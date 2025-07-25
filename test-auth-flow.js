const https = require('https');

async function testAuthFlow() {
  console.log('🧪 Testing Authentication Flow');
  console.log('=' .repeat(50));
  
  // Step 1: Login and get cookies
  console.log('\n1️⃣ Logging in...');
  
  const loginData = 'email=demo@smartqueue.com&password=demo123456';
  
  const loginPromise = new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'queuemanagement-vtc2.onrender.com',
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': loginData.length
      }
    }, (res) => {
      console.log('   Login response:', res.statusCode);
      console.log('   Location:', res.headers.location);
      
      // Get all cookies
      const cookies = res.headers['set-cookie'] || [];
      console.log('   Cookies set:', cookies.length);
      
      let cookieString = '';
      cookies.forEach((cookie, i) => {
        console.log(`   Cookie ${i + 1}:`, cookie.split(';')[0]);
        if (cookie.includes('qms_session')) {
          cookieString = cookie.split(';')[0];
        }
      });
      
      resolve({
        success: res.statusCode === 302,
        location: res.headers.location,
        sessionCookie: cookieString
      });
    });
    
    req.on('error', reject);
    req.write(loginData);
    req.end();
  });
  
  const loginResult = await loginPromise;
  
  if (!loginResult.success) {
    console.log('   ❌ Login failed');
    return;
  }
  
  console.log('   ✅ Login successful');
  
  // Step 2: Access dashboard with cookie
  console.log('\n2️⃣ Accessing dashboard with session cookie...');
  console.log('   Using cookie:', loginResult.sessionCookie);
  
  const dashboardPromise = new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'queuemanagement-vtc2.onrender.com',
      path: '/dashboard',
      method: 'GET',
      headers: {
        'Cookie': loginResult.sessionCookie
      }
    }, (res) => {
      console.log('   Dashboard response:', res.statusCode);
      
      if (res.statusCode === 302) {
        console.log('   Redirect to:', res.headers.location);
        resolve({
          success: false,
          redirect: res.headers.location
        });
      } else {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const isLoginPage = body.includes('Sign in') || body.includes('Password');
          const isDashboard = body.includes('Dashboard') || body.includes('Queue');
          
          console.log('   Page type:', isLoginPage ? 'Login page' : isDashboard ? 'Dashboard' : 'Unknown');
          
          resolve({
            success: isDashboard,
            body: body.substring(0, 500)
          });
        });
      }
    });
    
    req.on('error', reject);
    req.end();
  });
  
  const dashboardResult = await dashboardPromise;
  
  if (dashboardResult.success) {
    console.log('   ✅ Dashboard access successful!');
  } else {
    console.log('   ❌ Dashboard access failed');
    if (dashboardResult.redirect) {
      console.log('   Redirected to:', dashboardResult.redirect);
    }
  }
  
  // Step 3: Check authentication middleware
  console.log('\n3️⃣ Testing API endpoint with auth...');
  
  const apiPromise = new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'queuemanagement-vtc2.onrender.com',
      path: '/api/queue',
      method: 'GET',
      headers: {
        'Cookie': loginResult.sessionCookie
      }
    }, (res) => {
      console.log('   API response:', res.statusCode);
      
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          console.log('   Response:', data);
          resolve({ success: res.statusCode === 200, data });
        } catch (e) {
          console.log('   Response body:', body.substring(0, 200));
          resolve({ success: false, error: body });
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
  
  const apiResult = await apiPromise;
  
  if (apiResult.success) {
    console.log('   ✅ API access successful!');
  } else {
    console.log('   ❌ API access failed');
  }
  
  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 SUMMARY:');
  console.log(`Login: ${loginResult.success ? '✅' : '❌'}`);
  console.log(`Dashboard: ${dashboardResult.success ? '✅' : '❌'}`);
  console.log(`API: ${apiResult.success ? '✅' : '❌'}`);
  
  if (!dashboardResult.success) {
    console.log('\n⚠️  Session is not persisting correctly.');
    console.log('The login works but the session is not being maintained.');
  }
}

testAuthFlow().catch(console.error);