const mongoose = require('mongoose');
const Queue = require('./server/models/Queue');

async function checkPhoneFormats() {
  try {
    await mongoose.connect('mongodb://localhost:27017/smart-queue-manager');
    const queue = await Queue.findOne({ isActive: true });
    
    console.log('Queue entries with phone numbers:');
    queue.entries.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.customerName} - Phone: '${entry.customerPhone}' - Status: ${entry.status}`);
    });
    
    // Test phone number matching
    const testPhone = '60123456789';
    console.log(`\nTesting phone number: ${testPhone}`);
    
    const phoneFormats = [
      testPhone,
      '+' + testPhone.replace(/\D/g, ''),
      testPhone.replace(/\D/g, ''),
    ];
    
    const cleanNumber = testPhone.replace(/\D/g, '');
    if (!cleanNumber.startsWith('60') && cleanNumber.length <= 10) {
      phoneFormats.push('60' + cleanNumber);
      phoneFormats.push('+60' + cleanNumber);
    }
    
    console.log('Phone formats to try:', phoneFormats);
    
    for (const format of phoneFormats) {
      const found = queue.entries.find(entry => 
        entry.customerPhone === format && entry.status === 'waiting'
      );
      if (found) {
        console.log(`Found match with format: ${format}`);
        break;
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkPhoneFormats(); 