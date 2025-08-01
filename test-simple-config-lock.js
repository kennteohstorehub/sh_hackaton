#!/usr/bin/env node

const fetch = require('node-fetch');

async function testConfigLocking() {
  console.log('\n🧪 Testing Configuration Locking via API...\n');
  
  const cookies = 'qms_session=s%3Avq6nJd1RMJnpzRZD3pPLDhLnWfHMRUNs.O1b8j4%2B4gcdg%2B0I8kmVGiCKQJn1s4lUa9q7V0SFCH7M; qms_csrf=s%3AvZ4cJrAWk8xZQvv8HnOOr8k5.PxK7VLLtFpQJoE2rbP1d8xvzP0UwN8%2FXvjgdPILQtqI';
  
  try {
    // Step 1: Check queue status
    console.log('1️⃣ Checking queue status...');
    const statusResponse = await fetch('http://localhost:3838/api/queue/status', {
      headers: {
        'Cookie': cookies
      }
    });
    
    const statusData = await statusResponse.json();
    console.log('Queue status:', statusData);
    
    // Step 2: Try to update merchant profile
    console.log('\n2️⃣ Attempting to update merchant profile...');
    const updateResponse = await fetch('http://localhost:3838/api/merchant/profile', {
      method: 'PUT',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'vZ4cJrAWk8xZQvv8HnOOr8k5'
      },
      body: JSON.stringify({
        businessName: 'Test Restaurant Updated'
      })
    });
    
    console.log('Update response status:', updateResponse.status);
    const updateData = await updateResponse.json();
    console.log('Update response:', updateData);
    
    if (updateResponse.status === 423) {
      console.log('\n✅ Configuration is properly LOCKED! 🔒');
      console.log('Active queue:', updateData.activeQueue);
    } else if (updateResponse.status === 200) {
      console.log('\n✅ Configuration update successful - no active queue');
    } else {
      console.log('\n❌ Unexpected response');
    }
    
    // Step 3: Try queue settings update
    console.log('\n3️⃣ Attempting to update queue settings...');
    const queueSettingsResponse = await fetch('http://localhost:3838/api/merchant/settings/queue', {
      method: 'PUT',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'vZ4cJrAWk8xZQvv8HnOOr8k5'
      },
      body: JSON.stringify({
        maxQueueSize: 100
      })
    });
    
    console.log('Queue settings response status:', queueSettingsResponse.status);
    const queueSettingsData = await queueSettingsResponse.json();
    console.log('Queue settings response:', queueSettingsData);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Run the test
testConfigLocking().catch(console.error);