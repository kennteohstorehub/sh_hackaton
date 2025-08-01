const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { generateQueueQR, generateQueueQRSVG } = require('../utils/qrGenerator');
const RoomHelpers = require('../utils/roomHelpers');

// Use appropriate auth middleware based on environment
let requireAuth, loadUser;
const useAuthBypass = process.env.USE_AUTH_BYPASS === 'true' || 
                     (process.env.NODE_ENV !== 'production' && process.env.USE_AUTH_BYPASS !== 'false');

if (useAuthBypass) {
  ({ requireAuth, loadUser } = require('../middleware/auth-bypass'));
} else {
  ({ requireAuth, loadUser } = require('../middleware/auth'));
}

// Import tenant isolation middleware
const { tenantIsolationMiddleware, validateMerchantAccess } = require('../middleware/tenant-isolation');

const queueService = require('../services/queueService');
const merchantService = require('../services/merchantService');

const router = express.Router();

// GET /api/queue - Get all queues for merchant with tenant isolation
router.get('/', [requireAuth, loadUser, tenantIsolationMiddleware, validateMerchantAccess], async (req, res) => {
  try {
    const merchantId = req.user.id || req.user._id;
    const tenantId = req.tenantId;
    
    const queues = await queueService.findByMerchant(merchantId, true, tenantId);
    
    res.json({
      success: true,
      queues: queues.map(queue => ({
        ...queue,
        currentLength: queue.entries?.filter(e => e.status === 'waiting').length || 0,
        nextPosition: (queue.entries?.filter(e => e.status === 'waiting').length || 0) + 1
      }))
    });
  } catch (error) {
    logger.error('Error fetching queues:', error);
    res.status(500).json({ error: 'Failed to fetch queues' });
  }
});

// GET /api/queue/status - Get queue status (for checking if any queue is operating)
router.get('/status', [requireAuth, loadUser, tenantIsolationMiddleware, validateMerchantAccess], async (req, res) => {
  try {
    const merchantId = req.user.id || req.user._id;
    const tenantId = req.tenantId;
    
    // Get all queues for the merchant
    const queues = await queueService.findByMerchant(merchantId, false, tenantId);
    
    // Find if any queue is accepting customers
    const activeQueue = queues.find(queue => queue.isActive && queue.acceptingCustomers);
    
    res.json({
      success: true,
      hasActiveQueue: !!activeQueue,
      activeQueue: activeQueue ? {
        id: activeQueue.id || activeQueue._id,
        name: activeQueue.name,
        acceptingCustomers: activeQueue.acceptingCustomers,
        isActive: activeQueue.isActive
      } : null
    });
  } catch (error) {
    logger.error('Error checking queue status:', error);
    res.status(500).json({ error: 'Failed to check queue status' });
  }
});

// GET /api/queue/performance - Get queue performance data for dashboard with tenant isolation
router.get('/performance', [requireAuth, loadUser, tenantIsolationMiddleware, validateMerchantAccess], async (req, res) => {
  try {
    const merchantId = req.user._id;
    const tenantId = req.tenantId;
    
    // Get all queues for the merchant with performance stats
    const queues = await queueService.findByMerchant(merchantId, true, tenantId);
    
    // Calculate performance metrics for each queue
    const queuePerformance = await Promise.all(queues.map(async queue => {
      const stats = await queueService.getQueueStats(queue.id, tenantId);
      const totalCustomers = queue.entries?.length || 0;
      const efficiency = totalCustomers > 0 ? Math.round((stats.servedToday / totalCustomers) * 100) : 0;
      
      return {
        id: queue.id,
        name: queue.name,
        totalCustomers,
        completedCustomers: stats.servedToday,
        currentLength: stats.waitingCount,
        averageWaitTime: Math.round(stats.averageWaitTime),
        efficiency
      };
    }));
    
    res.json({
      success: true,
      queues: queuePerformance
    });
  } catch (error) {
    logger.error('Error fetching queue performance:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch queue performance data' 
    });
  }
});

// POST /api/queue - Create new queue with tenant isolation
router.post('/', [requireAuth, loadUser, tenantIsolationMiddleware, validateMerchantAccess], [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Queue name is required'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description too long'),
  body('maxCapacity').isInt({ min: 1, max: 1000 }).withMessage('Max capacity must be between 1 and 1000'),
  body('averageServiceTime').isInt({ min: 1, max: 300 }).withMessage('Service time must be between 1 and 300 minutes')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const merchantId = req.user.id || req.user._id;
    const tenantId = req.tenantId;
    const { name, description, maxCapacity, averageServiceTime } = req.body;

    // Check if merchant can create more queues (tenant-aware)
    const canCreate = await merchantService.canCreateQueue(merchantId, tenantId);
    
    if (!canCreate) {
      return res.status(403).json({ error: 'Queue limit reached for your subscription plan' });
    }

    const queue = await queueService.create(merchantId, {
      name,
      description,
      maxCapacity,
      averageServiceTime
    }, tenantId);

    // Emit real-time update to tenant-scoped room
    req.io.to(`tenant-${tenantId}-merchant-${merchantId}`).emit('queue-created', queue);

    res.status(201).json({
      success: true,
      queue: {
        ...queue,
        currentLength: 0,
        nextPosition: 1
      }
    });

  } catch (error) {
    logger.error('Error creating queue:', error);
    res.status(500).json({ error: 'Failed to create queue' });
  }
});

