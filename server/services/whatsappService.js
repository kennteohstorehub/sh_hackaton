const logger = require('../utils/logger');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const whatsappSecurity = require('../config/whatsapp-security');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.qrCode = null;
    this.conversationStates = new Map();
    this.sessionCount = 0;
    this.io = null;
    this.deviceInfo = null; // Store connected device information
    this.cleanupInterval = null;
    
    // Log whitelist status on initialization
    const securityInfo = whatsappSecurity.getWhitelistInfo();
    if (securityInfo.enforced) {
      logger.info('🔒 WhatsApp Security: Phone number whitelist is ENABLED');
      logger.info(`📱 Allowed numbers: ${securityInfo.allowedNumbers.join(', ')}`);
    } else {
      logger.warn('⚠️  WhatsApp Security: Phone number whitelist is DISABLED (production mode)');
    }
    
    // Start cleanup interval for conversation states
    this.startCleanupInterval();
  }

  /**
   * Security check: Verify if a phone number is allowed to receive messages
   * @param {string} phoneNumber - The phone number to check
   * @returns {boolean} - True if allowed, false if blocked
   */
  isPhoneNumberAllowed(phoneNumber) {
    const isAllowed = whatsappSecurity.isPhoneNumberAllowed(phoneNumber);

    if (!isAllowed) {
      const securityInfo = whatsappSecurity.getWhitelistInfo();
      logger.warn(`🚫 BLOCKED: Attempted to send WhatsApp message to unauthorized number: ${phoneNumber}`);
      logger.warn(`🔒 Only these numbers are allowed: ${securityInfo.allowedNumbers.join(', ')}`);
    }

    return isAllowed;
  }

  /**
   * Add a phone number to the whitelist (for testing purposes)
   * @param {string} phoneNumber - Phone number to add
   * @returns {boolean} - True if added successfully
   */
  addToWhitelist(phoneNumber) {
    const result = whatsappSecurity.addToWhitelist(phoneNumber);
    if (result) {
      logger.info(`📱 Added ${phoneNumber} to WhatsApp whitelist`);
    } else {
      logger.info(`📱 ${phoneNumber} is already in whitelist or whitelist is disabled`);
    }
    return result;
  }

  /**
   * Get current whitelist status and allowed numbers
   * @returns {object} - Whitelist information
   */
  getWhitelistInfo() {
    return whatsappSecurity.getWhitelistInfo();
  }

  async initialize(io = null) {
    try {
      this.io = io; // Store socket.io instance for real-time updates
      
      // Create WhatsApp client with local authentication
      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: 'smart-queue-manager'
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
            '--disable-gpu'
          ]
        }
      });

      // Set up event listeners
      this.setupEventListeners();
      
      // Initialize the client with timeout
      const initTimeout = setTimeout(() => {
        logger.error('WhatsApp initialization timeout - continuing without WhatsApp');
        this.client = null;
      }, 30000); // 30 second timeout
      
      await this.client.initialize();
      clearTimeout(initTimeout);
      
      logger.info('WhatsApp service initialized (real mode)');
      return true;
    } catch (error) {
      logger.error('Error initializing WhatsApp service:', error);
      // Don't throw - allow server to continue without WhatsApp
      this.client = null;
      return false;
    }
  }

  setupEventListeners() {
    // QR Code event - when QR code is generated
    this.client.on('qr', async (qr) => {
      this.qrCode = qr;
      logger.info('WhatsApp QR Code generated. Please scan with your phone.');
      
      // Display QR code in terminal
      qrcode.generate(qr, { small: true });
      
      try {
        // Generate QR code as data URL for web interface
        const qrDataURL = await QRCode.toDataURL(qr);
        
        // Emit to frontend if socket.io is available
        if (this.io) {
          this.io.emit('whatsapp-qr', { qr, qrDataURL });
        }
      } catch (error) {
        logger.error('Error generating QR code image:', error);
      }
    });

    // Ready event - when client is authenticated and ready
    this.client.on('ready', async () => {
      this.isConnected = true;
      this.sessionCount = 1;
      this.qrCode = null;
      
      try {
        // Get device information
        const info = this.client.info;
        this.deviceInfo = {
          phoneNumber: info.wid.user,
          deviceName: info.pushname || 'WhatsApp Device',
          platform: info.platform || 'Unknown',
          connectedAt: new Date().toISOString()
        };
        
        logger.info(`WhatsApp client is ready! Connected device: ${this.deviceInfo.phoneNumber} (${this.deviceInfo.deviceName})`);
      } catch (error) {
        logger.warn('Could not retrieve device info:', error.message);
        this.deviceInfo = {
          phoneNumber: 'Unknown',
          deviceName: 'WhatsApp Device',
          platform: 'Unknown',
          connectedAt: new Date().toISOString()
        };
        logger.info('WhatsApp client is ready!');
      }
      
      // Emit to frontend
      if (this.io) {
        this.io.emit('whatsapp-ready', { 
          isConnected: true,
          deviceInfo: this.deviceInfo
        });
      }
    });

    // Authentication success
    this.client.on('authenticated', () => {
      logger.info('WhatsApp client authenticated successfully');
    });

    // Authentication failure
    this.client.on('auth_failure', (msg) => {
      logger.error('WhatsApp authentication failed:', msg);
      this.isConnected = false;
      this.sessionCount = 0;
    });

    // Disconnected event
    this.client.on('disconnected', (reason) => {
      logger.info('WhatsApp client disconnected:', reason);
      this.isConnected = false;
      this.sessionCount = 0;
      this.deviceInfo = null; // Clear device info on disconnect
      
      if (this.io) {
        this.io.emit('whatsapp-disconnected', { reason });
      }
    });

    // Message received event
    this.client.on('message', async (message) => {
      try {
        await this.handleMessage(message);
      } catch (error) {
        logger.error('Error handling WhatsApp message:', error);
      }
    });

    // Error event
    this.client.on('error', (error) => {
      logger.error('WhatsApp client error:', error);
    });
  }

  async getQRCode() {
    if (this.isConnected) {
      // When connected, no QR code is needed
      return {
        qr: null,
        qrDataURL: null,
        isReady: true,
        message: 'WhatsApp is already connected'
      };
    } else if (this.qrCode) {
      try {
        // Generate QR code as data URL for web interface
        const qrDataURL = await QRCode.toDataURL(this.qrCode);
        
        return {
          qr: this.qrCode,
          qrDataURL: qrDataURL,
          isReady: false,
          message: 'Scan this QR code to connect WhatsApp'
        };
      } catch (error) {
        logger.error('Error generating QR code image:', error);
        return {
          qr: this.qrCode,
          qrDataURL: null,
          isReady: false,
          message: 'QR code available (check terminal)'
        };
      }
    } else {
      // Still initializing
      return {
        qr: null,
        qrDataURL: null,
        isReady: false,
        message: 'WhatsApp is initializing... Please wait for QR code.'
      };
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      isReady: this.isConnected,
      status: this.isConnected ? 'connected' : (this.qrCode ? 'waiting_for_scan' : 'initializing'),
      sessionCount: this.sessionCount,
      qrCode: this.isConnected ? null : (this.qrCode ? 'available' : 'generating'),
      deviceInfo: this.deviceInfo,
      hasQR: !!this.qrCode
    };
  }

  async getConnectionStatus() {
    return this.getStatus();
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.logout();
      }
      this.isConnected = false;
      this.sessionCount = 0;
      this.qrCode = null;
      this.deviceInfo = null; // Clear device info
      logger.info('WhatsApp service disconnected');
    } catch (error) {
      logger.error('Error disconnecting WhatsApp:', error);
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
      this.deviceInfo = null; // Clear device info
      logger.info('WhatsApp service destroyed');
    } catch (error) {
      logger.error('Error destroying WhatsApp:', error);
    }
  }

  async sendMessage(phoneNumber, message) {
    try {
      // SECURITY CHECK: Verify phone number is allowed
      if (!this.isPhoneNumberAllowed(phoneNumber)) {
        logger.error(`🚫 SECURITY BLOCK: Message to ${phoneNumber} was blocked by whitelist`);
        const securityInfo = whatsappSecurity.getWhitelistInfo();
        return { 
          success: false, 
          error: 'Phone number not authorized for testing',
          blocked: true,
          allowedNumbers: securityInfo.allowedNumbers
        };
      }

      if (!this.isConnected || !this.client) {
        logger.warn('WhatsApp client not connected. Cannot send message.');
        return { success: false, error: 'WhatsApp not connected' };
      }

      // Format phone number (ensure it includes country code)
      let formattedNumber = phoneNumber.replace(/\D/g, ''); // Remove non-digits
      
      // If number doesn't start with a country code, assume it's a local number
      // Common country codes: 1 (US/Canada), 60 (Malaysia), 65 (Singapore), 44 (UK), etc.
      const hasCountryCode = formattedNumber.length > 10 || 
                           formattedNumber.startsWith('1') || 
                           formattedNumber.startsWith('60') || 
                           formattedNumber.startsWith('65') ||
                           formattedNumber.startsWith('44') ||
                           formattedNumber.startsWith('86') ||
                           formattedNumber.startsWith('91');
      
      if (!hasCountryCode && formattedNumber.length <= 10) {
        // Default to Malaysia country code if no country code detected
        formattedNumber = '60' + formattedNumber;
      }
      
      const chatId = formattedNumber + '@c.us';
      
      // Send the message
      const sentMessage = await this.client.sendMessage(chatId, message);
      
      logger.info(`WhatsApp message sent to ${phoneNumber}: ${message}`);
      
      return { 
        success: true, 
        messageId: sentMessage?.id?._serialized || 'unknown',
        timestamp: sentMessage?.timestamp || Date.now()
      };
      
    } catch (error) {
      logger.error('Error sending WhatsApp message:', error);
      return { success: false, error: error.message };
    }
  }

  // Send templated notification
  async sendTemplatedNotification(phoneNumber, template, replacements) {
    try {
      let message = template;
      
      // Replace all placeholders in the template
      for (const [key, value] of Object.entries(replacements)) {
        const placeholder = `{${key}}`;
        message = message.replace(new RegExp(placeholder, 'g'), value);
      }
      
      return await this.sendMessage(phoneNumber, message);
    } catch (error) {
      logger.error('Error sending templated notification:', error);
      return { success: false, error: error.message };
    }
  }

  async handleMessage(message) {
    try {
      const contact = await message.getContact();
      const chat = await message.getChat();
      
      logger.info(`Received WhatsApp message from ${contact.number}: ${message.body}`);
      
      // Check if this person is actually in a queue before responding
      const isQueueCustomer = await this.isCustomerInQueue(contact.number);
      
      // Only process queue-related commands if the person is in a queue
      if (isQueueCustomer) {
        // Check for cancel queue keywords first
        const cancelResponse = await this.handleCancelQueue(message.body, contact.number);
        if (cancelResponse) {
          await message.reply(cancelResponse);
          logger.info(`Cancel queue response sent to ${contact.number}: ${cancelResponse}`);
          return; // Don't process other responses if cancel was handled
        }
        
        // Only auto-respond to queue customers
        const response = this.generateResponse(message.body, contact.number);
        if (response) {
          await message.reply(response);
          logger.info(`Auto-replied to queue customer ${contact.number}: ${response}`);
        }
      } else {
        // For non-queue customers, only respond to very specific queue-related commands
        const body = message.body.toLowerCase().trim();
        if (body === 'cancel' || body === 'help' || body === 'status') {
          const response = this.generateResponse(message.body, contact.number);
          if (response) {
            await message.reply(response);
            logger.info(`Responded to non-queue customer ${contact.number} for specific command: ${body}`);
          }
        } else {
          logger.info(`Ignoring message from non-queue customer ${contact.number}: ${message.body}`);
        }
      }
      
      // Emit to frontend for real-time message display
      if (this.io) {
        this.io.emit('whatsapp-message-received', {
          from: contact.number,
          name: contact.name || contact.pushname || 'Unknown',
          message: message.body,
          timestamp: message.timestamp
        });
      }
      
    } catch (error) {
      logger.error('Error handling WhatsApp message:', error);
    }
  }

  async handleCancelQueue(messageBody, phoneNumber) {
    const body = messageBody.toLowerCase().trim();
    
    try {
      // Import models here to avoid circular dependencies
      const Queue = require('../models/Queue');
      
      // First, check if this is a confirmation response (yes/no) for pending cancellation
      console.log(`[DEBUG] Checking for yes/no confirmation...`);
      if (body === 'yes' || body === 'y' || body === 'ya' || body === 'yeah') {
        console.log(`[DEBUG] Processing YES confirmation`);
        return await this.processCancellation(phoneNumber);
      } else if (body === 'no' || body === 'n' || body === 'nope') {
        console.log(`[DEBUG] Processing NO confirmation`);
        // Clear any pending cancellation
        if (this.conversationStates.has(phoneNumber)) {
          const state = this.conversationStates.get(phoneNumber);
          if (state.pendingCancellation) {
            delete state.pendingCancellation;
            return '👍 Cancellation cancelled. You remain in the queue. We\'ll notify you when it\'s your turn!';
          }
        }
        console.log(`[DEBUG] No pending cancellation found, returning null`);
        return null; // Not a cancellation response
      }
      console.log(`[DEBUG] Not a yes/no response, continuing...`);
      
      // Check for cancel keywords
      const cancelKeywords = ['cancel', 'leave', 'exit', 'remove', 'quit', 'stop'];
      const isCancelRequest = cancelKeywords.some(keyword => body.includes(keyword));
      
      console.log(`[DEBUG] Cancel keywords check: ${isCancelRequest}`);
      logger.info(`Cancel keywords check: ${isCancelRequest}`);
      
      if (!isCancelRequest) {
        console.log(`[DEBUG] Not a cancel request, returning null`);
        logger.info('Not a cancel request, returning null');
        return null; // Not a cancel request
      }
      
      logger.info(`Processing cancel request from phone: ${phoneNumber}`);
      
      // Try multiple phone number formats to match database entries
      const phoneFormats = [
        phoneNumber, // Original format (e.g., 60126368832)
        '+' + phoneNumber.replace(/\D/g, ''), // Add + prefix (e.g., +60126368832)
        phoneNumber.replace(/\D/g, ''), // Remove all non-digits
      ];
      
      // If the number doesn't start with country code, add Malaysia code
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      if (!cleanNumber.startsWith('60') && cleanNumber.length <= 10) {
        phoneFormats.push('60' + cleanNumber);
        phoneFormats.push('+60' + cleanNumber);
      }
      
      logger.info(`Trying phone formats: ${JSON.stringify(phoneFormats)}`);
      
      let queue = null;
      let customerEntry = null;
      
      // Try each phone format to find the customer
      for (const format of phoneFormats) {
        logger.info(`Searching for customer with phone format: ${format}`);
        
        queue = await Queue.findOne({
          'entries.customerPhone': format,
          'entries.status': 'waiting'
        });
        
        if (queue) {
          customerEntry = queue.entries.find(entry => 
            entry.customerPhone === format && entry.status === 'waiting'
          );
          if (customerEntry) {
            logger.info(`Found customer: ${customerEntry.customerName} with phone: ${format}`);
            break; // Found the customer
          }
        }
      }
      
      if (!queue || !customerEntry) {
        logger.info(`No waiting customer found for phone: ${phoneNumber}`);
        return '❌ You are not currently in any queue. If you believe this is an error, please contact our staff.';
      }
      
      // Store pending cancellation state
      this.updateConversationState(phoneNumber, {
        pendingCancellation: {
          queueId: queue._id,
          customerId: customerEntry.customerId,
          customerName: customerEntry.customerName,
          queueName: queue.name,
          position: customerEntry.position
        }
      });
      
      logger.info(`Stored pending cancellation for ${customerEntry.customerName}`);
      
      // Ask for confirmation
      return `🤔 Are you sure you want to leave the queue?\n\n📍 Queue: ${queue.name}\n👤 Name: ${customerEntry.customerName}\n🎫 Position: #${customerEntry.position}\n\n⚠️ If you leave, you'll lose your current position.\n\n💬 Reply with:\n• "YES" to confirm cancellation\n• "NO" to stay in queue`;
      
    } catch (error) {
      logger.error('Error handling cancel queue request:', error);
      return '❌ Sorry, there was an error processing your request. Please contact our staff for assistance.';
    }
  }

  async processCancellation(phoneNumber) {
    try {
      const Queue = require('../models/Queue');
      
      // Get pending cancellation from conversation state
      const conversationState = this.conversationStates.get(phoneNumber);
      if (!conversationState || !conversationState.pendingCancellation) {
        return '❌ No pending cancellation found. Please send "CANCEL" first to initiate cancellation.';
      }
      
      const { queueId, customerId, customerName, queueName } = conversationState.pendingCancellation;
      
      // Find and update the queue
      const queue = await Queue.findById(queueId);
      if (!queue) {
        return '❌ Queue not found. Please contact our staff for assistance.';
      }
      
      // Remove customer from queue
      const result = queue.removeCustomer(customerId, 'cancelled');
      
      if (result) {
        // Save the updated queue
        await queue.save();
        
        // Clear conversation state
        this.conversationStates.delete(phoneNumber);
        
        // Emit real-time update to dashboard
        if (this.io) {
          this.io.to(`merchant-${queue.merchantId}`).emit('queue-updated', {
            queueId: queue._id,
            action: 'customer-cancelled',
            customerId: customerId,
            queue: {
              ...queue.toObject(),
              currentLength: queue.entries.filter(e => e.status === 'waiting').length,
              nextPosition: queue.entries.filter(e => e.status === 'waiting').length + 1
            }
          });
        }
        
        logger.info(`Customer ${customerName} (${phoneNumber}) cancelled their queue position in ${queueName}`);
        
        return `✅ You have been successfully removed from the queue.\n\n📍 Queue: ${queueName}\n👤 Name: ${customerName}\n\nThank you for letting us know! You're welcome to join again anytime. 🙏`;
      } else {
        return '❌ Unable to remove you from the queue. Please contact our staff for assistance.';
      }
      
    } catch (error) {
      logger.error('Error processing cancellation:', error);
      return '❌ Sorry, there was an error processing your cancellation. Please contact our staff for assistance.';
    }
  }

  async isCustomerInQueue(phoneNumber) {
    try {
      const Queue = require('../models/Queue');
      
      // Check if phoneNumber is valid
      if (!phoneNumber) {
        logger.warn('isCustomerInQueue called with invalid phone number');
        return false;
      }
      
      // Try multiple phone number formats to match database entries
      const phoneFormats = [
        phoneNumber, // Original format (e.g., 60126368832)
        '+' + phoneNumber.replace(/\D/g, ''), // Add + prefix (e.g., +60126368832)
        phoneNumber.replace(/\D/g, ''), // Remove all non-digits
      ];
      
      // If the number doesn't start with country code, add Malaysia code
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      if (!cleanNumber.startsWith('60') && cleanNumber.length <= 10) {
        phoneFormats.push('60' + cleanNumber);
        phoneFormats.push('+60' + cleanNumber);
      }
      
      // Check if any phone format exists in any queue with waiting status
      for (const format of phoneFormats) {
        const queue = await Queue.findOne({
          'entries.customerPhone': format,
          'entries.status': 'waiting'
        });
        
        if (queue) {
          const customerEntry = queue.entries.find(entry => 
            entry.customerPhone === format && entry.status === 'waiting'
          );
          if (customerEntry) {
            return true; // Customer is in a queue
          }
        }
      }
      
      return false; // Customer is not in any queue
    } catch (error) {
      logger.error('Error checking if customer is in queue:', error);
      return false; // Default to false on error
    }
  }

  generateResponse(messageBody, phoneNumber) {
    const body = messageBody.toLowerCase().trim();
    
    // Only respond to very specific commands
    if (body === 'help') {
      return '🤖 Smart Queue Bot Commands:\n\n• Send "CANCEL" to leave the queue (requires confirmation)\n• Send "STATUS" to check your position\n• Send "HELP" to see this menu\n\nFor other assistance, please contact our staff.';
    }
    
    if (body === 'status') {
      return 'To check your queue status, I can see you are currently in our queue. We\'ll notify you when it\'s your turn!\n\n💡 Tip: Send "CANCEL" if you want to leave the queue (confirmation required).';
    }
    
    if (body === 'cancel') {
      return 'To cancel your queue position, please send "CANCEL" and I\'ll help you leave the queue.';
    }
    
    // Don't auto-respond to general messages anymore
    return null;
  }
  
  /**
   * Start cleanup interval to prevent memory leaks
   */
  startCleanupInterval() {
    // Clean up old conversation states every 30 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupConversationStates();
    }, 30 * 60 * 1000);
  }
  
  /**
   * Clean up old conversation states to prevent memory leaks
   */
  cleanupConversationStates() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let cleanedCount = 0;
    
    for (const [phoneNumber, state] of this.conversationStates) {
      // Check if state has a lastActivity timestamp, if not use current time
      const lastActivity = state.lastActivity || Date.now();
      
      if (lastActivity < oneHourAgo) {
        this.conversationStates.delete(phoneNumber);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} old conversation states`);
    }
  }
  
  /**
   * Update conversation state with activity timestamp
   */
  updateConversationState(phoneNumber, updates) {
    const existingState = this.conversationStates.get(phoneNumber) || {};
    this.conversationStates.set(phoneNumber, {
      ...existingState,
      ...updates,
      lastActivity: Date.now()
    });
  }
  
  /**
   * Clean up resources when shutting down
   */
  async cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.client) {
      await this.disconnect();
    }
    
    this.conversationStates.clear();
    logger.info('WhatsApp service cleanup completed');
  }
}

module.exports = new WhatsAppService(); 