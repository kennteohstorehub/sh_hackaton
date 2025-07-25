const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { xssProtection } = require('./xss-protection');
const { validationResult } = require('express-validator');

// Security middleware configuration
const configureSecurityMiddleware = (app) => {
  // Helmet for security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://cdn.socket.io"],
        scriptSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:"],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // XSS protection - provides sanitized getters instead of modifying data
  app.use(xssProtection);
};

// Rate limiting configurations
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests') => {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// Specific rate limiters
const authLimiter = createRateLimiter(15 * 60 * 1000, 100, 'Too many authentication attempts'); // Increased to 100
const apiLimiter = createRateLimiter(15 * 60 * 1000, 500, 'API rate limit exceeded'); // Increased to 500
const strictLimiter = createRateLimiter(60 * 1000, 50, 'Too many requests to this endpoint'); // Increased to 50

// Input validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// CSRF token validation for AJAX requests
const csrfProtection = (req, res, next) => {
  // TEMPORARILY SKIP ALL CSRF VALIDATION FOR TESTING
  return next();
  
  // Skip CSRF for webhooks and API endpoints that use other authentication
  const skipPaths = ['/webhook/', '/api/whatsapp/webhook'];
  if (skipPaths.some(path => req.path.includes(path))) {
    return next();
  }
  
  // For AJAX requests, check custom header
  if (req.xhr || req.headers['content-type'] === 'application/json') {
    const token = req.headers['x-csrf-token'];
    if (!token || token !== req.session.csrfToken) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
  }
  
  next();
};

// Generate CSRF token for session
const generateCSRFToken = (req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

// Sanitize user input helper - deprecated
const sanitizeInput = (input) => {
  // Deprecated - use req.getSanitized() from xssProtection middleware
  console.warn('sanitizeInput is deprecated. Use req.getSanitized() instead.');
  if (typeof input !== 'string') return input;
  const xss = require('xss');
  return xss(input.trim());
};

// Validate UUID format (PostgreSQL)
const isValidUUID = (id) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

module.exports = {
  configureSecurityMiddleware,
  createRateLimiter,
  authLimiter,
  apiLimiter,
  strictLimiter,
  handleValidationErrors,
  csrfProtection,
  generateCSRFToken,
  sanitizeInput,
  isValidUUID
};