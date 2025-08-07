const logger = require('../utils/logger');
const telegramService = require('./telegramService');

class UnifiedNotificationService {
  constructor() {
    this.services = {
      telegram: telegramService
      // SMS and WhatsApp services have been removed
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

    // SMS and WhatsApp services have been removed - using webchat and other channels only
    logger.info('SMS and WhatsApp services disabled - using webchat and Telegram only');

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
            
          // SMS and WhatsApp cases have been removed
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
      // Auto-detect available channels (SMS and WhatsApp removed)
      if (entry.telegramChatId) channels.push('telegram');
    }
    
    return channels;
  }

  async updateNotificationStatus(entryId, channel) {
    try {
      await prisma.queueEntry.update({
        where: { id: entryId },
        data: {
          lastNotified: new Date(),
          notificationCount: {
            increment: 1
          }
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
    
    // SMS and WhatsApp options removed
    
    return available;
  }
}

module.exports = new UnifiedNotificationService();