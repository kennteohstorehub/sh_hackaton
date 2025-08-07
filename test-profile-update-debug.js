#!/usr/bin/env node

/**
 * Debug test for profile update 500 error
 * This test will show us exactly where the error occurs
 */

const http = require('http');

// First, get the login page and extract cookies
function getLoginPage() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'demo.lvh.me',
      port: 3838,
      path: '/auth/login',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let cookies = {};
      if (res.headers['set-cookie']) {
        res.headers['set-cookie'].forEach(cookie => {
          const [name, value] = cookie.split('=');
          cookies[name] = value.split(';')[0];
        });
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ cookies, html: data }));
    });

    req.on('error', reject);
    req.end();
  });
}

// Login with proper credentials
function login(cookies) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      email: 'admin@demo.local', // Using email, not username
      password: 'Demo123!@#',
      _csrf: cookies['csrf-token']
    });

    const options = {
      hostname: 'demo.lvh.me',
      port: 3838,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length,
        'Cookie': Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '),
        'X-CSRF-Token': cookies['csrf-token']
      }
    };

    const req = http.request(options, (res) => {
      if (res.headers['set-cookie']) {
        res.headers['set-cookie'].forEach(cookie => {
          const [name, value] = cookie.split('=');
          cookies[name] = value.split(';')[0];
        });
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Login response status:', res.statusCode);
        console.log('Login response headers:', res.headers);
        resolve({ cookies, response: data, status: res.statusCode });
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Update profile
function updateProfile(cookies) {
  return new Promise((resolve, reject) => {
    const updateData = JSON.stringify({
      businessName: 'Test Restaurant ' + Date.now(),
      _csrf: cookies['csrf-token']
    });

    const options = {
      hostname: 'demo.lvh.me',
      port: 3838,
      path: '/api/merchant/profile',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': updateData.length,
        'Cookie': Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '),
        'X-CSRF-Token': cookies['csrf-token'],
        'X-Requested-With': 'XMLHttpRequest'
      }
    };

    console.log('\n📤 Sending PUT request to:', options.path);
    console.log('Headers:', options.headers);
    console.log('Body:', updateData);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('\n📥 Response Status:', res.statusCode);
        console.log('Response Headers:', res.headers);
        console.log('Response Body:', data);
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', reject);
    req.write(updateData);
    req.end();
  });
}

// Check server logs
function checkLogs() {
  const { execSync } = require('child_process');
  try {
    console.log('\n📋 Recent server logs with DEBUG messages:');
    const logs = execSync('tail -100 /tmp/server.log | grep -E "(DEBUG|PROFILE|tenantIsolation|validateMerchant|ERROR|error|500)" | tail -50', { encoding: 'utf8' });
    console.log(logs);
  } catch (e) {
    console.log('Could not read server logs');
  }
}

// Main test flow
async function runTest() {
  try {
    console.log('🚀 Starting Profile Update Debug Test\n');

    // Step 1: Get login page
    console.log('1️⃣ Getting login page...');
    const { cookies } = await getLoginPage();
    console.log('✅ Got CSRF token:', cookies['csrf-token'] ? 'Yes' : 'No');

    // Step 2: Login
    console.log('\n2️⃣ Logging in...');
    const loginResult = await login(cookies);
    console.log('✅ Login result:', loginResult.status === 302 ? 'Success (redirect)' : `Status ${loginResult.status}`);

    // Step 3: Update profile
    console.log('\n3️⃣ Updating profile...');
    const updateResult = await updateProfile(loginResult.cookies);

    // Step 4: Check logs
    checkLogs();

    console.log('\n✨ Test completed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
runTest();