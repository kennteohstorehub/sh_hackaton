const logger = require('../utils/logger');

/**
 * Authentication Context Middleware
 * Properly sets authentication context based on subdomain and session data
 * Ensures clean separation between BackOffice and Tenant authentication
 */

/**
 * Middleware to set authentication context based on subdomain
 * Must run after tenantResolver but before other auth middleware
 */
const setAuthContext = (req, res, next) => {
  // Clear any existing auth context
  req.authContext = null;
  req.requiresBackOfficeAuth = false;
  req.requiresTenantAuth = false;
  
  // Ensure isBackOffice is always defined
  if (req.isBackOffice === undefined) {
    req.isBackOffice = false;
  }
  
  if (req.isBackOffice) {
    // BackOffice subdomain (admin.*)
    req.authContext = 'backoffice';
    req.requiresBackOfficeAuth = true;
    
    // Ensure no tenant context for backoffice
    req.tenant = null;
    req.tenantId = null;
    
    logger.debug('Set auth context: backoffice', {
      hostname: req.hostname,
      subdomain: 'admin'
    });
  } else if (req.tenantId) {
    // Tenant subdomain (slug.*)
    req.authContext = 'tenant';
    req.requiresTenantAuth = true;
    
    logger.debug('Set auth context: tenant', {
      hostname: req.hostname,
      tenantId: req.tenantId,
      tenantSlug: req.tenant?.slug
    });
  } else {
    // No specific context (public routes)
    req.authContext = 'public';
    
    logger.debug('Set auth context: public', {
      hostname: req.hostname
    });
  }
  
  next();
};

/**
 * Middleware to validate session matches auth context
 * Prevents cross-context session usage
 */
const validateAuthContext = (req, res, next) => {
  if (!req.session) {
    return next();
  }
  
  const sessionType = req.session.sessionType;
  const hasBackOfficeSession = !!req.session.backOfficeUserId;
  const hasTenantSession = !!req.session.userId;
  
  // BackOffice context validation
  if (req.authContext === 'backoffice') {
    if (hasTenantSession && !hasBackOfficeSession) {
      logger.warn('Tenant session detected in BackOffice context - clearing session', {
        sessionId: req.sessionID,
        userId: req.session.userId,
        hostname: req.hostname
      });
      
      // Clear invalid session
      req.session.destroy((err) => {
        if (err) logger.error('Error destroying invalid session:', err);
      });
      
      return res.redirect('/backoffice/auth/login?error=session_invalid');
    }
    
    if (sessionType && sessionType !== 'backoffice') {
      logger.warn('Non-backoffice session in BackOffice context - clearing session', {
        sessionId: req.sessionID,
        sessionType,
        hostname: req.hostname
      });
      
      req.session.destroy((err) => {
        if (err) logger.error('Error destroying invalid session:', err);
      });
      
      return res.redirect('/backoffice/auth/login?error=session_invalid');
    }
  }
  
  // Tenant context validation
  if (req.authContext === 'tenant') {
    if (hasBackOfficeSession && !hasTenantSession) {
      logger.warn('BackOffice session detected in tenant context - clearing session', {
        sessionId: req.sessionID,
        backOfficeUserId: req.session.backOfficeUserId,
        hostname: req.hostname,
        tenantId: req.tenantId
      });
      
      // Clear invalid session
      req.session.destroy((err) => {
        if (err) logger.error('Error destroying invalid session:', err);
      });
      
      return res.redirect('/auth/login?error=session_invalid');
    }
    
    if (sessionType && sessionType !== 'tenant') {
      logger.warn('Non-tenant session in tenant context - clearing session', {
        sessionId: req.sessionID,
        sessionType,
        hostname: req.hostname,
        tenantId: req.tenantId
      });
      
      req.session.destroy((err) => {
        if (err) logger.error('Error destroying invalid session:', err);
      });
      
      return res.redirect('/auth/login?error=session_invalid');
    }
    
    // Validate tenant session belongs to current tenant
    if (hasTenantSession && req.session.tenantId && req.session.tenantId !== req.tenantId) {
      logger.warn('Tenant session mismatch - clearing session', {
        sessionId: req.sessionID,
        sessionTenantId: req.session.tenantId,
        requestTenantId: req.tenantId,
        hostname: req.hostname
      });
      
      req.session.destroy((err) => {
        if (err) logger.error('Error destroying invalid session:', err);
      });
      
      return res.redirect('/auth/login?error=tenant_mismatch');
    }
  }
  
  next();
};

/**
 * Middleware to ensure authentication for protected routes
 */
const requireAuthByContext = (req, res, next) => {
  const isAuthenticated = req.session && (
    (req.authContext === 'backoffice' && req.session.backOfficeUserId) ||
    (req.authContext === 'tenant' && req.session.userId)
  );
  
  if (!isAuthenticated) {
    // Determine redirect URL based on context
    let loginUrl = '/auth/login';
    if (req.authContext === 'backoffice') {
      loginUrl = '/backoffice/auth/login';
    }
    
    // For API requests, return 401
    if (req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ 
        error: 'Authentication required',
        context: req.authContext,
        loginUrl 
      });
    }
    
    // Redirect to appropriate login page
    return res.redirect(loginUrl + '?redirect=' + encodeURIComponent(req.originalUrl));
  }
  
  next();
};

/**
 * Middleware to prevent authenticated users from accessing guest-only routes
 */
const requireGuestByContext = (req, res, next) => {
  const isAuthenticated = req.session && (
    (req.authContext === 'backoffice' && req.session.backOfficeUserId) ||
    (req.authContext === 'tenant' && req.session.userId)
  );
  
  if (isAuthenticated) {
    // Redirect to appropriate dashboard
    if (req.authContext === 'backoffice') {
      return res.redirect('/backoffice/dashboard');
    } else if (req.authContext === 'tenant') {
      return res.redirect('/dashboard');
    }
  }
  
  next();
};

module.exports = {
  setAuthContext,
  validateAuthContext,
  requireAuthByContext,
  requireGuestByContext
};