// GET /api/queue/:id - Get specific queue with tenant isolation
router.get('/:id', [requireAuth, loadUser, tenantIsolationMiddleware, validateMerchantAccess], async (req, res) => {
  try {
    const merchantId = req.user.id || req.user._id;
    const tenantId = req.tenantId;
    const queue = await queueService.findByMerchantAndId(merchantId, req.params.id, tenantId);

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const waitingCount = await prisma.queueEntry.count({
      where: { queueId: queue.id, status: 'waiting' }
    });

    res.json({
      success: true,
      queue: {
        ...queue,
        currentLength: waitingCount,
        nextPosition: waitingCount + 1
      }
    });

  } catch (error) {
    logger.error('Error fetching queue:', error);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

// PUT /api/queue/:id - Update queue
router.put('/:id', [requireAuth, loadUser], [
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Queue name is required'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description too long'),
  body('maxCapacity').optional().isInt({ min: 1, max: 1000 }).withMessage('Max capacity must be between 1 and 1000'),
  body('averageServiceTime').optional().isInt({ min: 1, max: 300 }).withMessage('Service time must be between 1 and 300 minutes')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const merchantId = req.user.id || req.user._id;
    const queue = await queueService.findByMerchantAndId(merchantId, req.params.id);

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Update queue
    const updatedQueue = await queueService.update(req.params.id, req.body);

    // Emit real-time update
    req.io.to(`merchant-${merchantId}`).emit('queue-updated', {
      queueId: updatedQueue.id,
      action: 'queue-modified',
      queue: updatedQueue
    });

    const waitingCount = await prisma.queueEntry.count({
      where: { queueId: updatedQueue.id, status: 'waiting' }
    });

    res.json({
      success: true,
      queue: {
        ...updatedQueue,
        currentLength: waitingCount,
        nextPosition: waitingCount + 1
      }
    });

  } catch (error) {
    logger.error('Error updating queue:', error);
    res.status(500).json({ error: 'Failed to update queue' });
  }
});

// POST /api/queue/:id/call-next - Call next customer
router.post('/:id/call-next', [requireAuth, loadUser], async (req, res) => {
  try {
    const merchantId = req.user.id || req.user._id;
    const queue = await prisma.queue.findFirst({
      where: {
        id: req.params.id,
        merchantId: merchantId
      },
      include: {
        merchant: true
      }
    });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Get the next waiting customer
    const nextCustomer = await prisma.queueEntry.findFirst({
      where: {
        queueId: queue.id,
        status: 'waiting'
      },
      orderBy: {
        position: 'asc'
      }
    });
    
    if (!nextCustomer) {
      return res.status(400).json({ error: 'No customers waiting in queue' });
    }

    // Update the customer status to 'called'
    await prisma.queueEntry.update({
      where: { id: nextCustomer.id },
      data: {
        status: 'called',
        calledAt: new Date()
      }
    });
    
    // Refetch to ensure we have the latest data
    const updatedCustomer = await prisma.queueEntry.findUnique({
      where: { id: nextCustomer.id }
    });
    
    logger.info('Customer status updated:', {
      id: updatedCustomer.id,
      oldStatus: nextCustomer.status,
      newStatus: updatedCustomer.status,
      calledAt: updatedCustomer.calledAt
    });
    
    console.log('DEBUG - updatedCustomer:', JSON.stringify(updatedCustomer, null, 2));

    // Send notifications to customer
    try {
      const notificationData = {
        customerId: updatedCustomer.customerId,
        queueName: queue.name,
        position: updatedCustomer.position,
        verificationCode: updatedCustomer.verificationCode,
        message: `🎉 IT'S YOUR TURN!\n\nPlease proceed to the counter.\nVerification code: ${updatedCustomer.verificationCode}`
      };
      
      logger.info('[NOTIFICATION] Sending notification to customer:', {
        customerId: updatedCustomer.customerId,
        sessionId: updatedCustomer.sessionId,
        customerPhone: updatedCustomer.customerPhone,
        rooms: [`customer-${updatedCustomer.customerId}`, `session-${updatedCustomer.sessionId}`]
      });
      
      // Get all rooms the customer should be in
      const customerRooms = RoomHelpers.getCustomerRooms(updatedCustomer);
      
      // Debug: Check room memberships
      const roomMemberships = {};
      for (const room of customerRooms) {
        const members = req.io.sockets.adapter.rooms.get(room);
        roomMemberships[room] = members ? Array.from(members) : [];
      }
      
      logger.info('[NOTIFICATION] Room memberships:', {
        rooms: customerRooms,
        memberships: roomMemberships,
        entryId: updatedCustomer.id,
        sessionId: updatedCustomer.sessionId,
        phone: updatedCustomer.customerPhone
      });
      
      // Import deduplication service
      const deduplicationService = require('../services/notificationDeduplicationService');
      
      // Send notification to primary room only (entry room)
      // This prevents duplicate notifications when customer is in multiple rooms
      const primaryRoom = RoomHelpers.getEntryRoom(updatedCustomer.id);
      
      if (deduplicationService.shouldSend(
        updatedCustomer.id,
        primaryRoom,
        'customer-called',
        notificationData
      )) {
        // Emit to the primary room
        req.io.to(primaryRoom).emit('customer-called', {
          ...notificationData,
          entryId: updatedCustomer.id  // Include entry ID for frontend
        });
        logger.info(`[NOTIFICATION] Sent to primary room: ${primaryRoom}`);
        
        // Also emit to session room if it's different (for webchat compatibility)
        if (updatedCustomer.sessionId) {
          const sessionRoom = RoomHelpers.getSessionRoom(updatedCustomer.sessionId);
          if (sessionRoom !== primaryRoom) {
            req.io.to(sessionRoom).emit('customer-called', {
              ...notificationData,
              entryId: updatedCustomer.id
            });
            logger.info(`[NOTIFICATION] Also sent to session room: ${sessionRoom}`);
          }
        }
      } else {
        logger.warn(`[NOTIFICATION] Duplicate notification blocked for entry ${updatedCustomer.id}`);
      }
      
      // Tertiary: Try push notification
      const pushNotificationService = require('../services/pushNotificationService');
      const pushSent = await pushNotificationService.notifyTableReady(
        updatedCustomer.id,
        `#${updatedCustomer.position}`,
        queue.merchant?.businessName || 'Restaurant'
      );
      
      if (pushSent) {
        logger.info(`Push notification sent to ${updatedCustomer.customerName}`);
      }
      
      logger.info(`Notifications sent to ${updatedCustomer.customerName} via websocket and push`);
      
      // WhatsApp notifications have been removed - using webchat and push notifications only
    } catch (error) {
      logger.error('Error sending customer notification:', error);
    }

    // Calculate queue metrics
    const waitingEntries = await prisma.queueEntry.count({
      where: { queueId: queue.id, status: 'waiting' }
    });
    
    const nextPositionEntry = await prisma.queueEntry.findFirst({
      where: { queueId: queue.id },
      orderBy: { position: 'desc' },
      select: { position: true }
    });
    
    const nextPosition = (nextPositionEntry?.position || 0) + 1;

    // Emit real-time updates
    req.io.to(`merchant-${merchantId}`).emit('queue-updated', {
      queueId: queue.id,
      action: 'customer-called',
      customer: updatedCustomer,
      queue: {
        ...queue,
        currentLength: waitingEntries,
        nextPosition: nextPosition
      }
    });

    // No need for duplicate notifications here since we already sent them above

    res.json({
      success: true,
      customer: updatedCustomer,
      queue: {
        ...queue,
        currentLength: waitingEntries,
        nextPosition: nextPosition
      }
    });

  } catch (error) {
    logger.error('Error calling next customer:', error);
    res.status(500).json({ error: 'Failed to call next customer' });
  }
});

// POST /api/queue/:id/call-specific - Call specific customer (override queue order)
router.post('/:id/call-specific', [requireAuth, loadUser], [
  body('customerId').notEmpty().withMessage('Customer ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const merchantId = req.user.id || req.user._id;
    const { customerId } = req.body;
    
    // Use Prisma to find the queue
    const queue = await prisma.queue.findFirst({
      where: {
        id: req.params.id,
        merchantId: merchantId
      },
      include: {
        merchant: true
      }
    });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Find the specific customer in Prisma
    let customerEntry = await prisma.queueEntry.findFirst({
      where: {
        id: customerId,
        queueId: queue.id,
        status: {
          in: ['waiting', 'called']  // Allow notifying customers who are already called
        }
      }
    });

    if (!customerEntry) {
      // Try to find any entry with this ID for debugging
      const anyEntry = await prisma.queueEntry.findUnique({
        where: { id: customerId }
      });
      
      logger.error('Customer not found:', {
        customerId,
        queueId: queue.id,
        foundEntry: !!anyEntry,
        entryStatus: anyEntry?.status,
        entryQueueId: anyEntry?.queueId
      });
      
      return res.status(404).json({ error: 'Customer not found or not in valid status' });
    }

    // Update the customer status to 'called'
    customerEntry = await prisma.queueEntry.update({
      where: { id: customerEntry.id },
      data: {
        status: 'called',
        calledAt: new Date()
      }
    });

    // Send notifications to customer
    try {
      // Generate verification code if not present
      if (!customerEntry.verificationCode) {
        const webChatService = require('../services/webChatService');
        const verificationCode = webChatService.generateVerificationCode();
        customerEntry = await prisma.queueEntry.update({
          where: { id: customerEntry.id },
          data: { verificationCode }
        });
      }
      
      // Debug log the customer entry
      logger.info(`[NOTIFICATION] Customer entry:`, {
        id: customerEntry.id,
        customerId: customerEntry.customerId,
        customerPhone: customerEntry.customerPhone,
        sessionId: customerEntry.sessionId,
        platform: customerEntry.platform
      });
      
      const notificationData = {
        customerId: customerEntry.customerId,
        queueName: queue.name,
        position: customerEntry.position,
        verificationCode: customerEntry.verificationCode,
        message: `🎉 IT'S YOUR TURN!\n\nPlease proceed to the counter.\nVerification code: ${customerEntry.verificationCode}`
      };
      
      // Get all rooms the customer should be in
      const customerRooms = RoomHelpers.getCustomerRooms(customerEntry);
      
      // Import deduplication service
      const deduplicationService = require('../services/notificationDeduplicationService');
      
      // Send notification to primary room only (entry room)
      const primaryRoom = RoomHelpers.getEntryRoom(customerEntry.id);
      
      if (deduplicationService.shouldSend(
        customerEntry.id,
        primaryRoom,
        'customer-called',
        notificationData
      )) {
        // Emit to the primary room
        req.io.to(primaryRoom).emit('customer-called', {
          ...notificationData,
          entryId: customerEntry.id  // Include entry ID for frontend
        });
        logger.info(`[NOTIFICATION] Sent to primary room: ${primaryRoom}`);
        
        // Also emit to session room if it's different (for webchat compatibility)
        if (customerEntry.sessionId) {
          const sessionRoom = RoomHelpers.getSessionRoom(customerEntry.sessionId);
          if (sessionRoom !== primaryRoom) {
            req.io.to(sessionRoom).emit('customer-called', {
              ...notificationData,
              entryId: customerEntry.id
            });
            logger.info(`[NOTIFICATION] Also sent to session room: ${sessionRoom}`);
          }
        }
      } else {
        logger.warn(`[NOTIFICATION] Duplicate notification blocked for entry ${customerEntry.id}`);
      }
      
      // Tertiary: Try push notification
      const pushNotificationService = require('../services/pushNotificationService');
      const pushSent = await pushNotificationService.notifyTableReady(
        customerEntry.id,
        `#${customerEntry.position}`,
        queue.merchant?.businessName || 'Restaurant'
      );
      
      if (pushSent) {
        logger.info(`Push notification sent to ${customerEntry.customerName} (specific call)`);
      }
      
      logger.info(`Notifications sent to ${customerEntry.customerName} via websocket and push`);
      
      // WhatsApp notifications have been removed - using webchat and push notifications only
    } catch (error) {
      logger.error('Error sending customer notification:', error);
    }

    // Calculate queue metrics
    const waitingEntries = await prisma.queueEntry.count({
      where: { queueId: queue.id, status: 'waiting' }
    });
    
    const nextPositionEntry = await prisma.queueEntry.findFirst({
      where: { queueId: queue.id },
      orderBy: { position: 'desc' },
      select: { position: true }
    });
    
    const nextPosition = (nextPositionEntry?.position || 0) + 1;

    // Emit real-time updates
    req.io.to(`merchant-${merchantId}`).emit('queue-updated', {
      queueId: queue.id,
      action: 'customer-called-specific',
      customer: customerEntry,
      queue: {
        ...queue,
        currentLength: waitingEntries,
        nextPosition: nextPosition
      }
    });

    // This is already sent above in the try block, no need to duplicate

    res.json({
      success: true,
      customer: customerEntry,
      queue: {
        ...queue,
        currentLength: waitingEntries,
        nextPosition: nextPosition
      }
    });

  } catch (error) {
    logger.error('Error calling specific customer:', error);
    res.status(500).json({ error: 'Failed to call specific customer' });
  }
});

// Function to send position update notifications to all waiting customers
async function sendPositionUpdateNotifications(queueId, queueName, io, merchantId) {
  try {
    // WhatsApp service removed - using webchat notifications only
    const pushNotificationService = require('../services/pushNotificationService');
    const waitingCustomers = await prisma.queueEntry.findMany({
      where: { queueId, status: 'waiting' },
      orderBy: { position: 'asc' }
    });
    
    for (const customer of waitingCustomers) {
      try {
        // Try push notification first
        const pushSent = await pushNotificationService.notifyPositionUpdate(
          customer.id || customer._id,
          customer.position,
          customer.estimatedWaitTime,
          queue.name
        );
        
        if (pushSent) {
          logger.info(`Push position update sent to ${customer.customerName} - Position: #${customer.position}`);
        }
        
        // WhatsApp notifications removed - position updates via webchat only
        logger.info(`Position update sent via webchat to ${customer.customerName} - Position: #${customer.position}`);
      } catch (error) {
        logger.error(`Error sending position update to ${customer.customerPhone}:`, error);
      }
    }
  } catch (error) {
    logger.error('Error sending position update notifications:', error);
  }
}

// POST /api/queue/:id/assign-table/:customerId - Assign table and seat customer
router.post('/:id/assign-table/:customerId', [requireAuth, loadUser], [
  body('tableNumber').notEmpty().withMessage('Table number is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Table number is required' });
    }

    const merchantId = req.user.id || req.user._id;
    const { tableNumber } = req.body;
    
    const queue = await queueService.findByMerchantAndId(merchantId, req.params.id);
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Find the customer (must be in 'called' status)
    const customer = await prisma.queueEntry.findFirst({
      where: {
        id: req.params.customerId,
        queueId: req.params.id,
        status: 'called'
      }
    });
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found or not in called status' });
    }

    // Update customer with table number and mark as completed
    const seatedCustomer = await prisma.queueEntry.update({
      where: { id: customer.id },
      data: {
        status: 'completed',
        tableNumber: tableNumber.toString(),
        completedAt: new Date()
      }
    });

    // Log the table assignment
    logger.info('Customer seated with table assignment:', {
      customerId: seatedCustomer.id,
      customerName: seatedCustomer.customerName,
      tableNumber: tableNumber,
      merchantId: merchantId
    });

    // Emit real-time updates
    req.io.to(`merchant-${merchantId}`).emit('customer-seated', {
      queueId: queue.id,
      customer: seatedCustomer,
      tableNumber: tableNumber
    });

    // Send notification to customer about being seated
    if (seatedCustomer.sessionId) {
      const notificationData = {
        tableNumber: tableNumber,
        customerName: seatedCustomer.customerName,
        message: `You have been seated at table ${tableNumber}. Thank you for using our queue system!`,
        sessionEnded: true
      };
      
      // Get all rooms the customer should be in
      const customerRooms = RoomHelpers.getCustomerRooms(seatedCustomer);
      
      // Send notification to all customer rooms
      for (const room of customerRooms) {
        req.io.to(room).emit('customer-seated-notification', notificationData);
        logger.info(`[SEATED] Sent seated notification to room: ${room}`);
      }
      
      // Clear the WebChat session
      const webChatService = require('../services/webChatService');
      webChatService.clearSession(seatedCustomer.sessionId);
      logger.info(`[SEATED] Cleared WebChat session for customer ${seatedCustomer.customerName}`);
    }

    res.json({
      success: true,
      customer: seatedCustomer
    });

  } catch (error) {
    logger.error('Error assigning table:', error);
    res.status(500).json({ error: 'Failed to assign table' });
  }
});

