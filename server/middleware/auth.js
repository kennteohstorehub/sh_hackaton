// Authentication middleware for protecting routes
const requireAuth = (req, res, next) => {
  // Check if user is logged in via session
  if (!req.session || !req.session.userId) {
    // If it's an API request, return 401
    if (req.path.startsWith('/api/')) {
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
  if (req.session && req.session.userId) {
    try {
      const Merchant = require('../models/Merchant');
      const user = await Merchant.findById(req.session.userId).select('-password');
      
      if (!user) {
        // User not found, clear session
        req.session.destroy();
        return res.redirect('/auth/login');
      }
      
      // Attach user to request
      req.user = user;
      res.locals.user = user; // Make user available in views
    } catch (error) {
      console.error('Error loading user:', error);
    }
  }
  next();
};

module.exports = {
  requireAuth,
  requireGuest,
  loadUser
};