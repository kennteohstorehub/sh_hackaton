#!/usr/bin/env node

/**
 * Debug startup script to log configuration before starting the server
 * This helps diagnose Render deployment issues
 */

console.log('🚀 Debug Startup Information');
console.log('============================\n');

// Log environment
console.log('Environment Variables:');
console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
console.log('PORT:', process.env.PORT || 'NOT SET');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? `Set (${process.env.JWT_SECRET.length} chars)` : 'NOT SET');
console.log('SESSION_SECRET:', process.env.SESSION_SECRET ? `Set (${process.env.SESSION_SECRET.length} chars)` : 'NOT SET');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'NOT SET');
console.log('ENABLE_WHATSAPP_WEB:', process.env.ENABLE_WHATSAPP_WEB || 'NOT SET');
console.log('LOG_LEVEL:', process.env.LOG_LEVEL || 'NOT SET');

// Try to load and validate config
console.log('\nConfiguration Test:');
console.log('==================');
try {
  const { config, validateEnvironment } = require('./server/config');
  const { missing, warnings } = validateEnvironment();
  
  if (missing.length > 0) {
    console.error('❌ Missing required variables:', missing.join(', '));
    process.exit(1);
  }
  
  console.log('✅ Configuration valid');
  if (warnings.length > 0) {
    console.log('⚠️  Warnings:', warnings.join('; '));
  }
  
  // Log actual config values (non-sensitive)
  console.log('\nLoaded Configuration:');
  console.log('- Server Port:', config.server.port);
  console.log('- Environment:', config.env);
  console.log('- Database Configured:', !!config.database.postgres.url);
  console.log('- WhatsApp Enabled:', config.whatsapp.productionMode);
  console.log('- Session Cookie Secure:', config.session.cookie.secure);
  
} catch (error) {
  console.error('❌ Configuration error:', error.message);
  process.exit(1);
}

// Now start the actual server
console.log('\n✅ Configuration checks passed, starting server...\n');
require('./server/index.js');