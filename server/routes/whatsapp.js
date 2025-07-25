const express = require('express');
const whatsappService = require('../services/whatsappService');
const logger = require('../utils/logger');

const router = express.Router();

// Use appropriate auth middleware based on environment
let authMiddleware;
if (process.env.NODE_ENV !== 'production') {
  ({ authMiddleware } = require('../middleware/auth-bypass'));
} else {
  ({ authMiddleware } = require('../middleware/auth'));
}

// GET /api/whatsapp/status - Get WhatsApp connection status with performance metrics
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const status = whatsappService.getStatus();
    
    // Add performance recommendations if available
    if (status.performance) {
      status.recommendations = [];
      
      if (status.performance.queueLength > 500) {
        status.recommendations.push({
          type: 'warning',
          message: 'Message queue is getting full. Consider increasing rate limits or checking for issues.'
        });
      }
      
      if (status.performance.cacheSize > 1000) {
        status.recommendations.push({
          type: 'info',
          message: 'Cache is large. This is normal during peak hours.'
        });
      }
      
      if (!status.isConnected && status.performance.queueLength > 0) {
        status.recommendations.push({
          type: 'error',
          message: 'Messages are queued but WhatsApp is disconnected. Please reconnect.'
        });
      }
    }
    
    res.json(status);
  } catch (error) {
    logger.error('Error getting WhatsApp status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// GET /api/whatsapp/qr - Get QR code for authentication
router.get('/qr', authMiddleware, async (req, res) => {
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
router.post('/disconnect', authMiddleware, async (req, res) => {
  try {
    await whatsappService.destroy();
    res.json({ success: true, message: 'WhatsApp disconnected' });
  } catch (error) {
    logger.error('Error disconnecting WhatsApp:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// POST /api/whatsapp/send - Send message (for testing)
router.post('/send', authMiddleware, async (req, res) => {
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
router.post('/refresh', authMiddleware, async (req, res) => {
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
router.post('/test-message', authMiddleware, async (req, res) => {
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

// POST /api/whatsapp/init - Manually initialize WhatsApp
router.post('/init', authMiddleware, async (req, res) => {
  try {
    if (whatsappService.isConnected) {
      return res.json({ success: true, message: 'WhatsApp already initialized' });
    }
    
    const io = req.app.get('io');
    const result = await whatsappService.initialize(io);
    
    if (result) {
      res.json({ success: true, message: 'WhatsApp initialization started' });
    } else {
      res.status(500).json({ error: 'WhatsApp initialization failed' });
    }
  } catch (error) {
    logger.error('Error initializing WhatsApp:', error);
    res.status(500).json({ error: 'Failed to initialize WhatsApp', details: error.message });
  }
});

// GET /api/whatsapp/sessions - Get active sessions count
router.get('/sessions', authMiddleware, async (req, res) => {
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

// GET /api/whatsapp/health - Health check endpoint with performance metrics
router.get('/health', authMiddleware, async (req, res) => {
  try {
    const status = whatsappService.getStatus();
    const uptime = process.uptime();
    
    // Calculate health score
    let healthScore = 100;
    const issues = [];
    
    if (!status.isConnected) {
      healthScore -= 50;
      issues.push('WhatsApp not connected');
    }
    
    if (status.performance) {
      if (status.performance.queueLength > 500) {
        healthScore -= 20;
        issues.push('High message queue length');
      }
      
      if (status.performance.queueLength > 800) {
        healthScore -= 20;
        issues.push('Critical message queue length');
      }
      
      if (status.performance.conversationStates > 100) {
        healthScore -= 10;
        issues.push('High conversation state count');
      }
    }
    
    const health = {
      status: healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'degraded' : 'unhealthy',
      score: healthScore,
      issues,
      uptime: {
        seconds: Math.floor(uptime),
        formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
      },
      connection: {
        isConnected: status.isConnected,
        status: status.status,
        deviceInfo: status.deviceInfo
      },
      performance: status.performance || {},
      timestamp: new Date().toISOString()
    };
    
    // Set appropriate HTTP status code
    const httpStatus = healthScore >= 50 ? 200 : 503;
    res.status(httpStatus).json(health);
    
  } catch (error) {
    logger.error('Error checking WhatsApp health:', error);
    res.status(503).json({ 
      status: 'error',
      error: 'Failed to check health',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router; 