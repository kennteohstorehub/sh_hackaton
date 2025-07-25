// TEMPORARY: Authentication bypass for development
// This middleware creates a fake session for testing purposes

const logger = require('../utils/logger');

// Middleware that creates a demo session for all requests
const createDemoSession = (req, res, next) => {
  // ENHANCED: Ensure session exists
  if (!req.session) {
    req.session = {};
  }
  
  // Always set session data
  req.session.userId = '7a99f35e-0f73-4f8e-831c-fde8fc3a5532'; // Demo merchant ID from Neon
  req.session.user = {
    id: '7a99f35e-0f73-4f8e-831c-fde8fc3a5532',
    email: 'demo@storehub.com',
    businessName: 'StoreHub Demo Restaurant',
    merchantId: '7a99f35e-0f73-4f8e-831c-fde8fc3a5532'
  };
  
  // Always create fake user object with both id and _id for compatibility
  req.user = {
    id: '7a99f35e-0f73-4f8e-831c-fde8fc3a5532',
    _id: '7a99f35e-0f73-4f8e-831c-fde8fc3a5532',
    email: 'demo@storehub.com',
    businessName: 'StoreHub Demo Restaurant',
    merchantId: '7a99f35e-0f73-4f8e-831c-fde8fc3a5532'
  };
  
  // ENHANCED: Ensure res.locals exists and set user
  if (!res.locals) {
    res.locals = {};
  }
  res.locals.user = req.user;
  
  // Log auth bypass application (only once per request path)
  const logKey = `bypassLogged_${req.path}`;
  if (!req.session[logKey]) {
    logger.info('AUTH BYPASS: Applied to request', {
      userId: req.session.userId,
      path: req.path,
      hasUser: !!req.user,
      hasSession: !!req.session
    });
    req.session[logKey] = true;
  }
  
  // ENHANCED: Save session to ensure persistence
  if (req.session.save && typeof req.session.save === 'function') {
    req.session.save((err) => {
      if (err) {
        logger.error('AUTH BYPASS: Failed to save session', err);
      }
      next();
    });
  } else {
    next();
  }
};

// Replace requireAuth with a bypass version
const requireAuthBypass = (req, res, next) => {
  createDemoSession(req, res, next);
};

// Replace loadUser with a bypass version  
const loadUserBypass = (req, res, next) => {
  createDemoSession(req, res, next);
};

module.exports = {
  requireAuth: requireAuthBypass,
  authMiddleware: requireAuthBypass,
  requireGuest: (req, res, next) => next(), // Always allow
  loadUser: loadUserBypass,
  createDemoSession
};