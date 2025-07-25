const https = require('https');
const { parse } = require('cookie');

// Store cookies between requests
let sessionCookies = {};

// Helper to make requests with cookies
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    // Add cookies to request
    if (Object.keys(sessionCookies).length > 0) {
      const cookieString = Object.entries(sessionCookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
      options.headers = options.headers || {};
      options.headers.Cookie = cookieString;
    }
    
    const req = https.request(options, (res) => {
      // Update cookies from response
      if (res.headers['set-cookie']) {
        res.headers['set-cookie'].forEach(cookie => {
          const parsed = parse(cookie);
          Object.assign(sessionCookies, parsed);
        });
      }
      
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });
    
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function testSessionFlow() {
  console.log('🧪 Testing Session Persistence');
  console.log('=' .repeat(50));
  
  try {
    // Step 1: Get login page
    console.log('\n1️⃣ Getting login page...');
    const loginPageRes = await makeRequest({
      hostname: 'queuemanagement-vtc2.onrender.com',
      path: '/auth/login',
      method: 'GET'
    });
    
    console.log('   Status:', loginPageRes.status);
    console.log('   Cookies received:', Object.keys(sessionCookies).join(', '));
    
    // Step 2: Submit login
    console.log('\n2️⃣ Submitting login...');
    const loginData = 'email=demo@smartqueue.com&password=demo123456';
    
    const loginRes = await makeRequest({
      hostname: 'queuemanagement-vtc2.onrender.com',
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': loginData.length
      }
    }, loginData);
    
    console.log('   Status:', loginRes.status);
    console.log('   Location:', loginRes.headers.location || 'N/A');
    console.log('   Cookies now:', Object.keys(sessionCookies).join(', '));
    
    if (loginRes.status !== 302) {
      console.log('   ❌ Login failed - expected redirect');
      console.log('   Response:', loginRes.body.substring(0, 200));
      return;
    }
    
    // Step 3: Follow redirect to dashboard
    console.log('\n3️⃣ Following redirect to dashboard...');
    const dashboardPath = loginRes.headers.location || '/dashboard';
    
    const dashboardRes = await makeRequest({
      hostname: 'queuemanagement-vtc2.onrender.com',
      path: dashboardPath,
      method: 'GET'
    });
    
    console.log('   Status:', dashboardRes.status);
    console.log('   Content-Type:', dashboardRes.headers['content-type']);
    
    // Check if we're on the dashboard or redirected to login
    if (dashboardRes.status === 302 && dashboardRes.headers.location?.includes('login')) {
      console.log('   ❌ Redirected back to login - session not working');
    } else if (dashboardRes.status === 200) {
      // Check page content
      const isDashboard = dashboardRes.body.includes('Dashboard') || 
                         dashboardRes.body.includes('Queue Management') ||
                         dashboardRes.body.includes('Welcome back');
      const isLogin = dashboardRes.body.includes('Sign in') || 
                     dashboardRes.body.includes('Email Address') ||
                     dashboardRes.body.includes('Password');
      
      if (isDashboard) {
        console.log('   ✅ Successfully on dashboard!');
      } else if (isLogin) {
        console.log('   ❌ Still on login page - session not persisting');
      } else {
        console.log('   ⚠️  Unknown page content');
        console.log('   Preview:', dashboardRes.body.substring(0, 300).replace(/\s+/g, ' '));
      }
    }
    
    // Step 4: Test direct dashboard access
    console.log('\n4️⃣ Testing direct dashboard access...');
    const directDashboardRes = await makeRequest({
      hostname: 'queuemanagement-vtc2.onrender.com',
      path: '/dashboard',
      method: 'GET'
    });
    
    console.log('   Status:', directDashboardRes.status);
    if (directDashboardRes.status === 302) {
      console.log('   Redirect to:', directDashboardRes.headers.location);
    }
    
    // Step 5: Check session info
    console.log('\n5️⃣ Session Cookie Analysis:');
    if (sessionCookies['qms_session']) {
      const sessionValue = sessionCookies['qms_session'];
      console.log('   Session cookie exists: ✅');
      console.log('   Session prefix:', sessionValue.substring(0, 10) + '...');
      console.log('   Looks signed:', sessionValue.startsWith('s%3A') ? '✅' : '❌');
    } else {
      console.log('   Session cookie exists: ❌');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

testSessionFlow();