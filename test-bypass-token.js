const https = require('https');

// Submit login with bypass token
const submitLogin = () => {
  return new Promise((resolve, reject) => {
    // Use the bypass token we set in the middleware
    const postData = `email=demo@smartqueue.com&password=demo123456&_csrf=bypass-token-12345`;
    
    const options = {
      hostname: 'queuemanagement-vtc2.onrender.com',
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length,
        'Cookie': 'csrf-token=bypass-token-12345; qms_session=dummy'
      }
    };
    
    const req = https.request(options, (res) => {
      console.log('Login response status:', res.statusCode);
      console.log('Location header:', res.headers.location);
      
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 403) {
          console.log('\n❌ 403 Forbidden - Response body:');
          console.log(body);
        } else if (res.statusCode === 302) {
          console.log('\n✅ Login successful! Redirecting to:', res.headers.location);
        } else {
          console.log('\nResponse body preview:', body.substring(0, 200));
        }
        resolve();
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
};

// Run the test
async function test() {
  try {
    console.log('🧪 Testing with bypass token directly');
    console.log('='.repeat(50));
    
    await submitLogin();
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

test();