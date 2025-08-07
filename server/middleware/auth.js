const logger = require('../utils/logger');

// Middleware to ensure session separation between backoffice and tenant users
const ensureTenantSession = (req, res, next) => {
  // If there's a backoffice session active, warn and clear it
  if (req.session && req.session.backOfficeUserId && req.session.userId) {
    logger.warn('Detected mixed session (both backoffice and tenant). Clearing backoffice session.');
    delete req.session.backOfficeUserId;
    delete req.session.backOfficeUser;
    delete req.session.sessionType;
    delete req.session.lastActivity;
  }
  
  // Ensure tenant-specific session namespace
  if (req.session && req.session.userId) {
    // Add tenant-specific session markers
    req.session.sessionType = 'tenant';
    req.session.lastActivity = new Date();
    
    // Ensure tenant context is preserved
    if (req.tenantId && !req.session.tenantId) {
      req.session.tenantId = req.tenantId;
      req.session.tenantSlug = req.tenant?.slug;
    }
  }
  
  next();
};

// Authentication middleware for protecting routes
const requireAuth = (req, res, next) => {
  logger.debug('requireAuth middleware:', {
    hasSession: !!req.session,
    sessionId: req.sessionID,
    userId: req.session?.userId,
    backOfficeUserId: req.session?.backOfficeUserId,
    isBackOffice: req.isBackOffice,
    path: req.path
  });
  
  // Check if user is logged in via session (either regular user or BackOffice)
  const isAuthenticated = (req.session && req.session.userId) || 
                          (req.session && req.session.backOfficeUserId) ||
                          req.isBackOffice;
  
  if (!isAuthenticated) {
    // If it's an API request or AJAX request, return 401
    if (req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Determine appropriate login page based on context
    let loginUrl = '/auth/login';
    
    // If this is a BackOffice route or BackOffice subdomain, redirect to BackOffice login
    if (req.originalUrl.startsWith('/backoffice') || req.isBackOffice) {
      loginUrl = '/backoffice/auth/login';
    }
    
    // Otherwise redirect to appropriate login page
    return res.redirect(loginUrl + '?redirect=' + encodeURIComponent(req.originalUrl));
  }
  
  // User is authenticated, continue
  next();
};

// Middleware to check if user is already authenticated (for login/register pages)
const requireGuest = (req, res, next) => {
  // Check if user is already logged in (either regular user or BackOffice)
  if (req.session && req.session.userId) {
    // Regular merchant user is already logged in, redirect to merchant dashboard
    return res.redirect('/dashboard');
  }
  
  if (req.session && req.session.backOfficeUserId) {
    // BackOffice is already logged in, redirect to BackOffice dashboard
    return res.redirect('/backoffice/dashboard');
  }
  
  if (req.isBackOffice) {
    // BackOffice context detected, redirect to BackOffice dashboard
    return res.redirect('/backoffice/dashboard');
  }
  
  next();
};

// Middleware to load user data for authenticated routes with tenant context
const loadUser = async (req, res, next) => {
  logger.debug('loadUser middleware:', {
    hasSession: !!req.session,
    userId: req.session?.userId,
    tenantId: req.tenantId || req.session?.tenantId,
    isBackOffice: req.isBackOffice || req.session?.isBackOffice
  });
  
  // Handle regular user sessions
  if (req.session && req.session.userId) {
    try {
      const merchantService = require('../services/merchantService');
      
      // Get tenant context - prefer request context, fallback to session
      const tenantId = req.tenantId || req.session.tenantId;
      const isBackOffice = req.isBackOffice || req.session.isBackOffice;
      
      logger.info(`Loading user data for userId: ${req.session.userId}, tenantId: ${tenantId}, isBackOffice: ${isBackOffice}`);
      
      // For BackOffice, don't use tenant filtering
      const effectiveTenantId = isBackOffice ? null : tenantId;
      const user = await merchantService.findById(req.session.userId, {}, effectiveTenantId);
      
      if (!user) {
        // User not found, clear session
        logger.error(`User not found for userId: ${req.session.userId}, tenantId: ${effectiveTenantId}`);
        req.session.destroy();
        return res.redirect('/auth/login');
      }
      
      // Validate tenant assignment if not BackOffice
      if (!isBackOffice && tenantId && user.tenantId && user.tenantId !== tenantId) {
        logger.error(`Tenant mismatch: user.tenantId=${user.tenantId}, session.tenantId=${tenantId}`);
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
      
      // Store current tenant info for use in routes
      if (!isBackOffice && tenantId) {
        req.user.currentTenantId = tenantId;
      }
      
      logger.debug('User loaded successfully:', {
        userId: user.id || user._id,
        email: user.email,
        userTenantId: user.tenantId,
        sessionTenantId: tenantId,
        isBackOffice
      });
    } catch (error) {
      logger.error('Error loading user:', error);
      logger.error('Error stack:', error.stack);
    }
  }
  
  // Handle BackOffice sessions
  if (req.session && req.session.backOfficeUserId) {
    try {
      const backOfficeService = require('../services/backOfficeService');
      
      logger.info(`Loading BackOffice data for backOfficeUserId: ${req.session.backOfficeUserId}`);
      const backOfficeUser = await backOfficeService.findById(req.session.backOfficeUserId);
      
      if (!backOfficeUser) {
        // BackOffice not found, clear session
        logger.error(`BackOffice not found for backOfficeUserId: ${req.session.backOfficeUserId}`);
        req.session.destroy();
        return res.redirect('/backoffice/auth/login');
      }

      if (!backOfficeUser.isActive) {
        // BackOffice is inactive, clear session
        logger.error(`BackOffice is inactive for backOfficeUserId: ${req.session.backOfficeUserId}`);
        req.session.destroy();
        return res.redirect('/backoffice/auth/login?error=account_inactive');
      }
      
      // Attach superadmin to request (using standard user field for compatibility)
      req.user = backOfficeUser;
      req.backOfficeUser = backOfficeUser; // Also available as backOfficeUser
      res.locals.user = backOfficeUser; // Make superadmin available in views as user
      res.locals.backOfficeUser = backOfficeUser; // Also available as backOfficeUser
      
      // Mark this as a BackOffice session
      req.user.isBackOffice = true;
      
      logger.debug('BackOffice loaded successfully:', {
        backOfficeUserId: backOfficeUser.id,
        email: backOfficeUser.email,
        isActive: backOfficeUser.isActive
      });
    } catch (error) {
      logger.error('Error loading superadmin:', error);
      logger.error('Error stack:', error.stack);
      
      // Clear session on error
      req.session.destroy();
      return res.redirect('/backoffice/auth/login?error=session_error');
    }
  }
  next();
};

module.exports = {
  requireAuth,
  authMiddleware: requireAuth, // Alias for compatibility
  requireGuest,
  loadUser,
  ensureTenantSession
};