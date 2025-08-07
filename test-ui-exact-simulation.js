#!/usr/bin/env node

/**
 * Simulate EXACT UI behavior that causes 500 error
 */

const axios = require('axios');

const BASE_URL = 'http://demo.lvh.me:3838';

async function simulateUIBehavior() {
  try {
    // Step 1: Get login page
    console.log('1. Getting login page...');
    const loginPageResponse = await axios.get(`${BASE_URL}/auth/login`, {
      maxRedirects: 0,
      validateStatus: (status) => status < 500
    });
    
    let cookies = {};
    if (loginPageResponse.headers['set-cookie']) {
      loginPageResponse.headers['set-cookie'].forEach(cookie => {
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        cookies[name] = value;
      });
    }
    
    // Step 2: Login
    console.log('2. Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@demo.local',
      password: 'Demo123!@#',
      _csrf: cookies['csrf-token']
    }, {
      headers: {
        'Cookie': Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '),
        'X-CSRF-Token': cookies['csrf-token']
      },
      maxRedirects: 0,
      validateStatus: (status) => status < 500
    });
    
    // Update cookies
    if (loginResponse.headers['set-cookie']) {
      loginResponse.headers['set-cookie'].forEach(cookie => {
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        cookies[name] = value;
      });
    }
    
    // Step 3: Simulate EXACT UI payload that causes error
    console.log('\n3. Simulating UI update with problematic payload...');
    
    // This is what the UI actually sends when user edits restaurant name
    const uiPayload = {
      businessName: "Updated Restaurant Name",
      phone: "+60123456789",
      address: { street: "" },  // This is the problematic part!
      businessHours: {
        monday: { start: "09:00", end: "22:00", closed: false },
        tuesday: { start: "09:00", end: "22:00", closed: false },
        wednesday: { start: "09:00", end: "22:00", closed: false },
        thursday: { start: "09:00", end: "22:00", closed: false },
        friday: { start: "09:00", end: "23:00", closed: false },
        saturday: { start: "10:00", end: "23:00", closed: false },
        sunday: { start: "10:00", end: "21:00", closed: false }
      },
      _csrf: cookies['csrf-token']
    };
    
    console.log('Sending payload:', JSON.stringify(uiPayload, null, 2));
    
    const updateResponse = await axios.put(`${BASE_URL}/api/merchant/profile`, uiPayload, {
      headers: {
        'Cookie': Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '),
        'X-CSRF-Token': cookies['csrf-token'],
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      validateStatus: null // Accept any status
    });
    
    console.log('\n📊 Response:');
    console.log('Status:', updateResponse.status);
    console.log('Data:', updateResponse.data);
    
    if (updateResponse.status === 500) {
      console.log('\n❌ REPRODUCED THE 500 ERROR!');
      console.log('The issue is with the empty address object: { street: "" }');
    } else if (updateResponse.status === 200) {
      console.log('\n✅ Update successful - the fix is working!');
    }
    
    // Check logs
    const { execSync } = require('child_process');
    try {
      console.log('\n📋 Recent server logs:');
      const logs = execSync('tail -50 /tmp/server.log | grep -E "(PROFILE UPDATE|Request body|error)" | tail -20', { encoding: 'utf8' });
      console.log(logs);
    } catch (e) {
      // Ignore
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
console.log('🚀 Testing EXACT UI behavior that causes 500 error\n');
simulateUIBehavior();