const logger = require('../utils/logger');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const whatsappSecurity = require('../config/whatsapp-security');
const Queue = require('../models/Queue');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.qrCode = null;
    this.conversationStates = new Map();
    this.sessionCount = 0;
    this.io = null;
    this.deviceInfo = null;
    this.cleanupInterval = null;
    
    // Performance improvements
    this.messageQueue = [];
    this.isProcessingQueue = false;
    this.queueProcessInterval = null;
    this.rateLimitWindow = new Map(); // Track messages per phone number
    this.phoneNumberCache = new Map(); // Cache phone number lookups
    this.cacheCleanupInterval = null;
    
    // Configuration
    this.config = {
      maxQueueSize: 1000,
      messageProcessInterval: 100, // ms between messages
      rateLimitPerMinute: 30,
      cacheExpiryTime: 10 * 60 * 1000, // 10 minutes
      maxRetries: 3,
      retryDelay: 5000, // 5 seconds
      conversationStateExpiry: 60 * 60 * 1000, // 1 hour
    };
    
    // Initialize intervals
    this.startCleanupInterval();
    this.startQueueProcessor();
    this.startCacheCleanup();
    
    // Log whitelist status
    const securityInfo = whatsappSecurity.getWhitelistInfo();
    if (securityInfo.enforced) {
      logger.info('🔒 WhatsApp Security: Phone number whitelist is ENABLED');
      logger.info(`📱 Allowed numbers: ${securityInfo.allowedNumbers.join(', ')}`);
    } else {
      logger.warn('⚠️  WhatsApp Security: Phone number whitelist is DISABLED (production mode)');
    }
  }

  async initialize(io = null) {
    try {
      this.io = io;
      
      // Optimized Puppeteer configuration
      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: 'smart-queue-manager',
          dataPath: '.wwebjs_auth' // Specify data path for better session management
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-blink-features=AutomationControlled',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--metrics-recording-only',
            '--mute-audio',
            '--no-default-browser-check',
            '--safebrowsing-disable-auto-update',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--ignore-certificate-errors-spki-list'
          ],
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH // Allow custom Chrome path
        },
        qrMaxRetries: 5,
        takeoverOnConflict: true,
        takeoverTimeoutMs: 0
      });

      this.setupEventListeners();
      await this.client.initialize();
      
      logger.info('WhatsApp service initialized with performance optimizations');
      return true;
    } catch (error) {
      logger.error('Error initializing WhatsApp service:', error);
      throw error;
    }
  }

  setupEventListeners() {
    // QR Code event
    this.client.on('qr', async (qr) => {
      this.qrCode = qr;
      logger.info('WhatsApp QR Code generated');
      
      qrcode.generate(qr, { small: true });
      
      try {
        const qrDataURL = await QRCode.toDataURL(qr);
        if (this.io) {
          this.io.emit('whatsapp-qr', { qr, qrDataURL });
        }
      } catch (error) {
        logger.error('Error generating QR code image:', error);
      }
    });

    // Ready event
    this.client.on('ready', async () => {
      this.isConnected = true;
      this.sessionCount = 1;
      this.qrCode = null;
      
      try {
        const info = this.client.info;
        this.deviceInfo = {
          phoneNumber: info.wid.user,
          deviceName: info.pushname || 'WhatsApp Device',
          platform: info.platform || 'Unknown',
          connectedAt: new Date().toISOString()
        };
        logger.info(`WhatsApp connected: ${this.deviceInfo.phoneNumber}`);
      } catch (error) {
        logger.warn('Could not retrieve device info:', error.message);
      }
      
      if (this.io) {
        this.io.emit('whatsapp-ready', { 
          isConnected: true,
          deviceInfo: this.deviceInfo
        });
      }
    });

    // Other events
    this.client.on('authenticated', () => {
      logger.info('WhatsApp authenticated');
    });

    this.client.on('auth_failure', (msg) => {
      logger.error('WhatsApp auth failed:', msg);
      this.isConnected = false;
      this.sessionCount = 0;
    });

    this.client.on('disconnected', (reason) => {
      logger.info('WhatsApp disconnected:', reason);
      this.isConnected = false;
      this.sessionCount = 0;
      this.deviceInfo = null;
      
      if (this.io) {
        this.io.emit('whatsapp-disconnected', { reason });
      }
      
      // Auto-reconnect after 10 seconds
      setTimeout(() => {
        if (!this.isConnected) {
          logger.info('Attempting WhatsApp reconnection...');
          this.client.initialize().catch(err => 
            logger.error('WhatsApp reconnection failed:', err)
          );
        }
      }, 10000);
    });

    // Message handler with rate limiting
    this.client.on('message', async (message) => {
      try {
        await this.handleMessage(message);
      } catch (error) {
        logger.error('Error handling message:', error);
      }
    });

    this.client.on('error', (error) => {
      logger.error('WhatsApp error:', error);
    });
  }

  // Message queue processor
  startQueueProcessor() {
    this.queueProcessInterval = setInterval(async () => {
      if (!this.isProcessingQueue && this.messageQueue.length > 0) {
        this.isProcessingQueue = true;
        await this.processMessageQueue();
        this.isProcessingQueue = false;
      }
    }, this.config.messageProcessInterval);
  }

  async processMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      
      try {
        // Check rate limit
        if (this.isRateLimited(message.phoneNumber)) {
          // Re-queue the message with delay
          setTimeout(() => {
            this.messageQueue.push(message);
          }, 60000); // Retry after 1 minute
          continue;
        }
        
        // Send message with retry logic
        await this.sendMessageWithRetry(message);
        
        // Update rate limit tracking
        this.updateRateLimit(message.phoneNumber);
        
        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        logger.error('Error processing message from queue:', error);
        
        // Handle retry logic
        if (message.retries < this.config.maxRetries) {
          message.retries++;
          setTimeout(() => {
            this.messageQueue.push(message);
          }, this.config.retryDelay * message.retries);
        } else {
          logger.error(`Failed to send message after ${this.config.maxRetries} retries:`, message);
        }
      }
    }
  }

  async sendMessageWithRetry(messageData) {
    const { phoneNumber, message, retries = 0 } = messageData;
    
    try {
      // Security check
      if (!this.isPhoneNumberAllowed(phoneNumber)) {
        throw new Error('Phone number not authorized');
      }
      
      if (!this.isConnected || !this.client) {
        throw new Error('WhatsApp not connected');
      }
      
      // Format phone number
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      const chatId = formattedNumber + '@c.us';
      
      // Send message
      const sentMessage = await this.client.sendMessage(chatId, message);
      
      logger.info(`Message sent to ${phoneNumber}`);
      
      return { 
        success: true, 
        messageId: sentMessage.id._serialized,
        timestamp: sentMessage.timestamp
      };
      
    } catch (error) {
      logger.error(`Error sending message (attempt ${retries + 1}):`, error);
      throw error;
    }
  }

  // Improved send message with queue
  async sendMessage(phoneNumber, message) {
    try {
      // Add to queue instead of sending directly
      if (this.messageQueue.length >= this.config.maxQueueSize) {
        throw new Error('Message queue is full');
      }
      
      this.messageQueue.push({
        phoneNumber,
        message,
        retries: 0,
        timestamp: Date.now()
      });
      
      return { 
        success: true, 
        queued: true,
        queuePosition: this.messageQueue.length
      };
      
    } catch (error) {
      logger.error('Error queueing message:', error);
      return { success: false, error: error.message };
    }
  }

  // Send message immediately (bypass queue)
  async sendMessageImmediate(phoneNumber, message) {
    return await this.sendMessageWithRetry({ phoneNumber, message, retries: 0 });
  }

  // Enhanced templated notification
  async sendTemplatedNotification(phoneNumber, template, replacements) {
    try {
      let message = template;
      
      // Batch replace all placeholders
      const replacementRegex = new RegExp(
        Object.keys(replacements).map(key => `{${key}}`).join('|'), 
        'g'
      );
      
      message = message.replace(replacementRegex, (match) => {
        const key = match.slice(1, -1); // Remove { }
        return replacements[key] || match;
      });
      
      return await this.sendMessage(phoneNumber, message);
    } catch (error) {
      logger.error('Error sending templated notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Batch send messages
  async sendBatchMessages(messages) {
    const results = [];
    
    // Add all messages to queue
    for (const { phoneNumber, message } of messages) {
      try {
        const result = await this.sendMessage(phoneNumber, message);
        results.push({ phoneNumber, ...result });
      } catch (error) {
        results.push({ phoneNumber, success: false, error: error.message });
      }
    }
    
    return results;
  }

  // Rate limiting
  isRateLimited(phoneNumber) {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window
    
    if (!this.rateLimitWindow.has(phoneNumber)) {
      this.rateLimitWindow.set(phoneNumber, []);
    }
    
    const timestamps = this.rateLimitWindow.get(phoneNumber);
    const recentMessages = timestamps.filter(t => t > windowStart);
    
    this.rateLimitWindow.set(phoneNumber, recentMessages);
    
    return recentMessages.length >= this.config.rateLimitPerMinute;
  }

  updateRateLimit(phoneNumber) {
    if (!this.rateLimitWindow.has(phoneNumber)) {
      this.rateLimitWindow.set(phoneNumber, []);
    }
    
    this.rateLimitWindow.get(phoneNumber).push(Date.now());
  }

  // Optimized phone number formatting
  formatPhoneNumber(phoneNumber) {
    // Check cache first
    if (this.phoneNumberCache.has(phoneNumber)) {
      const cached = this.phoneNumberCache.get(phoneNumber);
      if (Date.now() - cached.timestamp < this.config.cacheExpiryTime) {
        return cached.formatted;
      }
    }
    
    let formattedNumber = phoneNumber.replace(/\D/g, '');
    
    // Country code detection with more patterns
    const countryPatterns = [
      { prefix: '1', minLength: 10 },    // US/Canada
      { prefix: '60', minLength: 9 },    // Malaysia
      { prefix: '65', minLength: 8 },    // Singapore
      { prefix: '44', minLength: 10 },   // UK
      { prefix: '86', minLength: 11 },   // China
      { prefix: '91', minLength: 10 },   // India
      { prefix: '62', minLength: 10 },   // Indonesia
      { prefix: '63', minLength: 10 },   // Philippines
      { prefix: '66', minLength: 9 },    // Thailand
      { prefix: '84', minLength: 9 },    // Vietnam
    ];
    
    // Check if already has country code
    const hasCountryCode = countryPatterns.some(({ prefix }) => 
      formattedNumber.startsWith(prefix)
    );
    
    // Add default country code if needed (Malaysia)
    if (!hasCountryCode && formattedNumber.length <= 10) {
      formattedNumber = '60' + formattedNumber;
    }
    
    // Cache the result
    this.phoneNumberCache.set(phoneNumber, {
      formatted: formattedNumber,
      timestamp: Date.now()
    });
    
    return formattedNumber;
  }

  // Optimized customer lookup
  async isCustomerInQueue(phoneNumber) {
    try {
      // Check cache first
      const cacheKey = `queue_${phoneNumber}`;
      if (this.phoneNumberCache.has(cacheKey)) {
        const cached = this.phoneNumberCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 30000) { // 30 second cache
          return cached.isInQueue;
        }
      }
      
      // Format phone number once
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      // Create all possible formats
      const phoneFormats = [
        formattedNumber,
        '+' + formattedNumber,
        phoneNumber // Original
      ];
      
      // Single database query with all formats
      const queue = await Queue.findOne({
        'entries.customerPhone': { $in: phoneFormats },
        'entries.status': 'waiting'
      });
      
      const isInQueue = !!queue;
      
      // Cache result
      this.phoneNumberCache.set(cacheKey, {
        isInQueue,
        timestamp: Date.now()
      });
      
      return isInQueue;
      
    } catch (error) {
      logger.error('Error checking queue status:', error);
      return false;
    }
  }

  // Enhanced cancel handling
  async handleCancelQueue(messageBody, phoneNumber) {
    const body = messageBody.toLowerCase().trim();
    
    try {
      // Check for confirmation response
      if (['yes', 'y', 'ya', 'yeah'].includes(body)) {
        return await this.processCancellation(phoneNumber);
      } else if (['no', 'n', 'nope'].includes(body)) {
        const state = this.conversationStates.get(phoneNumber);
        if (state?.pendingCancellation) {
          delete state.pendingCancellation;
          return '👍 Cancellation cancelled. You remain in the queue!';
        }
        return null;
      }
      
      // Check for cancel keywords
      const cancelKeywords = ['cancel', 'leave', 'exit', 'remove', 'quit', 'stop'];
      if (!cancelKeywords.some(keyword => body.includes(keyword))) {
        return null;
      }
      
      // Optimized customer lookup
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      const phoneFormats = [
        formattedNumber,
        '+' + formattedNumber,
        phoneNumber
      ];
      
      // Single query to find customer
      const queue = await Queue.findOne({
        'entries.customerPhone': { $in: phoneFormats },
        'entries.status': 'waiting'
      });
      
      if (!queue) {
        return '❌ You are not currently in any queue.';
      }
      
      const customerEntry = queue.entries.find(entry => 
        phoneFormats.includes(entry.customerPhone) && entry.status === 'waiting'
      );
      
      if (!customerEntry) {
        return '❌ You are not currently in any queue.';
      }
      
      // Store pending cancellation
      this.updateConversationState(phoneNumber, {
        pendingCancellation: {
          queueId: queue._id,
          customerId: customerEntry.customerId,
          customerName: customerEntry.customerName,
          queueName: queue.name,
          position: customerEntry.position
        }
      });
      
      return `🤔 Are you sure you want to leave?\n\n📍 ${queue.name}\n👤 ${customerEntry.customerName}\n🎫 Position: #${customerEntry.position}\n\nReply YES to confirm or NO to stay`;
      
    } catch (error) {
      logger.error('Error handling cancel:', error);
      return '❌ Error processing request. Please contact staff.';
    }
  }

  // Cleanup methods
  startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupConversationStates();
      this.cleanupRateLimitWindow();
    }, 30 * 60 * 1000); // 30 minutes
  }

  startCacheCleanup() {
    this.cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      
      // Clean phone number cache
      for (const [key, value] of this.phoneNumberCache) {
        if (now - value.timestamp > this.config.cacheExpiryTime) {
          this.phoneNumberCache.delete(key);
        }
      }
      
      // Clean old messages from queue
      this.messageQueue = this.messageQueue.filter(msg => 
        now - msg.timestamp < 3600000 // Keep messages less than 1 hour old
      );
      
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  cleanupConversationStates() {
    const expiredTime = Date.now() - this.config.conversationStateExpiry;
    let cleaned = 0;
    
    for (const [phoneNumber, state] of this.conversationStates) {
      if ((state.lastActivity || 0) < expiredTime) {
        this.conversationStates.delete(phoneNumber);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Cleaned ${cleaned} expired conversation states`);
    }
  }

  cleanupRateLimitWindow() {
    const windowStart = Date.now() - 60000;
    
    for (const [phoneNumber, timestamps] of this.rateLimitWindow) {
      const recent = timestamps.filter(t => t > windowStart);
      if (recent.length === 0) {
        this.rateLimitWindow.delete(phoneNumber);
      } else {
        this.rateLimitWindow.set(phoneNumber, recent);
      }
    }
  }

  updateConversationState(phoneNumber, updates) {
    const existing = this.conversationStates.get(phoneNumber) || {};
    this.conversationStates.set(phoneNumber, {
      ...existing,
      ...updates,
      lastActivity: Date.now()
    });
  }

  // Status and monitoring
  getStatus() {
    return {
      isConnected: this.isConnected,
      isReady: this.isConnected,
      status: this.isConnected ? 'connected' : (this.qrCode ? 'waiting_for_scan' : 'initializing'),
      sessionCount: this.sessionCount,
      deviceInfo: this.deviceInfo,
      performance: {
        queueLength: this.messageQueue.length,
        cacheSize: this.phoneNumberCache.size,
        conversationStates: this.conversationStates.size,
        rateLimitTracking: this.rateLimitWindow.size
      }
    };
  }

  async getQRCode() {
    if (this.isConnected) {
      return {
        qr: null,
        qrDataURL: null,
        isReady: true,
        message: 'WhatsApp is already connected'
      };
    } else if (this.qrCode) {
      try {
        const qrDataURL = await QRCode.toDataURL(this.qrCode);
        return {
          qr: this.qrCode,
          qrDataURL,
          isReady: false,
          message: 'Scan this QR code with WhatsApp'
        };
      } catch (error) {
        logger.error('Error generating QR code:', error);
        return {
          qr: this.qrCode,
          qrDataURL: null,
          isReady: false,
          message: 'QR code available'
        };
      }
    } else {
      return {
        qr: null,
        qrDataURL: null,
        isReady: false,
        message: 'WhatsApp is initializing...'
      };
    }
  }

  // Security methods
  isPhoneNumberAllowed(phoneNumber) {
    const isAllowed = whatsappSecurity.isPhoneNumberAllowed(phoneNumber);
    if (!isAllowed) {
      const securityInfo = whatsappSecurity.getWhitelistInfo();
      logger.warn(`🚫 Blocked message to: ${phoneNumber}`);
      logger.warn(`Allowed: ${securityInfo.allowedNumbers.join(', ')}`);
    }
    return isAllowed;
  }

  addToWhitelist(phoneNumber) {
    const result = whatsappSecurity.addToWhitelist(phoneNumber);
    if (result) {
      logger.info(`Added ${phoneNumber} to whitelist`);
    }
    return result;
  }

  getWhitelistInfo() {
    return whatsappSecurity.getWhitelistInfo();
  }

  // Cleanup
  async cleanup() {
    // Clear intervals
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.queueProcessInterval) clearInterval(this.queueProcessInterval);
    if (this.cacheCleanupInterval) clearInterval(this.cacheCleanupInterval);
    
    // Clear data structures
    this.messageQueue = [];
    this.conversationStates.clear();
    this.phoneNumberCache.clear();
    this.rateLimitWindow.clear();
    
    // Disconnect client
    if (this.client) {
      await this.destroy();
    }
    
    logger.info('WhatsApp service cleanup completed');
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.logout();
      }
      this.isConnected = false;
      this.sessionCount = 0;
      this.qrCode = null;
      this.deviceInfo = null;
      logger.info('WhatsApp disconnected');
    } catch (error) {
      logger.error('Error disconnecting:', error);
    }
  }

  async destroy() {
    try {
      if (this.client) {
        await this.client.destroy();
      }
      this.isConnected = false;
      this.sessionCount = 0;
      this.qrCode = null;
      this.deviceInfo = null;
      logger.info('WhatsApp destroyed');
    } catch (error) {
      logger.error('Error destroying:', error);
    }
  }

  // Handle incoming messages
  async handleMessage(message) {
    try {
      const contact = await message.getContact();
      const phoneNumber = contact.number || contact.id._serialized.split('@')[0];
      
      logger.info(`Message from ${phoneNumber}: ${message.body}`);
      
      // Check if customer is in queue (with caching)
      const isQueueCustomer = await this.isCustomerInQueue(phoneNumber);
      
      if (isQueueCustomer) {
        // Handle cancel request
        const cancelResponse = await this.handleCancelQueue(message.body, phoneNumber);
        if (cancelResponse) {
          await message.reply(cancelResponse);
          return;
        }
        
        // Generate response
        const response = this.generateResponse(message.body, phoneNumber);
        if (response) {
          await message.reply(response);
        }
      } else {
        // Handle specific commands for non-queue customers
        const body = message.body.toLowerCase().trim();
        if (['cancel', 'help', 'status'].includes(body)) {
          const response = this.generateResponse(message.body, phoneNumber);
          if (response) {
            await message.reply(response);
          }
        }
      }
      
      // Emit to frontend
      if (this.io) {
        this.io.emit('whatsapp-message-received', {
          from: phoneNumber,
          name: contact.name || contact.pushname || 'Unknown',
          message: message.body,
          timestamp: message.timestamp
        });
      }
      
    } catch (error) {
      logger.error('Error handling message:', error);
    }
  }

  generateResponse(messageBody, phoneNumber) {
    const body = messageBody.toLowerCase().trim();
    
    const responses = {
      'help': '🤖 Commands:\n• CANCEL - Leave queue\n• STATUS - Check position\n• HELP - Show this menu',
      'status': 'You are in the queue. We\'ll notify you when ready!\n💡 Send "CANCEL" to leave.',
      'cancel': 'Send "CANCEL" to leave the queue.'
    };
    
    return responses[body] || null;
  }

  async processCancellation(phoneNumber) {
    try {
      const state = this.conversationStates.get(phoneNumber);
      if (!state?.pendingCancellation) {
        return '❌ No pending cancellation. Send "CANCEL" first.';
      }
      
      const { queueId, customerId, customerName, queueName } = state.pendingCancellation;
      
      const queue = await Queue.findById(queueId);
      if (!queue) {
        return '❌ Queue not found.';
      }
      
      const result = await queue.removeCustomer(customerId, 'cancelled');
      if (result) {
        await queue.save();
        this.conversationStates.delete(phoneNumber);
        
        if (this.io) {
          this.io.to(`merchant-${queue.merchantId}`).emit('queue-updated', {
            queueId: queue._id,
            action: 'customer-cancelled',
            customerId
          });
        }
        
        return `✅ Removed from queue\n\n📍 ${queueName}\n👤 ${customerName}\n\nThank you! 🙏`;
      }
      
      return '❌ Unable to remove from queue.';
      
    } catch (error) {
      logger.error('Error processing cancellation:', error);
      return '❌ Error processing cancellation.';
    }
  }
}

module.exports = new WhatsAppService();