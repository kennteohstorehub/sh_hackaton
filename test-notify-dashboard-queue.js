#!/usr/bin/env node

const axios = require('axios');

async function testNotify() {
  try {
    // Use the queue ID from the dashboard
    const queueId = '14b6e77c-c11d-44c7-8d32-34cd01d67899';
    
    console.log('Testing notification for Main Dining Queue:', queueId);
    
    const response = await axios.post(`http://localhost:3838/api/queue/${queueId}/call-next`, {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Notification successful!');
    console.log('Customer status:', response.data.customer.status);
    console.log('Customer name:', response.data.customer.customerName);
    console.log('Called at:', response.data.customer.calledAt);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.data || error.message);
  }
}

testNotify();