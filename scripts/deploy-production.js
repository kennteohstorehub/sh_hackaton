#!/usr/bin/env node

/**
 * Production Deployment Configuration Script
 * This script ensures WhatsApp is properly configured for production
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Configuring WhatsApp for Production Deployment...\n');

// Check environment variables
const envFile = path.join(__dirname, '..', '.env');
let envContent = '';

if (fs.existsSync(envFile)) {
  envContent = fs.readFileSync(envFile, 'utf8');
}

// Ensure production environment variables are set
const productionEnvVars = {
  'NODE_ENV': 'production',
  'WHATSAPP_ENFORCE_WHITELIST': 'false',  // Allow all numbers
  'WHATSAPP_PRODUCTION_MODE': 'true'
};

let updated = false;

Object.entries(productionEnvVars).forEach(([key, value]) => {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}=${value}`;
  
  if (regex.test(envContent)) {
    // Update existing line
    envContent = envContent.replace(regex, line);
    console.log(`✅ Updated ${key}=${value}`);
  } else {
    // Add new line
    envContent += `\n${line}`;
    console.log(`➕ Added ${key}=${value}`);
  }
  updated = true;
});

// Write updated .env file
if (updated) {
  fs.writeFileSync(envFile, envContent);
  console.log('\n📝 Environment file updated successfully!');
} else {
  console.log('\n✅ Environment already configured for production');
}

// Show current WhatsApp configuration
console.log('\n📋 Current WhatsApp Configuration:');
console.log('• Production Mode: ✅ ENABLED');
console.log('• Phone Whitelist: ❌ DISABLED (allows all numbers)');
console.log('• Message Logging: ✅ ENABLED');
console.log('• Security Override: Available via WHATSAPP_ENFORCE_WHITELIST=true');

console.log('\n🔧 To enable security whitelist in production:');
console.log('   export WHATSAPP_ENFORCE_WHITELIST=true');
console.log('   # or add to your .env file');

console.log('\n✅ WhatsApp is now configured for production!');
console.log('   All customer phone numbers can receive messages');
console.log('   Ready to process queue notifications');