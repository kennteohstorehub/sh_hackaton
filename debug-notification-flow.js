#!/usr/bin/env node

const io = require('socket.io-client');
const axios = require('axios');

async function debugNotificationFlow() {
  console.log('=== WebSocket Notification Debugging ===\n');
  
  // 1. Create a test customer
  const sessionId = 'debug_' + Date.now();
  const customerData = {
    customerName: 'Debug Test User',
    customerPhone: '+60191234567',
    partySize: 2,
    merchantId: '7a99f35e-0f73-4f8e-831c-fde8fc3a5532',
    sessionId: sessionId,
    specialRequests: 'Debug notification test'
  };
  
  console.log('1. Joining queue with sessionId:', sessionId);
  
  try {
    const joinResponse = await axios.post('http://localhost:3838/api/webchat/join', customerData);
    const queueEntry = joinResponse.data.queueEntry;
    
    console.log('   ✅ Joined queue successfully');
    console.log('   Queue Entry ID:', queueEntry.id);
    console.log('   Customer ID:', queueEntry.customerId);
    console.log('   Session ID:', queueEntry.sessionId);
    console.log('   Queue ID:', queueEntry.queueId);
    
    // 2. Connect to WebSocket and join rooms
    console.log('\n2. Connecting to WebSocket...');
    const socket = io('http://localhost:3838');
    
    socket.on('connect', () => {
      console.log('   ✅ Connected to WebSocket');
      console.log('   Socket ID:', socket.id);
      
      // Join the queue room (mimicking what queue-chat.js does)
      socket.emit('join-queue', {
        queueId: queueEntry.queueId,
        sessionId: sessionId,
        platform: 'webchat',
        merchantId: customerData.merchantId
      });
      
      console.log('   Emitted join-queue event');
    });
    
    // Listen for notifications
    socket.on('customer-called', (data) => {
      console.log('\n🎉 NOTIFICATION RECEIVED!');
      console.log('   Data:', JSON.stringify(data, null, 2));
    });
    
    socket.on('notification', (data) => {
      console.log('\n📢 General notification received:', data);
    });
    
    // 3. Wait a bit, then call the customer
    setTimeout(async () => {
      console.log('\n3. Calling customer via API...');
      
      try {
        const callResponse = await axios.post(`http://localhost:3838/api/queue/${queueEntry.queueId}/call-next`);
        console.log('   ✅ Call API response:', callResponse.data.success ? 'Success' : 'Failed');
        console.log('   Called customer:', callResponse.data.customer?.customerName);
      } catch (error) {
        console.log('   ❌ Call API error:', error.response?.data || error.message);
      }
    }, 3000);
    
    // Keep the script running to receive notifications
    setTimeout(() => {
      console.log('\n4. Test complete. Disconnecting...');
      socket.disconnect();
      process.exit(0);
    }, 10000);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

debugNotificationFlow();