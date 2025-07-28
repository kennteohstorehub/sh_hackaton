#!/usr/bin/env node

const axios = require('axios');

async function addCustomerAndNotify() {
  try {
    console.log('1. Adding a test customer to the queue...');
    
    // First get the queue ID
    const dashboardResponse = await axios.get('http://localhost:3838/dashboard');
    const queueIdMatch = dashboardResponse.data.match(/id="active-queue"[\s\S]*?data-queue-id="([^"]+)"/);
    const queueId = '6dab0655-d08c-45f7-91fe-4cefc3f2485e'; // Use the VIP Section queue that has customers
    
    console.log(`   Using queue ID: ${queueId}`);
    
    // Add a customer via webchat
    const sessionId = 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const addResponse = await axios.post('http://localhost:3838/api/webchat/join', {
      customerName: 'Test Customer',
      customerPhone: '+60123456789',
      partySize: 2,
      merchantId: '7a99f35e-0f73-4f8e-831c-fde8fc3a5532',
      sessionId: sessionId,
      specialRequests: 'Testing notification system'
    });
    
    if (addResponse.data.success) {
      console.log('✅ Customer added successfully!');
      console.log('   Queue Number:', addResponse.data.queueNumber);
      console.log('   Position:', addResponse.data.position);
      console.log('   Customer ID:', addResponse.data.queueEntry.id);
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Now try to notify
      console.log('\n2. Testing notification...');
      const notifyResponse = await axios.post(`http://localhost:3838/api/queue/${queueId}/call-next`, {}, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Notification sent successfully!');
      console.log('Response:', JSON.stringify(notifyResponse.data, null, 2));
      
      // Optional: Check if we received the websocket notification
      console.log('\n✅ Test complete! The customer should have been notified via WebSocket.');
      console.log('   Since WhatsApp is disabled, only WebSocket notifications were sent.');
      
    } else {
      console.error('❌ Failed to add customer:', addResponse.data.error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.data || error.message);
    if (error.response?.data?.stack) {
      console.error('Stack trace:', error.response.data.stack);
    }
  }
}

addCustomerAndNotify();