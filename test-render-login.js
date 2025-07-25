#!/usr/bin/env node

const axios = require('axios');
const axiosCookieJarSupport = require('axios-cookiejar-support').wrapper;
const tough = require('tough-cookie');

// Enable cookie jar support
axiosCookieJarSupport(axios);
const cookieJar = new tough.CookieJar();

const baseURL = 'https://queuemanagement-vtc2.onrender.com';

async function testLogin() {
  console.log('🧪 Testing Login on Render Deployment');
  console.log('=' .repeat(50));
  
  try {
    // Step 1: Check if server is responding
    console.log('\n1️⃣ Testing server health...');
    try {
      const healthResponse = await axios.get(`${baseURL}/api/health`);
      console.log('Server health:', healthResponse.data);
    } catch (error) {
      console.log('Health check failed:', error.message);
    }
    
    // Step 2: Test login
    console.log('\n2️⃣ Testing login...');
    const loginResponse = await axios.post(`${baseURL}/auth/login`, 
      'email=demo@storehub.com&password=demo123',
      {
        jar: cookieJar,
        withCredentials: true,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        maxRedirects: 5, // Allow some redirects
        validateStatus: (status) => true // Accept all status codes
      }
    );
    
    console.log('Login response status:', loginResponse.status);
    console.log('Final URL:', loginResponse.request.res.responseUrl || loginResponse.config.url);
    
    // Check cookies
    const cookies = await cookieJar.getCookies(baseURL);
    console.log('\nCookies received:', cookies.length);
    cookies.forEach(cookie => {
      console.log(`  - ${cookie.key}: ${cookie.value.substring(0, 20)}...`);
    });
    
    // If we got a 200 response, check the content
    if (loginResponse.status === 200) {
      const pageTitle = loginResponse.data.match(/<title>(.*?)<\/title>/);
      console.log('\nPage title:', pageTitle ? pageTitle[1] : 'Not found');
      
      // Check for error messages in the HTML
      const errorMatch = loginResponse.data.match(/class="alert alert-danger"[^>]*>(.*?)<\/div>/s);
      if (errorMatch) {
        console.log('Error message found:', errorMatch[1].trim());
      }
      
      // Check if we're on the dashboard
      const isDashboard = loginResponse.data.includes('Dashboard') && loginResponse.data.includes('Queue Management');
      console.log('Is dashboard page:', isDashboard ? 'YES' : 'NO');
    }
    
    // Step 3: Try to access dashboard directly
    console.log('\n3️⃣ Testing dashboard access...');
    const dashboardResponse = await axios.get(`${baseURL}/dashboard`, {
      jar: cookieJar,
      withCredentials: true,
      maxRedirects: 0,
      validateStatus: (status) => true
    });
    
    console.log('Dashboard response status:', dashboardResponse.status);
    if (dashboardResponse.status === 302) {
      console.log('Redirect location:', dashboardResponse.headers.location);
    }
    
    // Summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 SUMMARY:');
    console.log('✅ Server is up:', loginResponse.status !== 0 ? 'YES' : 'NO');
    console.log('✅ Login endpoint accessible:', loginResponse.status < 500 ? 'YES' : 'NO');
    console.log('✅ Session cookie received:', cookies.some(c => c.key === 'queue.sid') ? 'YES' : 'NO');
    console.log('✅ Login successful:', loginResponse.data.includes('Dashboard') ? 'YES' : 'NO');
    console.log('✅ Can access dashboard:', dashboardResponse.status === 200 ? 'YES' : 'NO');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data.substring(0, 500));
    }
  }
}

// Run the test
testLogin().catch(console.error);