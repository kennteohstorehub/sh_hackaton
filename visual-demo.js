const axios = require('axios');
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:3838';

// Simple visual demo
console.log('\n🎯 WEBCHAT UNIQUE URL DEMONSTRATION\n');
console.log('━'.repeat(60) + '\n');

console.log('📱 SCENARIO: Three customers join the queue\n');

// Simulate three customers
const customers = [
  { name: 'Alice Chen', phone: '+60123456789' },
  { name: 'Bob Kumar', phone: '+60198765432' },
  { name: 'Charlie Lee', phone: '+60111223344' }
];

async function simulateCustomerJoin(customer, index) {
  try {
    console.log(`${index + 1}. ${customer.name} joins the queue:`);
    
    // Join queue
    const response = await axios.post(`${BASE_URL}/api/customer/join/453b1b29-7d3b-4c0e-92d6-d86cc9952f8e`, {
      name: customer.name,
      phone: customer.phone,
      partySize: 2,
      specialRequests: ''
    });
    
    const customerId = response.data.customer.customerId;
    const sessionId = customerId.split('_')[2];
    const uniqueUrl = `${BASE_URL}/queue-chat/qc_${sessionId}`;
    
    console.log(`   ✅ Position: #${response.data.position}`);
    console.log(`   🔑 Verification Code: ${response.data.customer.verificationCode}`);
    console.log(`   🔗 Unique URL: ${uniqueUrl}`);
    console.log('');
    
    return {
      ...customer,
      customerId,
      sessionId,
      uniqueUrl,
      position: response.data.position,
      verificationCode: response.data.customer.verificationCode
    };
  } catch (error) {
    console.log(`   ❌ Error: ${error.response?.data?.error || error.message}\n`);
    return null;
  }
}

async function runDemo() {
  // Join all customers
  const joinedCustomers = [];
  for (let i = 0; i < customers.length; i++) {
    const result = await simulateCustomerJoin(customers[i], i);
    if (result) joinedCustomers.push(result);
  }
  
  if (joinedCustomers.length === 0) {
    console.log('❌ No customers could join. Please check if the queue is active.');
    return;
  }
  
  console.log('━'.repeat(60) + '\n');
  console.log('🌟 KEY POINTS:\n');
  console.log('1. Each customer gets a UNIQUE URL');
  console.log('2. URLs contain session IDs (qc_TIMESTAMP_RANDOM)');
  console.log('3. No two customers share the same URL');
  console.log('4. Each session maintains its own state\n');
  
  console.log('━'.repeat(60) + '\n');
  console.log('🔔 REAL-TIME NOTIFICATIONS:\n');
  
  // Connect first customer to Socket.IO for demo
  const firstCustomer = joinedCustomers[0];
  if (firstCustomer) {
    const socket = io(BASE_URL);
    
    socket.on('connect', () => {
      console.log(`✅ ${firstCustomer.name} connected to Socket.IO`);
      
      // Join rooms
      socket.emit('join-customer-room', firstCustomer.customerId);
      console.log(`   Joined room: customer-${firstCustomer.customerId}`);
      
      // Also join phone room
      const phone = firstCustomer.phone;
      socket.emit('join-customer-room', `phone-${phone}`);
      console.log(`   Joined room: phone-${phone}`);
    });
    
    socket.on('customer-called', (data) => {
      console.log(`\n🎉 ${firstCustomer.name} RECEIVED NOTIFICATION!`);
      console.log(`   Message: "${data.message}"`);
      console.log(`   Code: ${data.verificationCode}`);
      console.log(`   Time: ${new Date().toLocaleTimeString()}`);
      
      setTimeout(() => {
        socket.disconnect();
        process.exit(0);
      }, 1000);
    });
    
    console.log('\n💡 To test notifications:');
    console.log('   1. Open dashboard: http://localhost:3838/dashboard');
    console.log(`   2. Find "${firstCustomer.name}" in the queue`);
    console.log('   3. Click the "Notify" button');
    console.log('\nWaiting for notification... (Ctrl+C to exit)');
  }
}

runDemo().catch(console.error);