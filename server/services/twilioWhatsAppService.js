const twilio = require('twilio');
const logger = require('../utils/logger');

class TwilioWhatsAppService {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.fromNumber = null;
  }

  async initialize() {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      logger.warn('Twilio credentials not provided, skipping WhatsApp initialization');
      return;
    }

    try {
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      
      this.fromNumber = process.env.TWILIO_WHATSAPP_NUMBER; // Format: whatsapp:+1234567890
      this.isInitialized = true;
      
      logger.info('Twilio WhatsApp service initialized');
    } catch (error) {
      logger.error('Failed to initialize Twilio WhatsApp:', error);
    }
  }

  async sendMessage(to, message, options = {}) {
    if (!this.isInitialized) {
      logger.warn('Twilio WhatsApp not initialized');
      return false;
    }

    try {
      // Ensure phone number is in WhatsApp format
      const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
      
      const messageOptions = {
        from: this.fromNumber,
        to: formattedTo,
        body: message
      };

      // Add media if provided
      if (options.mediaUrl) {
        messageOptions.mediaUrl = [options.mediaUrl];
      }

      const result = await this.client.messages.create(messageOptions);
      
      logger.info(`WhatsApp message sent to ${to}: ${result.sid}`);
      return true;
    } catch (error) {
      logger.error('Failed to send WhatsApp message:', error);
      return false;
    }
  }

  async sendQueueNotification(entry, type) {
    if (!entry.customerPhone) return;

    const merchantName = entry.queue?.merchant?.name || 'The merchant';
    let message;

    switch (type) {
      case 'joined':
        message = `Welcome to ${merchantName}! 🎯\n\n` +
                 `Your queue number: ${entry.displayNumber || entry.id}\n` +
                 `Current position: ${entry.position || 'calculating...'}\n` +
                 `Estimated wait: ${entry.estimatedWaitMinutes || '15'} minutes\n\n` +
                 `Reply CANCEL to leave the queue.`;
        break;
      
      case 'almost_ready':
        message = `⏰ Almost your turn at ${merchantName}!\n\n` +
                 `Queue number: ${entry.displayNumber || entry.id}\n` +
                 `You'll be called in about 5 minutes.\n` +
                 `Please make your way to the venue.`;
        break;
      
      case 'ready':
        message = `🎉 It's your turn at ${merchantName}!\n\n` +
                 `Queue number: ${entry.displayNumber || entry.id}\n` +
                 `Please proceed to the counter now.\n\n` +
                 `Thank you for your patience!`;
        break;
      
      case 'cancelled':
        message = `Your queue entry at ${merchantName} has been cancelled.\n\n` +
                 `We hope to serve you again soon!`;
        break;
      
      default:
        message = `Queue update from ${merchantName}: ${type}`;
    }

    return this.sendMessage(entry.customerPhone, message);
  }

  // Handle incoming WhatsApp messages (webhooks)
  async handleIncomingMessage(from, body, messageId) {
    const phoneNumber = from.replace('whatsapp:', '');
    const command = body.trim().toUpperCase();

    try {
      if (command === 'CANCEL') {
        // Find and cancel active queue entry
        const entry = await prisma.queueEntry.findFirst({
          where: {
            customerPhone: phoneNumber,
            status: { in: ['waiting', 'notified'] }
          },
          include: {
            queue: { include: { merchant: true } }
          }
        });

        if (entry) {
          await prisma.queueEntry.update({
            where: { id: entry.id },
            data: { status: 'cancelled' }
          });

          await this.sendMessage(
            from,
            `✅ Your queue entry at ${entry.queue.merchant.name} has been cancelled.`
          );
        } else {
          await this.sendMessage(
            from,
            'You are not currently in any queue.'
          );
        }
      } else if (command === 'STATUS') {
        // Check queue status
        const entries = await prisma.queueEntry.findMany({
          where: {
            customerPhone: phoneNumber,
            status: { in: ['waiting', 'notified'] }
          },
          include: {
            queue: { include: { merchant: true } }
          }
        });

        if (entries.length > 0) {
          let statusMsg = 'Your current queues:\n\n';
          entries.forEach(entry => {
            statusMsg += `📍 ${entry.queue.merchant.name}\n`;
            statusMsg += `Number: ${entry.displayNumber || entry.id}\n\n`;
          });
          await this.sendMessage(from, statusMsg);
        } else {
          await this.sendMessage(from, 'You are not in any queues.');
        }
      }
    } catch (error) {
      logger.error('Error handling WhatsApp message:', error);
    }
  }
}

module.exports = new TwilioWhatsAppService();