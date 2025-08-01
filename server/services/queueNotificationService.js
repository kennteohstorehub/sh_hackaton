const logger = require('../utils/logger');
const queueService = require('./queueService');
const merchantService = require('./merchantService');
const unifiedNotificationService = require('./unifiedNotificationService');
const pushNotificationService = require('./pushNotificationService');

class QueueNotificationService {
  constructor() {
    this.noShowTimers = new Map(); // Map of customerId -> timeout
    this.notificationTimers = new Map(); // Map of customerId -> { first: timeout, final: timeout }
  }

  // Schedule notifications when customer is called
  async scheduleCustomerNotifications(queue, customer, merchant) {
    try {
      const timing = merchant.settings?.notifications?.timing;
      const templates = merchant.settings?.notifications?.templates;
      
      if (!timing || !templates) {
        logger.warn('Merchant notification settings not configured');
        return;
      }

      // Clear any existing timers for this customer
      this.clearCustomerTimers(customer.customerId);

      // Schedule first notification (X minutes before ready)
      if (timing.firstNotification > 0) {
        const firstDelay = Math.max(0, (customer.estimatedWaitTime - timing.firstNotification) * 60 * 1000);
        
        const firstTimer = setTimeout(async () => {
          await this.sendAlmostReadyNotification(customer, merchant, timing.firstNotification);
        }, firstDelay);
        
        if (!this.notificationTimers.has(customer.customerId)) {
          this.notificationTimers.set(customer.customerId, {});
        }
        this.notificationTimers.get(customer.customerId).first = firstTimer;
      }

      // Schedule final notification (when ready or X minutes before)
      const finalDelay = Math.max(0, (customer.estimatedWaitTime - timing.finalNotification) * 60 * 1000);
      
      const finalTimer = setTimeout(async () => {
        await this.sendTableReadyNotification(customer, merchant);
        
        // Schedule no-show warning if enabled
        if (timing.sendNoShowWarning) {
          this.scheduleNoShowWarning(queue, customer, merchant);
        }
      }, finalDelay);
      
      this.notificationTimers.get(customer.customerId).final = finalTimer;
      
      logger.info(`Scheduled notifications for customer ${customer.customerId} - First in ${timing.firstNotification}min, Final in ${timing.finalNotification}min`);
      
    } catch (error) {
      logger.error('Error scheduling customer notifications:', error);
    }
  }

  // Send almost ready notification
  async sendAlmostReadyNotification(customer, merchant, minutesLeft) {
    try {
      const template = merchant.settings?.notifications?.templates?.almostReady || 
        'Hi {CustomerName}! Your table at {RestaurantName} will be ready in ~{Minutes} minutes. Please start making your way to the restaurant 🚶‍♂️';
      
      const replacements = {
        CustomerName: customer.customerName,
        RestaurantName: merchant.businessName,
        Minutes: minutesLeft,
        PartySize: customer.partySize
      };
      
      // Send via WebSocket if available
      const io = require('../index').io;
      if (io && customer.sessionId) {
        io.to(`session-${customer.sessionId}`).emit('notification', {
          type: 'notification',
          message: this.formatMessage(template, replacements),
          timestamp: new Date()
        });
      }
      
      // Also try push notification
      await pushNotificationService.sendNotification(
        customer.id,
        this.formatMessage(template, replacements)
      );
      
      // WhatsApp notifications have been removed - using webchat and push notifications only
      
      // Update notification count
      customer.notificationCount = (customer.notificationCount || 0) + 1;
      customer.lastNotified = new Date();
      
      logger.info(`Sent almost ready notification to ${customer.customerPhone}`);
    } catch (error) {
      logger.error('Error sending almost ready notification:', error);
    }
  }

  // Send table ready notification
  async sendTableReadyNotification(customer, merchant) {
    try {
      const template = merchant.settings?.notifications?.templates?.tableReady || 
        '🎉 {CustomerName}, your table is NOW READY! Please see our host at {RestaurantName}. You have {Timeout} minutes to claim your table.';
      
      const timeout = merchant.settings?.queue?.gracePeriod || 5;
      
      const replacements = {
        CustomerName: customer.customerName,
        RestaurantName: merchant.businessName,
        Timeout: timeout,
        Position: customer.position,
        PartySize: customer.partySize
      };
      
      // Send via WebSocket if available
      const io = require('../index').io;
      if (io && customer.sessionId) {
        io.to(`session-${customer.sessionId}`).emit('notification', {
          type: 'notification',
          message: this.formatMessage(template, replacements),
          timestamp: new Date()
        });
      }
      
      // Also try push notification
      await pushNotificationService.sendNotification(
        customer.id,
        this.formatMessage(template, replacements)
      );
      
      // WhatsApp notifications have been removed - using webchat and push notifications only
      
      // Update notification count
      customer.notificationCount = (customer.notificationCount || 0) + 1;
      customer.lastNotified = new Date();
      
      logger.info(`Sent table ready notification to ${customer.customerPhone}`);
    } catch (error) {
      logger.error('Error sending table ready notification:', error);
    }
  }

