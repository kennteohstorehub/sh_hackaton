const { Client, LocalAuth } = require('whatsapp-web.js');
const logger = require('../utils/logger');
const Queue = require('../models/Queue');
const Merchant = require('../models/Merchant');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.io = null;
    this.isReady = false;
  }

  async initialize(io) {
    this.io = io;
    
    try {
      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: process.env.WHATSAPP_SESSION_PATH || './whatsapp-session'
        }),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });

      this.setupEventHandlers();
      await this.client.initialize();
      
    } catch (error) {
      logger.error('WhatsApp service initialization error:', error);
    }
  }

  setupEventHandlers() {
    this.client.on('qr', (qr) => {
      logger.info('WhatsApp QR Code received');
      // Emit QR code to dashboard for scanning
      this.io.emit('whatsapp-qr', qr);
    });

    this.client.on('ready', () => {
      logger.info('WhatsApp client is ready');
      this.isReady = true;
      this.io.emit('whatsapp-ready');
    });

    this.client.on('authenticated', () => {
      logger.info('WhatsApp client authenticated');
      this.io.emit('whatsapp-authenticated');
    });

    this.client.on('auth_failure', (msg) => {
      logger.error('WhatsApp authentication failed:', msg);
      this.io.emit('whatsapp-auth-failure', msg);
    });

    this.client.on('disconnected', (reason) => {
      logger.warn('WhatsApp client disconnected:', reason);
      this.isReady = false;
      this.io.emit('whatsapp-disconnected', reason);
    });

    this.client.on('message', async (message) => {
      await this.handleIncomingMessage(message);
    });
  }

  async handleIncomingMessage(message) {
    try {
      if (message.from === 'status@broadcast') return; // Ignore status updates
      
      const contact = await message.getContact();
      const customerPhone = contact.number;
      const customerName = contact.pushname || contact.name || 'Unknown';
      const messageText = message.body.toLowerCase().trim();

      logger.info(`WhatsApp message from ${customerName} (${customerPhone}): ${messageText}`);

      // Find merchant by phone number (you'll need to implement this logic)
      // For now, we'll use a simple approach
      const merchant = await this.findMerchantByWhatsAppNumber(customerPhone);
      
      if (!merchant) {
        await message.reply('Sorry, I could not identify your business. Please contact support.');
        return;
      }

      // Handle different message types
      if (messageText.includes('join') || messageText.includes('queue')) {
        await this.handleJoinQueueRequest(message, merchant, customerPhone, customerName);
      } else if (messageText.includes('status') || messageText.includes('position')) {
        await this.handleStatusRequest(message, merchant, customerPhone);
      } else if (messageText.includes('cancel') || messageText.includes('leave')) {
        await this.handleCancelRequest(message, merchant, customerPhone);
      } else if (messageText.includes('help') || messageText === 'hi' || messageText === 'hello') {
        await this.handleHelpRequest(message, merchant);
      } else {
        await this.handleUnknownMessage(message, merchant);
      }

    } catch (error) {
      logger.error('Error handling WhatsApp message:', error);
      await message.reply('Sorry, an error occurred. Please try again later.');
    }
  }

  async handleJoinQueueRequest(message, merchant, customerPhone, customerName) {
    try {
      // Get active queues for the merchant
      const queues = await Queue.find({ merchantId: merchant._id, isActive: true });
      
      if (queues.length === 0) {
        await message.reply('Sorry, there are no active queues at the moment. Please try again later.');
        return;
      }

      if (queues.length === 1) {
        // Auto-join the only available queue
        const queue = queues[0];
        const customerId = `wa_${customerPhone}_${Date.now()}`;
        
        // Check if customer is already in queue
        const existingCustomer = queue.getCustomer(customerId);
        if (existingCustomer && existingCustomer.status === 'waiting') {
          await message.reply(`You are already in the queue for ${queue.name}. Your position is ${existingCustomer.position}. Estimated wait time: ${existingCustomer.estimatedWaitTime} minutes.`);
          return;
        }

        // Add customer to queue
        const newEntry = queue.addCustomer({
          customerId,
          customerName,
          customerPhone,
          platform: 'whatsapp',
          serviceType: queue.name
        });

        await queue.save();

        // Send confirmation
        await message.reply(`✅ You've been added to the queue for ${queue.name}!\n\n📍 Position: ${newEntry.position}\n⏱️ Estimated wait time: ${newEntry.estimatedWaitTime} minutes\n\nWe'll notify you when it's your turn. Reply "status" to check your position anytime.`);

        // Emit real-time update
        this.io.to(`merchant-${merchant._id}`).emit('queue-updated', {
          queueId: queue._id,
          action: 'customer-joined',
          customer: newEntry
        });

      } else {
        // Multiple queues - ask customer to choose
        let queueList = 'Please choose a queue by replying with the number:\n\n';
        queues.forEach((queue, index) => {
          queueList += `${index + 1}. ${queue.name} (${queue.currentLength} waiting, ~${queue.calculateEstimatedWaitTime(queue.nextPosition)} min wait)\n`;
        });
        
        await message.reply(queueList);
        
        // Store context for next message (you'd implement this with a session store)
        // For now, we'll keep it simple
      }

    } catch (error) {
      logger.error('Error handling join queue request:', error);
      await message.reply('Sorry, an error occurred while joining the queue. Please try again.');
    }
  }

  async handleStatusRequest(message, merchant, customerPhone) {
    try {
      // Find customer in any queue
      const queues = await Queue.find({ merchantId: merchant._id });
      let customerFound = false;

      for (const queue of queues) {
        const customer = queue.entries.find(entry => 
          entry.customerPhone === customerPhone && 
          entry.status === 'waiting'
        );

        if (customer) {
          customerFound = true;
          const waitingCustomers = queue.entries
            .filter(entry => entry.status === 'waiting')
            .sort((a, b) => a.position - b.position);
          
          const currentPosition = waitingCustomers.findIndex(entry => entry.customerId === customer.customerId) + 1;
          
          await message.reply(`📊 Queue Status for ${queue.name}:\n\n📍 Your position: ${currentPosition}\n⏱️ Estimated wait time: ${customer.estimatedWaitTime} minutes\n👥 People ahead of you: ${currentPosition - 1}\n\nWe'll notify you when it's your turn!`);
          break;
        }
      }

      if (!customerFound) {
        await message.reply('You are not currently in any queue. Reply "join" to join a queue.');
      }

    } catch (error) {
      logger.error('Error handling status request:', error);
      await message.reply('Sorry, an error occurred while checking your status. Please try again.');
    }
  }

  async handleCancelRequest(message, merchant, customerPhone) {
    try {
      // Find and remove customer from queue
      const queues = await Queue.find({ merchantId: merchant._id });
      let customerFound = false;

      for (const queue of queues) {
        const customerIndex = queue.entries.findIndex(entry => 
          entry.customerPhone === customerPhone && 
          entry.status === 'waiting'
        );

        if (customerIndex !== -1) {
          customerFound = true;
          const customer = queue.entries[customerIndex];
          
          queue.removeCustomer(customer.customerId, 'cancelled');
          await queue.save();

          await message.reply(`❌ You have been removed from the queue for ${queue.name}. Thank you for using our service!`);

          // Emit real-time update
          this.io.to(`merchant-${merchant._id}`).emit('queue-updated', {
            queueId: queue._id,
            action: 'customer-cancelled',
            customerId: customer.customerId
          });
          
          break;
        }
      }

      if (!customerFound) {
        await message.reply('You are not currently in any queue.');
      }

    } catch (error) {
      logger.error('Error handling cancel request:', error);
      await message.reply('Sorry, an error occurred while cancelling. Please try again.');
    }
  }

  async handleHelpRequest(message, merchant) {
    const helpText = `👋 Welcome to ${merchant.businessName}!\n\nHere's what you can do:\n\n🔹 Reply "join" to join a queue\n🔹 Reply "status" to check your position\n🔹 Reply "cancel" to leave the queue\n🔹 Reply "help" to see this message again\n\nWe're here to make your wait more convenient!`;
    
    await message.reply(helpText);
  }

  async handleUnknownMessage(message, merchant) {
    await message.reply(`I didn't understand that. Reply "help" to see available commands, or "join" to join a queue at ${merchant.businessName}.`);
  }

  async findMerchantByWhatsAppNumber(customerPhone) {
    // This is a simplified implementation
    // In a real scenario, you'd have a more sophisticated way to map phone numbers to merchants
    // For now, return the first merchant with WhatsApp enabled
    return await Merchant.findOne({ 
      'integrations.whatsapp.enabled': true,
      isActive: true 
    });
  }

  async sendMessage(phoneNumber, message) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const chatId = `${phoneNumber}@c.us`;
      await this.client.sendMessage(chatId, message);
      logger.info(`WhatsApp message sent to ${phoneNumber}`);
    } catch (error) {
      logger.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  async notifyCustomer(customerPhone, message) {
    try {
      await this.sendMessage(customerPhone, message);
    } catch (error) {
      logger.error('Error notifying customer via WhatsApp:', error);
    }
  }

  isClientReady() {
    return this.isReady;
  }
}

module.exports = new WhatsAppService(); 