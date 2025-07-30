const express = require('express');
const { body, validationResult } = require('express-validator');
const queueService = require('../services/queueService');
const merchantService = require('../services/merchantService');
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/customer/join/:queueId - Join a specific queue (for direct booking)
router.post('/join/:queueId', [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required'),
  body('phone').matches(/^\+?[1-9]\d{1,14}$/).withMessage('Valid phone number is required'),
  body('partySize').optional().isInt({ min: 1, max: 20 }).withMessage('Party size must be between 1 and 20'),
  body('specialRequests').optional().isLength({ max: 500 }).withMessage('Special requests too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { queueId } = req.params;
    const { name, phone, partySize, specialRequests } = req.body;

    const queue = await queueService.findById(queueId, { entries: true, merchant: true });
    
    if (!queue || !queue.isActive) {
      return res.status(404).json({ error: 'Queue not found or inactive' });
    }

    // Check if queue is accepting new customers
    if (!queue.acceptingCustomers) {
      return res.status(400).json({ 
        error: 'Queue is not accepting new customers',
        message: 'The queue has been temporarily closed for new entries. Please try again later or contact the restaurant.'
      });
    }

    const merchant = queue.merchant || await merchantService.findById(queue.merchantId);
    
    // Check if business is open (skip if method doesn't exist)
    if (merchant.isBusinessOpen && !merchant.isBusinessOpen()) {
      const joinCutoff = merchant.settings?.queue?.joinCutoffTime || 30;
      return res.status(400).json({ 
        error: 'Restaurant is closed or not accepting new customers',
        message: `Queue closes ${joinCutoff} minutes before restaurant closing time`
      });
    }
    
    // Check party size limits (with default values if method doesn't exist)
    const partySizeLimits = merchant.getPartySizeLimits ? merchant.getPartySizeLimits() : { min: 1, max: 20 };
    const requestedPartySize = partySize || 1;
    
    if (requestedPartySize < partySizeLimits.min || requestedPartySize > partySizeLimits.max) {
      const isPeak = merchant.isPeakHour ? merchant.isPeakHour() : false;
      return res.status(400).json({
        error: 'Party size not allowed',
        message: `Party size must be between ${partySizeLimits.min} and ${partySizeLimits.max} during ${isPeak ? 'peak hours' : 'regular hours'}`,
        limits: partySizeLimits
      });
    }
    
    // Check if queue should auto-pause (skip if method doesn't exist)
    const currentOccupancy = queue.entries.filter(e => e.status === 'serving').length;
    if (merchant.shouldAutoPause && merchant.shouldAutoPause(currentOccupancy)) {
      return res.status(400).json({
        error: 'Queue temporarily paused',
        message: 'Restaurant is at capacity. Please try again in a few minutes.'
      });
    }
    
    // Check queue capacity
    const maxQueueSize = merchant?.settings?.queue?.maxQueueSize || queue.maxCapacity || 50;
    if (queue.currentLength >= maxQueueSize) {
      return res.status(400).json({ 
        error: 'Queue is full',
        maxCapacity: maxQueueSize,
        currentLength: queue.currentLength
      });
    }

    // Generate unique customer ID and session ID
    const timestamp = Date.now();
    const customerId = `web_${phone}_${timestamp}`;
    const sessionId = `qc_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if customer is already in queue
    const existingCustomer = queue.entries.find(entry => 
      entry.customerPhone === phone && entry.status === 'waiting'
    );

    if (existingCustomer) {
      return res.status(400).json({ 
        error: 'You are already in this queue',
        position: existingCustomer.position,
        estimatedWaitTime: existingCustomer.estimatedWaitTime
      });
    }

    // Generate verification code
    const generateVerificationCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };
    
    const verificationCode = generateVerificationCode();
    
    // Add customer to queue with sessionId
    const newEntry = await queueService.addCustomer(queue.id, {
      customerId,
      customerName: name,
      customerPhone: phone,
      platform: 'web',
      serviceTypeId: null, // Would be set if service types were implemented
      partySize: parseInt(partySize) || 1,
      specialRequests: specialRequests || '',
      verificationCode: verificationCode,
      sessionId: sessionId // Add sessionId for webchat
    });

    // Calculate estimated wait time
    const position = newEntry.position;
    const estimatedWait = Math.max(0, (position - 1) * (queue.averageServiceTime || 15));

    // Send welcome WhatsApp message to customer
    try {
      const whatsappService = require('../services/whatsappService');
      
      // Use merchant's custom join template or fallback to default
      const template = merchant.settings?.notifications?.templates?.join || 
        'Welcome to {RestaurantName}! 🍽️ You\'re #{Position} in queue (Party of {PartySize}). Estimated wait: ~{WaitTime} minutes. We\'ll notify you when your table is ready!';
      
      // Replace placeholders in template
      const welcomeMessage = template
        .replace('{RestaurantName}', merchant.businessName || queue.name)
        .replace('{CustomerName}', name)
        .replace('{Position}', position)
        .replace('{PartySize}', newEntry.partySize)
        .replace('{WaitTime}', estimatedWait);
      
      await whatsappService.sendMessage(phone, welcomeMessage);
      logger.info(`Welcome message sent to ${phone} for joining queue ${queue.name}`);
    } catch (error) {
      logger.error('Error sending welcome message:', error);
    }

    // Emit real-time update
    req.io.to(`merchant-${queue.merchantId}`).emit('queue-updated', {
      queueId: queue.id,
      action: 'customer-joined',
      customer: newEntry,
      queue: {
        ...queue,
        currentLength: queue.currentLength,
        nextPosition: queue.nextPosition
      }
    });

    // Include verification code and sessionId in response
    const responseEntry = newEntry.toObject ? newEntry.toObject() : newEntry;
    responseEntry.verificationCode = verificationCode;
    responseEntry.sessionId = sessionId;
    
    res.status(201).json({
      success: true,
      entryId: newEntry.id || newEntry._id,  // Include the entry ID
      position,
      estimatedWait,
      customer: responseEntry,
      queue: {
        id: queue.id,
        name: queue.name,
        currentLength: queue.currentLength
      },
      statusUrl: `/queue-status/${queue.id}/${customerId}`,
      chatUrl: `/queue-chat/${sessionId}`
    });

  } catch (error) {
    logger.error('Error joining queue:', error);
    console.error('[CUSTOMER JOIN ERROR]', error.message, error.stack);
    res.status(500).json({ 
      error: 'Failed to join queue',
      message: error.message
    });
  }
});

// POST /api/customer/join - Join a queue
router.post('/join', [
  body('queueId').isMongoId().withMessage('Please select a queue first'),
  body('customerName').trim().isLength({ min: 1, max: 100 }).withMessage('Customer name required'),
  body('customerPhone').matches(/^\+?[0-9]{7,15}$/).withMessage('Valid phone number required (e.g., +60123456789)'),
  body('serviceType').trim().isLength({ min: 1 }).withMessage('Service type required'),
  body('platform').isIn(['whatsapp', 'messenger', 'web']).withMessage('Valid platform required'),
  body('partySize').optional().isInt({ min: 1, max: 20 }).withMessage('Party size must be between 1 and 20')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.error('Customer join validation failed:', {
        body: req.body,
        errors: errors.array()
      });
      return res.status(400).json({ 
        error: 'Validation failed', 
        message: errors.array()[0].msg,
        details: errors.array() 
      });
    }

    const { queueId, customerName, customerPhone, serviceType, platform, partySize } = req.body;

    const queue = await queueService.findById(queueId, { entries: true, merchant: true });
    
    if (!queue || !queue.isActive) {
      return res.status(404).json({ error: 'Queue not found or inactive' });
    }

    // Check if queue is accepting new customers
    if (!queue.acceptingCustomers) {
      return res.status(400).json({ 
        error: 'Queue is not accepting new customers',
        message: 'The queue has been temporarily closed for new entries. Please try again later or contact the restaurant.'
      });
    }

    // Check if business is open
    if (!queue.merchantId.isBusinessOpen()) {
      return res.status(400).json({ 
        error: 'Business is currently closed',
        businessHours: queue.merchantId.businessHours
      });
    }

    // Check queue capacity
    if (queue.currentLength >= queue.maxCapacity) {
      return res.status(400).json({ 
        error: 'Queue is full',
        maxCapacity: queue.maxCapacity,
        currentLength: queue.currentLength
      });
    }

    // Generate unique customer ID
    const customerId = `${platform}_${customerPhone}_${Date.now()}`;

    // Check if customer is already in queue
    const existingCustomer = queue.entries.find(entry => 
      entry.customerPhone === customerPhone && entry.status === 'waiting'
    );

    if (existingCustomer) {
      return res.status(400).json({ 
        error: 'Already in queue',
        position: existingCustomer.position,
        estimatedWaitTime: existingCustomer.estimatedWaitTime
      });
    }

    // Add customer to queue
    const newEntry = await queueService.addCustomer(queue.id, {
      customerId,
      customerName,
      customerPhone,
      platform,
      serviceType,
      partySize: partySize || 1
    });

    // Send confirmation WhatsApp message to customer
    try {
      const whatsappService = require('../services/whatsappService');
      const merchant = queue.merchant || await merchantService.findById(queue.merchantId);
      
      // Use merchant's custom join template or fallback to default
      const template = merchant.settings?.notifications?.templates?.join || 
        'Welcome to {RestaurantName}! 🍽️ You\'re #{Position} in queue (Party of {PartySize}). Estimated wait: ~{WaitTime} minutes. We\'ll notify you when your table is ready!';
      
      // Replace placeholders in template
      const confirmationMessage = template
        .replace('{RestaurantName}', merchant.businessName || queue.name)
        .replace('{CustomerName}', customerName)
        .replace('{Position}', newEntry.position)
        .replace('{PartySize}', newEntry.partySize)
        .replace('{WaitTime}', newEntry.estimatedWaitTime);
      
      await whatsappService.sendMessage(newEntry.customerPhone, confirmationMessage);
      logger.info(`Confirmation sent to ${newEntry.customerPhone} for joining queue ${queue.name}`);
    } catch (error) {
      logger.error('Error sending join confirmation:', error);
    }

    // Emit real-time update
    req.io.to(`merchant-${queue.merchantId}`).emit('queue-updated', {
      queueId: queue.id,
      action: 'customer-joined',
      customer: newEntry,
      queue: {
        ...queue,
        currentLength: queue.currentLength,
        nextPosition: queue.nextPosition
      }
    });

    res.status(201).json({
      success: true,
      customer: newEntry,
      queue: {
        id: queue.id,
        name: queue.name,
        currentLength: queue.currentLength
      },
      statusUrl: `/queue-status/${queue.id}/${customerId}`
    });

  } catch (error) {
    logger.error('Error joining queue:', error);
    console.error('[CUSTOMER JOIN ERROR]', error.message, error.stack);
    res.status(500).json({ 
      error: 'Failed to join queue',
      message: error.message
    });
  }
});

// GET /api/customer/status/:queueId/:customerId - Get customer status
router.get('/status/:queueId/:customerId', async (req, res) => {
  try {
    const { queueId, customerId } = req.params;

    const queue = await queueService.findById(queueId, { entries: true, merchant: true });
    
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const customer = queue.entries?.find(e => e.customerId === customerId);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found in queue' });
    }

    // Calculate current position for waiting customers
    let currentPosition = customer.position;
    if (customer.status === 'waiting') {
      const waitingCustomers = queue.entries
        .filter(entry => entry.status === 'waiting')
        .sort((a, b) => a.position - b.position);
      
      const customerIndex = waitingCustomers.findIndex(entry => entry.customerId === customerId);
      currentPosition = customerIndex + 1;
    }

    res.json({
      success: true,
      customer: {
        ...customer.toObject(),
        currentPosition
      },
      queue: {
        id: queue.id,
        name: queue.name,
        currentLength: queue.currentLength
      },
      merchant: {
        businessName: queue.merchantId.businessName,
        businessType: queue.merchantId.businessType
      }
    });

  } catch (error) {
    logger.error('Error getting customer status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// POST /api/customer/cancel - Cancel queue position
router.post('/cancel', [
  body('queueId').isMongoId().withMessage('Valid queue ID required'),
  body('customerId').trim().isLength({ min: 1 }).withMessage('Customer ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { queueId, customerId } = req.body;

    const queue = await queueService.findById(queueId, {
      entries: true,
      merchant: true
    });
    
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const customer = queue.entries?.find(e => e.customerId === customerId);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found in queue' });
    }

    if (customer.status !== 'waiting') {
      return res.status(400).json({ 
        error: 'Cannot cancel - customer is not waiting',
        status: customer.status
      });
    }

    // Remove customer from queue
    const removedCustomer = await queueService.removeCustomer(queue.id, customerId, 'cancelled');

    // Emit real-time update
    req.io.to(`merchant-${queue.merchantId}`).emit('queue-updated', {
      queueId: queue.id,
      action: 'customer-cancelled',
      customerId
    });

    res.json({
      success: true,
      message: 'Successfully cancelled queue position',
      customer: removedCustomer
    });

  } catch (error) {
    logger.error('Error cancelling queue position:', error);
    res.status(500).json({ error: 'Failed to cancel position' });
  }
});

module.exports = router; 