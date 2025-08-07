const logger = require('../utils/logger');
const backOfficeService = require('../services/backOfficeService');

// BackOffice Authentication middleware for protecting routes
const requireBackOfficeAuth = (req, res, next) => {
  logger.debug('requireBackOfficeAuth middleware:', {
    hasSession: !!req.session,
    sessionId: req.sessionID,
    backOfficeUserId: req.session?.backOfficeUserId,
    path: req.path
  });
  
  // Check if backoffice user is logged in via session
  if (!req.session || !req.session.backOfficeUserId) {
    // If it's an API request or AJAX request, return 401
    if (req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'BackOffice authentication required' });
    }
    // Otherwise redirect to backoffice login page
    return res.redirect('/backoffice/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  
  // BackOffice user is authenticated, continue
  next();
};

// Middleware to check if backoffice user is already authenticated (for login/register pages)
const requireBackOfficeGuest = (req, res, next) => {
  if (req.session && req.session.backOfficeUserId) {
    // BackOffice user is already logged in, redirect to dashboard
    return res.redirect('/backoffice/dashboard');
  }
  next();
};

// Middleware to load backoffice user data for authenticated routes
const loadBackOfficeUser = async (req, res, next) => {
  logger.debug('loadBackOfficeUser middleware:', {
    hasSession: !!req.session,
    backOfficeUserId: req.session?.backOfficeUserId
  });
  
  if (req.session && req.session.backOfficeUserId) {
    try {
      logger.info(`Loading backoffice user data for backOfficeUserId: ${req.session.backOfficeUserId}`);
      const backOfficeUser = await backOfficeService.findById(req.session.backOfficeUserId);
      
      if (!backOfficeUser) {
        // BackOffice user not found, clear session
        logger.error(`BackOffice user not found for backOfficeUserId: ${req.session.backOfficeUserId}`);
        req.session.destroy();
        return res.redirect('/backoffice/login');
      }

      if (!backOfficeUser.isActive) {
        // BackOffice is inactive, clear session
        logger.error(`BackOffice is inactive for backOfficeUserId: ${req.session.backOfficeUserId}`);
        req.session.destroy();
        return res.redirect('/backoffice/login?error=account_inactive');
      }
      
      // Attach superadmin to request
      req.backOfficeUser = backOfficeUser;
      res.locals.backOfficeUser = backOfficeUser; // Make superadmin available in views
      
      logger.debug('BackOffice loaded successfully:', {
        backOfficeUserId: backOfficeUser.id,
        email: backOfficeUser.email
      });
    } catch (error) {
      logger.error('Error loading superadmin:', error);
      logger.error('Error stack:', error.stack);
      
      // Clear session on error
      req.session.destroy();
      return res.redirect('/backoffice/login?error=session_error');
    }
  }
  next();
};

// Middleware to ensure session separation between merchants and backoffice users
const ensureBackOfficeSession = (req, res, next) => {
  // If there's a merchant session active, warn and clear it
  if (req.session && req.session.userId && req.session.backOfficeUserId) {
    logger.warn('Detected mixed session (both merchant and backoffice). Clearing merchant session.');
    delete req.session.userId;
    delete req.session.user;
    delete req.session.tenantId;
    delete req.session.tenantSlug;
  }
  
  // Ensure backoffice-specific session namespace
  if (req.session && req.session.backOfficeUserId) {
    // Add backoffice-specific session markers
    req.session.sessionType = 'backoffice';
    req.session.lastActivity = new Date();
    
    // Ensure tenant context is cleared for backoffice users
    delete req.session.tenantId;
    delete req.session.tenantSlug;
  }
  
  next();
};

// Middleware to log superadmin actions for audit trail
const auditBackOfficeAction = (action, resourceType = null) => {
  return async (req, res, next) => {
    // Store audit data in request for later logging
    req.auditData = {
      action,
      resourceType: resourceType || 'Unknown',
      resourceId: req.params.id || req.params.tenantId || null,
      timestamp: new Date(),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent']
    };

    // Override res.json and res.redirect to log actions after successful operations
    const originalJson = res.json;
    const originalRedirect = res.redirect;
    const originalRender = res.render;

    res.json = function(data) {
      // Log successful API actions
      if (req.backOfficeUser && res.statusCode < 400) {
        backOfficeService.logAuditAction(req.backOfficeUser.id, {
          ...req.auditData,
          details: {
            success: true,
            responseStatus: res.statusCode,
            method: req.method,
            path: req.path,
            body: req.method !== 'GET' ? req.body : undefined
          }
        }, req).catch(err => logger.error('Audit logging error:', err));
      }
      return originalJson.call(this, data);
    };

    res.redirect = function(url) {
      // Log successful redirect actions
      if (req.backOfficeUser && res.statusCode < 400) {
        backOfficeService.logAuditAction(req.backOfficeUser.id, {
          ...req.auditData,
          details: {
            success: true,
            redirectTo: url,
            method: req.method,
            path: req.path,
            body: req.method !== 'GET' ? req.body : undefined
          }
        }, req).catch(err => logger.error('Audit logging error:', err));
      }
      return originalRedirect.call(this, url);
    };

    res.render = function(view, options, callback) {
      // Log successful page renders
      if (req.backOfficeUser && res.statusCode < 400) {
        backOfficeService.logAuditAction(req.backOfficeUser.id, {
          ...req.auditData,
          details: {
            success: true,
            view: view,
            method: req.method,
            path: req.path
          }
        }, req).catch(err => logger.error('Audit logging error:', err));
      }
      return originalRender.call(this, view, options, callback);
    };

    next();
  };
};

// Middleware for session timeout (30 minutes for superadmin)
const checkBackOfficeSessionTimeout = (req, res, next) => {
  if (req.session && req.session.backOfficeUserId) {
    const lastActivity = req.session.lastActivity ? new Date(req.session.lastActivity) : new Date();
    const now = new Date();
    const thirtyMinutes = 30 * 60 * 1000;

    if (now - lastActivity > thirtyMinutes) {
      logger.info(`BackOffice session timeout for: ${req.session.backOfficeUserId}`);
      req.session.destroy((err) => {
        if (err) logger.error('Session destroy error:', err);
      });
      
      // For API requests, return 401
      if (req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Session timeout' });
      }
      
      return res.redirect('/backoffice/login?error=session_timeout');
    }

    // Update last activity
    req.session.lastActivity = now;
  }
  
  next();
};

// Role-based access control (for future expansion)
const requireBackOfficeRole = (requiredRoles = []) => {
  return (req, res, next) => {
    if (!req.backOfficeUser) {
      return res.status(401).json({ error: 'BackOffice authentication required' });
    }

    // For now, all superadmins have full access
    // In the future, you can add role checks here
    // const userRoles = req.backOfficeUser.roles || ['admin'];
    // const hasRole = requiredRoles.some(role => userRoles.includes(role));
    
    // if (requiredRoles.length > 0 && !hasRole) {
    //   return res.status(403).json({ error: 'Insufficient permissions' });
    // }

    next();
  };
};

module.exports = {
  requireBackOfficeAuth,
  backOfficeUserAuthMiddleware: requireBackOfficeAuth, // Alias for compatibility
  requireBackOfficeGuest,
  loadBackOfficeUser,
  ensureBackOfficeSession,
  auditBackOfficeAction,
  checkBackOfficeSessionTimeout,
  requireBackOfficeRole
};