  // Schedule no-show warning
  scheduleNoShowWarning(queue, customer, merchant) {
    try {
      const noShowTimeout = merchant.settings?.queue?.noShowTimeout || 15;
      const gracePeriod = merchant.settings?.queue?.gracePeriod || 5;
      
      // First warning after grace period
      const warningDelay = gracePeriod * 60 * 1000;
      
      const warningTimer = setTimeout(async () => {
        await this.sendNoShowWarning(customer, merchant, gracePeriod, noShowTimeout - gracePeriod);
        
        // Schedule final no-show action
        const finalDelay = (noShowTimeout - gracePeriod) * 60 * 1000;
        
        const noShowTimer = setTimeout(async () => {
          await this.handleNoShow(queue, customer, merchant);
        }, finalDelay);
        
        // Store the no-show timer
        this.noShowTimers.set(customer.customerId, noShowTimer);
        
      }, warningDelay);
      
      // Store warning timer in no-show timers map
      this.noShowTimers.set(customer.customerId, warningTimer);
      
      logger.info(`Scheduled no-show warning for customer ${customer.customerId} in ${gracePeriod} minutes`);
      
    } catch (error) {
      logger.error('Error scheduling no-show warning:', error);
    }
  }

  // Send no-show warning
  async sendNoShowWarning(customer, merchant, minutesPassed, minutesRemaining) {
    try {
      const template = merchant.settings?.notifications?.templates?.noShowWarning || 
        '⚠️ {CustomerName}, we\'ve been holding your table for {Minutes} minutes. Please respond within {Remaining} minutes or we\'ll need to release your table to the next guest.';
      
      const replacements = {
        CustomerName: customer.customerName,
        RestaurantName: merchant.businessName,
        Minutes: minutesPassed,
        Remaining: minutesRemaining
      };
      
      // Send via WebSocket if available
      const io = require('../index').io;
      if (io && customer.sessionId) {
        io.to(`session-${customer.sessionId}`).emit('notification', {
          type: 'notification',
          message: this.formatMessage(template, replacements),
          timestamp: new Date()
        });
      }
      
      // Also try push notification
      await pushNotificationService.sendNotification(
        customer.id,
        this.formatMessage(template, replacements)
      );
      
      // WhatsApp notifications have been removed - using webchat and push notifications only
      
      logger.info(`Sent no-show warning to ${customer.customerPhone}`);
    } catch (error) {
      logger.error('Error sending no-show warning:', error);
    }
  }

  // Handle no-show
  async handleNoShow(queue, customer, merchant) {
    try {
      // Mark customer as no-show
      customer.status = 'no-show';
      customer.completedAt = new Date();
      
      // Update queue positions
      await queue.updatePositions();
      await queue.save();
      
      // Clear timers
      this.clearCustomerTimers(customer.customerId);
      
      // Send final message via WebSocket
      const io = require('../index').io;
      const finalMessage = `Unfortunately, your table at ${merchant.businessName} has been released to the next guest due to no-show. We hope to serve you another time! 🙏`;
      
      if (io && customer.sessionId) {
        io.to(`session-${customer.sessionId}`).emit('notification', {
          type: 'no-show-final',
          message: finalMessage,
          timestamp: new Date()
        });
      }
      
      // WhatsApp notifications have been removed - using webchat and push notifications only
      
      logger.info(`Marked customer ${customer.customerId} as no-show`);
      
      // Update analytics
      queue.analytics.noShowRate = (queue.analytics.noShowRate || 0) + 1;
      await queue.save();
      
    } catch (error) {
      logger.error('Error handling no-show:', error);
    }
  }

  // Clear all timers for a customer
  clearCustomerTimers(customerId) {
    // Clear notification timers
    if (this.notificationTimers.has(customerId)) {
      const timers = this.notificationTimers.get(customerId);
      if (timers.first) clearTimeout(timers.first);
      if (timers.final) clearTimeout(timers.final);
      this.notificationTimers.delete(customerId);
    }
    
    // Clear no-show timer
    if (this.noShowTimers.has(customerId)) {
      clearTimeout(this.noShowTimers.get(customerId));
      this.noShowTimers.delete(customerId);
    }
  }

  // Clear all timers (for shutdown)
  clearAllTimers() {
    // Clear all notification timers
    for (const [customerId, timers] of this.notificationTimers) {
      if (timers.first) clearTimeout(timers.first);
      if (timers.final) clearTimeout(timers.final);
    }
    this.notificationTimers.clear();
    
    // Clear all no-show timers
    for (const timer of this.noShowTimers.values()) {
      clearTimeout(timer);
    }
    this.noShowTimers.clear();
    
    logger.info('Cleared all notification timers');
  }

  // Format message with replacements
  formatMessage(template, replacements) {
    let message = template;
    for (const [key, value] of Object.entries(replacements)) {
      const placeholder = `{${key}}`;
      message = message.replace(new RegExp(placeholder, 'g'), value);
    }
    return message;
  }
}

module.exports = new QueueNotificationService();