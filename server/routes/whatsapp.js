const express = require('express');
const whatsappService = require('../services/whatsappService');
const logger = require('../utils/logger');

const router = express.Router();

// Mock user middleware
const setMockUser = (req, res, next) => {
  req.session.user = {
    id: '507f1f77bcf86cd799439011',
    email: 'demo@smartqueue.com',
    businessName: 'Demo Restaurant'
  };
  next();
};

// GET /api/whatsapp/status - Get WhatsApp connection status
router.get('/status', setMockUser, async (req, res) => {
  try {
    const status = whatsappService.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error getting WhatsApp status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// GET /api/whatsapp/qr - Get QR code for authentication
router.get('/qr', setMockUser, async (req, res) => {
  try {
    const qrData = await whatsappService.getQRCode();
    
    // If WhatsApp is already connected, return success with message
    if (qrData.isReady) {
      return res.json(qrData);
    }
    
    // If not connected and no QR code available, return error
    if (!qrData.qr && !qrData.qrDataURL) {
      return res.status(404).json({ error: 'No QR code available' });
    }
    
    res.json(qrData);
  } catch (error) {
    logger.error('Error getting QR code:', error);
    res.status(500).json({ error: 'Failed to get QR code' });
  }
});

// POST /api/whatsapp/disconnect - Disconnect WhatsApp
router.post('/disconnect', setMockUser, async (req, res) => {
  try {
    await whatsappService.destroy();
    res.json({ success: true, message: 'WhatsApp disconnected' });
  } catch (error) {
    logger.error('Error disconnecting WhatsApp:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// POST /api/whatsapp/send - Send message (for testing)
router.post('/send', setMockUser, async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ error: 'Phone number and message are required' });
    }
    
    const success = await whatsappService.sendMessage(phoneNumber, message);
    
    if (success) {
      res.json({ success: true, message: 'Message sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send message' });
    }
  } catch (error) {
    logger.error('Error sending WhatsApp message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/whatsapp/refresh - Refresh WhatsApp connection
router.post('/refresh', setMockUser, async (req, res) => {
  try {
    // Destroy current connection and reinitialize
    await whatsappService.destroy();
    
    // Get io instance from app
    const io = req.app.get('io');
    await whatsappService.initialize(io);
    
    res.json({ success: true, message: 'WhatsApp connection refreshed' });
    logger.info('WhatsApp connection refreshed via API');
  } catch (error) {
    logger.error('Error refreshing WhatsApp connection:', error);
    res.status(500).json({ error: 'Failed to refresh connection' });
  }
});

// POST /api/whatsapp/test-message - Send test message
router.post('/test-message', setMockUser, async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ error: 'Phone number and message are required' });
    }
    
    const result = await whatsappService.sendMessage(phoneNumber, message);
    
    if (result.success) {
      res.json({ success: true, message: 'Test message sent successfully', result });
    } else {
      res.status(500).json({ error: result.error || 'Failed to send test message', result });
    }
  } catch (error) {
    logger.error('Error sending test message:', error);
    res.status(500).json({ error: 'Failed to send test message' });
  }
});

// GET /api/whatsapp/sessions - Get active sessions count
router.get('/sessions', setMockUser, async (req, res) => {
  try {
    const status = whatsappService.getStatus();
    res.json({ 
      sessionCount: status.sessionCount,
      isReady: status.isReady 
    });
  } catch (error) {
    logger.error('Error getting sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

module.exports = router; 