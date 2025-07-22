/**
 * Production Environment Configuration
 */

module.exports = {
  // Production-specific overrides
  server: {
    trustProxy: true
  },

  // Strict security in production
  security: {
    cors: {
      origin: false, // Disable CORS or set specific domains
      credentials: true
    },
    bcryptRounds: 12 // Stronger hashing in production
  },

  // Production logging
  logging: {
    level: 'warn',
    format: 'json'
  },

  // Production features
  whatsapp: {
    enforceWhitelist: false,
    productionMode: true
  },

  // Server configuration for Render
  server: {
    port: parseInt(process.env.PORT, 10) || 10000,
    trustProxy: true
  },

  // Session configuration for production
  session: {
    cookie: {
      secure: true,
      httpOnly: true,
      maxAge: 4 * 60 * 60 * 1000, // 4 hours
      sameSite: 'strict'
    }
  },

  // Stricter rate limiting in production
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 50,
    auth: {
      windowMs: 15 * 60 * 1000,
      max: 3
    }
  }
};