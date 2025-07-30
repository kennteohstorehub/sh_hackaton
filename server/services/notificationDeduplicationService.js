/**
 * Notification Deduplication Service
 * Prevents duplicate notifications from being sent through multiple channels
 */

const logger = require('../utils/logger');

class NotificationDeduplicationService {
  constructor() {
    // Track sent notifications: key -> { channels: Set, timestamp, messageHash }
    this.sentNotifications = new Map();
    
    // Clean up old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if we should send a notification
   * @param {string} entryId - The queue entry ID
   * @param {string} channel - The channel/room being used
   * @param {string} notificationType - Type of notification (e.g., 'customer-called')
   * @param {object} data - The notification data
   * @returns {boolean} - Whether to send the notification
   */
  shouldSend(entryId, channel, notificationType, data = {}) {
    const key = `${entryId}-${notificationType}`;
    const messageHash = this.hashMessage(data);
    const now = Date.now();
    
    const existing = this.sentNotifications.get(key);
    
    // If we haven't sent this notification before, allow it
    if (!existing) {
      this.sentNotifications.set(key, {
        channels: new Set([channel]),
        timestamp: now,
        messageHash
      });
      logger.debug(`[DEDUP] First notification for ${key} on channel ${channel}`);
      return true;
    }
    
    // If it's a different message, allow it
    if (existing.messageHash !== messageHash) {
      existing.channels = new Set([channel]);
      existing.timestamp = now;
      existing.messageHash = messageHash;
      logger.debug(`[DEDUP] Different message for ${key}, allowing on ${channel}`);
      return true;
    }
    
    // If it's been more than 10 seconds, allow resend
    if (now - existing.timestamp > 10000) {
      existing.channels = new Set([channel]);
      existing.timestamp = now;
      logger.debug(`[DEDUP] Timeout expired for ${key}, allowing resend on ${channel}`);
      return true;
    }
    
    // If we've already sent on this channel, block it
    if (existing.channels.has(channel)) {
      logger.debug(`[DEDUP] Blocking duplicate on same channel ${channel} for ${key}`);
      return false;
    }
    
    // If this is a different channel but same entry, block it
    // This prevents sending the same notification through multiple rooms
    logger.debug(`[DEDUP] Blocking duplicate on different channel ${channel} for ${key}`);
    return false;
  }

  /**
   * Generate a simple hash of the notification data
   * @param {object} data - The notification data
   * @returns {string} - A hash of the data
   */
  hashMessage(data) {
    // Create a simple hash from key properties
    const relevant = {
      type: data.type,
      message: data.message,
      verificationCode: data.verificationCode,
      position: data.position
    };
    
    return JSON.stringify(relevant);
  }

  /**
   * Clean up old entries to prevent memory leak
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    
    for (const [key, value] of this.sentNotifications.entries()) {
      if (now - value.timestamp > maxAge) {
        this.sentNotifications.delete(key);
      }
    }
    
    logger.debug(`[DEDUP] Cleanup completed, ${this.sentNotifications.size} entries remaining`);
  }

  /**
   * Clear all dedupe data (useful for testing)
   */
  clear() {
    this.sentNotifications.clear();
  }
}

module.exports = new NotificationDeduplicationService();