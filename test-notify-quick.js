#!/usr/bin/env node

const axios = require('axios');

async function testNotify() {
  try {
    // Get the queue ID from the dashboard
    console.log('1. Getting dashboard to find queue ID...');
    const dashboardResponse = await axios.get('http://localhost:3838/dashboard');
    
    // Extract the queue ID
    const match = dashboardResponse.data.match(/notifyNext\('([^']+)'\)/);
    
    if (match) {
      const queueId = match[1];
      console.log(`   Found queue ID: ${queueId}`);
      
      // Test the notify endpoint
      console.log('\n2. Testing notify endpoint...');
      const response = await axios.post(`http://localhost:3838/api/queue/${queueId}/call-next`, {}, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Success!');
      console.log('Response:', JSON.stringify(response.data, null, 2));
    } else {
      console.log('❌ Could not find queue ID in dashboard');
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.data || error.message);
  }
}

testNotify();