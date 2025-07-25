#!/usr/bin/env node

const axios = require('axios');
const axiosCookieJarSupport = require('axios-cookiejar-support').wrapper;
const tough = require('tough-cookie');

// Enable cookie jar support
axiosCookieJarSupport(axios);
const cookieJar = new tough.CookieJar();

const baseURL = 'https://storehub-queue.onrender.com';

async function testSession() {
  console.log('🧪 Testing Session Persistence After Migration');
  console.log('=' .repeat(50));
  
  try {
    // Step 1: Test session set endpoint
    console.log('\n1️⃣ Testing session set...');
    const setResponse = await axios.post(`${baseURL}/api/debug/test-session-set`, {}, {
      jar: cookieJar,
      withCredentials: true
    });
    
    console.log('Session set response:', setResponse.data);
    
    // Extract session ID from cookies
    const cookies = await cookieJar.getCookies(baseURL);
    const sessionCookie = cookies.find(c => c.key === 'queue.sid');
    console.log('Session cookie:', sessionCookie ? sessionCookie.value : 'Not found');
    
    // Step 2: Test session get endpoint
    console.log('\n2️⃣ Testing session get...');
    const getResponse = await axios.get(`${baseURL}/api/debug/test-session-get`, {
      jar: cookieJar,
      withCredentials: true
    });
    
    console.log('Session get response:', getResponse.data);
    
    // Step 3: Test login
    console.log('\n3️⃣ Testing login...');
    const loginResponse = await axios.post(`${baseURL}/auth/login`, 
      'email=demo@storehub.com&password=demo123',
      {
        jar: cookieJar,
        withCredentials: true,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 500
      }
    );
    
    console.log('Login response status:', loginResponse.status);
    console.log('Login redirect location:', loginResponse.headers.location);
    
    // Step 4: Check session after login
    console.log('\n4️⃣ Checking session after login...');
    const sessionCheckResponse = await axios.get(`${baseURL}/api/debug/test-session-get`, {
      jar: cookieJar,
      withCredentials: true
    });
    
    console.log('Session after login:', sessionCheckResponse.data);
    
    // Step 5: Try to access dashboard
    console.log('\n5️⃣ Testing dashboard access...');
    const dashboardResponse = await axios.get(`${baseURL}/dashboard`, {
      jar: cookieJar,
      withCredentials: true,
      maxRedirects: 0,
      validateStatus: (status) => status < 500
    });
    
    console.log('Dashboard response status:', dashboardResponse.status);
    console.log('Dashboard redirect location:', dashboardResponse.headers.location);
    
    // Summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 SUMMARY:');
    console.log('✅ Session can be set:', setResponse.data.success ? 'YES' : 'NO');
    console.log('✅ Session persists:', getResponse.data.hasTestData ? 'YES' : 'NO');
    console.log('✅ Login successful:', loginResponse.status === 302 ? 'YES' : 'NO');
    console.log('✅ Session has userId after login:', sessionCheckResponse.data.userId ? 'YES' : 'NO');
    console.log('✅ Dashboard accessible:', dashboardResponse.status === 200 ? 'YES' : 'NO');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testSession().catch(console.error);