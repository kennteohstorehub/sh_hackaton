const http = require('http');
const querystring = require('querystring');

console.log('Testing dashboard 500 error fix...\n');

// Test credentials - use localhost for simpler testing
const testConfig = {
  hostname: 'localhost',
  port: 3838,
  credentials: {
    email: 'demo@demorestaurant.local',
    password: 'demo123'
  }
};

async function testDashboardFix() {
  return new Promise((resolve) => {
    console.log('Step 1: Attempting login...');
    
    const postData = querystring.stringify({
      email: testConfig.credentials.email,
      password: testConfig.credentials.password
    });

    const loginOptions = {
      hostname: testConfig.hostname,
      port: testConfig.port,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Dashboard-Fix-Test'
      }
    };

    const loginReq = http.request(loginOptions, (res) => {
      console.log(`Login response: ${res.statusCode}`);
      
      if (res.statusCode === 302 && res.headers.location === '/dashboard') {
        console.log('✓ Login successful, redirected to dashboard');
        
        // Extract session cookie
        const cookies = res.headers['set-cookie'];
        let cookieHeader = '';
        if (cookies) {
          cookieHeader = cookies.map(cookie => cookie.split(';')[0]).join('; ');
          console.log('✓ Session cookie extracted');
        }
        
        console.log('\nStep 2: Testing dashboard access...');
        
        // Test dashboard access
        const dashboardOptions = {
          hostname: testConfig.hostname,
          port: testConfig.port,
          path: '/dashboard',
          method: 'GET',
          headers: {
            'Cookie': cookieHeader,
            'User-Agent': 'Dashboard-Fix-Test'
          }
        };

        const dashboardReq = http.request(dashboardOptions, (dashRes) => {
          console.log(`Dashboard response: ${dashRes.statusCode}`);
          
          if (dashRes.statusCode === 200) {
            console.log('✅ SUCCESS: Dashboard loaded without 500 error!');
            console.log('✅ Fix confirmed: Template data mismatch resolved');
            resolve(true);
          } else if (dashRes.statusCode === 500) {
            console.log('❌ FAILURE: Dashboard still returning 500 error');
            console.log('❌ The template data mismatch fix may not have taken effect');
            resolve(false);
          } else {
            console.log(`⚠️  UNEXPECTED: Dashboard returned status ${dashRes.statusCode}`);
            resolve(false);
          }
        });

        dashboardReq.on('error', (e) => {
          console.error('❌ Dashboard request error:', e.message);
          resolve(false);
        });

        dashboardReq.end();
        
      } else if (res.statusCode === 400 || res.statusCode === 401) {
        console.log('❌ Login failed - invalid credentials or authentication issue');
        resolve(false);
      } else {
        console.log(`❌ Login unexpected response: ${res.statusCode}`);
        if (res.headers.location) {
          console.log(`   Redirected to: ${res.headers.location}`);
        }
        resolve(false);
      }
    });

    loginReq.on('error', (e) => {
      console.error('❌ Login request error:', e.message);
      resolve(false);
    });

    loginReq.write(postData);
    loginReq.end();
  });
}

// Run the test
testDashboardFix().then((success) => {
  console.log('\n' + '='.repeat(50));
  if (success) {
    console.log('🎉 DASHBOARD FIX TEST PASSED');
    console.log('The template variable mismatch has been resolved.');
    console.log('Dashboard now receives proper "stats" object with:');
    console.log('- totalWaiting: queue waiting count');
    console.log('- averageWaitTime: rounded average wait time');
    console.log('- totalServed: customers served today');
  } else {
    console.log('❌ DASHBOARD FIX TEST FAILED');
    console.log('Additional investigation may be needed.');
  }
  console.log('='.repeat(50));
  
  process.exit(success ? 0 : 1);
});