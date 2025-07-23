const crypto = require('crypto');

/**
 * Safe CSRF Protection - Won't crash if session is unavailable
 */

const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const csrfTokenManager = (req, res, next) => {
  try {
    // Check if session exists
    if (!req.session) {
      console.warn('[CSRF] No session available, skipping CSRF token generation');
      res.locals.csrfToken = '';
      return next();
    }

    // Initialize or rotate token
    if (!req.session.csrfToken || req.session.csrfTokenExpiry < Date.now()) {
      req.session.csrfToken = generateToken();
      req.session.csrfTokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
    }

    // Make token available to views
    res.locals.csrfToken = req.session.csrfToken;
    
    // Set CSRF cookie
    res.cookie('csrf-token', req.session.csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });
  } catch (error) {
    console.error('[CSRF] Error in token manager:', error.message);
    res.locals.csrfToken = '';
  }

  next();
};

const csrfValidation = (req, res, next) => {
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

  try {
    // Check if session exists
    if (!req.session) {
      console.warn('[CSRF] No session available, skipping CSRF validation');
      return next();
    }

    const sessionToken = req.session.csrfToken;
    
    if (!sessionToken) {
      console.warn('[CSRF] No session token found');
      if (req.xhr || req.headers['content-type'] === 'application/json') {
        return res.status(403).json({ error: 'CSRF token missing' });
      }
      return res.status(403).send('CSRF token missing');
    }

    let providedToken = null;

    // Check for CSRF token in different locations
    if (req.xhr || req.headers['content-type'] === 'application/json') {
      providedToken = req.headers['x-csrf-token'];
    } else {
      providedToken = req.body._csrf || 
                     req.query._csrf || 
                     req.cookies['csrf-token'];
    }

    // Validate token
    if (!providedToken || providedToken !== sessionToken) {
      console.warn('[CSRF] Invalid token provided');
      if (req.xhr || req.headers['content-type'] === 'application/json') {
        return res.status(403).json({ error: 'Invalid CSRF token' });
      }
      return res.status(403).send('Invalid CSRF token');
    }
  } catch (error) {
    console.error('[CSRF] Error in validation:', error.message);
    // In case of error, fail open in development, fail closed in production
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'Security validation error' });
    }
  }

  next();
};

const csrfHelpers = (req, res, next) => {
  res.locals.csrfToken = res.locals.csrfToken || '';
  next();
};

module.exports = {
  csrfTokenManager,
  csrfValidation,
  csrfHelpers
};