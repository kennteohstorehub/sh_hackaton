const logger = require('../utils/logger');
const superAdminService = require('../services/superAdminService');

// SuperAdmin Authentication middleware for protecting routes
const requireSuperAdminAuth = (req, res, next) => {
  logger.debug('requireSuperAdminAuth middleware:', {
    hasSession: !!req.session,
    sessionId: req.sessionID,
    superAdminId: req.session?.superAdminId,
    path: req.path
  });
  
  // Check if superadmin is logged in via session
  if (!req.session || !req.session.superAdminId) {
    // If it's an API request or AJAX request, return 401
    if (req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'SuperAdmin authentication required' });
    }
    // Otherwise redirect to superadmin login page
    return res.redirect('/superadmin/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  
  // SuperAdmin is authenticated, continue
  next();
};

// Middleware to check if superadmin is already authenticated (for login/register pages)
const requireSuperAdminGuest = (req, res, next) => {
  if (req.session && req.session.superAdminId) {
    // SuperAdmin is already logged in, redirect to dashboard
    return res.redirect('/superadmin/dashboard');
  }
  next();
};

// Middleware to load superadmin data for authenticated routes
const loadSuperAdmin = async (req, res, next) => {
  logger.debug('loadSuperAdmin middleware:', {
    hasSession: !!req.session,
    superAdminId: req.session?.superAdminId
  });
  
  if (req.session && req.session.superAdminId) {
    try {
      logger.info(`Loading superadmin data for superAdminId: ${req.session.superAdminId}`);
      const superAdmin = await superAdminService.findById(req.session.superAdminId);
      
      if (!superAdmin) {
        // SuperAdmin not found, clear session
        logger.error(`SuperAdmin not found for superAdminId: ${req.session.superAdminId}`);
        req.session.destroy();
        return res.redirect('/superadmin/login');
      }

      if (!superAdmin.isActive) {
        // SuperAdmin is inactive, clear session
        logger.error(`SuperAdmin is inactive for superAdminId: ${req.session.superAdminId}`);
        req.session.destroy();
        return res.redirect('/superadmin/login?error=account_inactive');
      }
      
      // Attach superadmin to request
      req.superAdmin = superAdmin;
      res.locals.superAdmin = superAdmin; // Make superadmin available in views
      
      logger.debug('SuperAdmin loaded successfully:', {
        superAdminId: superAdmin.id,
        email: superAdmin.email
      });
    } catch (error) {
      logger.error('Error loading superadmin:', error);
      logger.error('Error stack:', error.stack);
      
      // Clear session on error
      req.session.destroy();
      return res.redirect('/superadmin/login?error=session_error');
    }
  }
  next();
};

// Middleware to ensure session separation between merchants and superadmins
const ensureSuperAdminSession = (req, res, next) => {
  // If there's a merchant session active, warn and clear it
  if (req.session && req.session.userId && req.session.superAdminId) {
    logger.warn('Detected mixed session (both merchant and superadmin). Clearing merchant session.');
    delete req.session.userId;
    delete req.session.user;
  }
  
  // Ensure superadmin-specific session namespace
  if (req.session && req.session.superAdminId) {
    // Add superadmin-specific session markers
    req.session.sessionType = 'superadmin';
    req.session.lastActivity = new Date();
  }
  
  next();
};

// Middleware to log superadmin actions for audit trail
const auditSuperAdminAction = (action, resourceType = null) => {
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
      if (req.superAdmin && res.statusCode < 400) {
        superAdminService.logAuditAction(req.superAdmin.id, {
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
      if (req.superAdmin && res.statusCode < 400) {
        superAdminService.logAuditAction(req.superAdmin.id, {
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
      if (req.superAdmin && res.statusCode < 400) {
        superAdminService.logAuditAction(req.superAdmin.id, {
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
const checkSuperAdminSessionTimeout = (req, res, next) => {
  if (req.session && req.session.superAdminId) {
    const lastActivity = req.session.lastActivity ? new Date(req.session.lastActivity) : new Date();
    const now = new Date();
    const thirtyMinutes = 30 * 60 * 1000;

    if (now - lastActivity > thirtyMinutes) {
      logger.info(`SuperAdmin session timeout for: ${req.session.superAdminId}`);
      req.session.destroy((err) => {
        if (err) logger.error('Session destroy error:', err);
      });
      
      // For API requests, return 401
      if (req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Session timeout' });
      }
      
      return res.redirect('/superadmin/login?error=session_timeout');
    }

    // Update last activity
    req.session.lastActivity = now;
  }
  
  next();
};

// Role-based access control (for future expansion)
const requireSuperAdminRole = (requiredRoles = []) => {
  return (req, res, next) => {
    if (!req.superAdmin) {
      return res.status(401).json({ error: 'SuperAdmin authentication required' });
    }

    // For now, all superadmins have full access
    // In the future, you can add role checks here
    // const userRoles = req.superAdmin.roles || ['admin'];
    // const hasRole = requiredRoles.some(role => userRoles.includes(role));
    
    // if (requiredRoles.length > 0 && !hasRole) {
    //   return res.status(403).json({ error: 'Insufficient permissions' });
    // }

    next();
  };
};

module.exports = {
  requireSuperAdminAuth,
  superAdminAuthMiddleware: requireSuperAdminAuth, // Alias for compatibility
  requireSuperAdminGuest,
  loadSuperAdmin,
  ensureSuperAdminSession,
  auditSuperAdminAction,
  checkSuperAdminSessionTimeout,
  requireSuperAdminRole
};