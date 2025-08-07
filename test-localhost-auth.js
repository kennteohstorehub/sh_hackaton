#!/usr/bin/env node

const axios = require('axios');

async function testLocalAuth() {
  console.log('🧪 Testing Authentication via localhost:3838');
  console.log('─'.repeat(50));
  
  try {
    // Test if server is running
    const healthRes = await axios.get('http://localhost:3838/api/health');
    console.log('✅ Server is running:', healthRes.data);
    
    // Test BackOffice login page
    console.log('\n1. Testing BackOffice login page...');
    const backofficeLogin = await axios.get('http://localhost:3838/backoffice/auth/login', {
      headers: { 'Host': 'admin.lvh.me' }
    });
    console.log('   BackOffice login page status:', backofficeLogin.status);
    
    // Test tenant login page with demo host header
    console.log('\n2. Testing tenant login page...');
    const tenantLogin = await axios.get('http://localhost:3838/auth/login', {
      headers: { 'Host': 'demo.lvh.me' }
    });
    console.log('   Tenant login page status:', tenantLogin.status);
    
    // Test actual login
    console.log('\n3. Testing demo tenant login...');
    const loginPageRes = await axios.get('http://localhost:3838/auth/login', {
      headers: { 'Host': 'demo.lvh.me' }
    });
    
    const cookies = loginPageRes.headers['set-cookie'] || [];
    const csrfToken = cookies.find(c => c.includes('csrf-token'))?.split('=')[1]?.split(';')[0];
    const sessionCookie = cookies.map(c => c.split(';')[0]).join('; ');
    
    console.log('   Got CSRF token:', csrfToken?.substring(0, 10) + '...');
    
    // Attempt login
    const formData = new URLSearchParams();
    formData.append('email', 'admin@demo.local');
    formData.append('password', 'Demo123!@#');
    formData.append('_csrf', csrfToken);
    
    const loginRes = await axios.post('http://localhost:3838/auth/login', formData, {
      headers: {
        'Host': 'demo.lvh.me',
        'Cookie': sessionCookie,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      maxRedirects: 0,
      validateStatus: (status) => status < 500
    });
    
    console.log('   Login response status:', loginRes.status);
    if (loginRes.status === 302) {
      console.log('   ✅ Login successful! Redirect to:', loginRes.headers.location);
      
      // Try to access dashboard
      const newCookies = loginRes.headers['set-cookie'] || [];
      const allCookies = newCookies.map(c => c.split(';')[0]).join('; ');
      
      console.log('\n4. Testing dashboard access...');
      const dashboardRes = await axios.get('http://localhost:3838/dashboard', {
        headers: {
          'Host': 'demo.lvh.me',
          'Cookie': allCookies
        },
        maxRedirects: 0,
        validateStatus: (status) => true
      });
      
      console.log('   Dashboard response status:', dashboardRes.status);
      if (dashboardRes.status === 200) {
        console.log('   ✅ Dashboard loaded successfully!');
      } else if (dashboardRes.status === 500) {
        console.log('   ❌ Dashboard returned 500 error');
        console.log('   Error snippet:', dashboardRes.data.substring(0, 200));
      }
    } else {
      console.log('   ❌ Login failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data?.substring(0, 200));
    }
  }
}

testLocalAuth();