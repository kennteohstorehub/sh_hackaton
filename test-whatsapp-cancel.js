const mongoose = require('mongoose');
const whatsappService = require('./server/services/whatsappService');

async function testWhatsAppCancel() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/smart-queue-manager');
    console.log('Connected to MongoDB');

    // Test the cancellation directly
    console.log('\n=== Testing cancellation with debug logs ===');
    
    const phoneNumber = '+60126368832'; // The phone number that's in the queue
    const message = 'cancel';
    
    console.log(`Testing with phone: ${phoneNumber}, message: "${message}"`);
    
    // Call the method directly
    const response = await whatsappService.handleCancelQueue(message, phoneNumber);
    console.log('Response:', response);
    
    // Also test without the + prefix
    const phoneNumber2 = '60126368832';
    console.log(`\nTesting with phone: ${phoneNumber2}, message: "${message}"`);
    
    const response2 = await whatsappService.handleCancelQueue(message, phoneNumber2);
    console.log('Response:', response2);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testWhatsAppCancel(); 