const mongoose = require('mongoose');
const Queue = require('./server/models/Queue');
const whatsappService = require('./server/services/whatsappService');

async function testCancellationDebug() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/smart-queue-manager');
    console.log('Connected to MongoDB');

    // Find an active queue
    const queue = await Queue.findOne({ isActive: true });
    if (!queue) {
      console.log('No active queue found');
      return;
    }

    console.log(`Found queue: ${queue.name}`);
    
    // Add a test customer
    const testCustomer = {
      customerId: 'test-cancel-debug-' + Date.now(),
      customerName: 'Test Cancel Debug User',
      customerPhone: '60123456789',
      platform: 'whatsapp',
      serviceType: 'General Service',
      partySize: 2,
      specialRequests: 'Test cancellation debug'
    };

    const newEntry = queue.addCustomer(testCustomer);
    await queue.save();
    
    console.log(`Added test customer: ${newEntry.customerName} at position ${newEntry.position}`);
    console.log(`Customer ID: ${newEntry.customerId}`);
    console.log(`Customer Phone: ${newEntry.customerPhone}`);

    // Test step by step
    console.log('\n=== STEP 1: Initial Cancel Request ===');
    const cancelResponse1 = await whatsappService.handleCancelQueue('cancel', testCustomer.customerPhone);
    console.log('Response:', cancelResponse1);
    
    // Check conversation state
    console.log('\nConversation states:', whatsappService.conversationStates);
    
    console.log('\n=== STEP 2: "No" Response ===');
    const noResponse = await whatsappService.handleCancelQueue('no', testCustomer.customerPhone);
    console.log('Response:', noResponse);
    
    console.log('\n=== STEP 3: Another Cancel Request ===');
    const cancelResponse2 = await whatsappService.handleCancelQueue('cancel', testCustomer.customerPhone);
    console.log('Response:', cancelResponse2);
    
    console.log('\n=== STEP 4: "Yes" Response ===');
    const yesResponse = await whatsappService.handleCancelQueue('yes', testCustomer.customerPhone);
    console.log('Response:', yesResponse);

    // Check final state
    const updatedQueue = await Queue.findById(queue._id);
    const customer = updatedQueue.entries.find(e => e.customerId === testCustomer.customerId);
    
    if (customer) {
      console.log(`\nFinal customer status: ${customer.status}`);
    } else {
      console.log('\nCustomer not found in queue');
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDebug test completed');
  }
}

// Run the test
testCancellationDebug(); 