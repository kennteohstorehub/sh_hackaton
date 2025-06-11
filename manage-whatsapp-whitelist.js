#!/usr/bin/env node

/**
 * WhatsApp Whitelist Management Script
 * 
 * This script helps you manage the WhatsApp phone number whitelist
 * for testing purposes.
 */

const whatsappService = require('./server/services/whatsappService');
const whatsappSecurity = require('./server/config/whatsapp-security');

function showUsage() {
  console.log(`
🔒 WhatsApp Whitelist Management

Usage:
  node manage-whatsapp-whitelist.js <command> [phone_number]

Commands:
  list                    - Show current whitelist
  add <phone_number>      - Add a phone number to whitelist
  test <phone_number>     - Test if a phone number is allowed
  status                  - Show whitelist status

Examples:
  node manage-whatsapp-whitelist.js list
  node manage-whatsapp-whitelist.js add 60123456789
  node manage-whatsapp-whitelist.js test +60987654321
  node manage-whatsapp-whitelist.js status
`);
}

function showWhitelistInfo() {
  const info = whatsappService.getWhitelistInfo();
  
  console.log('\n🔒 WhatsApp Security Status:');
  console.log(`📊 Enforcement: ${info.enforced ? '✅ ENABLED' : '❌ DISABLED'}`);
  console.log(`🌍 Environment: ${info.environment}`);
  console.log(`📱 Total allowed numbers: ${info.count}`);
  console.log('\n📋 Allowed Numbers:');
  
  if (info.allowedNumbers.length === 0) {
    console.log('   (No numbers in whitelist)');
  } else {
    info.allowedNumbers.forEach((number, index) => {
      console.log(`   ${index + 1}. ${number}`);
    });
  }
  console.log('');
}

function addNumber(phoneNumber) {
  if (!phoneNumber) {
    console.log('❌ Error: Please provide a phone number to add');
    console.log('Example: node manage-whatsapp-whitelist.js add 60123456789');
    return;
  }

  console.log(`\n📱 Adding ${phoneNumber} to whitelist...`);
  
  const result = whatsappService.addToWhitelist(phoneNumber);
  
  if (result) {
    console.log(`✅ Successfully added ${phoneNumber} to whitelist`);
  } else {
    console.log(`⚠️  ${phoneNumber} is already in whitelist or whitelist is disabled`);
  }
  
  showWhitelistInfo();
}

function testNumber(phoneNumber) {
  if (!phoneNumber) {
    console.log('❌ Error: Please provide a phone number to test');
    console.log('Example: node manage-whatsapp-whitelist.js test +60987654321');
    return;
  }

  console.log(`\n🧪 Testing ${phoneNumber}...`);
  
  const isAllowed = whatsappService.isPhoneNumberAllowed(phoneNumber);
  
  if (isAllowed) {
    console.log(`✅ ${phoneNumber} is ALLOWED to receive WhatsApp messages`);
  } else {
    console.log(`❌ ${phoneNumber} is BLOCKED from receiving WhatsApp messages`);
  }
  console.log('');
}

// Main script logic
const command = process.argv[2];
const phoneNumber = process.argv[3];

switch (command) {
  case 'list':
    showWhitelistInfo();
    break;
    
  case 'add':
    addNumber(phoneNumber);
    break;
    
  case 'test':
    testNumber(phoneNumber);
    break;
    
  case 'status':
    showWhitelistInfo();
    break;
    
  case 'help':
  case '--help':
  case '-h':
    showUsage();
    break;
    
  default:
    console.log('❌ Unknown command:', command || '(none)');
    showUsage();
    break;
} 