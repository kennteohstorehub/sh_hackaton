const mongoose = require('mongoose');
const Queue = require('./server/models/Queue');
const whatsappService = require('./server/services/whatsappService');

async function testSeatedMessage() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/smart-queue-manager');
    console.log('Connected to MongoDB');

    // Initialize WhatsApp service
    await whatsappService.initialize();
    console.log('WhatsApp service initialized');

    // Find a queue with customers
    const queue = await Queue.findOne({ merchantId: '507f1f77bcf86cd799439011' });
    if (!queue) {
      console.log('No queue found');
      return;
    }

    console.log('Queue found:', queue.name);
    console.log('Queue entries:', queue.entries.length);

    // Find a waiting customer to test with
    const waitingCustomer = queue.entries.find(entry => entry.status === 'waiting');
    if (!waitingCustomer) {
      console.log('No waiting customers found');
      return;
    }

    console.log('Testing with customer:', waitingCustomer.customerName, waitingCustomer.customerPhone);

    // Test the seated message functionality
    console.log('Marking customer as seated...');
    const customer = queue.removeCustomer(waitingCustomer.customerId, 'completed');
    
    if (!customer) {
      console.log('Failed to mark customer as seated');
      return;
    }

    console.log('Customer marked as seated:', customer.customerName);

    // Send welcome message with menu link to the seated customer
    try {
      const welcomeMessage = `🎉 Welcome ${customer.customerName}!\n\n✅ You've been seated successfully!\n👥 Party size: ${customer.partySize} pax\n\n🍽️ Ready to order? Check out our menu:\n\n📱 Online Menu: https://beepdeliveryops.beepit.com/dine?s=5e806691322bdd231653d70c&from=home\n\n🛎️ Our staff will be with you shortly. Enjoy your dining experience!\n\n⏰ Please present yourself within 10 minutes or your table will self destruct. Kindly inform your name and number to our crew.`;
      
      console.log('Sending welcome message...');
      await whatsappService.sendMessage(customer.customerPhone, welcomeMessage);
      console.log(`✅ Welcome message with menu link sent to ${customer.customerPhone} for queue ${queue.name}`);
    } catch (error) {
      console.error('❌ Error sending welcome message:', error);
    }

    // Save the queue changes
    await queue.save();
    console.log('Queue saved successfully');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

testSeatedMessage(); 