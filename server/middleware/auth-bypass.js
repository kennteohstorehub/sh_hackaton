// TEMPORARY: Authentication bypass for development
// This middleware creates a fake session for testing purposes

const logger = require('../utils/logger');

// CRITICAL: Production safeguard - this should NEVER run in production
if (process.env.NODE_ENV === 'production' && !process.env.FORCE_AUTH_BYPASS) {
  logger.error('CRITICAL: auth-bypass.js loaded in production environment!');
  logger.error('This is a security vulnerability. Ensure proper middleware is loaded.');
  throw new Error('Auth bypass cannot be used in production');
}

// Additional feature flag check
const USE_AUTH_BYPASS = process.env.USE_AUTH_BYPASS === 'true';
if (!USE_AUTH_BYPASS) {
  logger.warn('Auth bypass loaded but USE_AUTH_BYPASS is not set to "true"');
}

// Middleware that creates a demo session for all requests
const createDemoSession = (req, res, next) => {
  // Double-check production safeguard
  if (process.env.NODE_ENV === 'production') {
    logger.error('SECURITY: Auth bypass attempted in production!');
    return res.status(500).json({ error: 'Internal server error' });
  }
  
  // Log warning on every request in non-development environments
  if (process.env.NODE_ENV !== 'development') {
    logger.warn('⚠️  AUTH BYPASS ACTIVE - This should only be used in development!');
  }
  // Skip auth bypass for certain routes
  const skipPaths = [
    '/auth/logout',
    '/',  // Allow main page to check session
    '/auth/login',  // Allow login page to work
    '/auth/register'  // Allow register page to work
  ];
  
  if (skipPaths.includes(req.path) || req.path.startsWith('/auth/logout')) {
    return next();
  }
  
  // ENHANCED: Ensure session exists
  if (!req.session) {
    req.session = {};
  }
  
  // Always set session data
  req.session.userId = '0f97ed6c-7240-4f05-98f9-5f47571bd6b3'; // Demo merchant ID from Neon
  req.session.user = {
    id: '0f97ed6c-7240-4f05-98f9-5f47571bd6b3',
    email: 'admin@storehub.com',
    businessName: 'StoreHub Restaurant',
    merchantId: '0f97ed6c-7240-4f05-98f9-5f47571bd6b3'
  };
  
  // Always create fake user object with both id and _id for compatibility
  req.user = {
    id: '0f97ed6c-7240-4f05-98f9-5f47571bd6b3',
    _id: '0f97ed6c-7240-4f05-98f9-5f47571bd6b3',
    email: 'admin@storehub.com',
    businessName: 'StoreHub Restaurant',
    merchantId: '0f97ed6c-7240-4f05-98f9-5f47571bd6b3'
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