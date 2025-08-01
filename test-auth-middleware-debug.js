const axios = require('axios');
const axiosCookieJarSupport = require('axios-cookiejar-support').wrapper;
const tough = require('tough-cookie');

// Enable cookie support
axiosCookieJarSupport(axios);
const cookieJar = new tough.CookieJar();

const BASE_URL = 'http://localhost:3838';

async function debugAuthMiddleware() {
  console.log('🔍 Debugging Authentication Middleware Issue\n');
  
  // Test 1: Check debug endpoint
  console.log('1. Checking /auth/debug endpoint:');
  try {
    const res = await axios.get(`${BASE_URL}/auth/debug`, {
      jar: cookieJar,
      withCredentials: true
    });
    
    console.log('   Debug info:', JSON.stringify(res.data, null, 2));
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 2: Check session creation
  console.log('\n2. Testing session creation on login page:');
  try {
    const res = await axios.get(`${BASE_URL}/auth/login`, {
      jar: cookieJar,
      withCredentials: true
    });
    
    const cookies = await cookieJar.getCookies(BASE_URL);
    console.log('   Cookies received:', cookies.map(c => `${c.key}=${c.value.substring(0, 20)}...`));
    
    // Check if CSRF token is in the page
    const hasCSRF = res.data.includes('name="_csrf"');
    console.log('   CSRF token in page:', hasCSRF);
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 3: Direct dashboard access with detailed headers
  console.log('\n3. Testing dashboard access with full headers:');
  try {
    const res = await axios.get(`${BASE_URL}/dashboard`, {
      jar: cookieJar,
      withCredentials: true,
      maxRedirects: 0,
      validateStatus: null,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    console.log('   Status:', res.status);
    console.log('   Location:', res.headers.location || 'None');
    console.log('   Set-Cookie:', res.headers['set-cookie'] || 'None');
    
    // If we get HTML, check what it contains
    if (res.status === 200 && res.data) {
      const titleMatch = res.data.match(/<title>(.*?)<\/title>/);
      console.log('   Page title:', titleMatch ? titleMatch[1] : 'No title found');
      
      // Check if it's actually the dashboard or error page
      if (res.data.includes('Dashboard')) {
        console.log('   ⚠️  ISSUE: Dashboard is accessible without authentication!');
      }
    }
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 4: Check API route authentication
  console.log('\n4. Testing API route authentication:');
  try {
    const res = await axios.get(`${BASE_URL}/api/queues`, {
      jar: cookieJar,
      withCredentials: true,
      validateStatus: null
    });
    
    console.log('   Status:', res.status);
    console.log('   Response:', res.data);
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 5: Check if auth bypass is somehow active
  console.log('\n5. Checking for auth bypass indicators:');
  try {
    // Try accessing a protected route and see if demo user is injected
    const res = await axios.get(`${BASE_URL}/dashboard`, {
      jar: cookieJar,
      withCredentials: true
    });
    
    // Look for demo merchant indicators
    const hasDemoMerchant = res.data.includes('StoreHub Restaurant') || 
                           res.data.includes('admin@storehub.com');
    
    console.log('   Demo merchant detected:', hasDemoMerchant);
    
    if (hasDemoMerchant) {
      console.log('   ⚠️  AUTH BYPASS MAY BE ACTIVE despite USE_AUTH_BYPASS=false');
    }
  } catch (error) {
    console.log('   Error checking for auth bypass');
  }
}

debugAuthMiddleware().then(() => {
  console.log('\n✅ Debug completed!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});