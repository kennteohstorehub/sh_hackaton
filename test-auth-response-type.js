const axios = require('axios');

const BASE_URL = 'http://localhost:3838';

async function testResponseType() {
  console.log('🔍 Testing Authentication Response Types\n');
  
  // Test 1: Browser-like request
  console.log('1. Testing browser-like request to /dashboard:');
  try {
    const res = await axios.get(`${BASE_URL}/dashboard`, {
      maxRedirects: 0,
      validateStatus: null,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    console.log('   Status:', res.status);
    console.log('   Content-Type:', res.headers['content-type']);
    console.log('   Location:', res.headers.location || 'None');
    
    if (res.status === 401 && res.headers['content-type']?.includes('json')) {
      console.log('   ❌ PROBLEM: Returning JSON 401 for HTML request');
      console.log('   Response:', res.data);
    }
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 2: Check the exact path triggering logic
  console.log('\n2. Checking request path logic:');
  const paths = ['/dashboard', '/dashboard/settings', '/api/queues'];
  
  for (const path of paths) {
    try {
      const res = await axios.get(`${BASE_URL}${path}`, {
        maxRedirects: 0,
        validateStatus: null,
        headers: {
          'Accept': 'text/html'
        }
      });
      
      const isAPI = path.startsWith('/api/');
      console.log(`   ${path}:`);
      console.log(`     Status: ${res.status}`);
      console.log(`     Is API path: ${isAPI}`);
      console.log(`     Should redirect: ${!isAPI}`);
      console.log(`     Actually redirects: ${res.status === 302}`);
    } catch (error) {
      console.log(`   ${path}: Error - ${error.message}`);
    }
  }

  // Test 3: Check the actual auth middleware logic
  console.log('\n3. Testing exact conditions from auth middleware:');
  const testCases = [
    { path: '/dashboard', xhr: false, accept: 'text/html' },
    { path: '/api/queues', xhr: false, accept: 'application/json' },
    { path: '/dashboard', xhr: true, accept: 'application/json' },
    { path: '/other/path', xhr: false, accept: 'text/html' }
  ];
  
  for (const test of testCases) {
    try {
      const headers = {
        'Accept': test.accept
      };
      if (test.xhr) {
        headers['X-Requested-With'] = 'XMLHttpRequest';
      }
      
      const res = await axios.get(`${BASE_URL}${test.path}`, {
        maxRedirects: 0,
        validateStatus: null,
        headers
      });
      
      const shouldReturn401 = test.path.startsWith('/api/') || test.xhr || test.accept.includes('application/json');
      
      console.log(`   Path: ${test.path}, XHR: ${test.xhr}, Accept: ${test.accept}`);
      console.log(`     Expected: ${shouldReturn401 ? '401 JSON' : '302 Redirect'}`);
      console.log(`     Actual: ${res.status} ${res.headers.location ? 'to ' + res.headers.location : ''}`);
      console.log(`     Result: ${(shouldReturn401 && res.status === 401) || (!shouldReturn401 && res.status === 302) ? '✅' : '❌'}`);
    } catch (error) {
      console.log(`   Error:`, error.message);
    }
  }
}

testResponseType().then(() => {
  console.log('\n✅ Analysis completed!');
  process.exit(0);
});