const http = require('http');
const querystring = require('querystring');

// Function to make HTTP request
function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, data }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function testRegistration() {
  try {
    // Step 1: Get CSRF token
    console.log('1. Getting CSRF token...');
    const getResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/register',
      method: 'GET'
    });
    
    // Extract CSRF token from cookie
    const cookies = getResponse.headers['set-cookie'];
    const csrfCookie = cookies.find(c => c.startsWith('csrf-token='));
    const sessionCookie = cookies.find(c => c.startsWith('qms_session='));
    const csrfToken = csrfCookie.split('=')[1].split(';')[0];
    
    console.log('2. Got CSRF token:', csrfToken);
    
    // Step 2: Submit registration
    const timestamp = Date.now();
    const formData = querystring.stringify({
      fullName: 'Protocol Test User',
      email: `protocol-test${timestamp}@example.com`,
      phone: '+1234567890',
      businessName: 'Protocol Test Business',
      subdomain: `protocol-test${timestamp}`,
      businessType: 'restaurant',
      password: 'Test123!@#',
      confirmPassword: 'Test123!@#',
      agreeToTerms: 'true',
      _csrf: csrfToken
    });
    
    console.log('3. Submitting registration...');
    const postResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formData),
        'Cookie': `${csrfCookie}; ${sessionCookie}`
      }
    }, formData);
    
    console.log('4. Response status:', postResponse.statusCode);
    
    // Check response
    if (postResponse.data.includes('Registration Successful') || postResponse.data.includes('Welcome to StoreHub')) {
      console.log('✅ Registration successful!');
      
      // Extract and check the login URL
      const urlMatch = postResponse.data.match(/href="([^"]*\/t\/[^"]+\/auth\/login)"/);
      if (urlMatch) {
        const loginUrl = urlMatch[1];
        console.log('5. Login URL:', loginUrl);
        
        // Check protocol
        if (loginUrl.startsWith('http://')) {
          console.log('✅ Correct protocol (HTTP) for localhost!');
        } else if (loginUrl.startsWith('https://')) {
          console.log('❌ Wrong protocol (HTTPS) for localhost - should be HTTP');
        } else {
          console.log('⚠️ Relative URL detected:', loginUrl);
        }
      }
      
      // Also check the displayed URL
      const displayUrlMatch = postResponse.data.match(/<span class="info-value url">([^<]+)<\/span>/);
      if (displayUrlMatch) {
        const displayUrl = displayUrlMatch[1];
        console.log('6. Displayed URL:', displayUrl);
        
        if (displayUrl.startsWith('http://localhost')) {
          console.log('✅ Display URL has correct protocol!');
        } else if (displayUrl.startsWith('https://localhost')) {
          console.log('❌ Display URL has wrong protocol - should be HTTP for localhost');
        }
      }
    } else {
      console.log('❌ Registration failed');
      
      // Extract error message
      const errorMatch = postResponse.data.match(/Registration failed[^<]*/);
      if (errorMatch) {
        console.log('Error:', errorMatch[0]);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testRegistration();