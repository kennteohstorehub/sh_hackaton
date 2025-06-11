const mongoose = require('mongoose');
const Queue = require('./server/models/Queue');
const whatsappService = require('./server/services/whatsappService');

async function testCancellationFixed() {
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

    // Find a waiting customer
    const waitingCustomer = queue.entries.find(entry => entry.status === 'waiting');
    if (!waitingCustomer) {
      console.log('No waiting customers found');
      return;
    }

    console.log(`Testing with existing customer: ${waitingCustomer.customerName}`);
    console.log(`Phone: ${waitingCustomer.customerPhone}`);
    console.log(`Status: ${waitingCustomer.status}`);

    // Test cancellation flow
    console.log('\n=== STEP 1: Send "cancel" ===');
    const cancelResponse = await whatsappService.handleCancelQueue('cancel', waitingCustomer.customerPhone);
    console.log('Response:', cancelResponse);
    
    // Check conversation state
    console.log('\nConversation states size:', whatsappService.conversationStates.size);
    if (whatsappService.conversationStates.has(waitingCustomer.customerPhone)) {
      console.log('Has pending cancellation:', !!whatsappService.conversationStates.get(waitingCustomer.customerPhone).pendingCancellation);
    }
    
    console.log('\n=== STEP 2: Send "no" ===');
    const noResponse = await whatsappService.handleCancelQueue('no', waitingCustomer.customerPhone);
    console.log('Response:', noResponse);
    
    console.log('\n=== STEP 3: Send "cancel" again ===');
    const cancelResponse2 = await whatsappService.handleCancelQueue('cancel', waitingCustomer.customerPhone);
    console.log('Response:', cancelResponse2);
    
    console.log('\n=== STEP 4: Send "yes" ===');
    const yesResponse = await whatsappService.handleCancelQueue('yes', waitingCustomer.customerPhone);
    console.log('Response:', yesResponse);

    // Check final state
    const updatedQueue = await Queue.findById(queue._id);
    const customer = updatedQueue.entries.find(e => e.customerId === waitingCustomer.customerId);
    
    if (customer) {
      console.log(`\nFinal customer status: ${customer.status}`);
      if (customer.status === 'cancelled') {
        console.log('✅ SUCCESS: Customer was successfully cancelled');
      } else {
        console.log('❌ FAILED: Customer status not changed to cancelled');
      }
    } else {
      console.log('\nCustomer not found in queue');
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nTest completed');
  }
}

// Run the test
testCancellationFixed(); 