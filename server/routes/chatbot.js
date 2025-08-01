const express = require('express');
const router = express.Router();
const chatbotService = require('../services/chatbotService');
const { body, validationResult } = require('express-validator');

// WhatsApp endpoint - REMOVED
// WhatsApp integration has been removed from the system

/**
 * POST /api/chatbot/messenger
 * Handle incoming Facebook Messenger messages
 */
router.post('/messenger', [
  body('senderId').notEmpty().withMessage('Sender ID is required'),
  body('message').notEmpty().withMessage('Message is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { senderId, message, merchantId } = req.body;
    
    const response = await chatbotService.processMessage('messenger', senderId, message, merchantId);
    
    res.json(response);
  } catch (error) {
    console.error('Error processing Messenger message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

/**
 * POST /api/chatbot/test
 * Test chatbot functionality (for demo purposes)
 */
router.post('/test', [
  body('phoneNumber').notEmpty().withMessage('Phone number is required'),
  body('message').notEmpty().withMessage('Message is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { phoneNumber, message, platform = 'webchat' } = req.body;
    const merchantId = '507f1f77bcf86cd799439011'; // Demo merchant
    
    const response = await chatbotService.processMessage(platform, phoneNumber, message, merchantId);
    
    res.json({
      ...response,
      demo: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error testing chatbot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process test message'
    });
  }
});

/**
 * GET /api/chatbot/session/:phoneNumber
 * Get current session state for a user
 */
router.get('/session/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    const session = chatbotService.getUserSession(phoneNumber);
    
    res.json({
      success: true,
      session: {
        state: session.state,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        inQueue: session.state === 'in_queue',
        queueId: session.queueId || null,
        position: session.position || null
      }
    });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session'
    });
  }
});

/**
 * DELETE /api/chatbot/session/:phoneNumber
 * Clear session for a user
 */
router.delete('/session/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    // Clear the session
    if (chatbotService.userSessions.has(phoneNumber)) {
      chatbotService.userSessions.delete(phoneNumber);
    }
    
    res.json({
      success: true,
      message: 'Session cleared'
    });
  } catch (error) {
    console.error('Error clearing session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear session'
    });
  }
});

/**
 * POST /api/chatbot/notify
 * Send notification to customer
 */
router.post('/notify', [
  body('phoneNumber').notEmpty().withMessage('Phone number is required'),
  body('message').notEmpty().withMessage('Message is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { phoneNumber, message, platform = 'webchat' } = req.body;
    
    const result = await chatbotService.notifyCustomer(phoneNumber, message, platform);
    
    res.json({
      success: result,
      message: result ? 'Notification sent' : 'Failed to send notification'
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send notification'
    });
  }
});

module.exports = router; 