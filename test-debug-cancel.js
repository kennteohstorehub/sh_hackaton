const mongoose = require('mongoose');
const whatsappService = require('./server/services/whatsappService');

async function testCancelKeywords() {
  console.log('Testing cancel keyword detection...');
  
  // Connect to MongoDB first
  try {
    await mongoose.connect('mongodb://localhost:27017/smart-queue-manager');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    return;
  }
  
  const testMessages = [
    'cancel',
    'CANCEL',
    'Cancel',
    'I want to cancel',
    'cancel my order',
    'leave',
    'exit',
    'remove',
    'quit',
    'stop',
    'hello',
    'status'
  ];
  
  for (const message of testMessages) {
    console.log(`\nTesting message: "${message}"`);
    
    const body = message.toLowerCase().trim();
    const cancelKeywords = ['cancel', 'leave', 'exit', 'remove', 'quit', 'stop'];
    const isCancelRequest = cancelKeywords.some(keyword => body.includes(keyword));
    
    console.log(`  - Lowercase body: "${body}"`);
    console.log(`  - Is cancel request: ${isCancelRequest}`);
    
    if (isCancelRequest) {
      console.log('  ✅ Would process as cancel request');
    } else {
      console.log('  ❌ Would not process as cancel request');
    }
  }
  
  // Test the actual method
  console.log('\n=== Testing actual handleCancelQueue method ===');
  
  try {
    const response = await whatsappService.handleCancelQueue('cancel', '+60126368832');
    console.log('Response:', response);
  } catch (error) {
    console.error('Error:', error);
  }
  
  // Disconnect
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

testCancelKeywords(); 