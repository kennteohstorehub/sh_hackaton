const mongoose = require('mongoose');
const Queue = require('./server/models/Queue');
const whatsappService = require('./server/services/whatsappService');

async function testCancellation() {
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
    console.log(`Current entries: ${queue.entries.length}`);
    
    // Add a test customer
    const testCustomer = {
      customerId: 'test-cancel-' + Date.now(),
      customerName: 'Test Cancel User',
      customerPhone: '60123456789',
      platform: 'whatsapp',
      serviceType: 'General Service',
      partySize: 2,
      specialRequests: 'Test cancellation flow'
    };

    const newEntry = queue.addCustomer(testCustomer);
    await queue.save();
    
    console.log(`Added test customer: ${newEntry.customerName} at position ${newEntry.position}`);

    // Test cancellation request (should ask for confirmation)
    const cancelResponse1 = await whatsappService.handleCancelQueue('cancel', testCustomer.customerPhone);
    console.log('\n--- First Cancel Request (should ask for confirmation) ---');
    console.log(cancelResponse1);

    // Test "no" response (should keep in queue)
    const noResponse = await whatsappService.handleCancelQueue('no', testCustomer.customerPhone);
    console.log('\n--- "No" Response (should stay in queue) ---');
    console.log(noResponse);

    // Test "yes" response (should remove from queue)
    const yesResponse = await whatsappService.handleCancelQueue('yes', testCustomer.customerPhone);
    console.log('\n--- "Yes" Response (should remove from queue) ---');
    console.log(yesResponse);

    // Verify customer was removed
    const updatedQueue = await Queue.findById(queue._id);
    const remainingCustomer = updatedQueue.entries.find(e => e.customerId === testCustomer.customerId && e.status === 'waiting');
    
    if (!remainingCustomer) {
      console.log('\n✅ SUCCESS: Customer was successfully removed from queue');
    } else {
      console.log('\n❌ FAILED: Customer is still in queue');
    }

    // Check if customer is marked as cancelled
    const cancelledCustomer = updatedQueue.entries.find(e => e.customerId === testCustomer.customerId && e.status === 'cancelled');
    if (cancelledCustomer) {
      console.log('✅ Customer correctly marked as cancelled');
    } else {
      console.log('❌ Customer not found in cancelled status');
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nTest completed');
  }
}

// Run the test
testCancellation(); 