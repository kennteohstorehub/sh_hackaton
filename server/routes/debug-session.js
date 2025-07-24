const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Debug endpoint to check session state
router.get('/session-info', (req, res) => {
  const sessionInfo = {
    sessionID: req.sessionID,
    hasSession: !!req.session,
    sessionData: req.session || {},
    cookie: req.session?.cookie,
    timestamp: new Date().toISOString()
  };
  
  logger.info('Session debug info requested:', sessionInfo);
  
  res.json(sessionInfo);
});

// Test setting session data
router.post('/test-session-set', (req, res) => {
  if (!req.session) {
    return res.status(500).json({ error: 'No session available' });
  }
  
  // Try to set test data
  req.session.testData = {
    timestamp: new Date().toISOString(),
    random: Math.random()
  };
  
  req.session.userId = 'test-user-123';
  
  req.session.save((err) => {
    if (err) {
      logger.error('Session save error:', err);
      return res.status(500).json({ error: 'Failed to save session', details: err.message });
    }
    
    res.json({
      success: true,
      sessionID: req.sessionID,
      testData: req.session.testData,
      userId: req.session.userId
    });
  });
});

// Check if session persists
router.get('/test-session-get', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    hasTestData: !!req.session?.testData,
    testData: req.session?.testData,
    userId: req.session?.userId,
    allSessionData: req.session
  });
});

module.exports = router;