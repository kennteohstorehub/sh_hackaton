const axios = require('axios');

const BASE_URL = 'http://localhost:3838';

async function testRedirectIssue() {
  console.log('Testing authentication redirect issue...\n');
  
  // Test 1: Access dashboard without auth
  console.log('1. Testing /dashboard without authentication:');
  try {
    const res = await axios.get(`${BASE_URL}/dashboard`, {
      maxRedirects: 0,
      validateStatus: null
    });
    
    console.log(`   Status: ${res.status}`);
    console.log(`   Location header: ${res.headers.location || 'None'}`);
    console.log(`   Expected: 302 with Location: /auth/login?redirect=/dashboard`);
    console.log(`   Result: ${res.status === 302 && res.headers.location?.includes('/auth/login') ? 'PASS' : 'FAIL'}\n`);
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 2: Access root path without auth
  console.log('2. Testing / without authentication:');
  try {
    const res = await axios.get(BASE_URL, {
      maxRedirects: 0,
      validateStatus: null
    });
    
    console.log(`   Status: ${res.status}`);
    console.log(`   Location header: ${res.headers.location || 'None'}`);
    console.log(`   Expected: 302 with Location: /auth/login`);
    console.log(`   Result: ${res.status === 302 && res.headers.location === '/auth/login' ? 'PASS' : 'FAIL'}\n`);
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 3: Check if it's returning 401 instead of redirect
  console.log('3. Testing if routes return 401 instead of redirect:');
  try {
    const res = await axios.get(`${BASE_URL}/dashboard/settings`, {
      maxRedirects: 0,
      validateStatus: null,
      headers: {
        'Accept': 'text/html'
      }
    });
    
    console.log(`   Status: ${res.status}`);
    console.log(`   Content-Type: ${res.headers['content-type']}`);
    console.log(`   Issue: Routes are returning 401 (API response) instead of 302 redirect for browser requests`);
    
    if (res.status === 401) {
      console.log(`   PROBLEM IDENTIFIED: The middleware is treating HTML requests as API requests\n`);
    }
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 4: Check session configuration
  console.log('4. Checking session configuration:');
  console.log(`   USE_AUTH_BYPASS: ${process.env.USE_AUTH_BYPASS || 'false'}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
}

testRedirectIssue().then(() => {
  console.log('\nTest completed!');
  process.exit(0);
});