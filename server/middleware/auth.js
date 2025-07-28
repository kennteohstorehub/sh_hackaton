const logger = require('../utils/logger');

// Authentication middleware for protecting routes
const requireAuth = (req, res, next) => {
  logger.debug('requireAuth middleware:', {
    hasSession: !!req.session,
    sessionId: req.sessionID,
    userId: req.session?.userId,
    path: req.path
  });
  
  // Check if user is logged in via session
  if (!req.session || !req.session.userId) {
    // If it's an API request or AJAX request, return 401
    if (req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    // Otherwise redirect to login page
    return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  
  // User is authenticated, continue
  next();
};

// Middleware to check if user is already authenticated (for login/register pages)
const requireGuest = (req, res, next) => {
  if (req.session && req.session.userId) {
    // User is already logged in, redirect to dashboard
    return res.redirect('/dashboard');
  }
  next();
};

// Middleware to load user data for authenticated routes
const loadUser = async (req, res, next) => {
  logger.debug('loadUser middleware:', {
    hasSession: !!req.session,
    userId: req.session?.userId
  });
  
  if (req.session && req.session.userId) {
    try {
      const merchantService = require('../services/merchantService');
      logger.info(`Loading user data for userId: ${req.session.userId}`);
      const user = await merchantService.findById(req.session.userId);
      
      if (!user) {
        // User not found, clear session
        logger.error(`User not found for userId: ${req.session.userId}`);
        req.session.destroy();
        return res.redirect('/auth/login');
      }
      
      // Attach user to request
      req.user = user;
      res.locals.user = user; // Make user available in views
      
      // Ensure _id is always available for backward compatibility
      if (user.id && !user._id) {
        req.user._id = user.id;
      }
      
      logger.debug('User loaded successfully:', {
        userId: user.id || user._id,
        email: user.email
      });
    } catch (error) {
      logger.error('Error loading user:', error);
      logger.error('Error stack:', error.stack);
    }
  }
  next();
};

module.exports = {
  requireAuth,
  authMiddleware: requireAuth, // Alias for compatibility
  requireGuest,
  loadUser
};