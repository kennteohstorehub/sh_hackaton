const logger = require('../utils/logger');

class SMSService {
  constructor() {
    // Initialize with Twilio or other SMS provider
    this.enabled = process.env.SMS_ENABLED === 'true';
    this.fromNumber = process.env.SMS_FROM_NUMBER;
    
    if (this.enabled && process.env.TWILIO_ACCOUNT_SID) {
      const twilio = require('twilio');
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }
  }

  async sendMessage(to, message) {
    if (!this.enabled) {
      logger.info(`SMS disabled. Would send to ${to}: ${message}`);
      return { success: true, mock: true };
    }

    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to
      });
      
      logger.info(`SMS sent to ${to}, ID: ${result.sid}`);
      return { success: true, messageId: result.sid };
      
    } catch (error) {
      logger.error('SMS send error:', error);
      return { success: false, error: error.message };
    }
  }

  // Queue-specific notification methods
  async notifyQueueJoined(customerPhone, queueNumber, position, waitTime, businessName) {
    const message = `Welcome to ${businessName}! Your queue number is ${queueNumber}. Position: ${position}. Estimated wait: ${waitTime} min. We'll notify you when ready.`;
    return this.sendMessage(customerPhone, message);
  }

  async notifyTableReady(customerPhone, queueNumber, businessName) {
    const message = `${businessName}: Your table is ready! Queue ${queueNumber}. Please proceed to the host desk.`;
    return this.sendMessage(customerPhone, message);
  }

  async notifyPositionUpdate(customerPhone, newPosition, waitTime, businessName) {
    const message = `${businessName} Update: You're now position ${newPosition}. Estimated wait: ${waitTime} min.`;
    return this.sendMessage(customerPhone, message);
  }
}

module.exports = new SMSService();