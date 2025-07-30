#!/usr/bin/env node

/**
 * Test the complete webchat flow with unique session URLs
 */

const axios = require('axios');
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:3838';

async function testWebchatFlow() {
  console.log('🧪 Testing Webchat Flow with Unique Session URLs\n');
  
  try {
    // Step 1: Join queue via web form
    console.log('1. Joining queue via web form...');
    const joinResponse = await axios.post(`${BASE_URL}/api/customer/join/e476a8e8-0dc2-4455-8e09-3a95f5c1dc8f`, {
      name: 'Test User',
      phone: '+60123456789',
      partySize: 2,
      specialRequests: 'Testing unique session URLs'
    });
    
    console.log('✅ Join response:', {
      success: joinResponse.data.success,
      customerId: joinResponse.data.customer.customerId,
      sessionId: joinResponse.data.customer.customerId.split('_')[2],
      position: joinResponse.data.position
    });
    
    const customerId = joinResponse.data.customer.customerId;
    const sessionId = customerId.split('_')[2];
    
    // Step 2: Check the dynamic route
    console.log('\n2. Checking dynamic queue-chat route...');
    const chatPageResponse = await axios.get(`${BASE_URL}/queue-chat/qc_${sessionId}`);
    console.log('✅ Dynamic route accessible:', chatPageResponse.status === 200);
    console.log('   URL:', `${BASE_URL}/queue-chat/qc_${sessionId}`);
    
    // Step 3: Test status endpoint with session ID
    console.log('\n3. Testing status endpoint...');
    const statusResponse = await axios.get(`${BASE_URL}/api/webchat/status/qc_${sessionId}`);
    console.log('✅ Status response:', {
      success: statusResponse.data.success,
      status: statusResponse.data.status,
      position: statusResponse.data.position
    });
    
    // Step 4: Connect via Socket.IO
    console.log('\n4. Connecting via Socket.IO...');
    const socket = io(BASE_URL, {
      transports: ['websocket', 'polling']
    });
    
    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      
      // Join customer room
      socket.emit('join-customer-room', customerId);
      socket.emit('join-queue', {
        queueId: joinResponse.data.customer.queueId,
        sessionId: `qc_${sessionId}`,
        customerId: customerId,
        platform: 'webchat',
        merchantId: joinResponse.data.customer.merchantId
      });
      
      console.log('✅ Joined Socket.IO rooms');
    });
    
    // Listen for notifications
    socket.on('customer-called', (data) => {
      console.log('\n🎉 NOTIFICATION RECEIVED!');
      console.log('   Data:', data);
      
      // Cleanup
      setTimeout(() => {
        socket.disconnect();
        process.exit(0);
      }, 1000);
    });
    
    console.log('\n📱 Unique session URL:', `${BASE_URL}/queue-chat/qc_${sessionId}`);
    console.log('   Each customer gets their own unique URL!');
    console.log('\n⏳ Waiting for notifications...');
    console.log('   Go to the dashboard and click "Notify" for this customer');
    
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

testWebchatFlow().catch(console.error);