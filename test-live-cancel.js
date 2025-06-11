const mongoose = require('mongoose');
const Queue = require('./server/models/Queue');
const whatsappService = require('./server/services/whatsappService');

async function testLiveCancel() {
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
    console.log('Current customers in queue:');
    
    queue.entries.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.customerName} - Phone: '${entry.customerPhone}' - Status: ${entry.status}`);
    });

    // Test with a phone number that might be sending messages
    // From the logs, I see messages from numbers like 60142126585
    const testPhoneNumbers = [
      '60142126585',
      '60124168358', 
      '60122575211',
      '60149099471',
      '60104681622',
      '60104001337',
      '60122058649',
      '601137670781'
    ];

    console.log('\n=== Testing cancellation with different phone formats ===');
    
    for (const phoneNumber of testPhoneNumbers) {
      console.log(`\nTesting phone number: ${phoneNumber}`);
      
      // Test if this number is in any queue
      const foundQueue = await Queue.findOne({
        'entries.customerPhone': phoneNumber,
        'entries.status': 'waiting'
      });
      
      if (foundQueue) {
        console.log(`✅ Found customer with phone ${phoneNumber} in queue ${foundQueue.name}`);
        
        // Test cancellation
        const cancelResponse = await whatsappService.handleCancelQueue('cancel', phoneNumber);
        console.log('Cancel response:', cancelResponse);
        
        break; // Stop after finding one
      } else {
        console.log(`❌ No customer found with phone ${phoneNumber}`);
        
        // Try different formats
        const formats = [
          phoneNumber,
          '+' + phoneNumber,
          phoneNumber.replace(/\D/g, ''),
          '60' + phoneNumber.replace(/^60/, ''),
          '+60' + phoneNumber.replace(/^60/, '')
        ];
        
        for (const format of formats) {
          const testQueue = await Queue.findOne({
            'entries.customerPhone': format,
            'entries.status': 'waiting'
          });
          
          if (testQueue) {
            console.log(`✅ Found customer with phone format '${format}' in queue ${testQueue.name}`);
            break;
          }
        }
      }
    }

    // Also test with a known customer from the database
    const waitingCustomer = queue.entries.find(entry => entry.status === 'waiting');
    if (waitingCustomer) {
      console.log(`\n=== Testing with existing customer: ${waitingCustomer.customerName} ===`);
      console.log(`Phone: ${waitingCustomer.customerPhone}`);
      
      const cancelResponse = await whatsappService.handleCancelQueue('cancel', waitingCustomer.customerPhone);
      console.log('Cancel response:', cancelResponse);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testLiveCancel(); 