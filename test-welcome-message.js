const mongoose = require('mongoose');
const Queue = require('./server/models/Queue');
const whatsappService = require('./server/services/whatsappService');

async function testWelcomeMessage() {
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

    // Find a customer to test with
    const waitingCustomer = queue.entries.find(entry => entry.status === 'waiting');
    if (!waitingCustomer) {
      console.log('No waiting customers found');
      return;
    }

    console.log('Testing welcome message for customer:', waitingCustomer.customerName);

    // Test the welcome message
    const welcomeMessage = `🎉 Welcome ${waitingCustomer.customerName}!\n\n✅ You've been seated successfully!\n👥 Party size: ${waitingCustomer.partySize} pax\n\n🍽️ Ready to order? Check out our menu:\n\n📱 Online Menu: https://beepdeliveryops.beepit.com/dine?s=5e806691322bdd231653d70c&from=home\n\n🛎️ Our staff will be with you shortly. Enjoy your dining experience!\n\n⏰ Please present yourself within 10 minutes or your table will self destruct. Kindly inform your name and number to our crew.`;
    
    await whatsappService.sendMessage(waitingCustomer.customerPhone, welcomeMessage);
    console.log(`Welcome message sent to ${waitingCustomer.customerPhone}`);

  } catch (error) {
    console.error('Error testing welcome message:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

testWelcomeMessage(); 