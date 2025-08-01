#!/usr/bin/env node

const http = require('http');

async function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testConfigLocking() {
  console.log('\n🧪 Testing Configuration Locking via Direct API\n');
  
  try {
    // 1. Check queue status
    console.log('1️⃣ Checking queue status...');
    const statusResponse = await makeRequest({
      hostname: 'localhost',
      port: 3838,
      path: '/api/queue/status',
      method: 'GET',
      headers: {
        'X-Bypass-Auth': 'true'  // Auth bypass header
      }
    });
    
    console.log(`Status: ${statusResponse.status}`);
    console.log('Queue status:', statusResponse.data);
    
    const hasActiveQueue = statusResponse.data.hasActiveQueue;
    
    // 2. Try to update merchant profile
    console.log('\n2️⃣ Attempting to update merchant profile...');
    const updateResponse = await makeRequest({
      hostname: 'localhost',
      port: 3838,
      path: '/api/merchant/profile',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Bypass-Auth': 'true',
        'X-Bypass-CSRF': 'true'  // Try to bypass CSRF
      }
    }, {
      businessName: 'Test Restaurant Updated'
    });
    
    console.log(`Status: ${updateResponse.status}`);
    console.log('Response:', updateResponse.data);
    
    if (updateResponse.status === 423) {
      console.log('\n✅ SUCCESS: Configuration is properly LOCKED! 🔒');
      console.log('Lock details:', updateResponse.data);
    } else if (updateResponse.status === 200) {
      console.log('\n⚠️  WARNING: Configuration was updated even though queue is active');
    } else {
      console.log('\n❌ Unexpected response status:', updateResponse.status);
    }
    
    // 3. Try queue settings
    console.log('\n3️⃣ Attempting to update queue settings...');
    const queueSettingsResponse = await makeRequest({
      hostname: 'localhost',
      port: 3838,
      path: '/api/merchant/settings/queue',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Bypass-Auth': 'true',
        'X-Bypass-CSRF': 'true'
      }
    }, {
      maxQueueSize: 100
    });
    
    console.log(`Status: ${queueSettingsResponse.status}`);
    console.log('Response:', queueSettingsResponse.data);
    
    if (queueSettingsResponse.status === 423) {
      console.log('\n✅ SUCCESS: Queue settings are properly LOCKED! 🔒');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testConfigLocking().catch(console.error);