#!/usr/bin/env node

/**
 * Test settings update with proper CSRF token handling
 * This simulates exactly what the browser does
 */

const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'http://demo.lvh.me:3838';
const LOGIN_CREDENTIALS = {
  username: 'admin@demo.local',
  password: 'Demo123!@#'
};

let cookies = '';
let csrfToken = '';

async function getLoginPage() {
  try {
    console.log('📄 Getting login page to extract CSRF token...');
    const response = await axios.get(`${BASE_URL}/login`, {
      maxRedirects: 0,
      validateStatus: (status) => status < 500
    });
    
    if (response.headers['set-cookie']) {
      cookies = response.headers['set-cookie'].join('; ');
    }
    
    // Extract CSRF token from the page
    const $ = cheerio.load(response.data);
    csrfToken = $('meta[name="csrf-token"]').attr('content') || 
                $('input[name="_csrf"]').val() || '';
    
    console.log('✅ CSRF Token extracted:', csrfToken ? csrfToken.substring(0, 20) + '...' : 'NOT FOUND');
    return true;
  } catch (error) {
    console.error('❌ Failed to get login page:', error.message);
    return false;
  }
}

async function login() {
  try {
    console.log('🔐 Logging in...');
    const response = await axios.post(`${BASE_URL}/api/auth/login`, 
      { ...LOGIN_CREDENTIALS, _csrf: csrfToken },
      {
        headers: {
          'Cookie': cookies,
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 500
      }
    );

    if (response.headers['set-cookie']) {
      cookies = response.headers['set-cookie'].join('; ');
    }

    console.log('✅ Login response status:', response.status);
    console.log('✅ Login response:', response.data);
    return response.status === 200 || response.status === 302;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    return false;
  }
}

async function getSettingsPage() {
  try {
    console.log('📄 Getting settings page for fresh CSRF token...');
    const response = await axios.get(`${BASE_URL}/dashboard/settings`, {
      headers: {
        'Cookie': cookies
      },
      maxRedirects: 5,
      validateStatus: (status) => status < 500
    });
    
    // Extract fresh CSRF token from settings page
    const $ = cheerio.load(response.data);
    const newCsrfToken = $('meta[name="csrf-token"]').attr('content') || 
                         $('input[name="_csrf"]').val() || '';
    
    if (newCsrfToken) {
      csrfToken = newCsrfToken;
      console.log('✅ Fresh CSRF Token from settings page:', csrfToken.substring(0, 20) + '...');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to get settings page:', error.message);
    return false;
  }
}

async function testProfileUpdate(updateData) {
  try {
    console.log('\n🔄 Testing profile update with data:', JSON.stringify(updateData, null, 2));
    
    // Add CSRF token to the request
    const requestData = { ...updateData, _csrf: csrfToken };
    
    const response = await axios.put(`${BASE_URL}/api/merchant/profile`, 
      requestData,
      {
        headers: {
          'Cookie': cookies,
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'X-Requested-With': 'XMLHttpRequest'
        },
        validateStatus: null
      }
    );

    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Headers:', response.headers);
    console.log('📊 Response Data:', response.data);
    
    return response;
  } catch (error) {
    console.error('❌ Profile update error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

async function runTest() {
  console.log('🚀 Starting Settings Update Test with CSRF\n');

  // Step 1: Get login page and CSRF token
  if (!await getLoginPage()) {
    console.error('❌ Failed to get initial CSRF token');
    return;
  }

  // Step 2: Login
  if (!await login()) {
    console.error('❌ Failed to login');
    return;
  }

  // Step 3: Get settings page for fresh CSRF token
  if (!await getSettingsPage()) {
    console.error('❌ Failed to get settings page');
    return;
  }

  // Step 4: Test various updates
  console.log('\n📝 Test 1: Simple restaurant name update');
  await testProfileUpdate({
    businessName: 'Test Restaurant ' + Date.now()
  });

  console.log('\n📝 Test 2: Phone number update');
  await testProfileUpdate({
    phone: '+60123456789'
  });

  console.log('\n📝 Test 3: Complete update with all fields');
  await testProfileUpdate({
    businessName: 'Complete Test ' + Date.now(),
    phone: '+60198765432',
    email: 'test@restaurant.com',
    businessType: 'restaurant'
  });

  // Check server logs
  console.log('\n📋 Checking server logs for our canary message...');
  const { execSync } = require('child_process');
  try {
    const logs = execSync('tail -100 /tmp/server.log | grep "PROFILE UPDATE HANDLER" || echo "Canary log not found"', { encoding: 'utf8' });
    console.log('Server logs:', logs);
  } catch (e) {
    console.log('Could not check server logs');
  }

  console.log('\n✨ Test completed!');
}

// Run the test
runTest().catch(error => {
  console.error('❌ Test failed:', error);
});