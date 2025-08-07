#!/usr/bin/env node

const axios = require('axios');

async function testTenantLogin(subdomain, email, password) {
  console.log(`\n🧪 Testing ${subdomain} login and dashboard access`);
  console.log('─'.repeat(60));
  
  const baseUrl = `http://${subdomain}.lvh.me:3838`;
  const axiosInstance = axios.create({
    baseURL: baseUrl,
    withCredentials: true,
    maxRedirects: 0,
    validateStatus: (status) => status < 500,
    timeout: 10000
  });
  
  let cookies = '';
  
  try {
    // Step 1: Get login page
    console.log('1. Getting login page...');
    const loginPageRes = await axiosInstance.get('/auth/login');
    
    const setCookies = loginPageRes.headers['set-cookie'] || [];
    cookies = setCookies.map(c => c.split(';')[0]).join('; ');
    const csrfToken = setCookies.find(c => c.includes('csrf-token'))?.split('=')[1]?.split(';')[0];
    
    console.log(`   ✅ Got CSRF token: ${csrfToken?.substring(0, 10)}...`);
    
    // Step 2: Login
    console.log(`2. Logging in with ${email}...`);
    const formData = new URLSearchParams();
    formData.append('email', email);
    formData.append('password', password);
    formData.append('_csrf', csrfToken);
    
    const loginRes = await axiosInstance.post('/auth/login', formData, {
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (loginRes.status === 302) {
      console.log(`   ✅ Login successful! Redirecting to: ${loginRes.headers.location}`);
      
      // Update cookies
      if (loginRes.headers['set-cookie']) {
        const newCookies = loginRes.headers['set-cookie'];
        cookies = newCookies.map(c => c.split(';')[0]).join('; ');
      }
      
      // Step 3: Access dashboard
      console.log('3. Accessing dashboard...');
      const dashboardRes = await axiosInstance.get('/dashboard', {
        headers: { 'Cookie': cookies }
      });
      
      console.log(`   Dashboard status: ${dashboardRes.status}`);
      
      if (dashboardRes.status === 200) {
        console.log('   ✅ Dashboard loaded successfully!');
        
        // Check for key elements
        const html = dashboardRes.data;
        const hasTitle = html.includes('Dashboard');
        const hasQueue = html.includes('queue') || html.includes('Queue');
        const hasLogout = html.includes('logout') || html.includes('Logout');
        
        console.log(`   Dashboard elements: Title=${hasTitle}, Queue=${hasQueue}, Logout=${hasLogout}`);
      } else if (dashboardRes.status === 302 || dashboardRes.status === 401) {
        console.log('   ❌ Dashboard access denied - session issue');
      }
      
    } else {
      console.log(`   ❌ Login failed with status: ${loginRes.status}`);
    }
    
  } catch (error) {
    if (error.response?.status === 500) {
      console.log(`   ❌ Dashboard returned 500 error`);
      console.log(`   Error: ${error.response.data.substring(0, 200)}...`);
    } else {
      console.log(`   ❌ Test failed: ${error.message}`);
    }
  }
}

async function testBackOfficeLogin() {
  console.log(`\n🧪 Testing BackOffice login and dashboard access`);
  console.log('─'.repeat(60));
  
  const baseUrl = 'http://admin.lvh.me:3838';
  const axiosInstance = axios.create({
    baseURL: baseUrl,
    withCredentials: true,
    maxRedirects: 0,
    validateStatus: (status) => status < 500,
    timeout: 10000
  });
  
  let cookies = '';
  
  try {
    // Step 1: Get login page
    console.log('1. Getting BackOffice login page...');
    const loginPageRes = await axiosInstance.get('/backoffice/auth/login');
    
    const setCookies = loginPageRes.headers['set-cookie'] || [];
    cookies = setCookies.map(c => c.split(';')[0]).join('; ');
    const csrfToken = setCookies.find(c => c.includes('csrf-token'))?.split('=')[1]?.split(';')[0];
    
    console.log(`   ✅ Got CSRF token: ${csrfToken?.substring(0, 10)}...`);
    
    // Step 2: Login
    console.log('2. Logging in as BackOffice...');
    const formData = new URLSearchParams();
    formData.append('email', 'backoffice@storehubqms.local');
    formData.append('password', 'BackOffice123!@#');
    formData.append('_csrf', csrfToken);
    
    const loginRes = await axiosInstance.post('/backoffice/auth/login', formData, {
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (loginRes.status === 302) {
      console.log(`   ✅ Login successful! Redirecting to: ${loginRes.headers.location}`);
      
      // Update cookies
      if (loginRes.headers['set-cookie']) {
        const newCookies = loginRes.headers['set-cookie'];
        cookies = newCookies.map(c => c.split(';')[0]).join('; ');
      }
      
      // Step 3: Access dashboard
      console.log('3. Accessing BackOffice dashboard...');
      const dashboardRes = await axiosInstance.get('/backoffice/dashboard', {
        headers: { 'Cookie': cookies }
      });
      
      console.log(`   Dashboard status: ${dashboardRes.status}`);
      
      if (dashboardRes.status === 200) {
        console.log('   ✅ BackOffice dashboard loaded successfully!');
      }
      
    } else {
      console.log(`   ❌ Login failed with status: ${loginRes.status}`);
    }
    
  } catch (error) {
    if (error.response?.status === 500) {
      console.log(`   ❌ Dashboard returned 500 error`);
    } else {
      console.log(`   ❌ Test failed: ${error.message}`);
    }
  }
}

async function main() {
  console.log('🚀 Final Authentication & Dashboard Test');
  console.log('=====================================');
  
  await testBackOfficeLogin();
  await testTenantLogin('demo', 'admin@demo.local', 'Demo123!@#');
  await testTenantLogin('test-cafe', 'cafe@testcafe.local', 'Test123!@#');
  
  console.log('\n✅ Test complete!');
}

main().catch(console.error);