// POST /api/queue/:id/verify-and-seat/:customerId - Verify code and seat customer (legacy)
router.post('/:id/verify-and-seat/:customerId', [requireAuth, loadUser], [
  body('verificationCode').notEmpty().isLength({ min: 4, max: 4 }).withMessage('Verification code must be 4 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid verification code format' });
    }

    const merchantId = req.user.id || req.user._id;
    const { verificationCode } = req.body;
    
    const queue = await queueService.findByMerchantAndId(merchantId, req.params.id);
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Find the customer
    const customer = await prisma.queueEntry.findFirst({
      where: {
        id: req.params.customerId,
        queueId: req.params.id,
        status: 'called'
      }
    });
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found or not in called status' });
    }

    // Verify the code (case-insensitive)
    if (customer.verificationCode.toUpperCase() !== verificationCode.toUpperCase()) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Mark as completed (seated)
    const seatedCustomer = await queueService.removeCustomer(customer.id, 'completed');

    // WhatsApp welcome messages have been removed - using webchat notifications only
    logger.info(`Customer ${seatedCustomer.customerName} seated successfully - welcome via webchat`);

    // Send position updates
    await sendPositionUpdateNotifications(queue.id, queue.name, req.io, merchantId);

    // Emit real-time updates
    req.io.to(`merchant-${merchantId}`).emit('queue-updated', {
      queueId: queue.id,
      action: 'customer-seated-verified',
      customer: seatedCustomer
    });

    res.json({
      success: true,
      customer: seatedCustomer,
      message: 'Customer verified and seated successfully'
    });

  } catch (error) {
    logger.error('Error verifying and seating customer:', error);
    res.status(500).json({ error: 'Failed to verify and seat customer' });
  }
});

