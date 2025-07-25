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

  // Skip CSRF for webhook endpoints and auth pages (temporary fix)
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
      if (process.env.NODE_ENV === 'development') {
        console.warn('[CSRF] No session token found for path:', req.path);
      }
      
      if (req.xhr || req.headers['content-type'] === 'application/json') {
        return res.status(403).json({ error: 'CSRF token missing' });
      }
      return res.status(403).send('CSRF token missing');
    }

    let providedToken = null;

    // Check for CSRF token in different locations
    if (req.xhr || req.headers['content-type'] === 'application/json') {
      // Headers are lowercase in Express, but check both cases for compatibility
      providedToken = req.headers['x-csrf-token'] || 
                     req.headers['X-CSRF-Token'] || 
                     req.get('X-CSRF-Token') ||
                     req.cookies['csrf-token'];
    } else {
      providedToken = req.body._csrf || 
                     req.query._csrf || 
                     req.cookies['csrf-token'];
    }

    // Only log CSRF issues in development
    if (process.env.NODE_ENV === 'development' && (!providedToken || providedToken !== sessionToken)) {
      console.log('[CSRF] Validation failed for path:', req.path);
      console.log('[CSRF] Session token:', sessionToken ? 'exists' : 'missing');
      console.log('[CSRF] Provided token:', providedToken ? 'exists' : 'missing');
    }

    // Validate token
    if (!providedToken || providedToken !== sessionToken) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[CSRF] Invalid token provided');
        console.warn('[CSRF] Expected:', sessionToken);
        console.warn('[CSRF] Received:', providedToken);
      }
      
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