#!/usr/bin/env node

const axios = require('axios');
const axiosCookieJarSupport = require('axios-cookiejar-support').wrapper;
const tough = require('tough-cookie');

// Enable cookie jar support
axiosCookieJarSupport(axios);
const cookieJar = new tough.CookieJar();

const baseURL = 'https://queuemanagement-vtc2.onrender.com';

async function testSessionFlow() {
  console.log('🧪 Testing Complete Session Flow');
  console.log('=' .repeat(50));
  
  try {
    // Step 1: Get initial session
    console.log('\n1️⃣ Getting initial session...');
    const initialResponse = await axios.get(`${baseURL}/api/health`, {
      jar: cookieJar,
      withCredentials: true
    });
    
    console.log('Server status:', initialResponse.data);
    
    // Check cookies
    const initialCookies = await cookieJar.getCookies(baseURL);
    console.log('Initial cookies:', initialCookies.length);
    
    // Step 2: Test login with detailed logging
    console.log('\n2️⃣ Testing login...');
    const loginResponse = await axios.post(`${baseURL}/auth/login`, 
      'email=demo@storehub.com&password=demo123',
      {
        jar: cookieJar,
        withCredentials: true,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        maxRedirects: 0, // Don't follow redirects
        validateStatus: (status) => true // Accept all status codes
      }
    );
    
    console.log('Login response:');
    console.log('  Status:', loginResponse.status);
    console.log('  Headers:', {
      location: loginResponse.headers.location,
      'set-cookie': loginResponse.headers['set-cookie']
    });
    
    // Check cookies after login
    const loginCookies = await cookieJar.getCookies(baseURL);
    console.log('\nCookies after login:', loginCookies.length);
    loginCookies.forEach(cookie => {
      console.log(`  ${cookie.key}: ${cookie.value.substring(0, 30)}...`);
    });
    
    // Step 3: Follow the redirect manually
    if (loginResponse.status === 302 && loginResponse.headers.location) {
      console.log('\n3️⃣ Following redirect to:', loginResponse.headers.location);
      
      const redirectResponse = await axios.get(`${baseURL}${loginResponse.headers.location}`, {
        jar: cookieJar,
        withCredentials: true,
        maxRedirects: 0,
        validateStatus: (status) => true
      });
      
      console.log('Redirect response:');
      console.log('  Status:', redirectResponse.status);
      console.log('  URL:', redirectResponse.config.url);
      
      if (redirectResponse.status === 302) {
        console.log('  Another redirect to:', redirectResponse.headers.location);
      } else if (redirectResponse.status === 200) {
        const title = redirectResponse.data.match(/<title>(.*?)<\/title>/);
        console.log('  Page title:', title ? title[1] : 'Not found');
      }
    }
    
    // Step 4: Test session endpoint if available
    console.log('\n4️⃣ Testing session endpoint...');
    try {
      const sessionResponse = await axios.get(`${baseURL}/api/session-test`, {
        jar: cookieJar,
        withCredentials: true
      });
      console.log('Session data:', sessionResponse.data);
    } catch (error) {
      console.log('Session endpoint not available (404)');
    }
    
    // Step 5: Try accessing protected route
    console.log('\n5️⃣ Testing protected route (dashboard)...');
    const dashboardResponse = await axios.get(`${baseURL}/dashboard`, {
      jar: cookieJar,
      withCredentials: true,
      maxRedirects: 2, // Allow a couple redirects
      validateStatus: (status) => true
    });
    
    console.log('Dashboard response:');
    console.log('  Status:', dashboardResponse.status);
    console.log('  Final URL:', dashboardResponse.request.res.responseUrl || dashboardResponse.config.url);
    
    if (dashboardResponse.status === 200) {
      const isDashboard = dashboardResponse.data.includes('Dashboard') && 
                         dashboardResponse.data.includes('Queue') &&
                         !dashboardResponse.data.includes('Login');
      console.log('  Is dashboard page:', isDashboard ? 'YES' : 'NO');
    }
    
    // Summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 SUMMARY:');
    console.log('✅ Server responding:', initialResponse.status === 200 ? 'YES' : 'NO');
    console.log('✅ Login returns redirect:', loginResponse.status === 302 ? 'YES' : 'NO');
    console.log('✅ Session cookie set:', loginCookies.some(c => c.key === 'qms_session') ? 'YES' : 'NO');
    console.log('✅ Can access dashboard:', dashboardResponse.status === 200 && 
                                      dashboardResponse.data.includes('Dashboard') ? 'YES' : 'NO');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', {
        status: error.response.status,
        data: error.response.data.substring(0, 200)
      });
    }
  }
}

// Run the test
testSessionFlow().catch(console.error);