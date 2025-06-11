const mongoose = require('mongoose');
const whatsappService = require('./server/services/whatsappService');

async function testFullCancelFlow() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/smart-queue-manager');
    console.log('Connected to MongoDB');

    const phoneNumber = '+60126368832'; // The phone number that's in the queue
    
    console.log('\n=== Step 1: Initial Cancel Request ===');
    const cancelResponse = await whatsappService.handleCancelQueue('cancel', phoneNumber);
    console.log('Response:', cancelResponse);
    
    console.log('\n=== Step 2: "No" Response (should stay in queue) ===');
    const noResponse = await whatsappService.handleCancelQueue('no', phoneNumber);
    console.log('Response:', noResponse);
    
    console.log('\n=== Step 3: Another Cancel Request ===');
    const cancelResponse2 = await whatsappService.handleCancelQueue('cancel', phoneNumber);
    console.log('Response:', cancelResponse2);
    
    console.log('\n=== Step 4: "Yes" Response (should remove from queue) ===');
    const yesResponse = await whatsappService.handleCancelQueue('yes', phoneNumber);
    console.log('Response:', yesResponse);
    
    console.log('\n=== Step 5: Try to cancel again (should say not in queue) ===');
    const cancelResponse3 = await whatsappService.handleCancelQueue('cancel', phoneNumber);
    console.log('Response:', cancelResponse3);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testFullCancelFlow(); 