// POST /api/queue/:id/complete/:customerId - Mark customer service as completed
router.post('/:id/complete/:customerId', [requireAuth, loadUser], async (req, res) => {
  try {
    const merchantId = req.user.id || req.user._id;
    const queue = await queueService.findByMerchantAndId(merchantId, req.params.id);

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const customer = await queueService.removeCustomer(req.params.customerId, 'completed');
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found in queue' });
    }
    
    // Emit cancellation event to the customer's webchat
    if (customer.sessionId) {
      req.io.to(`webchat-${customer.sessionId}`).emit('queue-cancelled', {
        customerId: customer.id,
        customerName: customer.customerName,
        reason: req.body.reason || 'Service completed by merchant',
        type: 'merchant-removed'
      });
    }

    // WhatsApp welcome messages have been removed - using webchat notifications only
    logger.info(`Customer ${customer.customerName} seated successfully - welcome via webchat`);

    // Send position update notifications to all waiting customers
    await sendPositionUpdateNotifications(queue.id, queue.name, req.io, merchantId);

    // Emit real-time updates
    req.io.to(`merchant-${merchantId}`).emit('queue-updated', {
      queueId: queue.id,
      action: 'customer-completed',
      customer
    });

    req.io.to(`customer-${customer.customerId}`).emit('service-completed', {
      queueName: queue.name,
      completedAt: customer.completedAt
    });

    // Also emit updated queue state for comprehensive refresh
    const stats = await queueService.getQueueStats(queue.id);
    req.io.to(`merchant-${merchantId}`).emit('queue-updated', {
      queueId: queue.id,
      action: 'customer-completed',
      customer,
      queue: {
        ...queue,
        currentLength: stats.waitingCount,
        nextPosition: stats.waitingCount + 1
      }
    });

    res.json({
      success: true,
      customer,
      queue: {
        ...queue,
        currentLength: stats.waitingCount,
        nextPosition: stats.waitingCount + 1
      }
    });

  } catch (error) {
    logger.error('Error completing customer service:', error);
    res.status(500).json({ error: 'Failed to complete customer service' });
  }
});

