const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Test endpoint to check session functionality
router.get('/session-test', (req, res) => {
  logger.info('Session test accessed', {
    sessionID: req.sessionID,
    hasSession: !!req.session,
    sessionData: req.session,
    cookies: req.headers.cookie
  });
  
  res.json({
    sessionID: req.sessionID,
    hasSession: !!req.session,
    userId: req.session?.userId || null,
    user: req.session?.user || null,
    sessionData: req.session || {}
  });
});

// Test setting session data
router.post('/session-test/set', (req, res) => {
  req.session.testData = {
    timestamp: new Date().toISOString(),
    random: Math.random()
  };
  req.session.userId = 'test-user-123';
  
  req.session.save((err) => {
    if (err) {
      logger.error('Session save error:', err);
      return res.status(500).json({ 
        error: 'Failed to save session', 
        details: err.message 
      });
    }
    
    res.json({
      success: true,
      sessionID: req.sessionID,
      saved: {
        testData: req.session.testData,
        userId: req.session.userId
      }
    });
  });
});

module.exports = router;