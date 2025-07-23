const path = require('path');
const logger = require('../utils/logger');

/**
 * Centralized Configuration Management
 * 
 * Provides validated, type-safe configuration with environment-specific overrides
 */

// Required environment variables
const REQUIRED_ENV_VARS = [
  'NODE_ENV',
  'JWT_SECRET',
  'SESSION_SECRET'
];

// Optional but recommended environment variables
const RECOMMENDED_ENV_VARS = [
  'DATABASE_URL',
  'WEBHOOK_SECRET',
  'FB_APP_SECRET',
  'FB_PAGE_ACCESS_TOKEN'
];

/**
 * Validate environment variables
 */
function validateEnvironment() {
  const missing = [];
  const warnings = [];

  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Check recommended variables
  for (const varName of RECOMMENDED_ENV_VARS) {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  }

  // Check for weak secrets
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET should be at least 32 characters long');
  }

  if (process.env.SESSION_SECRET === process.env.JWT_SECRET) {
    warnings.push('SESSION_SECRET should be different from JWT_SECRET');
  }

  return { missing, warnings };
}

/**
 * Load environment-specific configuration
 */
function loadEnvironmentConfig() {
  const env = process.env.NODE_ENV || 'development';
  const envFile = path.join(__dirname, 'environments', `${env}.js`);
  
  try {
    return require(envFile);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      logger.warn(`No environment-specific config found for ${env}`);
      return {};
    }
    throw error;
  }
}

/**
 * Configuration object
 */
const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Server
  server: {
    port: parseInt(process.env.PORT, 10) || 3001,
    host: process.env.HOST || 'localhost',
    url: process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3001}`,
    trustProxy: process.env.TRUST_PROXY === 'true'
  },

  // Database
  database: {
    postgres: {
      url: process.env.DATABASE_URL,
      directUrl: process.env.DATABASE_URL_DIRECT,
      ssl: process.env.NODE_ENV === 'production'
    }
  },

  // Security
  security: {
    jwtSecret: process.env.JWT_SECRET,
    sessionSecret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
    webhookSecret: process.env.WEBHOOK_SECRET,
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
    cors: {
      origin: process.env.CORS_ORIGIN ? 
        process.env.CORS_ORIGIN.split(',') : 
        process.env.NODE_ENV === 'production' ? false : ['http://localhost:3001'],
      credentials: true
    }
  },

  // Session
  session: {
    name: 'sessionId',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: parseInt(process.env.SESSION_MAX_AGE, 10) || 2 * 60 * 60 * 1000, // 2 hours
      sameSite: 'lax'
    }
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    auth: {
      windowMs: 15 * 60 * 1000,
      max: 5
    }
  },

  // WhatsApp
  whatsapp: {
    sessionPath: process.env.WHATSAPP_SESSION_PATH || './whatsapp-session',
    enforceWhitelist: process.env.WHATSAPP_ENFORCE_WHITELIST === 'true',
    productionMode: process.env.WHATSAPP_PRODUCTION_MODE === 'true',
    allowedNumbers: process.env.WHATSAPP_ALLOWED_NUMBERS ? 
      process.env.WHATSAPP_ALLOWED_NUMBERS.split(',').map(n => n.trim()) : [],
    webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET
  },


  // AI Services
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    sentimentApiKey: process.env.SENTIMENT_API_KEY,
    enabled: !!(process.env.OPENAI_API_KEY || process.env.SENTIMENT_API_KEY)
  },

  // Queue Settings
  queue: {
    maxSize: parseInt(process.env.MAX_QUEUE_SIZE, 10) || 100,
    notificationInterval: parseInt(process.env.NOTIFICATION_INTERVAL_MINUTES, 10) || 5,
    defaultServiceTime: 15, // minutes
    noShowTimeout: 15 // minutes
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    maxFileSize: 5242880, // 5MB
    maxFiles: 5
  },

  // Email (for future use)
  email: {
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    },
    from: process.env.EMAIL_FROM || 'noreply@storehub-queue.com'
  },

  // Error Tracking
  sentry: {
    dsn: process.env.SENTRY_DSN,
    enabled: !!process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV
  },

  // Redis (for future use)
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    enabled: !!process.env.REDIS_URL
  }
};

// Deep merge with environment-specific config
const envConfig = loadEnvironmentConfig();
// Merge carefully to avoid overwriting nested objects
for (const key in envConfig) {
  if (typeof envConfig[key] === 'object' && typeof config[key] === 'object') {
    // Merge nested objects
    Object.assign(config[key], envConfig[key]);
  } else {
    // Replace top-level values
    config[key] = envConfig[key];
  }
}

/**
 * Initialize configuration
 */
function initialize() {
  const { missing, warnings } = validateEnvironment();

  if (missing.length > 0) {
    logger.error('Missing required environment variables:', missing.join(', '));
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (warnings.length > 0) {
    logger.warn('Configuration warnings:', warnings.join('; '));
  }

  // Log configuration summary (without sensitive data)
  logger.info('Configuration loaded', {
    env: config.env,
    port: config.server.port,
    postgresConfigured: !!config.database.postgres.url,
    whatsappWhitelist: config.whatsapp.enforceWhitelist,
    aiEnabled: config.ai.enabled,
    sentryEnabled: config.sentry.enabled
  });

  return config;
}

module.exports = {
  config,
  initialize,
  validateEnvironment
};