// POST /api/queue/:id/remove/:customerId - Remove customer from queue (cancel)
router.post('/:id/remove/:customerId', [requireAuth, loadUser], async (req, res) => {
  try {
    const merchantId = req.user.id || req.user._id;
    const { reason } = req.body;
    const queue = await queueService.findByMerchantAndId(merchantId, req.params.id);
    
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }
    
    // Find the customer entry
    const customerEntry = await prisma.queueEntry.findFirst({
      where: {
        id: req.params.customerId,
        queueId: req.params.id,
        status: { in: ['waiting', 'called'] }
      }
    });
    
    if (!customerEntry) {
      return res.status(404).json({ error: 'Customer not found in queue' });
    }
    
    // Remove customer
    const removedCustomer = await queueService.removeCustomer(req.params.customerId, 'cancelled');
    
    // Emit cancellation event to the customer's webchat
    if (customerEntry.sessionId) {
      req.io.to(`webchat-${customerEntry.sessionId}`).emit('queue-cancelled', {
        customerId: customerEntry.id,
        customerName: customerEntry.customerName,
        reason: reason || 'Removed from queue by merchant',
        type: 'merchant-removed'
      });
    }
    
    // Emit updates to merchant dashboard
    req.io.to(`merchant-${merchantId}`).emit('customer-removed', {
      queueId: queue.id,
      customerId: req.params.customerId,
      action: 'merchant-cancelled'
    });
    
    // Send position updates to remaining customers
    await sendPositionUpdateNotifications(queue.id, queue.name, req.io, merchantId);
    
    res.json({
      success: true,
      message: 'Customer removed from queue successfully',
      customer: removedCustomer
    });
    
  } catch (error) {
    logger.error('Error removing customer from queue:', error);
    res.status(500).json({ error: 'Failed to remove customer from queue' });
  }
});

