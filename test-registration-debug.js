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
      fullName: 'Test User',
      email: `test${timestamp}@example.com`,
      phone: '+1234567890',
      businessName: 'Test Business',
      subdomain: `test${timestamp}`,
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
      
      // Extract login URL
      const urlMatch = postResponse.data.match(/href="([^"]*\/t\/[^"]+\/login)"/);
      if (urlMatch) {
        console.log('5. Login URL:', urlMatch[1]);
      }
    } else if (postResponse.data.includes('Registration failed')) {
      console.log('❌ Registration failed');
      
      // Extract error message
      const errorMatch = postResponse.data.match(/Registration failed[^<]*/);
      if (errorMatch) {
        console.log('Error:', errorMatch[0]);
      }
    } else {
      console.log('⚠️ Unexpected response');
      console.log('Response preview:', postResponse.data.substring(0, 500));
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testRegistration();