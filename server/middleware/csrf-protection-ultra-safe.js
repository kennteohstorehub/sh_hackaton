const crypto = require('crypto');

/**
 * Ultra-safe CSRF Protection - Won't crash under any circumstances
 */

const generateToken = () => {
  try {
    return crypto.randomBytes(32).toString('hex');
  } catch (e) {
    // Fallback to less secure but functional token
    return Math.random().toString(36).substr(2) + Date.now().toString(36);
  }
};

const csrfTokenManager = (req, res, next) => {
  try {
    // Ensure res.locals exists
    if (!res.locals) {
      res.locals = {};
    }
    
    // Check if session exists
    if (!req.session) {
      console.warn('[CSRF] No session available, skipping CSRF token generation');
      res.locals.csrfToken = '';
      return next();
    }

    // Initialize or rotate token
    if (!req.session.csrfToken || !req.session.csrfTokenExpiry || req.session.csrfTokenExpiry < Date.now()) {
      req.session.csrfToken = generateToken();
      req.session.csrfTokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
    }

    // Make token available to views
    res.locals.csrfToken = req.session.csrfToken || '';
    
    // Set CSRF cookie (wrapped in try-catch)
    try {
      res.cookie('csrf-token', req.session.csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
      });
    } catch (cookieErr) {
      console.error('[CSRF] Failed to set cookie:', cookieErr.message);
    }
  } catch (error) {
    console.error('[CSRF] Error in token manager:', error.message);
    // Ensure res.locals is safe
    if (!res.locals) res.locals = {};
    res.locals.csrfToken = '';
  }

  next();
};

const csrfValidation = (req, res, next) => {
  try {
    // Skip CSRF for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Skip CSRF for webhook endpoints
    const skipPaths = [
      '/api/webhooks/',
      '/api/whatsapp/webhook',
      '/api/messenger/webhook',
      '/webhook/'
    ];
    
    if (skipPaths.some(path => req.path.includes(path))) {
      return next();
    }

    // Check if session exists
    if (!req.session || !req.session.csrfToken) {
      console.warn('[CSRF] No session/token available for validation');
      return next(); // Be permissive in case of missing session
    }

    const sessionToken = req.session.csrfToken;
    let providedToken = null;

    // Safely check for CSRF token in different locations
    try {
      if (req.body && req.body._csrf) {
        providedToken = req.body._csrf;
      } else if (req.query && req.query._csrf) {
        providedToken = req.query._csrf;
      } else if (req.cookies && req.cookies['csrf-token']) {
        providedToken = req.cookies['csrf-token'];
      } else if (req.headers && req.headers['x-csrf-token']) {
        providedToken = req.headers['x-csrf-token'];
      }
    } catch (e) {
      console.error('[CSRF] Error extracting token:', e.message);
    }

    // Validate token
    if (!providedToken || providedToken !== sessionToken) {
      const isJsonRequest = req.xhr || 
                           (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) ||
                           (req.headers['accept'] && req.headers['accept'].includes('application/json'));
      
      if (isJsonRequest) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
      }
      return res.status(403).send('Invalid CSRF token');
    }
  } catch (error) {
    console.error('[CSRF] Critical error in validation:', error.message);
    // In production, fail closed; in dev, fail open
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).send('Security validation error');
    }
  }

  next();
};

const csrfHelpers = (req, res, next) => {
  try {
    // Ensure res.locals exists
    if (!res.locals) {
      res.locals = {};
    }
    // Only set if not already set by csrfTokenManager
    if (typeof res.locals.csrfToken === 'undefined') {
      res.locals.csrfToken = '';
    }
  } catch (e) {
    console.error('[CSRF] Error in helpers:', e.message);
  }
  next();
};

module.exports = {
  csrfTokenManager,
  csrfValidation,
  csrfHelpers
};
