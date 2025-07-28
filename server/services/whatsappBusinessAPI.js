const logger = require('../utils/logger');
const queueService = require('./queueService');
const prisma = require('../utils/prisma');

/**
 * WhatsApp Business API Service
 * 
 * This service provides a commercial-grade WhatsApp integration using the official
 * WhatsApp Business API. It supports multiple providers:
 * - WhatsApp Cloud API (Meta)
 * - Twilio WhatsApp Business API
 * - Other BSPs (Business Solution Providers)
 * 
 * For commercial use, you must:
 * 1. Register with Meta Business Manager
 * 2. Get WhatsApp Business API access
 * 3. Get message templates approved
 * 4. Use a verified business phone number
 */
class WhatsAppBusinessAPIService {
  constructor() {
    this.provider = process.env.WHATSAPP_PROVIDER || 'twilio'; // 'twilio', 'meta', 'messagebird'
    this.isInitialized = false;
    this.client = null;
    this.config = {};
    this.messageTemplates = new Map();
  }

  async initialize() {
    try {
      switch (this.provider) {
        case 'twilio':
          await this.initializeTwilio();
          break;
        case 'meta':
          await this.initializeMetaCloudAPI();
          break;
        case 'messagebird':
          await this.initializeMessageBird();
          break;
        default:
          logger.warn(`Unknown WhatsApp provider: ${this.provider}`);
          return;
      }

      // Load approved message templates
      await this.loadMessageTemplates();
      
      this.isInitialized = true;
      logger.info(`✅ WhatsApp Business API initialized with provider: ${this.provider}`);
    } catch (error) {
      logger.error('Failed to initialize WhatsApp Business API:', error);
      this.isInitialized = false;
    }
  }

