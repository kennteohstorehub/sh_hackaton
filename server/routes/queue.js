const express = require('express');
const { body, validationResult } = require('express-validator');
const Queue = require('../models/Queue');
const Merchant = require('../models/Merchant');
const logger = require('../utils/logger');
const { generateQueueQR, generateQueueQRSVG } = require('../utils/qrGenerator');

const router = express.Router();

// Mock user for demo purposes
const mockUser = {
  id: '507f1f77bcf86cd799439011',
  email: 'demo@smartqueue.com',
  businessName: 'Demo Restaurant',
  businessType: 'restaurant'
};

// Middleware to set mock user for API
const setMockUser = (req, res, next) => {
  req.session.user = mockUser;
  next();
};

// GET /api/queue - Get all queues for merchant
router.get('/', setMockUser, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
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

// POST /api/queue - Create new queue
router.post('/', setMockUser, [
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

    const merchantId = req.session.user.id;
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
router.get('/:id', setMockUser, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
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
router.put('/:id', setMockUser, [
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

    const merchantId = req.session.user.id;
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
router.post('/:id/call-next', setMockUser, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
    const queue = await Queue.findOne({ _id: req.params.id, merchantId });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const nextCustomer = queue.callNext();
    
    if (!nextCustomer) {
      return res.status(400).json({ error: 'No customers waiting in queue' });
    }

    await queue.save();

    // Send WhatsApp notification to customer
    try {
      const whatsappService = require('../services/whatsappService');
              const notificationMessage = `🔔 It's your turn ${nextCustomer.customerName}!\n\n📍 Queue: ${queue.name}\n🎫 Your position: #${nextCustomer.position}\n👥 Party size: ${nextCustomer.partySize} pax\n\nPlease come to the service counter now. Thank you for waiting!\n\n⏰ Please present yourself within 10 minutes or your table will self destruct. Kindly inform your name and number to our crew.`;
      
      await whatsappService.sendMessage(nextCustomer.customerPhone, notificationMessage);
      logger.info(`Notification sent to ${nextCustomer.customerPhone} for queue ${queue.name}`);
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
      customer: nextCustomer,
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
router.post('/:id/call-specific', setMockUser, [
  body('customerId').notEmpty().withMessage('Customer ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const merchantId = req.session.user.id;
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

    // Send WhatsApp notification to customer
    try {
      const whatsappService = require('../services/whatsappService');
              const notificationMessage = `🔔 It's your turn ${customerEntry.customerName}!\n\n📍 Queue: ${queue.name}\n🎫 Your position: #${customerEntry.position}\n👥 Party size: ${customerEntry.partySize} pax\n\n⚡ You've been called ahead of schedule!\nPlease come to the service counter now. Thank you for waiting!\n\n⏰ Please present yourself within 10 minutes or your table will self destruct. Kindly inform your name and number to our crew.`;
      
      await whatsappService.sendMessage(customerEntry.customerPhone, notificationMessage);
      logger.info(`Priority notification sent to ${customerEntry.customerPhone} for queue ${queue.name}`);
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
      priority: true
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
    const waitingCustomers = queue.entries.filter(entry => entry.status === 'waiting');
    
    for (const customer of waitingCustomers) {
      try {
        const notificationMessage = `📍 Queue Update ${customer.customerName}!\n\n🏪 ${queue.name}\n🎫 Your position: #${customer.position}\n👥 Party size: ${customer.partySize} pax\n⏱️ Estimated wait: ${customer.estimatedWaitTime} minutes\n\n✅ Someone has been seated - you're moving up in the queue!`;
        
        await whatsappService.sendMessage(customer.customerPhone, notificationMessage);
        logger.info(`Position update notification sent to ${customer.customerPhone} - Position: #${customer.position}`);
      } catch (error) {
        logger.error(`Error sending position update to ${customer.customerPhone}:`, error);
      }
    }
  } catch (error) {
    logger.error('Error sending position update notifications:', error);
  }
}

// POST /api/queue/:id/complete/:customerId - Mark customer service as completed
router.post('/:id/complete/:customerId', setMockUser, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
    const queue = await Queue.findOne({ _id: req.params.id, merchantId });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const customer = queue.removeCustomer(req.params.customerId, 'completed');
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found in queue' });
    }

    await queue.save();

    // Send welcome message with menu link to the seated customer
    try {
      const whatsappService = require('../services/whatsappService');
      const welcomeMessage = `🎉 Welcome ${customer.customerName}!\n\n✅ You've been seated successfully!\n👥 Party size: ${customer.partySize} pax\n\n🍽️ Ready to order? Check out our menu:\n\n📱 Online Menu: https://beepdeliveryops.beepit.com/dine?s=5e806691322bdd231653d70c&from=home\n\n🛎️ If you prefer to be served by a human, please shout for help!\n\nEnjoy your dining experience!`;
      
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
router.post('/:id/requeue/:customerId', setMockUser, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
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
    queue.updatePositions();

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

// DELETE /api/queue/:id - Delete queue
router.delete('/:id', setMockUser, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
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
router.get('/:id/qr', setMockUser, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
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

module.exports = router; 