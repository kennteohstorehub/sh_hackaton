const https = require('https');

async function testSessionMechanics() {
  console.log('🔧 Testing Session Mechanics');
  console.log('=' .repeat(50));
  
  let sessionCookie = '';
  
  // Step 1: Get initial session
  console.log('\n1️⃣ Getting initial session...');
  await new Promise((resolve, reject) => {
    https.get('https://queuemanagement-vtc2.onrender.com/api/debug/session-info', (res) => {
      const cookies = res.headers['set-cookie'];
      if (cookies) {
        sessionCookie = cookies[0].split(';')[0];
      }
      
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const data = JSON.parse(body);
        console.log('   Session ID:', data.sessionID);
        console.log('   Cookie set:', !!sessionCookie);
        resolve();
      });
    }).on('error', reject);
  });
  
  // Step 2: Test setting session data
  console.log('\n2️⃣ Testing session data persistence...');
  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'queuemanagement-vtc2.onrender.com',
      path: '/api/debug/test-session-set',
      method: 'POST',
      headers: {
        'Cookie': sessionCookie,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('   Response:', body);
        resolve();
      });
    });
    
    req.on('error', reject);
    req.end();
  });
  
  // Step 3: Check if data persists
  console.log('\n3️⃣ Checking if session data persists...');
  await new Promise((resolve, reject) => {
    https.get({
      hostname: 'queuemanagement-vtc2.onrender.com',
      path: '/api/debug/test-session-get',
      headers: {
        'Cookie': sessionCookie
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const data = JSON.parse(body);
        console.log('   Has test data:', data.hasTestData);
        console.log('   User ID:', data.userId);
        console.log('   Session data:', JSON.stringify(data.allSessionData, null, 2));
        resolve();
      });
    }).on('error', reject);
  });
  
  // Step 4: Test actual login
  console.log('\n4️⃣ Testing actual login...');
  const loginData = 'email=demo@smartqueue.com&password=demo123456';
  
  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'queuemanagement-vtc2.onrender.com',
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Cookie': sessionCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': loginData.length
      }
    }, (res) => {
      console.log('   Login status:', res.statusCode);
      console.log('   Location:', res.headers.location);
      
      // Update session cookie if new one provided
      if (res.headers['set-cookie']) {
        sessionCookie = res.headers['set-cookie'][0].split(';')[0];
        console.log('   New session cookie received');
      }
      
      resolve();
    });
    
    req.on('error', reject);
    req.write(loginData);
    req.end();
  });
  
  // Step 5: Check session after login
  console.log('\n5️⃣ Checking session after login...');
  await new Promise((resolve, reject) => {
    https.get({
      hostname: 'queuemanagement-vtc2.onrender.com',
      path: '/api/debug/test-session-get',
      headers: {
        'Cookie': sessionCookie
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const data = JSON.parse(body);
        console.log('   User ID after login:', data.userId);
        console.log('   Session data:', JSON.stringify(data.allSessionData, null, 2));
        resolve();
      });
    }).on('error', reject);
  });
  
  console.log('\n' + '=' .repeat(50));
  console.log('✅ Session mechanics test complete');
}

testSessionMechanics().catch(console.error);