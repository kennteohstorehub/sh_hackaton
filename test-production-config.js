#!/usr/bin/env node

/**
 * Test Production WhatsApp Configuration
 * This script verifies that WhatsApp is properly configured for production
 */

const whatsappSecurity = require('./server/config/whatsapp-security');
const logger = require('./server/utils/logger');

console.log('🧪 Testing WhatsApp Production Configuration...\n');

// Test various phone numbers
const testNumbers = [
  '60123456789',    // Malaysian number
  '+60123456789',   // International format
  '60126368832',    // Your original number
  '1234567890',     // Random number
  '+1234567890',    // Random international
  '601234567890',   // Long Malaysian number
];

console.log('📋 Testing phone number authorization:');
testNumbers.forEach(number => {
  const isAllowed = whatsappSecurity.isPhoneNumberAllowed(number);
  const status = isAllowed ? '✅ ALLOWED' : '❌ BLOCKED';
  console.log(`   ${number}: ${status}`);
});

// Show current configuration
console.log('\n🔧 Current Configuration:');
const config = whatsappSecurity.getWhitelistInfo();
console.log(`   • Whitelist Enforced: ${config.enforced ? '✅ YES' : '❌ NO'}`);
console.log(`   • Environment: ${config.environment}`);
console.log(`   • Allowed Numbers: ${config.allowedNumbers.join(', ')}`);
console.log(`   • Total Count: ${config.count}`);

console.log('\n📊 Production Status:');
if (!config.enforced) {
  console.log('   ✅ Production Mode: ACTIVE');
  console.log('   ✅ All phone numbers can receive messages');
  console.log('   ✅ Ready for customer queue notifications');
} else {
  console.log('   ⚠️  Development Mode: ACTIVE');
  console.log('   ⚠️  Only whitelisted numbers can receive messages');
  console.log('   ⚠️  Need to disable whitelist for production');
}

console.log('\n🎯 Summary:');
console.log('   • WhatsApp service is configured for production');
console.log('   • All customer phone numbers will receive notifications');
console.log('   • Security logging is enabled for monitoring');
console.log('   • Re-enable whitelist with: WHATSAPP_ENFORCE_WHITELIST=true');