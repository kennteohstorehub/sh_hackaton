const webpush = require('web-push');
const logger = require('../utils/logger');
const prisma = require('../utils/prisma');

class PushNotificationService {
  constructor() {
    this.vapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY
    };

    // Generate VAPID keys if not set
    if (!this.vapidKeys.publicKey || !this.vapidKeys.privateKey) {
      const keys = webpush.generateVAPIDKeys();
      this.vapidKeys = keys;
      logger.warn('VAPID keys not found in environment. Generated new keys:');
      logger.warn(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
      logger.warn(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
      logger.warn('Please add these to your .env file');
    }

    // Configure web-push
    webpush.setVapidDetails(
      'mailto:support@storehub.com',
      this.vapidKeys.publicKey,
      this.vapidKeys.privateKey
    );

    logger.info('Push notification service initialized');
  }

  /**
   * Get VAPID public key for client
   */
  getPublicKey() {
    return this.vapidKeys.publicKey;
  }

  /**
   * Save push subscription for a queue entry
   */
  async saveSubscription(queueEntryId, subscription) {
    try {
      // Store subscription in database
      await prisma.pushSubscription.create({
        data: {
          queueEntryId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          expirationTime: subscription.expirationTime ? new Date(subscription.expirationTime) : null
        }
      });

      logger.info(`Push subscription saved for queue entry: ${queueEntryId}`);
      return true;
    } catch (error) {
      logger.error('Error saving push subscription:', error);
      return false;
    }
  }

  /**
   * Send push notification to a queue entry
   */
  async sendNotification(queueEntryId, payload) {
    try {
      // Get subscription from database
      const subscription = await prisma.pushSubscription.findFirst({
        where: { queueEntryId }
      });

      if (!subscription) {
        logger.warn(`No push subscription found for queue entry: ${queueEntryId}`);
        return false;
      }

      // Reconstruct subscription object
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        }
      };

      // Send notification
      await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
      logger.info(`Push notification sent to queue entry: ${queueEntryId}`);
      return true;

    } catch (error) {
      if (error.statusCode === 410) {
        // Subscription expired, remove it
        logger.warn(`Push subscription expired for queue entry: ${queueEntryId}`);
        await this.removeSubscription(queueEntryId);
      } else {
        logger.error('Error sending push notification:', error);
      }
      return false;
    }
  }

  /**
   * Remove expired or invalid subscription
   */
  async removeSubscription(queueEntryId) {
    try {
      await prisma.pushSubscription.deleteMany({
        where: { queueEntryId }
      });
      logger.info(`Removed push subscription for queue entry: ${queueEntryId}`);
    } catch (error) {
      logger.error('Error removing push subscription:', error);
    }
  }

  /**
   * Send queue joined notification
   */
  async notifyQueueJoined(queueEntryId, queueNumber, position, waitTime, businessName) {
    const payload = {
      title: `Welcome to ${businessName}!`,
      body: `Your queue number is ${queueNumber}. Position: ${position}. Estimated wait: ${waitTime} min.`,
      icon: '/images/icon-192x192.png',
      badge: '/images/badge-72x72.png',
      tag: `queue-joined-${queueEntryId}`,
      data: {
        queueEntryId,
        queueNumber,
        type: 'queue-joined'
      }
    };

    return this.sendNotification(queueEntryId, payload);
  }

  /**
   * Send table ready notification
   */
  async notifyTableReady(queueEntryId, queueNumber, businessName) {
    const payload = {
      title: '🎉 Your table is ready!',
      body: `${businessName}: Please proceed to the host desk. Queue ${queueNumber}`,
      icon: '/images/icon-192x192.png',
      badge: '/images/badge-72x72.png',
      tag: `table-ready-${queueEntryId}`,
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: 'View Status'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],
      data: {
        queueEntryId,
        queueNumber,
        type: 'table-ready'
      }
    };

    return this.sendNotification(queueEntryId, payload);
  }

  /**
   * Send position update notification
   */
  async notifyPositionUpdate(queueEntryId, newPosition, waitTime, businessName) {
    const payload = {
      title: `${businessName} Queue Update`,
      body: `You're now position ${newPosition}. Estimated wait: ${waitTime} min.`,
      icon: '/images/icon-192x192.png',
      badge: '/images/badge-72x72.png',
      tag: `position-update-${queueEntryId}`,
      data: {
        queueEntryId,
        newPosition,
        type: 'position-update'
      }
    };

    return this.sendNotification(queueEntryId, payload);
  }
}

module.exports = new PushNotificationService();