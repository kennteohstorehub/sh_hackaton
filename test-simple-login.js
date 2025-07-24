const https = require('https');

// First, get the login page to obtain cookies
const getLoginPage = () => {
  return new Promise((resolve, reject) => {
    https.get('https://queuemanagement-vtc2.onrender.com/auth/login', (res) => {
      let cookies = '';
      let csrfToken = '';
      
      // Extract cookies from headers
      const setCookies = res.headers['set-cookie'];
      if (setCookies) {
        cookies = setCookies.map(cookie => cookie.split(';')[0]).join('; ');
      }
      
      // Read response body to extract CSRF token
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        // Extract CSRF token from HTML
        const csrfMatch = body.match(/name="_csrf"\s+value="([^"]+)"/);
        if (csrfMatch) {
          csrfToken = csrfMatch[1];
        }
        
        console.log('Got cookies:', cookies.substring(0, 50) + '...');
        console.log('Got CSRF token:', csrfToken || 'NOT FOUND');
        
        resolve({ cookies, csrfToken });
      });
    }).on('error', reject);
  });
};

// Then, submit login form
const submitLogin = (cookies, csrfToken) => {
  return new Promise((resolve, reject) => {
    const postData = `email=demo@smartqueue.com&password=demo123456&_csrf=${csrfToken}`;
    
    const options = {
      hostname: 'queuemanagement-vtc2.onrender.com',
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length,
        'Cookie': cookies
      }
    };
    
    const req = https.request(options, (res) => {
      console.log('\nLogin response status:', res.statusCode);
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
    console.log('🧪 Simple Login Test');
    console.log('='.repeat(50));
    
    const { cookies, csrfToken } = await getLoginPage();
    await submitLogin(cookies, csrfToken);
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

test();