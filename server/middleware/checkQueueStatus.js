const logger = require('../utils/logger');
const queueService = require('../services/queueService');

/**
 * Middleware to check if any queue is currently operating (accepting customers)
 * and prevent configuration changes during active operations
 */
const checkQueueStatus = (options = {}) => {
  return async (req, res, next) => {
    try {
      const merchantId = req.user?.id || req.user?._id;
      
      if (!merchantId) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          locked: false 
        });
      }

      // Get tenant context if available
      const tenantId = req.tenantId;
      
      // Fetch all queues for the merchant
      const queues = await queueService.findByMerchant(merchantId, false, tenantId);
      
      // Check if any queue is currently accepting customers
      const activeQueue = queues.find(queue => queue.isActive && queue.acceptingCustomers);
      
      if (activeQueue && !options.allowWhenActive) {
        logger.warn(`Configuration change blocked - Queue "${activeQueue.name}" is currently operating`, {
          merchantId,
          queueId: activeQueue.id,
          attemptedAction: req.method + ' ' + req.originalUrl
        });
        
        return res.status(423).json({ 
          error: 'Configuration locked while queue is operating',
          message: 'Please stop the queue before making configuration changes',
          locked: true,
          activeQueue: {
            id: activeQueue.id,
            name: activeQueue.name,
            acceptingCustomers: activeQueue.acceptingCustomers
          }
        });
      }
      
      // Add queue status to request for use in routes
      req.queueStatus = {
        hasActiveQueue: !!activeQueue,
        activeQueueId: activeQueue?.id,
        activeQueueName: activeQueue?.name,
        isOperating: !!activeQueue?.acceptingCustomers
      };
      
      next();
    } catch (error) {
      logger.error('Error checking queue status:', error);
      // In case of error, allow the operation but log it
      req.queueStatus = {
        hasActiveQueue: false,
        isOperating: false,
        error: true
      };
      next();
    }
  };
};

module.exports = checkQueueStatus;