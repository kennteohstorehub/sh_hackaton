#!/usr/bin/env node

const axios = require('axios');

async function testNotify() {
  try {
    // Use the VIP Section queue that has waiting customers
    const queueId = '6dab0655-d08c-45f7-91fe-4cefc3f2485e';
    
    console.log('Testing notification for queue:', queueId);
    console.log('This queue has 3 waiting customers (verified from database)');
    
    const response = await axios.post(`http://localhost:3838/api/queue/${queueId}/call-next`, {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Notification successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.data || error.message);
  }
}

testNotify();