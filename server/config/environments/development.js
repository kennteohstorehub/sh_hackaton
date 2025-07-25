/**
 * Development Environment Configuration
 */

module.exports = {
  // Development-specific overrides
  server: {
    port: 3838,
    url: 'http://localhost:3838'
  },

  // Less strict security in development
  security: {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3838'],
      credentials: true
    }
  },

  // More verbose logging in development
  logging: {
    level: 'debug',
    format: 'simple'
  },

  // Disable production features in development
  whatsapp: {
    enforceWhitelist: true,
    productionMode: false
  },

  // Development database - PostgreSQL only
  database: {
    postgres: {
      // Uses DATABASE_URL from .env
    }
  }
};