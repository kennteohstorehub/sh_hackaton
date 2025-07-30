const axios = require('axios');
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:3838';

async function runDemo() {
  console.log('\n🧪 COMPLETE WEBCHAT FLOW DEMONSTRATION\n');
  console.log('='.repeat(50) + '\n');
  
  try {
    // Step 1: Join queue
    const queueId = '453b1b29-7d3b-4c0e-92d6-d86cc9952f8e'; // Active queue
    console.log('📝 STEP 1: Customer joins queue via web form');
    console.log(`   URL: http://localhost:3838/queue/${queueId}`);
    
    const joinData = {
      name: 'Test Customer',
      phone: '+60199887766',
      partySize: 2,
      specialRequests: 'Window seat please'
    };
    
    console.log('   Form data:', JSON.stringify(joinData, null, 2));
    
    const joinResponse = await axios.post(`${BASE_URL}/api/customer/join/${queueId}`, joinData);
    
    console.log('\n✅ Successfully joined queue!');
    console.log('   Position:', joinResponse.data.position);
    console.log('   Customer ID:', joinResponse.data.customer.customerId);
    console.log('   Verification Code:', joinResponse.data.customer.verificationCode);
    
    // Extract session info
    const customerId = joinResponse.data.customer.customerId;
    const sessionId = customerId.split('_')[2];
    const qcSessionId = `qc_${sessionId}`;
    
    // Step 2: Show unique URL
    console.log('\n🔗 STEP 2: Customer redirected to unique webchat URL');
    const uniqueUrl = `${BASE_URL}/queue-chat/${qcSessionId}`;
    console.log('   Unique URL:', uniqueUrl);
    console.log('   Each customer gets their own URL!');
    
    // Step 3: Connect Socket.IO
    console.log('\n🔌 STEP 3: Establishing real-time connection');
    const socket = io(BASE_URL);
    
    await new Promise((resolve) => {
      socket.on('connect', () => {
        console.log('   ✅ Socket.IO connected');
        console.log('   Socket ID:', socket.id);
        
        // Join rooms
        socket.emit('join-customer-room', customerId);
        socket.emit('join-queue', {
          queueId: joinResponse.data.customer.queueId,
          sessionId: qcSessionId,
          customerId: customerId,
          platform: 'webchat',
          merchantId: joinResponse.data.customer.merchantId
        });
        
        resolve();
      });
    });
    
    // Step 4: Test status check
    console.log('\n📊 STEP 4: Testing status endpoint');
    const statusResponse = await axios.get(`${BASE_URL}/api/webchat/status/${qcSessionId}`);
    console.log('   ✅ Status check working');
    console.log('   Current position:', statusResponse.data.position);
    console.log('   Status:', statusResponse.data.status);
    
    // Step 5: Listen for notifications
    console.log('\n📢 STEP 5: Waiting for notifications');
    console.log('\n' + '─'.repeat(50));
    console.log('💡 TO TEST NOTIFICATIONS:');
    console.log('   1. Open merchant dashboard: http://localhost:3838/dashboard');
    console.log('   2. Find this customer in the queue (look for "Test Customer")');
    console.log('   3. Click the "Notify" button');
    console.log('─'.repeat(50) + '\n');
    
    socket.on('customer-called', (data) => {
      console.log('\n🎉 NOTIFICATION RECEIVED!');
      console.log('   Message:', data.message);
      console.log('   Verification Code:', data.verificationCode);
      console.log('   Time:', new Date().toLocaleTimeString());
      
      console.log('\n✅ TEST SUCCESSFUL! All features working:');
      console.log('   • Unique session URLs');
      console.log('   • Real-time notifications');
      console.log('   • WebSocket communication');
      console.log('   • API endpoints');
      
      setTimeout(() => {
        socket.disconnect();
        process.exit(0);
      }, 2000);
    });
    
    console.log('Waiting for notification... (Press Ctrl+C to exit)\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

runDemo();