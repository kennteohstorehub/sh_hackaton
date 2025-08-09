const axios = require('axios');

async function testDirectLogin() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('   DIRECT LOGIN API TEST');
  console.log('════════════════════════════════════════════════════════════');
  console.log('');
  
  // Use the test merchant we know exists
  const credentials = {
    email: 'test-1754656681117@example.com',
    password: 'TestPassword123!'
  };
  
  const subdomain = 'test1754656681117';
  
  try {
    // First, try to get the login page to get CSRF token
    console.log('Step 1: Getting CSRF token from login page...');
    const loginPageUrl = `http://localhost:3000/t/${subdomain}/auth/merchant-login`;
    console.log(`  URL: ${loginPageUrl}`);
    
    const loginPageResponse = await axios.get(loginPageUrl, {
      maxRedirects: 0,
      validateStatus: (status) => status < 500
    });
    
    console.log(`  Response status: ${loginPageResponse.status}`);
    console.log(`  Headers:`, loginPageResponse.headers);
    
    // Extract CSRF token from cookies
    const cookies = loginPageResponse.headers['set-cookie'] || [];
    let csrfToken = null;
    let sessionCookie = null;
    
    cookies.forEach(cookie => {
      if (cookie.includes('csrf-token=')) {
        csrfToken = cookie.split('csrf-token=')[1].split(';')[0];
      }
      if (cookie.includes('qms_session=')) {
        sessionCookie = cookie.split('qms_session=')[1].split(';')[0];
      }
    });
    
    console.log(`  CSRF Token: ${csrfToken ? csrfToken.substring(0, 20) + '...' : 'NOT FOUND'}`);
    console.log(`  Session Cookie: ${sessionCookie ? sessionCookie.substring(0, 20) + '...' : 'NOT FOUND'}`);
    
    if (!csrfToken) {
      console.log('  ⚠️  No CSRF token found, trying without it...');
    }
    
    // Step 2: Attempt login
    console.log('\nStep 2: Attempting login...');
    const loginUrl = `http://localhost:3000/t/${subdomain}/auth/login`;
    console.log(`  URL: ${loginUrl}`);
    console.log(`  Credentials: ${credentials.email} / [password hidden]`);
    
    const loginData = {
      email: credentials.email,
      password: credentials.password,
      _csrf: csrfToken || ''
    };
    
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies.join('; ')
    };
    
    console.log(`  Request headers:`, headers);
    console.log(`  Request data:`, { ...loginData, password: '[hidden]' });
    
    const loginResponse = await axios.post(
      loginUrl,
      new URLSearchParams(loginData).toString(),
      {
        headers,
        maxRedirects: 0,
        validateStatus: (status) => status < 500
      }
    );
    
    console.log(`  Response status: ${loginResponse.status}`);
    console.log(`  Response headers:`, loginResponse.headers);
    
    if (loginResponse.status === 302 || loginResponse.status === 303) {
      const redirectLocation = loginResponse.headers.location;
      console.log(`  Redirect to: ${redirectLocation}`);
      
      if (redirectLocation.includes('dashboard')) {
        console.log('  ✅ Login successful! Redirected to dashboard');
      } else if (redirectLocation.includes('login')) {
        console.log('  ❌ Login failed! Redirected back to login');
      } else {
        console.log('  ⚠️  Unexpected redirect location');
      }
    } else {
      console.log('  ⚠️  No redirect - unexpected response');
    }
    
    // Step 3: Try direct authentication via API (if exists)
    console.log('\nStep 3: Testing authentication at different paths...');
    
    const testPaths = [
      `/auth/login`,
      `/t/${subdomain}/auth/login`,
      `/auth/merchant-login`,
      `/t/${subdomain}/auth/merchant-login`
    ];
    
    for (const path of testPaths) {
      const fullUrl = `http://localhost:3000${path}`;
      console.log(`\n  Testing: ${fullUrl}`);
      
      try {
        const response = await axios.post(
          fullUrl,
          new URLSearchParams(loginData).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Cookie': cookies.join('; ')
            },
            maxRedirects: 0,
            validateStatus: (status) => status < 500
          }
        );
        
        console.log(`    Status: ${response.status}`);
        if (response.headers.location) {
          console.log(`    Redirect: ${response.headers.location}`);
        }
      } catch (err) {
        console.log(`    Error: ${err.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
  
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('TEST COMPLETE');
  console.log('════════════════════════════════════════════════════════════');
}

// Run the test
testDirectLogin().catch(console.error);