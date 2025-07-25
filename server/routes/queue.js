const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { generateQueueQR, generateQueueQRSVG } = require('../utils/qrGenerator');
const { requireAuth, loadUser } = require('../middleware/auth-bypass');
const Queue = require('../models/Queue');
const Merchant = require('../models/Merchant');

const router = express.Router();

// GET /api/queue - Get all queues for merchant
router.get('/', [requireAuth, loadUser], async (req, res) => {
  try {
    const merchantId = req.user._id;
    const queues = await Queue.find({ merchantId }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      queues: queues.map(queue => ({
        ...queue.toObject(),
        currentLength: queue.currentLength,
        nextPosition: queue.nextPosition
      }))
    });
  } catch (error) {
    logger.error('Error fetching queues:', error);
    res.status(500).json({ error: 'Failed to fetch queues' });
  }
});

// GET /api/queue/performance - Get queue performance data for dashboard
router.get('/performance', [requireAuth, loadUser], async (req, res) => {
  try {
    const merchantId = req.user._id;
    
    // Get all queues for the merchant
    const queues = await Queue.find({ merchantId }).lean();
    
    // Calculate performance metrics for each queue
    const queuePerformance = queues.map(queue => {
      const totalCustomers = queue.entries ? queue.entries.length : 0;
      const completedCustomers = queue.entries ? queue.entries.filter(e => e.status === 'completed').length : 0;
      const waitingCustomers = queue.entries ? queue.entries.filter(e => e.status === 'waiting').length : 0;
      const efficiency = totalCustomers > 0 ? Math.round((completedCustomers / totalCustomers) * 100) : 0;
      
      // Calculate average wait time
      let averageWaitTime = 0;
      if (queue.entries && queue.entries.length > 0) {
        const waitingEntries = queue.entries.filter(e => e.status === 'waiting');
        if (waitingEntries.length > 0) {
          const now = new Date();
          const totalWaitTime = waitingEntries.reduce((total, entry) => {
            const waitMinutes = Math.floor((now - new Date(entry.joinedAt)) / (1000 * 60));
            return total + waitMinutes;
          }, 0);
          averageWaitTime = Math.round(totalWaitTime / waitingEntries.length);
        }
      }
      
      return {
        id: queue._id,
        name: queue.name,
        totalCustomers,
        completedCustomers,
        currentLength: waitingCustomers,
        averageWaitTime,
        efficiency
      };
    });
    
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

// POST /api/queue - Create new queue
router.post('/', [requireAuth, loadUser], [
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

    const merchantId = req.user._id;
    const { name, description, maxCapacity, averageServiceTime } = req.body;

    // Check if merchant can create more queues
    const merchant = await Merchant.findById(merchantId);
    const existingQueues = await Queue.countDocuments({ merchantId });
    
    if (!merchant.canCreateQueue(existingQueues)) {
      return res.status(403).json({ error: 'Queue limit reached for your subscription plan' });
    }

    const queue = new Queue({
      merchantId,
      name,
      description,
      maxCapacity,
      averageServiceTime
    });

    await queue.save();

    // Emit real-time update
    req.io.to(`merchant-${merchantId}`).emit('queue-created', queue);

    res.status(201).json({
      success: true,
      queue: {
        ...queue.toObject(),
        currentLength: queue.currentLength,
        nextPosition: queue.nextPosition
      }
    });

  } catch (error) {
    logger.error('Error creating queue:', error);
    res.status(500).json({ error: 'Failed to create queue' });
  }
});

// GET /api/queue/:id - Get specific queue
router.get('/:id', [requireAuth, loadUser], async (req, res) => {
  try {
    const merchantId = req.user._id;
    const queue = await Queue.findOne({ _id: req.params.id, merchantId });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    res.json({
      success: true,
      queue: {
        ...queue.toObject(),
        currentLength: queue.currentLength,
        nextPosition: queue.nextPosition
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

    const merchantId = req.user._id;
    const queue = await Queue.findOne({ _id: req.params.id, merchantId });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        queue[key] = req.body[key];
      }
    });

    await queue.save();

    // Emit real-time update
    req.io.to(`merchant-${merchantId}`).emit('queue-updated', {
      queueId: queue._id,
      action: 'queue-modified',
      queue
    });

    res.json({
      success: true,
      queue: {
        ...queue.toObject(),
        currentLength: queue.currentLength,
        nextPosition: queue.nextPosition
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
    const merchantId = req.user._id;
    const queue = await Queue.findOne({ _id: req.params.id, merchantId });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const nextCustomer = await queue.callNext();
    
    if (!nextCustomer) {
      return res.status(400).json({ error: 'No customers waiting in queue' });
    }

    await queue.save();

    // Send notifications to customer (Push & WhatsApp)
    try {
      // Try push notification first
      const pushNotificationService = require('../services/pushNotificationService');
      const pushSent = await pushNotificationService.notifyTableReady(
        nextCustomer.id || nextCustomer._id,
        `#${nextCustomer.position}`,
        queue.merchant?.businessName || 'Restaurant'
      );
      
      if (pushSent) {
        logger.info(`Push notification sent to ${nextCustomer.customerName}`);
      }
      
      // Also try WhatsApp if available
      const whatsappService = require('../services/whatsappService');
      const notificationMessage = `🔔 It's your turn ${nextCustomer.customerName}!\n\n📍 Queue: ${queue.name}\n🎫 Your position: #${nextCustomer.position}\n👥 Party size: ${nextCustomer.partySize} pax\n\n🔐 YOUR VERIFICATION CODE: ${nextCustomer.verificationCode}\n\nPlease show this code to our staff to be seated.\n\n⏰ Please present yourself within 10 minutes or your spot may be given away.`;
      
      await whatsappService.sendMessage(nextCustomer.customerPhone, notificationMessage);
      logger.info(`WhatsApp notification sent to ${nextCustomer.customerPhone} for queue ${queue.name}`);
    } catch (error) {
      logger.error('Error sending customer notification:', error);
    }

    // Emit real-time updates
    req.io.to(`merchant-${merchantId}`).emit('queue-updated', {
      queueId: queue._id,
      action: 'customer-called',
      customer: nextCustomer,
      queue: {
        ...queue.toObject(),
        currentLength: queue.currentLength,
        nextPosition: queue.nextPosition
      }
    });

    req.io.to(`customer-${nextCustomer.customerId}`).emit('customer-called', {
      queueName: queue.name,
      position: nextCustomer.position
    });

    res.json({
      success: true,
      customer: {
        ...nextCustomer,
        verificationCode: nextCustomer.verificationCode
      },
      queue: {
        ...queue.toObject(),
        currentLength: queue.currentLength,
        nextPosition: queue.nextPosition
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

    const merchantId = req.user._id;
    const { customerId } = req.body;
    const queue = await Queue.findOne({ _id: req.params.id, merchantId });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Find the specific customer
    const customerEntry = queue.entries.find(entry => 
      entry._id.toString() === customerId && entry.status === 'waiting'
    );

    if (!customerEntry) {
      return res.status(404).json({ error: 'Customer not found or not waiting' });
    }

    // Call the specific customer
    customerEntry.status = 'called';
    customerEntry.calledAt = new Date();

    await queue.save();

    // Send notifications to customer (Push & WhatsApp)
    try {
      // Try push notification first
      const pushNotificationService = require('../services/pushNotificationService');
      const pushSent = await pushNotificationService.notifyTableReady(
        customerEntry.id || customerEntry._id,
        `#${customerEntry.position}`,
        queue.merchant?.businessName || 'Restaurant'
      );
      
      if (pushSent) {
        logger.info(`Push notification sent to ${customerEntry.customerName} (specific call)`);
      }
      
      // Also send WhatsApp notification
      const whatsappService = require('../services/whatsappService');
      const notificationMessage = `🔔 It's your turn ${customerEntry.customerName}!\n\n📍 Queue: ${queue.name}\n🎫 Your position: #${customerEntry.position}\n👥 Party size: ${customerEntry.partySize} pax\n\n⚡ You've been called ahead of schedule!\nPlease come to the service counter now. Thank you for waiting!\n\n⏰ Please present yourself within 10 minutes or your table will self destruct. Kindly inform your name and number to our crew.`;
      
      await whatsappService.sendMessage(customerEntry.customerPhone, notificationMessage);
      logger.info(`WhatsApp notification sent to ${customerEntry.customerPhone} for queue ${queue.name} (specific call)`);
    } catch (error) {
      logger.error('Error sending customer notification:', error);
    }

    // Emit real-time updates
    req.io.to(`merchant-${merchantId}`).emit('queue-updated', {
      queueId: queue._id,
      action: 'customer-called-specific',
      customer: customerEntry,
      queue: {
        ...queue.toObject(),
        currentLength: queue.currentLength,
        nextPosition: queue.nextPosition
      }
    });

    req.io.to(`customer-${customerEntry.customerId}`).emit('customer-called', {
      queueName: queue.name,
      position: customerEntry.position,
      isSpecificCall: true
    });

    res.json({
      success: true,
      customer: customerEntry,
      queue: {
        ...queue.toObject(),
        currentLength: queue.currentLength,
        nextPosition: queue.nextPosition
      }
    });

  } catch (error) {
    logger.error('Error calling specific customer:', error);
    res.status(500).json({ error: 'Failed to call specific customer' });
  }
});

// Function to send position update notifications to all waiting customers
async function sendPositionUpdateNotifications(queue, io, merchantId) {
  try {
    const whatsappService = require('../services/whatsappService');
    const pushNotificationService = require('../services/pushNotificationService');
    const waitingCustomers = queue.entries.filter(entry => entry.status === 'waiting');
    
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
        
        // Also send WhatsApp notification
        const notificationMessage = `📍 Queue Update ${customer.customerName}!\n\n🏪 ${queue.name}\n🎫 Your position: #${customer.position}\n👥 Party size: ${customer.partySize} pax\n⏱️ Estimated wait: ${customer.estimatedWaitTime} minutes\n\n✅ Someone has been seated - you're moving up in the queue!`;
        
        await whatsappService.sendMessage(customer.customerPhone, notificationMessage);
        logger.info(`WhatsApp position update sent to ${customer.customerPhone} - Position: #${customer.position}`);
      } catch (error) {
        logger.error(`Error sending position update to ${customer.customerPhone}:`, error);
      }
    }
  } catch (error) {
    logger.error('Error sending position update notifications:', error);
  }
}

// POST /api/queue/:id/verify-and-seat/:customerId - Verify code and seat customer
router.post('/:id/verify-and-seat/:customerId', [requireAuth, loadUser], [
  body('verificationCode').notEmpty().isLength({ min: 4, max: 4 }).withMessage('Verification code must be 4 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid verification code format' });
    }

    const merchantId = req.user._id;
    const { verificationCode } = req.body;
    
    const queue = await Queue.findOne({ _id: req.params.id, merchantId });
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Find the customer
    const customer = queue.entries?.find(e => 
      (e.customerId === req.params.customerId || e.id === req.params.customerId) && 
      e.status === 'called'
    );
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found or not in called status' });
    }

    // Verify the code (case-insensitive)
    if (customer.verificationCode.toUpperCase() !== verificationCode.toUpperCase()) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Mark as completed (seated)
    const seatedCustomer = await queue.removeCustomer(customer.customerId || customer.id, 'completed');
    await queue.save();

    // Send welcome message with menu link
    try {
      const whatsappService = require('../services/whatsappService');
      const merchant = await Merchant.findById(merchantId);
      const menuUrl = merchant?.settings?.menuUrl || 'https://beepdeliveryops.beepit.com/dine?s=5e806691322bdd231653d70c&from=home';
      
      const welcomeMessage = `🎉 Welcome ${seatedCustomer.customerName}!\n\n✅ You've been seated successfully!\n👥 Party size: ${seatedCustomer.partySize} pax\n\n🍽️ Ready to order? Check out our menu:\n\n📱 Online Menu: ${menuUrl}\n\n🛎️ Need assistance? Our staff will be right with you!\n\nEnjoy your dining experience!`;
      
      await whatsappService.sendMessage(seatedCustomer.customerPhone, welcomeMessage);
    } catch (error) {
      logger.error('Error sending welcome message:', error);
    }

    // Send position updates
    await sendPositionUpdateNotifications(queue, req.io, merchantId);

    // Emit real-time updates
    req.io.to(`merchant-${merchantId}`).emit('queue-updated', {
      queueId: queue._id,
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
    const merchantId = req.user._id;
    const queue = await Queue.findOne({ _id: req.params.id, merchantId });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const customer = await queue.removeCustomer(req.params.customerId, 'completed');
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found in queue' });
    }

    await queue.save();

    // Send welcome message with menu link to the seated customer
    try {
      const whatsappService = require('../services/whatsappService');
      const merchant = await Merchant.findById(merchantId);
      // Get merchant menu URL if available
      const menuUrl = merchant?.settings?.menuUrl || 'https://beepdeliveryops.beepit.com/dine?s=5e806691322bdd231653d70c&from=home';
      
      const welcomeMessage = `🎉 Welcome ${customer.customerName}!\n\n✅ You've been seated successfully!\n👥 Party size: ${customer.partySize} pax\n\n🍽️ Ready to order? Check out our menu:\n\n📱 Online Menu: ${menuUrl}\n\n🛎️ Need assistance? Our staff will be right with you!\n\nEnjoy your dining experience!`;
      
      await whatsappService.sendMessage(customer.customerPhone, welcomeMessage);
      logger.info(`Welcome message with menu link sent to ${customer.customerPhone} for queue ${queue.name}`);
    } catch (error) {
      logger.error('Error sending welcome message:', error);
    }

    // Send position update notifications to all waiting customers
    await sendPositionUpdateNotifications(queue, req.io, merchantId);

    // Emit real-time updates
    req.io.to(`merchant-${merchantId}`).emit('queue-updated', {
      queueId: queue._id,
      action: 'customer-completed',
      customer
    });

    req.io.to(`customer-${customer.customerId}`).emit('service-completed', {
      queueName: queue.name,
      completedAt: customer.completedAt
    });

    // Also emit updated queue state for comprehensive refresh
    req.io.to(`merchant-${merchantId}`).emit('queue-updated', {
      queueId: queue._id,
      action: 'customer-completed',
      customer,
      queue: {
        ...queue.toObject(),
        currentLength: queue.currentLength,
        nextPosition: queue.nextPosition
      }
    });

    res.json({
      success: true,
      customer,
      queue: {
        ...queue.toObject(),
        currentLength: queue.currentLength,
        nextPosition: queue.nextPosition
      }
    });

  } catch (error) {
    logger.error('Error completing customer service:', error);
    res.status(500).json({ error: 'Failed to complete customer service' });
  }
});

// POST /api/queue/:id/requeue/:customerId - Requeue completed customer back to waiting list
router.post('/:id/requeue/:customerId', [requireAuth, loadUser], async (req, res) => {
  try {
    const merchantId = req.user._id;
    const queue = await Queue.findOne({ _id: req.params.id, merchantId });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Find the completed customer
    const customerEntry = queue.entries.find(entry => 
      entry.customerId === req.params.customerId && 
      (entry.status === 'completed' || entry.status === 'seated')
    );

    if (!customerEntry) {
      return res.status(404).json({ error: 'Completed customer not found' });
    }

    // Check if queue is at capacity
    const currentWaitingCount = queue.entries.filter(entry => entry.status === 'waiting').length;
    if (currentWaitingCount >= queue.maxCapacity) {
      return res.status(400).json({ error: 'Queue is at maximum capacity' });
    }

    // Requeue the customer
    customerEntry.status = 'waiting';
    customerEntry.position = queue.nextPosition;
    customerEntry.completedAt = null;
    customerEntry.calledAt = null;
    customerEntry.requeuedAt = new Date();

    // Update positions for all waiting customers
    await queue.updatePositions();

    await queue.save();

    // Send WhatsApp notification to customer
    try {
      const whatsappService = require('../services/whatsappService');
      const notificationMessage = `🔄 You've been requeued ${customerEntry.customerName}!\n\n📍 Queue: ${queue.name}\n🎫 Your new position: #${customerEntry.position}\n👥 Party size: ${customerEntry.partySize} pax\n\nYou've been added back to the waiting list. We'll notify you when it's your turn. Thank you for your patience!`;
      
      await whatsappService.sendMessage(customerEntry.customerPhone, notificationMessage);
      logger.info(`Requeue notification sent to ${customerEntry.customerPhone} for queue ${queue.name}`);
    } catch (error) {
      logger.error('Error sending requeue notification:', error);
    }

    // Emit real-time updates
    req.io.to(`merchant-${merchantId}`).emit('queue-updated', {
      queueId: queue._id,
      action: 'customer-requeued',
      customer: customerEntry,
      queue: {
        ...queue.toObject(),
        currentLength: queue.currentLength,
        nextPosition: queue.nextPosition
      }
    });

    req.io.to(`customer-${customerEntry.customerId}`).emit('customer-requeued', {
      queueName: queue.name,
      position: customerEntry.position,
      requeuedAt: customerEntry.requeuedAt
    });

    res.json({
      success: true,
      customer: customerEntry,
      queue: {
        ...queue.toObject(),
        currentLength: queue.currentLength,
        nextPosition: queue.nextPosition
      }
    });

  } catch (error) {
    logger.error('Error requeuing customer:', error);
    res.status(500).json({ error: 'Failed to requeue customer' });
  }
});

// POST /api/queue/:id/toggle-accepting - Start/Stop accepting new customers
router.post('/:id/toggle-accepting', [requireAuth, loadUser], async (req, res) => {
  try {
    const merchantId = req.user._id;
    const queue = await Queue.findOne({ _id: req.params.id, merchantId });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Toggle accepting customers state
    queue.acceptingCustomers = !queue.acceptingCustomers;
    await queue.save();

    // Log the action
    logger.info(`Queue ${queue.name} ${queue.acceptingCustomers ? 'started' : 'stopped'} accepting customers by ${req.user.businessName}`);

    // Emit real-time update
    req.io.to(`merchant-${merchantId}`).emit('queue-status-changed', {
      queueId: queue._id,
      acceptingCustomers: queue.acceptingCustomers,
      message: queue.acceptingCustomers ? 'Queue is now accepting customers' : 'Queue has stopped accepting new customers'
    });

    res.json({
      success: true,
      acceptingCustomers: queue.acceptingCustomers,
      message: queue.acceptingCustomers ? 
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
    const merchantId = req.user._id;
    const queue = await Queue.findOne({ _id: req.params.id, merchantId });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    queue.acceptingCustomers = false;
    await queue.save();

    // Emit real-time update
    req.io.to(`merchant-${merchantId}`).emit('queue-status-changed', {
      queueId: queue._id,
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
    const merchantId = req.user._id;
    const queue = await Queue.findOne({ _id: req.params.id, merchantId });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Check if queue has waiting customers
    const waitingCustomers = queue.entries.filter(entry => entry.status === 'waiting');
    if (waitingCustomers.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete queue with waiting customers',
        waitingCount: waitingCustomers.length
      });
    }

    await Queue.findByIdAndDelete(req.params.id);

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
    const merchantId = req.user._id;
    const queue = await Queue.findOne({ _id: req.params.id, merchantId });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const format = req.query.format || 'png'; // png or svg
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    if (format === 'svg') {
      const qrCodeSVG = await generateQueueQRSVG(queue._id, baseUrl);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(qrCodeSVG);
    } else {
      const qrCodeDataURL = await generateQueueQR(queue._id, baseUrl);
      res.json({
        success: true,
        qrCode: qrCodeDataURL,
        queueUrl: `${baseUrl}/queue/${queue._id}`
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
    const merchant = await Merchant.findById(merchantId);
    if (!merchant || !merchant.isActive) {
      return res.status(404).json({ error: 'Business not found or inactive' });
    }

    // Find active queue for merchant
    const queue = await Queue.findOne({ 
      merchantId: merchant.id || merchant._id, 
      isActive: true 
    });

    if (!queue) {
      return res.status(404).json({ error: 'No active queue available' });
    }

    // Check if queue is at capacity
    const currentCount = queue.entries?.filter(e => e.status === 'waiting').length || 0;
    if (queue.maxCapacity && currentCount >= queue.maxCapacity) {
      return res.status(400).json({ error: 'Queue is at full capacity' });
    }

    // Create queue entry
    const entry = await prisma.queueEntry.create({
      data: {
        queueId: queue.id,
        customerId: `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        customerName,
        customerPhone,
        platform: 'web',
        partySize: parseInt(partySize),
        specialRequests,
        position: currentCount + 1,
        estimatedWaitTime: (currentCount + 1) * (queue.averageServiceTime || 15)
      }
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
    const io = req.app.get('io');
    if (io) {
      io.to(merchantId).emit('new-customer', {
        queueId: queue.id,
        entry: {
          ...entry,
          queueNumber
        }
      });
    }

    // Send WhatsApp notification if enabled
    try {
      const whatsappService = require('../services/whatsappService');
      const confirmationMessage = `🎉 Welcome ${customerName}!\n\n✅ You've joined the queue at ${merchant.businessName}\n🎫 Queue Number: ${queueNumber}\n👥 Party Size: ${partySize}\n📍 Position: #${entry.position}\n⏱️ Estimated Wait: ${entry.estimatedWaitTime} minutes\n\nWe'll notify you when your table is ready!`;
      
      await whatsappService.sendMessage(customerPhone, confirmationMessage);
    } catch (notifError) {
      logger.error('Error sending WhatsApp notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.json({
      success: true,
      queueNumber,
      position: entry.position,
      estimatedWaitTime: entry.estimatedWaitTime,
      queueEntry: entry
    });

  } catch (error) {
    logger.error('Error joining queue:', error);
    res.status(500).json({ 
      error: 'Failed to join queue',
      message: error.message 
    });
  }
});

module.exports = router; 