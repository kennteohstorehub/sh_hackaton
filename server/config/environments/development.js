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

  // Development database
  database: {
    mongodb: {
      uri: 'mongodb://localhost:27017/smart-queue-manager-dev'
    }
  }
};