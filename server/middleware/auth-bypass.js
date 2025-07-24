// TEMPORARY: Authentication bypass for development
// This middleware creates a fake session for testing purposes

const logger = require('../utils/logger');

// Middleware that creates a demo session for all requests
const createDemoSession = (req, res, next) => {
  // Skip if already has a session
  if (req.session && req.session.userId) {
    return next();
  }
  
  // Create demo session data
  req.session = req.session || {};
  req.session.userId = '7a99f35e-0f73-4f8e-831c-fde8fc3a5532'; // Demo merchant ID from Neon
  req.session.user = {
    id: '7a99f35e-0f73-4f8e-831c-fde8fc3a5532',
    email: 'demo@storehub.com',
    businessName: 'StoreHub Demo Restaurant',
    merchantId: '7a99f35e-0f73-4f8e-831c-fde8fc3a5532'
  };
  
  // Create fake user object
  req.user = {
    id: '7a99f35e-0f73-4f8e-831c-fde8fc3a5532',
    _id: '7a99f35e-0f73-4f8e-831c-fde8fc3a5532',
    email: 'demo@storehub.com',
    businessName: 'StoreHub Demo Restaurant'
  };
  
  res.locals.user = req.user;
  
  logger.info('AUTH BYPASS: Created demo session', {
    userId: req.session.userId,
    path: req.path
  });
  
  next();
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