  async initializeTwilio() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Missing Twilio credentials');
    }

    const twilio = require('twilio');
    this.client = twilio(accountSid, authToken);
    this.config = {
      fromNumber: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
      provider: 'twilio'
    };
  }

  async initializeMetaCloudAPI() {
    const accessToken = process.env.META_ACCESS_TOKEN;
    const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    const businessAccountId = process.env.META_BUSINESS_ACCOUNT_ID;

    if (!accessToken || !phoneNumberId) {
      throw new Error('Missing Meta WhatsApp credentials');
    }

    // Meta Cloud API configuration
    this.config = {
      accessToken,
      phoneNumberId,
      businessAccountId,
      apiUrl: 'https://graph.facebook.com/v18.0',
      provider: 'meta'
    };
  }

  async initializeMessageBird() {
    const accessKey = process.env.MESSAGEBIRD_ACCESS_KEY;
    const channelId = process.env.MESSAGEBIRD_CHANNEL_ID;

    if (!accessKey || !channelId) {
      throw new Error('Missing MessageBird credentials');
    }

    const messagebird = require('messagebird')(accessKey);
    this.client = messagebird;
    this.config = {
      channelId,
      provider: 'messagebird'
    };
  }

  /**
   * Load approved message templates from the provider
   * Templates must be pre-approved by WhatsApp
   */
  async loadMessageTemplates() {
    // In production, these would be fetched from the provider's API
    // For now, we'll use a static set of common templates
    
    this.messageTemplates.set('queue_joined', {
      name: 'queue_joined',
      language: 'en',
      components: [
        {
          type: 'body',
          text: 'Welcome to {{1}}! Your queue number is {{2}}. Current position: {{3}}. Estimated wait: {{4}} minutes. Reply CANCEL to leave the queue.'
        }
      ]
    });

    this.messageTemplates.set('queue_ready', {
      name: 'queue_ready',
      language: 'en',
      components: [
        {
          type: 'body',
          text: 'It\'s your turn at {{1}}! Queue number {{2}}. Please proceed to the counter now. Thank you for your patience!'
        }
      ]
    });

    this.messageTemplates.set('queue_cancelled', {
      name: 'queue_cancelled',
      language: 'en',
      components: [
        {
          type: 'body',
          text: 'Your queue entry at {{1}} has been cancelled. We hope to serve you again soon!'
        }
      ]
    });

    logger.info(`Loaded ${this.messageTemplates.size} WhatsApp message templates`);
  }

  /**
   * Send a templated message (required for business-initiated messages)
   * @param {string} to - Recipient phone number
   * @param {string} templateName - Name of approved template
   * @param {array} parameters - Template parameters
   */
  async sendTemplateMessage(to, templateName, parameters = []) {
    if (!this.isInitialized) {
      logger.warn('WhatsApp Business API not initialized');
      return { success: false, error: 'Service not initialized' };
    }

    const template = this.messageTemplates.get(templateName);
    if (!template) {
      logger.error(`Template not found: ${templateName}`);
      return { success: false, error: 'Template not found' };
    }

    try {
      let result;

      switch (this.provider) {
        case 'twilio':
          result = await this.sendTwilioTemplate(to, template, parameters);
          break;
        case 'meta':
          result = await this.sendMetaTemplate(to, template, parameters);
          break;
        case 'messagebird':
          result = await this.sendMessageBirdTemplate(to, template, parameters);
          break;
      }

      logger.info(`WhatsApp template message sent to ${to} using ${templateName}`);
      return { success: true, messageId: result.id || result.sid };
    } catch (error) {
      logger.error('Error sending WhatsApp template message:', error);
      return { success: false, error: error.message };
    }
  }

  async sendTwilioTemplate(to, template, parameters) {
    const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    
    // Format the message body with parameters
    let body = template.components[0].text;
    parameters.forEach((param, index) => {
      body = body.replace(`{{${index + 1}}}`, param);
    });

    return await this.client.messages.create({
      from: this.config.fromNumber,
      to: formattedTo,
      body: body
    });
  }

  async sendMetaTemplate(to, template, parameters) {
    const axios = require('axios');
    
    const payload = {
      messaging_product: 'whatsapp',
      to: to.replace(/[^\d]/g, ''), // Remove non-digits
      type: 'template',
      template: {
        name: template.name,
        language: {
          code: template.language
        },
        components: [
          {
            type: 'body',
            parameters: parameters.map(text => ({ type: 'text', text }))
          }
        ]
      }
    };

    const response = await axios.post(
      `${this.config.apiUrl}/${this.config.phoneNumberId}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  async sendMessageBirdTemplate(to, template, parameters) {
    // MessageBird implementation
    // This would use MessageBird's Conversations API
    throw new Error('MessageBird implementation pending');
  }

  /**
   * Send a regular text message (for replies within 24-hour window)
   * @param {string} to - Recipient phone number
   * @param {string} message - Message text
   */
  async sendMessage(to, message) {
    if (!this.isInitialized) {
      logger.warn('WhatsApp Business API not initialized');
      return { success: false, error: 'Service not initialized' };
    }

    try {
      let result;

      switch (this.provider) {
        case 'twilio':
          const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
          result = await this.client.messages.create({
            from: this.config.fromNumber,
            to: formattedTo,
            body: message
          });
          break;
          
        case 'meta':
          const axios = require('axios');
          const response = await axios.post(
            `${this.config.apiUrl}/${this.config.phoneNumberId}/messages`,
            {
              messaging_product: 'whatsapp',
              to: to.replace(/[^\d]/g, ''),
              type: 'text',
              text: { body: message }
            },
            {
              headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          result = response.data;
          break;
      }

      logger.info(`WhatsApp message sent to ${to}`);
      return { success: true, messageId: result.id || result.sid };
    } catch (error) {
      logger.error('Error sending WhatsApp message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send queue notification using appropriate template
   */
  async sendQueueNotification(entry, type) {
    if (!entry.customerPhone) {
      return { success: false, error: 'No phone number provided' };
    }

    try {
      // Get queue and merchant information
      const queue = await Queue.findById(entry.queueId);
      const merchantName = queue?.merchantId?.businessName || 'the merchant';

      let templateName;
      let parameters;

      switch (type) {
        case 'joined':
          templateName = 'queue_joined';
          parameters = [
            merchantName,
            entry.displayNumber || entry.position,
            entry.position,
            entry.estimatedWaitTime || 15
          ];
          break;

        case 'ready':
          templateName = 'queue_ready';
          parameters = [
            merchantName,
            entry.displayNumber || entry.position
          ];
          break;

        case 'cancelled':
          templateName = 'queue_cancelled';
          parameters = [merchantName];
          break;

        default:
          // For other types, use regular message if within 24-hour window
          const message = `Queue update from ${merchantName}: ${type}`;
          return await this.sendMessage(entry.customerPhone, message);
      }

      return await this.sendTemplateMessage(entry.customerPhone, templateName, parameters);
    } catch (error) {
      logger.error('Error sending queue notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle incoming webhook from WhatsApp
   */
  async handleWebhook(body) {
    try {
      switch (this.provider) {
        case 'twilio':
          return await this.handleTwilioWebhook(body);
        case 'meta':
          return await this.handleMetaWebhook(body);
        default:
          logger.warn(`Webhook handler not implemented for ${this.provider}`);
      }
    } catch (error) {
      logger.error('Error handling WhatsApp webhook:', error);
    }
  }

  async handleTwilioWebhook(body) {
    const { From, Body, MessageSid } = body;
    const phoneNumber = From.replace('whatsapp:', '');
    const command = Body.trim().toUpperCase();

    if (command === 'CANCEL') {
      await this.handleCancelCommand(phoneNumber);
    } else if (command === 'STATUS') {
      await this.handleStatusCommand(phoneNumber);
    }
  }

  async handleMetaWebhook(body) {
    // Meta webhook structure is different
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];
    
    if (message) {
      const phoneNumber = message.from;
      const text = message.text?.body;
      
      if (text) {
        const command = text.trim().toUpperCase();
        if (command === 'CANCEL') {
          await this.handleCancelCommand(phoneNumber);
        } else if (command === 'STATUS') {
          await this.handleStatusCommand(phoneNumber);
        }
      }
    }
  }

  async handleCancelCommand(phoneNumber) {
    try {
      // Find all active queues
      const queues = await Queue.find({ isActive: true });
      let foundEntry = null;
      let foundQueue = null;

      // Search for the customer's entry across all queues
      for (const queue of queues) {
        const entry = queue.entries.find(e => 
          e.customerPhone === phoneNumber && 
          ['waiting', 'called'].includes(e.status)
        );
        
        if (entry) {
          foundEntry = entry;
          foundQueue = queue;
          break;
        }
      }

      if (foundEntry && foundQueue) {
        // Update entry status
        foundEntry.status = 'cancelled';
        await foundQueue.save();

        await this.sendMessage(
          phoneNumber,
          `✅ Your queue entry at ${foundQueue.name || 'the venue'} has been cancelled.`
        );
      } else {
        await this.sendMessage(
          phoneNumber,
          'You are not currently in any queue.'
        );
      }
    } catch (error) {
      logger.error('Error handling cancel command:', error);
    }
  }

  async handleStatusCommand(phoneNumber) {
    try {
      // Find all active queues
      const queues = await Queue.find({ isActive: true });
      const customerEntries = [];

      // Search for customer entries across all queues
      for (const queue of queues) {
        const entries = queue.entries.filter(e => 
          e.customerPhone === phoneNumber && 
          ['waiting', 'called'].includes(e.status)
        );
        
        entries.forEach(entry => {
          customerEntries.push({
            queueName: queue.name,
            displayNumber: entry.displayNumber || entry.position,
            status: entry.status
          });
        });
      }

      if (customerEntries.length > 0) {
        let statusMsg = 'Your current queues:\n\n';
        customerEntries.forEach(entry => {
          statusMsg += `📍 ${entry.queueName}\n`;
          statusMsg += `Number: ${entry.displayNumber}\n`;
          statusMsg += `Status: ${entry.status}\n\n`;
        });
        await this.sendMessage(phoneNumber, statusMsg);
      } else {
        await this.sendMessage(phoneNumber, 'You are not in any queues.');
      }
    } catch (error) {
      logger.error('Error handling status command:', error);
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      provider: this.provider,
      templatesLoaded: this.messageTemplates.size,
      ready: this.isInitialized
    };
  }
}

module.exports = new WhatsAppBusinessAPIService();