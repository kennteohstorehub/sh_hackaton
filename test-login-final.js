const axios = require('axios');

const BASE_URL = 'http://localhost:3838';

async function testLogin() {
  console.log('🔍 Final Login System Test\n');

  try {
    // Create a new axios instance without cookies
    const client = axios.create({
      baseURL: BASE_URL,
      validateStatus: () => true,
      maxRedirects: 0
    });

    // 1. Test dashboard redirect
    console.log('1. Testing dashboard access (should redirect to login)...');
    const dashRes = await client.get('/dashboard');
    console.log(`   Status: ${dashRes.status}`);
    console.log(`   Location: ${dashRes.headers.location || 'N/A'}`);
    
    // 2. Test login page
    console.log('\n2. Testing login page access...');
    const loginRes = await client.get('/auth/login');
    console.log(`   Status: ${loginRes.status}`);
    
    if (loginRes.status === 200) {
      console.log('   ✅ Login page loaded successfully!');
      console.log('   Page contains login form:', loginRes.data.includes('<form'));
      console.log('   Page contains email field:', loginRes.data.includes('name="email"'));
      console.log('   Page contains password field:', loginRes.data.includes('name="password"'));
      
      // Extract title
      const titleMatch = loginRes.data.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) {
        console.log(`   Page title: "${titleMatch[1]}"`);
      }
    } else if (loginRes.status === 302) {
      console.log('   ❌ Login page redirected to:', loginRes.headers.location);
      console.log('   Auth bypass appears to still be active');
    }

    // 3. Check environment
    console.log('\n3. Server Configuration:');
    console.log('   Check server logs for:');
    console.log('   - "✅ Authentication required - Login system active"');
    console.log('   - NOT "🔓 AUTH BYPASS ENABLED"');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLogin();