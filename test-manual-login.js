const axios = require('axios');

async function testTenantLogin() {
  console.log('🧪 Testing tenant login manually...\n');
  
  try {
    // Create axios instance with cookie jar
    const client = axios.create({
      withCredentials: true,
      validateStatus: () => true, // Don't throw on any status codes
    });
    
    // Step 1: Get login page to get CSRF token
    console.log('1. Getting login page for demo tenant...');
    const loginPageResponse = await client.get('http://demo.lvh.me:3838/auth/login');
    console.log(`   Status: ${loginPageResponse.status}`);
    
    // Extract CSRF token from cookies
    const cookies = loginPageResponse.headers['set-cookie'] || [];
    const csrfCookie = cookies.find(cookie => cookie.includes('csrf-token='));
    const sessionCookie = cookies.find(cookie => cookie.includes('qms_session='));
    
    if (!csrfCookie) {
      console.log('❌ No CSRF token found in cookies');
      return;
    }
    
    const csrfToken = csrfCookie.split('csrf-token=')[1].split(';')[0];
    console.log(`   CSRF Token: ${csrfToken.substring(0, 20)}...`);
    
    // Step 2: Attempt login
    console.log('\n2. Attempting login...');
    const loginData = new URLSearchParams({
      email: 'admin@demo.local',
      password: 'Demo123!@#',
      _csrf: csrfToken,
      redirect: '/dashboard'
    });
    
    const loginResponse = await client.post('http://demo.lvh.me:3838/auth/login', loginData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `csrf-token=${csrfToken}; ${sessionCookie ? sessionCookie.split(';')[0] : ''}`,
        'X-CSRF-Token': csrfToken
      },
      maxRedirects: 0 // Don't follow redirects
    });
    
    console.log(`   Login Status: ${loginResponse.status}`);
    console.log(`   Location Header: ${loginResponse.headers.location || 'None'}`);
    
    if (loginResponse.status === 302) {
      const redirectUrl = loginResponse.headers.location;
      console.log(`   ✅ Login successful, redirecting to: ${redirectUrl}`);
      
      // Step 3: Follow redirect to dashboard
      console.log('\n3. Following redirect to dashboard...');
      const newCookies = loginResponse.headers['set-cookie'] || [];
      const allCookies = [...cookies, ...newCookies].map(c => c.split(';')[0]).join('; ');
      
      const dashboardResponse = await client.get(`http://demo.lvh.me:3838${redirectUrl}`, {
        headers: {
          'Cookie': allCookies
        }
      });
      
      console.log(`   Dashboard Status: ${dashboardResponse.status}`);
      
      if (dashboardResponse.status === 500) {
        console.log('❌ 500 Error accessing dashboard');
        console.log('   Response body preview:', dashboardResponse.data.substring(0, 200));
      } else if (dashboardResponse.status === 200) {
        console.log('✅ Dashboard loaded successfully');
        console.log('   Page title:', dashboardResponse.data.match(/<title>(.*?)<\/title>/)?.[1] || 'No title found');
      } else {
        console.log(`   Unexpected status: ${dashboardResponse.status}`);
      }
    } else {
      console.log('❌ Login failed');
      console.log('   Response body preview:', loginResponse.data.substring(0, 200));
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error.message);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Status Text: ${error.response.statusText}`);
    }
  }
}

// Test both tenants
async function testAllTenants() {
  console.log('='.repeat(60));
  console.log('TESTING DEMO TENANT (demo.lvh.me:3838)');
  console.log('='.repeat(60));
  
  await testTenantLogin();
  
  console.log('\n' + '='.repeat(60));
  console.log('TESTING TEST-CAFE TENANT (test-cafe.lvh.me:3838)');
  console.log('='.repeat(60));
  
  // Test test-cafe tenant
  try {
    const client = axios.create({
      withCredentials: true,
      validateStatus: () => true,
    });
    
    console.log('\n1. Getting login page for test-cafe tenant...');
    const loginPageResponse = await client.get('http://test-cafe.lvh.me:3838/auth/login');
    console.log(`   Status: ${loginPageResponse.status}`);
    
    const cookies = loginPageResponse.headers['set-cookie'] || [];
    const csrfCookie = cookies.find(cookie => cookie.includes('csrf-token='));
    const csrfToken = csrfCookie?.split('csrf-token=')[1].split(';')[0];
    
    if (csrfToken) {
      console.log('\n2. Attempting login...');
      const loginData = new URLSearchParams({
        email: 'cafe@testcafe.local',
        password: 'Test123!@#',
        _csrf: csrfToken,
        redirect: '/dashboard'
      });
      
      const loginResponse = await client.post('http://test-cafe.lvh.me:3838/auth/login', loginData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookies.map(c => c.split(';')[0]).join('; '),
          'X-CSRF-Token': csrfToken
        },
        maxRedirects: 0
      });
      
      console.log(`   Login Status: ${loginResponse.status}`);
      console.log(`   Location Header: ${loginResponse.headers.location || 'None'}`);
      
      if (loginResponse.status === 302) {
        console.log('\n3. Following redirect to dashboard...');
        const newCookies = loginResponse.headers['set-cookie'] || [];
        const allCookies = [...cookies, ...newCookies].map(c => c.split(';')[0]).join('; ');
        
        const dashboardResponse = await client.get(`http://test-cafe.lvh.me:3838${loginResponse.headers.location}`, {
          headers: { 'Cookie': allCookies }
        });
        
        console.log(`   Dashboard Status: ${dashboardResponse.status}`);
        
        if (dashboardResponse.status === 500) {
          console.log('❌ 500 Error accessing dashboard');
        }
      }
    }
  } catch (error) {
    console.error('❌ Error testing test-cafe tenant:', error.message);
  }
}

testAllTenants();