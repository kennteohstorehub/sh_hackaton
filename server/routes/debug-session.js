const express = require('express');
const router = express.Router();

// Debug endpoint to check session and cookie configuration
router.get('/session-info', (req, res) => {
  const info = {
    sessionExists: !!req.session,
    sessionId: req.sessionID,
    sessionData: req.session,
    cookies: req.cookies,
    headers: {
      cookie: req.headers.cookie,
      'x-forwarded-proto': req.headers['x-forwarded-proto'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      host: req.headers.host
    },
    protocol: req.protocol,
    secure: req.secure,
    trustProxy: req.app.get('trust proxy'),
    env: process.env.NODE_ENV,
    sessionConfig: {
      cookieName: req.app.get('session name') || 'sessionId',
      cookieSecure: req.session?.cookie?.secure,
      cookieHttpOnly: req.session?.cookie?.httpOnly,
      cookieSameSite: req.session?.cookie?.sameSite,
      cookieDomain: req.session?.cookie?.domain
    }
  };
  
  res.json(info);
});

// Test setting session
router.post('/set-session', (req, res) => {
  req.session.testValue = 'Hello from session!';
  req.session.timestamp = new Date().toISOString();
  
  req.session.save((err) => {
    if (err) {
      return res.status(500).json({ 
        error: 'Failed to save session', 
        details: err.message 
      });
    }
    
    res.json({ 
      success: true, 
      sessionId: req.sessionID,
      sessionData: req.session 
    });
  });
});

module.exports = router;