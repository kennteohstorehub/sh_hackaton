const https = require('https');

async function debugSession() {
  console.log('🔍 Session Debugging');
  console.log('=' .repeat(50));
  
  // First, login and capture the exact response
  const loginData = 'email=demo@smartqueue.com&password=demo123456';
  
  console.log('\n1️⃣ Performing login...');
  
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
      const sessionCookie = res.headers['set-cookie']?.[0]?.split(';')[0] || '';
      
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          location: res.headers.location,
          cookie: sessionCookie,
          body
        });
      });
    });
    
    req.on('error', reject);
    req.write(loginData);
    req.end();
  });
  
  const loginResult = await loginPromise;
  
  console.log('   Status:', loginResult.status);
  console.log('   Location:', loginResult.location);
  console.log('   Cookie:', loginResult.cookie);
  
  if (loginResult.status !== 302) {
    console.log('   Response body:', loginResult.body);
    return;
  }
  
  // Now check the debug endpoint with the cookie
  console.log('\n2️⃣ Checking session debug endpoint...');
  
  const debugPromise = new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'queuemanagement-vtc2.onrender.com',
      path: '/auth/debug',
      method: 'GET',
      headers: {
        'Cookie': loginResult.cookie
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data);
        } catch (e) {
          resolve({ error: 'Failed to parse response', body });
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
  
  const debugData = await debugPromise;
  console.log('   Session debug data:', JSON.stringify(debugData, null, 2));
  
  // Check if we can access a protected route
  console.log('\n3️⃣ Testing protected route access...');
  
  const protectedPromise = new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'queuemanagement-vtc2.onrender.com',
      path: '/dashboard',
      method: 'GET',
      headers: {
        'Cookie': loginResult.cookie
      }
    }, (res) => {
      console.log('   Dashboard status:', res.statusCode);
      console.log('   Location:', res.headers.location || 'N/A');
      
      resolve({
        status: res.statusCode,
        location: res.headers.location
      });
    });
    
    req.on('error', reject);
    req.end();
  });
  
  await protectedPromise;
  
  // Try to check the actual session in the database
  console.log('\n4️⃣ Session Analysis:');
  
  if (loginResult.cookie) {
    const sessionId = loginResult.cookie.match(/s%3A([^.]+)/)?.[1];
    console.log('   Session ID fragment:', sessionId?.substring(0, 20) + '...');
    
    // The session should be stored in PostgreSQL
    console.log('   Session should be in PostgreSQL "Session" table');
    console.log('   With columns: id, sid, sess, expire');
  }
  
  console.log('\n⚠️  Issue: Session is created but userId is not being set');
  console.log('This suggests the login route is not properly saving the userId to the session.');
}

debugSession().catch(console.error);