// POST /api/queue/:id/requeue/:customerId - Requeue completed customer back to waiting list
router.post('/:id/requeue/:customerId', [requireAuth, loadUser], async (req, res) => {
  try {
    const merchantId = req.user.id || req.user._id;
    const queue = await queueService.findByMerchantAndId(merchantId, req.params.id);

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Find the completed customer
    const customerEntry = await prisma.queueEntry.findFirst({
      where: {
        id: req.params.customerId,
        queueId: req.params.id,
        status: { in: ['completed', 'seated'] }
      }
    });

    if (!customerEntry) {
      return res.status(404).json({ error: 'Completed customer not found' });
    }

    // Check if queue is at capacity
    const stats = await queueService.getQueueStats(queue.id);
    if (stats.waitingCount >= queue.maxCapacity) {
      return res.status(400).json({ error: 'Queue is at maximum capacity' });
    }

    // Requeue the customer
    const nextPosition = stats.waitingCount + 1;
    const updatedCustomer = await prisma.queueEntry.update({
      where: { id: req.params.customerId },
      data: {
        status: 'waiting',
        position: nextPosition,
        completedAt: null,
        calledAt: null,
        requeuedAt: new Date()
      }
    });

    // WhatsApp notifications have been removed - using webchat notifications only
    logger.info(`Customer ${customerEntry.customerName} requeued successfully - notification via webchat`);

    // Emit real-time updates
    const finalStats = await queueService.getQueueStats(queue.id);
    req.io.to(`merchant-${merchantId}`).emit('queue-updated', {
      queueId: queue.id,
      action: 'customer-requeued',
      customer: updatedCustomer,
      queue: {
        ...queue,
        currentLength: finalStats.waitingCount,
        nextPosition: finalStats.waitingCount + 1
      }
    });

    req.io.to(`customer-${updatedCustomer.customerId}`).emit('customer-requeued', {
      queueName: queue.name,
      position: updatedCustomer.position,
      requeuedAt: updatedCustomer.requeuedAt
    });

    res.json({
      success: true,
      customer: updatedCustomer,
      queue: {
        ...queue,
        currentLength: finalStats.waitingCount,
        nextPosition: finalStats.waitingCount + 1
      }
    });

  } catch (error) {
    logger.error('Error requeuing customer:', error);
    res.status(500).json({ error: 'Failed to requeue customer' });
  }
});

// POST /api/queue/:id/revoke/:customerId - Revoke notification for a called customer
router.post('/:id/revoke/:customerId', [requireAuth, loadUser], async (req, res) => {
  try {
    const merchantId = req.user.id || req.user._id;
    const queue = await queueService.findByMerchantAndId(merchantId, req.params.id);

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Find the called customer - try by ID first, then by customerId
    let customerEntry = await prisma.queueEntry.findFirst({
      where: {
        id: req.params.customerId,
        queueId: req.params.id,
        status: 'called'
      }
    });

    // If not found by ID, try finding by customerId field
    if (!customerEntry) {
      customerEntry = await prisma.queueEntry.findFirst({
        where: {
          customerId: req.params.customerId,
          queueId: req.params.id,
          status: 'called'
        }
      });
    }

    if (!customerEntry) {
      // Log for debugging
      logger.error('Called customer not found for revoke:', {
        providedId: req.params.customerId,
        queueId: req.params.id,
        searchedBy: 'both id and customerId'
      });
      return res.status(404).json({ error: 'Called customer not found' });
    }

    // Revoke the notification - change status back to waiting
    const updatedCustomer = await prisma.queueEntry.update({
      where: { id: customerEntry.id },
      data: {
        status: 'waiting',
        calledAt: null,  // Clear the called timestamp
        notificationCount: 0  // Reset notification count
      }
    });

    logger.info('Customer notification revoked:', {
      customerId: updatedCustomer.id,
      customerName: updatedCustomer.customerName,
      previousStatus: 'called',
      newStatus: 'waiting',
      merchantId
    });

    // Get updated queue statistics
    const stats = await queueService.getQueueStats(queue.id);

    // Emit real-time updates
    req.io.to(`merchant-${merchantId}`).emit('queue-updated', {
      queueId: queue.id,
      action: 'notification-revoked',
      customer: updatedCustomer,
      queue: {
        ...queue,
        currentLength: stats.waitingCount,
        nextPosition: stats.waitingCount + 1
      }
    });

    // Notify the customer that their call was revoked
    const revokeData = {
      queueName: queue.name,
      message: 'Your notification has been revoked. You will be notified again when it\'s your turn.',
      entryId: updatedCustomer.id
    };
    
    // Get all rooms the customer should be in
    const customerRooms = RoomHelpers.getCustomerRooms(updatedCustomer);
    
    // Emit to all customer rooms
    for (const room of customerRooms) {
      req.io.to(room).emit('notification-revoked', revokeData);
      logger.info(`[REVOKE] Emitted revoke to room: ${room}`);
    }

    res.json({
      success: true,
      customer: updatedCustomer,
      queue: {
        ...queue,
        currentLength: stats.waitingCount,
        nextPosition: stats.waitingCount + 1
      }
    });

  } catch (error) {
    logger.error('Error revoking notification:', error);
    res.status(500).json({ error: 'Failed to revoke notification' });
  }
});

