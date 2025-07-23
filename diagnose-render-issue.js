#!/usr/bin/env node

/**
 * Diagnostic script to help troubleshoot Render deployment issues
 * Run this to check for common configuration problems
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Diagnosing Render Deployment Issues\n');

// Check for required environment variables
const requiredEnvVars = [
  'NODE_ENV',
  'JWT_SECRET', 
  'SESSION_SECRET'
];

const recommendedEnvVars = [
  'DATABASE_URL',
  'WEBHOOK_SECRET',
  'PORT'
];

console.log('📋 Environment Variables Check:');
console.log('================================');

// Check required vars
console.log('\n🔴 Required Variables:');
let missingRequired = [];
requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`✅ ${varName}: Set (length: ${process.env[varName].length})`);
  } else {
    console.log(`❌ ${varName}: MISSING`);
    missingRequired.push(varName);
  }
});

// Check recommended vars
console.log('\n🟡 Recommended Variables:');
recommendedEnvVars.forEach(varName => {
  if (process.env[varName]) {
    if (varName === 'DATABASE_URL') {
      // Hide sensitive data but show it's configured
      console.log(`✅ ${varName}: Set (PostgreSQL)`);
    } else {
      console.log(`✅ ${varName}: Set`);
    }
  } else {
    console.log(`⚠️  ${varName}: Not set`);
  }
});

// Check for common issues
console.log('\n\n🔍 Common Issues Check:');
console.log('=======================');

// 1. WhatsApp configuration
if (process.env.ENABLE_WHATSAPP_WEB === 'true') {
  console.log('❌ ENABLE_WHATSAPP_WEB is true - This will fail on Render!');
  console.log('   Fix: Set ENABLE_WHATSAPP_WEB=false in Render environment');
} else {
  console.log('✅ WhatsApp Web is disabled (good for Render)');
}

// 2. Node environment
if (!process.env.NODE_ENV) {
  console.log('❌ NODE_ENV is not set - This causes configuration issues!');
  console.log('   Fix: Set NODE_ENV=production in Render environment');
} else if (process.env.NODE_ENV !== 'production') {
  console.log(`⚠️  NODE_ENV is '${process.env.NODE_ENV}' - Should be 'production' on Render`);
} else {
  console.log('✅ NODE_ENV is set to production');
}

// 3. Database configuration
if (!process.env.DATABASE_URL) {
  console.log('⚠️  No DATABASE_URL - Sessions will use memory (not recommended)');
  console.log('   Fix: Add PostgreSQL database URL from Neon or Render');
} else {
  console.log('✅ Database URL is configured');
}

// 4. Port configuration
if (process.env.PORT) {
  console.log(`✅ PORT is set to ${process.env.PORT}`);
} else {
  console.log('ℹ️  PORT not set - Will default to 3001');
  console.log('   Note: Render usually sets this automatically');
}

// 5. Session secrets
if (process.env.JWT_SECRET === process.env.SESSION_SECRET) {
  console.log('⚠️  JWT_SECRET and SESSION_SECRET are the same');
  console.log('   Recommendation: Use different secrets for better security');
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.log('⚠️  JWT_SECRET is less than 32 characters');
  console.log('   Recommendation: Use a longer secret for better security');
}

// Check if render.yaml exists
console.log('\n\n📄 Deployment Configuration:');
console.log('============================');
const renderYamlPath = path.join(__dirname, 'render.yaml');
if (fs.existsSync(renderYamlPath)) {
  console.log('✅ render.yaml exists');
  
  // Check key settings in render.yaml
  const renderYaml = fs.readFileSync(renderYamlPath, 'utf8');
  if (renderYaml.includes('ENABLE_WHATSAPP_WEB')) {
    if (renderYaml.includes('ENABLE_WHATSAPP_WEB:\n        value: "false"')) {
      console.log('✅ render.yaml has ENABLE_WHATSAPP_WEB=false');
    } else {
      console.log('❌ render.yaml might have ENABLE_WHATSAPP_WEB enabled');
    }
  }
  
  if (renderYaml.includes('NODE_ENV:\n        value: production')) {
    console.log('✅ render.yaml sets NODE_ENV=production');
  } else {
    console.log('⚠️  render.yaml might not set NODE_ENV=production');
  }
} else {
  console.log('❌ render.yaml not found!');
}

// Summary
console.log('\n\n📊 Summary:');
console.log('===========');
if (missingRequired.length > 0) {
  console.log(`\n❌ CRITICAL: Missing required environment variables: ${missingRequired.join(', ')}`);
  console.log('   The application will fail to start without these!');
}

console.log('\n🔧 Recommended Actions:');
console.log('1. Ensure all required environment variables are set in Render');
console.log('2. Set NODE_ENV=production');
console.log('3. Set ENABLE_WHATSAPP_WEB=false (or remove it)');
console.log('4. Configure a PostgreSQL database URL');
console.log('5. Check Render logs for specific error messages');

console.log('\n💡 To test locally with production settings:');
console.log('   NODE_ENV=production npm start');

console.log('\n📝 To view detailed logs:');
console.log('   Set LOG_LEVEL=debug in Render environment variables');

// Test if we can start the config
console.log('\n\n🧪 Testing Configuration Loading:');
console.log('=================================');
try {
  const { config, validateEnvironment } = require('./server/config');
  const { missing, warnings } = validateEnvironment();
  
  if (missing.length > 0) {
    console.log(`❌ Configuration validation failed: Missing ${missing.join(', ')}`);
  } else {
    console.log('✅ Configuration can be loaded');
    if (warnings.length > 0) {
      console.log(`⚠️  Warnings: ${warnings.join('; ')}`);
    }
  }
} catch (error) {
  console.log('❌ Failed to load configuration:', error.message);
}

console.log('\n\n✅ Diagnostic complete!\n');