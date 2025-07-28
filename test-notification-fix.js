#!/usr/bin/env node

/**
 * Test script to verify the notification issue is fixed
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3838';

async function testNotificationEndpoint() {
  console.log('🧪 Testing notification endpoint fix...\n');
  
  try {
    // First, get the active queue
    console.log('1. Getting active queue...');
    const dashboardResponse = await axios.get(`${BASE_URL}/dashboard`, {
      headers: {
        'Cookie': 'your-session-cookie-here' // This would normally come from login
      }
    });
    
    // Extract queue ID from the HTML (this is a simplified approach)
    const queueIdMatch = dashboardResponse.data.match(/notifyNext\(['"]([^'"]+)['"]\)/);
    
    if (queueIdMatch) {
      const queueId = queueIdMatch[1];
      console.log(`   Found queue ID: ${queueId}`);
      
      // Test the API endpoint directly
      console.log('\n2. Testing notification endpoint...');
      const response = await axios.post(`${BASE_URL}/api/queue/${queueId}/call-next`, {}, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('   ✅ Endpoint accessible!');
      console.log('   Response:', response.data);
      
    } else {
      console.log('   ❌ Could not extract queue ID from dashboard');
    }
    
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log('   ❌ 404 Error - Endpoint not found');
      console.log('   URL attempted:', error.config.url);
    } else if (error.response && error.response.status === 401) {
      console.log('   ⚠️  401 Unauthorized - Authentication required');
      console.log('   This is expected in development mode');
    } else {
      console.log('   ❌ Error:', error.message);
      if (error.response) {
        console.log('   Status:', error.response.status);
        console.log('   Data:', error.response.data);
      }
    }
  }
}

// Simple direct endpoint test
async function testDirectEndpoint() {
  console.log('\n3. Testing with demo queue ID...');
  
  // Common ID formats
  const testIds = [
    'demo-queue-id',  // Demo ID
    '674e6f1234567890',  // MongoDB ObjectId format
    'clxxxxxxxxxxxxx'  // Prisma cuid format
  ];
  
  for (const id of testIds) {
    try {
      console.log(`   Testing ID format: ${id}`);
      const response = await axios.post(`${BASE_URL}/api/queue/${id}/call-next`, {}, {
        headers: {
          'Content-Type': 'application/json',
          'X-Merchant-Id': 'demo-merchant-id'
        }
      });
      
      console.log('   ✅ Success with ID:', id);
      break;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(`   ❌ 404 with ID: ${id}`);
      } else {
        console.log(`   ❌ Error with ID ${id}:`, error.response?.status || error.message);
      }
    }
  }
}

async function runTests() {
  await testNotificationEndpoint();
  await testDirectEndpoint();
  
  console.log('\n✅ Test complete!');
  console.log('\nIf you\'re still seeing 404 errors:');
  console.log('1. Check that the queue ID format matches (MongoDB vs Prisma)');
  console.log('2. Verify the queue exists in the database');
  console.log('3. Ensure authentication is working properly');
}

runTests().catch(console.error);