// POST /api/queue/:id/toggle-accepting - Start/Stop accepting new customers
router.post('/:id/toggle-accepting', [requireAuth, loadUser], async (req, res) => {
  try {
    const merchantId = req.user.id || req.user._id;
    const queue = await queueService.findByMerchantAndId(merchantId, req.params.id);

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Toggle accepting customers state
    const updatedQueue = await queueService.update(req.params.id, {
      acceptingCustomers: !queue.acceptingCustomers
    });

    // Log the action
    logger.info(`Queue ${queue.name} ${updatedQueue.acceptingCustomers ? 'started' : 'stopped'} accepting customers by ${req.user.businessName}`);

    // Emit real-time update
    req.io.to(`merchant-${merchantId}`).emit('queue-status-changed', {
      queueId: queue.id,
      acceptingCustomers: updatedQueue.acceptingCustomers,
      message: updatedQueue.acceptingCustomers ? 'Queue is now accepting customers' : 'Queue has stopped accepting new customers'
    });

    res.json({
      success: true,
      acceptingCustomers: updatedQueue.acceptingCustomers,
      message: updatedQueue.acceptingCustomers ? 
        'Queue is now accepting new customers' : 
        'Queue has stopped accepting new customers'
    });

  } catch (error) {
    logger.error('Error toggling queue accepting status:', error);
    res.status(500).json({ error: 'Failed to update queue status' });
  }
});

// POST /api/queue/:id/stop-accepting - Stop accepting new customers (explicit endpoint)
router.post('/:id/stop-accepting', [requireAuth, loadUser], async (req, res) => {
  try {
    const merchantId = req.user.id || req.user._id;
    const queue = await queueService.findByMerchantAndId(merchantId, req.params.id);

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    await queueService.update(req.params.id, {
      acceptingCustomers: false
    });

    // Emit real-time update
    req.io.to(`merchant-${merchantId}`).emit('queue-status-changed', {
      queueId: queue.id,
      acceptingCustomers: false,
      message: 'Queue has stopped accepting new customers'
    });

    res.json({
      success: true,
      message: 'Queue has stopped accepting new customers'
    });

  } catch (error) {
    logger.error('Error stopping queue:', error);
    res.status(500).json({ error: 'Failed to stop queue' });
  }
});

// DELETE /api/queue/:id - Delete queue
router.delete('/:id', [requireAuth, loadUser], async (req, res) => {
  try {
    const merchantId = req.user.id || req.user._id;
    const queue = await queueService.findByMerchantAndId(merchantId, req.params.id);

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Check if queue has waiting customers
    const stats = await queueService.getQueueStats(queue.id);
    if (stats.waitingCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete queue with waiting customers',
        waitingCount: stats.waitingCount
      });
    }

    await queueService.delete(req.params.id);

    // Emit real-time update
    req.io.to(`merchant-${merchantId}`).emit('queue-deleted', { queueId: req.params.id });

    res.json({ success: true, message: 'Queue deleted successfully' });

  } catch (error) {
    logger.error('Error deleting queue:', error);
    res.status(500).json({ error: 'Failed to delete queue' });
  }
});

