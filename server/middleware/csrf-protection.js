const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Enhanced CSRF Protection Middleware
 * 
 * Implements double-submit cookie pattern for forms and
 * custom header validation for AJAX requests
 */

/**
 * Generate a new CSRF token
 */
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * CSRF token management middleware
 * Creates and manages CSRF tokens for the session
 */
const csrfTokenManager = (req, res, next) => {
  // Initialize or rotate token
  if (!req.session.csrfToken || req.session.csrfTokenExpiry < Date.now()) {
    req.session.csrfToken = generateToken();
    req.session.csrfTokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  }

  // Make token available to views
  res.locals.csrfToken = req.session.csrfToken;
  
  // Set CSRF cookie for double-submit pattern
  res.cookie('csrf-token', req.session.csrfToken, {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });

  next();
};

/**
 * CSRF validation middleware
 * Validates CSRF tokens for state-changing requests
 */
const csrfValidation = (req, res, next) => {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for webhook endpoints (they use signature verification)
  // and public API endpoints
  const skipPaths = [
    '/api/webhooks/',
    '/api/messenger/webhook',
    '/webhook/',
    '/api/customer/join/',  // Public queue join endpoint
    '/api/customer/queue/',  // Public queue stats endpoint
    '/api/queue/acknowledge',  // Customer acknowledgment endpoint
    '/register'  // Public registration endpoint (temporarily skip CSRF)
  ];
  
  // Check if path should skip CSRF
  for (const path of skipPaths) {
    if (path.endsWith('/')) {
      // For paths ending with /, check if request path starts with it
      if (req.path.startsWith(path)) {
        return next();
      }
    } else {
      // For exact paths, check exact match or if it's included
      if (req.path === path || req.path.includes(path)) {
        return next();
      }
    }
  }

  // Get the session token
  const sessionToken = req.session.csrfToken;
  
  if (!sessionToken) {
    logger.warn('CSRF validation failed - no session token', {
      url: req.url,
      method: req.method,
      ip: req.ip
    });
    
    if (req.xhr || req.headers['content-type'] === 'application/json') {
      return res.status(403).json({ error: 'CSRF token missing' });
    }
    return res.status(403).render('error', {
      title: 'Security Error',
      status: 403,
      message: 'Your session has expired. Please refresh the page and try again.'
    });
  }

  let providedToken = null;

  // Check for CSRF token in different locations
  const contentType = req.headers['content-type'] || '';
  const isAjax = req.xhr || contentType.includes('application/json');
  
  if (isAjax) {
    // AJAX request - check custom header
    providedToken = req.headers['x-csrf-token'];
  } else {
    // Form submission - check body, query, or cookie
    providedToken = req.body._csrf || 
                   req.query._csrf || 
                   (req.cookies && req.cookies['csrf-token']);
  }

  // Validate token
  if (!providedToken || providedToken !== sessionToken) {
    logger.warn('CSRF validation failed - invalid token', {
      url: req.url,
      method: req.method,
      ip: req.ip,
      hasToken: !!providedToken,
      tokenMatch: providedToken === sessionToken
    });

    if (req.xhr || req.headers['content-type'] === 'application/json') {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    return res.status(403).render('error', {
      title: 'Security Error',
      status: 403,
      message: 'Invalid security token. Please refresh the page and try again.'
    });
  }

  // Token is valid
  next();
};

/**
 * Helper function to generate CSRF meta tags for HTML pages
 */
const generateCSRFMeta = (token) => {
  return `
    <meta name="csrf-token" content="${token}">
    <meta name="csrf-param" content="_csrf">
    <meta name="csrf-header" content="X-CSRF-Token">
  `;
};

/**
 * Helper function to generate hidden CSRF input for forms
 */
const generateCSRFInput = (token) => {
  return `<input type="hidden" name="_csrf" value="${token}">`;
};

/**
 * Client-side JavaScript helper for AJAX requests
 */
const csrfAjaxSetup = `
// CSRF token setup for AJAX requests
(function() {
  const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  
  // Setup for fetch API
  const originalFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    if (token && !options.headers) {
      options.headers = {};
    }
    if (token && options.headers) {
      options.headers['X-CSRF-Token'] = token;
    }
    return originalFetch.call(this, url, options);
  };
  
  // Setup for XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function() {
    const result = originalOpen.apply(this, arguments);
    if (token) {
      this.setRequestHeader('X-CSRF-Token', token);
    }
    return result;
  };
  
  // Setup for jQuery if available
  if (typeof jQuery !== 'undefined') {
    jQuery.ajaxSetup({
      headers: { 'X-CSRF-Token': token }
    });
  }
})();
`;

/**
 * Middleware to add CSRF helpers to res.locals
 */
const csrfHelpers = (req, res, next) => {
  res.locals.csrfMeta = () => generateCSRFMeta(res.locals.csrfToken);
  res.locals.csrfInput = () => generateCSRFInput(res.locals.csrfToken);
  res.locals.csrfAjaxSetup = csrfAjaxSetup;
  next();
};

module.exports = {
  csrfTokenManager,
  csrfValidation,
  csrfHelpers,
  generateToken,
  generateCSRFMeta,
  generateCSRFInput,
  csrfAjaxSetup
};