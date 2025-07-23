#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Queue Management System Diagnostic Tool\n');

// Check Node version
console.log('1. Node.js Version:');
console.log(`   Current: ${process.version}`);
console.log(`   Required: >=16.0.0`);
console.log(`   Status: ${process.version.match(/v(\d+)/)[1] >= 16 ? '✅ OK' : '❌ FAIL'}\n`);

// Check environment variables
console.log('2. Environment Variables:');
const requiredEnvVars = {
  'NODE_ENV': process.env.NODE_ENV || '❌ NOT SET',
  'JWT_SECRET': process.env.JWT_SECRET ? '✅ SET' : '❌ NOT SET',
  'SESSION_SECRET': process.env.SESSION_SECRET ? '✅ SET' : '❌ NOT SET',
  'DATABASE_URL': process.env.DATABASE_URL ? '✅ SET' : '❌ NOT SET',
  'PORT': process.env.PORT || '3000 (default)',
  'LOG_LEVEL': process.env.LOG_LEVEL || 'info (default)',
  'ENABLE_WHATSAPP_WEB': process.env.ENABLE_WHATSAPP_WEB || 'true (default)'
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  console.log(`   ${key}: ${value}`);
}
console.log();

// Check if we can connect to config
console.log('3. Configuration Test:');
try {
  const { config, initialize } = require('./server/config');
  console.log('   ✅ Config module loaded');
  
  try {
    initialize();
    console.log('   ✅ Config initialized successfully');
  } catch (initError) {
    console.log('   ❌ Config initialization failed:', initError.message);
  }
} catch (error) {
  console.log('   ❌ Failed to load config:', error.message);
}
console.log();

// Check database connection
console.log('4. Database Connection:');
if (process.env.DATABASE_URL) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  prisma.$connect()
    .then(() => {
      console.log('   ✅ Database connection successful');
      return prisma.$disconnect();
    })
    .catch(error => {
      console.log('   ❌ Database connection failed:', error.message);
    });
} else {
  console.log('   ⚠️  DATABASE_URL not set - cannot test connection');
}
console.log();

// Check for common issues
console.log('5. Common Issues Check:');

// Check logs directory
const logsDir = path.join(__dirname, 'logs');
try {
  if (!fs.existsSync(logsDir)) {
    console.log('   ⚠️  Logs directory does not exist (will be created on first run)');
  } else {
    console.log('   ✅ Logs directory exists');
  }
} catch (error) {
  console.log('   ❌ Cannot check logs directory:', error.message);
}

// Check for WhatsApp session directory
const whatsappDir = path.join(__dirname, '.wwebjs_auth');
if (fs.existsSync(whatsappDir)) {
  console.log('   ⚠️  WhatsApp session directory exists (may cause issues on Render)');
} else {
  console.log('   ✅ No WhatsApp session directory');
}

// Check package.json scripts
try {
  const packageJson = require('./package.json');
  console.log(`   ✅ Start script: ${packageJson.scripts.start}`);
} catch (error) {
  console.log('   ❌ Cannot read package.json');
}

console.log('\n6. Recommendations:');
if (!process.env.JWT_SECRET || !process.env.SESSION_SECRET) {
  console.log('   🔴 CRITICAL: Set JWT_SECRET and SESSION_SECRET environment variables!');
  console.log('      These are required for the application to start.');
}
if (!process.env.DATABASE_URL) {
  console.log('   🔴 CRITICAL: Set DATABASE_URL for session storage!');
  console.log('      Without this, sessions won\'t work properly.');
}
if (process.env.ENABLE_WHATSAPP_WEB !== 'false') {
  console.log('   ⚠️  WARNING: WhatsApp Web is enabled. Set ENABLE_WHATSAPP_WEB=false on Render.');
}
if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'production') {
  console.log('   ⚠️  WARNING: NODE_ENV should be set to "production" on Render.');
}

console.log('\n✨ Diagnostic complete!\n');