const axios = require('axios');
const axiosCookieJarSupport = require('axios-cookiejar-support').wrapper;
const tough = require('tough-cookie');

// Enable cookie support
axiosCookieJarSupport(axios);

const BASE_URL = 'http://localhost:3838';

async function testWithCleanSession() {
  console.log('🧹 Testing Authentication with Clean Session\n');
  
  // Create a new cookie jar for clean session
  const cookieJar = new tough.CookieJar();
  
  // Test 1: Access dashboard with no cookies
  console.log('1. Testing dashboard access with clean session:');
  try {
    const res = await axios.get(`${BASE_URL}/dashboard`, {
      jar: cookieJar,
      withCredentials: true,
      maxRedirects: 0,
      validateStatus: null
    });
    
    console.log('   Status:', res.status);
    console.log('   Location:', res.headers.location || 'None');
    console.log('   Expected: 302 redirect to /auth/login');
    console.log('   Result:', res.status === 302 && res.headers.location?.includes('/auth/login') ? '✅ PASS' : '❌ FAIL');
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 2: Access API with clean session
  console.log('\n2. Testing API access with clean session:');
  try {
    const res = await axios.get(`${BASE_URL}/api/queues`, {
      jar: cookieJar,
      withCredentials: true,
      validateStatus: null
    });
    
    console.log('   Status:', res.status);
    console.log('   Expected: 401');
    console.log('   Result:', res.status === 401 ? '✅ PASS' : '❌ FAIL');
    
    if (res.status === 200) {
      console.log('   ⚠️  API is accessible without authentication!');
    }
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 3: Check debug endpoint with clean session
  console.log('\n3. Checking debug endpoint with clean session:');
  try {
    const res = await axios.get(`${BASE_URL}/auth/debug`, {
      jar: cookieJar,
      withCredentials: true
    });
    
    console.log('   Session info:', JSON.stringify(res.data.session, null, 2));
    
    if (res.data.session.userId) {
      console.log('   ⚠️  Session has userId despite clean cookie jar!');
      console.log('   This suggests auth bypass middleware is creating sessions');
    }
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 4: Try different user agent to ensure it's not cached
  console.log('\n4. Testing with different user agent:');
  try {
    const res = await axios.get(`${BASE_URL}/dashboard`, {
      jar: new tough.CookieJar(), // Another fresh jar
      withCredentials: true,
      maxRedirects: 0,
      validateStatus: null,
      headers: {
        'User-Agent': 'TestBot/1.0'
      }
    });
    
    console.log('   Status:', res.status);
    console.log('   Location:', res.headers.location || 'None');
    console.log('   Result:', res.status === 302 ? '✅ Redirected' : '❌ Not redirected');
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 5: Direct curl equivalent
  console.log('\n5. Testing with minimal request (no cookies):');
  try {
    const res = await axios.get(`${BASE_URL}/dashboard`, {
      maxRedirects: 0,
      validateStatus: null,
      withCredentials: false, // Explicitly no credentials
      headers: {
        'Cookie': '' // Empty cookie header
      }
    });
    
    console.log('   Status:', res.status);
    console.log('   Set-Cookie headers:', res.headers['set-cookie']?.length || 0);
    
    if (res.status === 200) {
      // Check if page has user info
      const hasUserEmail = res.data.includes('admin@storehub.com');
      console.log('   Contains demo user email:', hasUserEmail);
      
      if (hasUserEmail) {
        console.log('   🚨 AUTH BYPASS IS DEFINITELY ACTIVE!');
      }
    }
  } catch (error) {
    console.log('   Error:', error.message);
  }
}

testWithCleanSession().then(() => {
  console.log('\n✅ Test completed!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});