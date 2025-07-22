const logger = require('../utils/logger');
const telegramService = require('./telegramService');
const twilioWhatsAppService = require('./twilioWhatsAppService');
const smsService = require('./smsService');

class UnifiedNotificationService {
  constructor() {
    this.services = {
      telegram: telegramService,
      whatsapp_api: twilioWhatsAppService,
      sms: smsService,
      // Legacy whatsapp-web.js can still be used in development
      whatsapp_web: null
    };
  }

  async initialize() {
    logger.info('Initializing unified notification service...');
    
    // Initialize all available services
    const initPromises = [];
    
    if (process.env.TELEGRAM_BOT_TOKEN) {
      initPromises.push(
        this.services.telegram.initialize()
          .then(() => logger.info('✅ Telegram service ready'))
          .catch(err => logger.error('❌ Telegram init failed:', err))
      );
    }

    if (process.env.TWILIO_ACCOUNT_SID) {
      initPromises.push(
        this.services.whatsapp_api.initialize()
          .then(() => logger.info('✅ WhatsApp API service ready'))
          .catch(err => logger.error('❌ WhatsApp API init failed:', err))
      );
      
      initPromises.push(
        this.services.sms.initialize()
          .then(() => logger.info('✅ SMS service ready'))
          .catch(err => logger.error('❌ SMS init failed:', err))
      );
    }

    // Legacy WhatsApp Web (only in development/Docker)
    if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_WHATSAPP_WEB) {
      try {
        this.services.whatsapp_web = require('./whatsappService');
        initPromises.push(
          this.services.whatsapp_web.initialize()
            .then(() => logger.info('✅ WhatsApp Web service ready'))
            .catch(err => logger.error('❌ WhatsApp Web init failed:', err))
        );
      } catch (error) {
        logger.warn('WhatsApp Web not available in this environment');
      }
    }

    await Promise.allSettled(initPromises);
    logger.info('Notification services initialization complete');
  }

  async sendNotification(entry, type, options = {}) {
    const results = {
      sent: [],
      failed: []
    };

    // Determine notification channels for this entry
    const channels = this.getNotificationChannels(entry);
    
    for (const channel of channels) {
      try {
        const service = this.services[channel];
        if (!service) {
          logger.warn(`Service ${channel} not available`);
          continue;
        }

        let success = false;
        
        switch (channel) {
          case 'telegram':
            if (entry.telegramChatId) {
              await service.sendQueueNotification(entry, type);
              success = true;
            }
            break;
            
          case 'whatsapp_api':
          case 'whatsapp_web':
            if (entry.customerPhone) {
              success = await service.sendQueueNotification(entry, type);
            }
            break;
            
          case 'sms':
            if (entry.customerPhone && this.shouldSendSMS(type)) {
              success = await service.sendQueueNotification(entry, type);
            }
            break;
        }

        if (success) {
          results.sent.push(channel);
          logger.info(`Notification sent via ${channel} to entry ${entry.id}`);
          
          // Update last notification channel used
          await this.updateNotificationStatus(entry.id, channel);
          
          // If one channel succeeds, we can skip others (unless specified)
          if (!options.sendToAll) {
            break;
          }
        }
      } catch (error) {
        logger.error(`Failed to send via ${channel}:`, error);
        results.failed.push({ channel, error: error.message });
      }
    }

    return results;
  }

  getNotificationChannels(entry) {
    const channels = [];
    
    // Priority order based on user preference and availability
    if (entry.notificationChannel) {
      // User has explicit preference
      channels.push(entry.notificationChannel);
    } else {
      // Auto-detect available channels
      if (entry.telegramChatId) channels.push('telegram');
      if (entry.customerPhone) {
        if (this.services.whatsapp_api?.isInitialized) {
          channels.push('whatsapp_api');
        } else if (this.services.whatsapp_web?.isInitialized) {
          channels.push('whatsapp_web');
        }
        // SMS as last resort
        if (this.services.sms?.isInitialized) {
          channels.push('sms');
        }
      }
    }
    
    return channels;
  }

  shouldSendSMS(type) {
    // Only send SMS for critical notifications to save costs
    return ['ready', 'almost_ready'].includes(type);
  }

  async updateNotificationStatus(entryId, channel) {
    try {
      await prisma.queueEntry.update({
        where: { id: entryId },
        data: {
          lastNotificationChannel: channel,
          lastNotificationAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to update notification status:', error);
    }
  }

  // Get available notification methods for UI
  getAvailableChannels() {
    const available = [];
    
    if (this.services.telegram?.isInitialized) {
      available.push({
        id: 'telegram',
        name: 'Telegram',
        description: 'Free instant messages via Telegram',
        requiresSetup: true,
        setupInstructions: 'Search for @YourQueueBot on Telegram'
      });
    }
    
    if (this.services.whatsapp_api?.isInitialized || this.services.whatsapp_web?.isInitialized) {
      available.push({
        id: 'whatsapp',
        name: 'WhatsApp',
        description: 'Get updates on WhatsApp',
        requiresSetup: false
      });
    }
    
    if (this.services.sms?.isInitialized) {
      available.push({
        id: 'sms',
        name: 'SMS',
        description: 'Text messages (charges may apply)',
        requiresSetup: false,
        warning: 'Standard SMS rates apply'
      });
    }
    
    return available;
  }
}

module.exports = new UnifiedNotificationService();