// GET /api/queue/:id/qr - Generate QR code for queue
router.get('/:id/qr', [requireAuth, loadUser], async (req, res) => {
  try {
    const merchantId = req.user.id || req.user._id;
    const queue = await queueService.findByMerchantAndId(merchantId, req.params.id);

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const format = req.query.format || 'png'; // png or svg
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    if (format === 'svg') {
      const qrCodeSVG = await generateQueueQRSVG(queue.id, baseUrl);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(qrCodeSVG);
    } else {
      const qrCodeDataURL = await generateQueueQR(queue.id, baseUrl);
      res.json({
        success: true,
        qrCode: qrCodeDataURL,
        queueUrl: `${baseUrl}/queue/${queue.id}`
      });
    }

  } catch (error) {
    logger.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// POST /api/queues/join - Customer joins queue via web form
router.post('/join', [
  body('customerName').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required'),
  body('customerPhone').matches(/^\+?[1-9]\d{1,14}$/).withMessage('Valid phone number is required'),
  body('partySize').isInt({ min: 1, max: 20 }).withMessage('Party size must be between 1 and 20'),
  body('merchantId').notEmpty().withMessage('Merchant ID is required'),
  body('specialRequests').optional().isLength({ max: 500 }).withMessage('Special requests too long'),
  body('pushSubscription').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        message: errors.array()[0].msg,
        details: errors.array() 
      });
    }

    const { customerName, customerPhone, partySize, merchantId, specialRequests, pushSubscription } = req.body;

    // Find merchant and active queue
    const merchant = await merchantService.findById(merchantId);
    if (!merchant || !merchant.isActive) {
      return res.status(404).json({ error: 'Business not found or inactive' });
    }

    // Find active queue for merchant
    const queues = await queueService.findByMerchant(merchantId);
    const queue = queues.find(q => q.isActive);

    if (!queue) {
      return res.status(404).json({ error: 'No active queue available' });
    }

    if (!queue.acceptingCustomers) {
      return res.status(400).json({ error: 'Queue is not accepting new customers at the moment' });
    }

    // Check if queue is at capacity
    const stats = await queueService.getQueueStats(queue.id);
    if (queue.maxCapacity && stats.waitingCount >= queue.maxCapacity) {
      return res.status(400).json({ error: 'Queue is at full capacity' });
    }

    // Generate verification code
    const webChatService = require('../services/webChatService');
    const verificationCode = webChatService.generateVerificationCode();

    // Create queue entry
    const entry = await queueService.addCustomer(queue.id, {
      customerId: `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customerName,
      customerPhone,
      platform: 'web',
      partySize: parseInt(partySize),
      specialRequests,
      verificationCode
    });

    // Generate queue number
    const queueNumber = `W${String(entry.position).padStart(3, '0')}`;

    // Save push subscription if provided
    if (pushSubscription && pushSubscription.endpoint) {
      try {
        const pushNotificationService = require('../services/pushNotificationService');
        await pushNotificationService.saveSubscription(entry.id, pushSubscription);
        logger.info(`Push subscription saved for queue entry ${entry.id}`);
      } catch (subError) {
        logger.error('Error saving push subscription:', subError);
        // Don't fail the request if push subscription fails
      }
    }

    // Emit socket event for real-time update
    req.io.to(`merchant-${merchantId}`).emit('new-customer', {
      queueId: queue.id,
      entry: {
        ...entry,
        queueNumber
      }
    });

    // WhatsApp notifications have been removed - using webchat notifications only
    logger.info(`Customer ${customerName} joined queue successfully - confirmation via webchat`);

    res.json({
      success: true,
      queueNumber,
      position: entry.position,
      estimatedWaitTime: entry.estimatedWaitTime,
      verificationCode,
      queueEntry: {
        ...entry,
        queueNumber,
        merchantName: merchant.businessName
      }
    });

  } catch (error) {
    logger.error('Error joining queue:', error);
    res.status(500).json({ 
      error: 'Failed to join queue',
      message: error.message 
    });
  }
});

// Debug endpoint to check Socket.IO rooms
router.get('/debug/rooms/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Get all rooms that might contain this customer
    const allRooms = req.io.sockets.adapter.rooms;
    const relevantRooms = [];
    
    // Check specific room patterns
    const roomsToCheck = [
      `customer-${customerId}`,
      `session-${customerId}`,
      `webchat_${customerId}`
    ];
    
    // If customerId is in web format, extract phone
    if (customerId.startsWith('web_')) {
      const parts = customerId.split('_');
      if (parts.length >= 3) {
        const phone = parts[1];
        roomsToCheck.push(`phone-${phone}`);
      }
    }
    
    // Check each room
    for (const roomName of roomsToCheck) {
      const room = allRooms.get(roomName);
      if (room) {
        relevantRooms.push({
          room: roomName,
          sockets: Array.from(room)
        });
      }
    }
    
    // Get all sockets and their data
    const connectedSockets = [];
    for (const [socketId, socket] of req.io.sockets.sockets) {
      if (socket.data.phone || socket.rooms.has(`customer-${customerId}`)) {
        connectedSockets.push({
          id: socketId,
          rooms: Array.from(socket.rooms),
          data: socket.data
        });
      }
    }
    
    res.json({
      customerId,
      relevantRooms,
      connectedSockets,
      roomsChecked: roomsToCheck
    });
  } catch (error) {
    logger.error('Error checking rooms:', error);
    res.status(500).json({ error: 'Failed to check rooms' });
  }
});

// POST /api/queue/acknowledge - Customer acknowledges notification
router.post('/acknowledge', async (req, res) => {
  try {
    const { entryId, type, acknowledged } = req.body;
    
    if (!entryId) {
      return res.status(400).json({ error: 'Entry ID is required' });
    }
    
    // Find the queue entry
    const entry = await prisma.queueEntry.findUnique({
      where: { id: entryId },
      include: {
        queue: true
      }
    });
    
    if (!entry || entry.status !== 'called') {
      return res.status(404).json({ error: 'Queue entry not found or not in called status' });
    }
    
    // Update entry with acknowledgment
    const updatedEntry = await prisma.queueEntry.update({
      where: { id: entryId },
      data: {
        acknowledgedAt: new Date(),
        acknowledgmentType: type || 'on_way'
      }
    });
    
    // Emit real-time update to merchant dashboard
    const merchantId = entry.queue.merchantId;
    req.io.to(`merchant-${merchantId}`).emit('customer-acknowledged', {
      queueId: entry.queueId,
      entryId: entry.id,
      customerName: entry.customerName,
      type: type || 'on_way',
      acknowledgedAt: updatedEntry.acknowledgedAt,
      message: `${entry.customerName} is on their way!`
    });
    
    // Log the acknowledgment
    logger.info(`Customer ${entry.customerName} acknowledged notification for queue ${entry.queue.name}`);
    
    // Send confirmation back to the customer via WebSocket
    const RoomHelpers = require('../utils/roomHelpers');
    const customerRooms = RoomHelpers.getCustomerRooms(updatedEntry);
    
    // Emit acknowledgment confirmation to all customer rooms
    for (const room of customerRooms) {
      req.io.to(room).emit('acknowledgment-confirmed', {
        entryId: updatedEntry.id,
        customerId: updatedEntry.customerId,
        customerName: updatedEntry.customerName,
        type: type || 'on_way',
        acknowledgedAt: updatedEntry.acknowledgedAt,
        message: 'Your acknowledgment has been received successfully!',
        queueName: entry.queue.name
      });
      logger.info(`[ACKNOWLEDGE] Sent confirmation to room: ${room}`);
    }
    
    res.json({
      success: true,
      message: 'Acknowledgment received',
      entry: updatedEntry
    });
    
  } catch (error) {
    logger.error('Error processing acknowledgment:', error);
    res.status(500).json({ error: 'Failed to process acknowledgment' });
  }
});

module.exports = router; 