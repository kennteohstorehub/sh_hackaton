#!/usr/bin/env node

const axios = require('axios');
const FormData = require('form-data');

async function testCompleteFlow(scenario) {
  console.log(`\n🧪 Testing ${scenario.name}`);
  console.log('─'.repeat(60));
  
  const axiosInstance = axios.create({
    baseURL: 'http://localhost:3000',
    withCredentials: true,
    maxRedirects: 0,
    validateStatus: (status) => true,
    timeout: 10000
  });
  
  let cookies = '';
  
  try {
    // Step 1: Get login page
    console.log(`1. Getting login page at ${scenario.loginPath}...`);
    const loginPageRes = await axiosInstance.get(scenario.loginPath, {
      headers: { 'Host': scenario.host }
    });
    
    if (loginPageRes.status !== 200) {
      console.log(`   ❌ Login page returned ${loginPageRes.status}`);
      return;
    }
    
    const setCookies = loginPageRes.headers['set-cookie'] || [];
    cookies = setCookies.map(c => c.split(';')[0]).join('; ');
    const csrfToken = setCookies.find(c => c.includes('csrf-token'))?.split('=')[1]?.split(';')[0];
    
    console.log(`   ✅ Login page loaded`);
    console.log(`   CSRF token: ${csrfToken?.substring(0, 10)}...`);
    
    // Step 2: Login
    console.log(`2. Logging in as ${scenario.email}...`);
    const formData = new URLSearchParams();
    formData.append('email', scenario.email);
    formData.append('password', scenario.password);
    formData.append('_csrf', csrfToken);
    
    const loginRes = await axiosInstance.post(scenario.loginPath, formData, {
      headers: {
        'Host': scenario.host,
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log(`   Login response: ${loginRes.status}`);
    
    if (loginRes.status === 302) {
      console.log(`   ✅ Login successful! Redirecting to: ${loginRes.headers.location}`);
      
      // Update cookies
      if (loginRes.headers['set-cookie']) {
        const newCookies = loginRes.headers['set-cookie'];
        cookies = newCookies.map(c => c.split(';')[0]).join('; ');
      }
      
      // Step 3: Access dashboard
      console.log(`3. Accessing dashboard at ${scenario.dashboardPath}...`);
      const dashboardRes = await axiosInstance.get(scenario.dashboardPath, {
        headers: {
          'Host': scenario.host,
          'Cookie': cookies
        }
      });
      
      console.log(`   Dashboard response: ${dashboardRes.status}`);
      
      if (dashboardRes.status === 200) {
        console.log('   ✅ Dashboard loaded successfully!');
        
        // Check for key elements
        const html = dashboardRes.data;
        const hasTitle = html.includes('Dashboard');
        const hasStats = html.includes('stats') || html.includes('Customers Waiting');
        const hasQueue = html.includes('queue') || html.includes('Queue');
        
        console.log(`   Dashboard content: Title=${hasTitle}, Stats=${hasStats}, Queue=${hasQueue}`);
        
        // Test logout
        console.log(`4. Testing logout...`);
        const logoutRes = await axiosInstance.get(`${scenario.logoutPath}?_csrf=${csrfToken}`, {
          headers: {
            'Host': scenario.host,
            'Cookie': cookies
          }
        });
        
        if (logoutRes.status === 302) {
          console.log('   ✅ Logout successful!');
        }
        
      } else if (dashboardRes.status === 500) {
        console.log('   ❌ Dashboard returned 500 error');
        // Extract error message
        const errorMatch = dashboardRes.data.match(/<pre[^>]*>([^<]+)<\/pre>/);
        if (errorMatch) {
          console.log(`   Error: ${errorMatch[1].substring(0, 100)}...`);
        }
      } else if (dashboardRes.status === 302 || dashboardRes.status === 401) {
        console.log('   ❌ Dashboard access denied - authentication issue');
      }
      
    } else if (loginRes.status === 403) {
      console.log('   ❌ Login failed - Invalid credentials');
    } else {
      console.log(`   ❌ Unexpected login response`);
    }
    
  } catch (error) {
    console.error(`   ❌ Test failed: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Final Authentication & Dashboard Test');
  console.log('=====================================');
  
  const scenarios = [
    {
      name: 'BackOffice Login',
      host: 'admin.lvh.me',
      loginPath: '/backoffice/auth/login',
      dashboardPath: '/backoffice/dashboard',
      logoutPath: '/backoffice/auth/logout',
      email: 'backoffice@storehubqms.local',
      password: 'BackOffice123!@#'
    },
    {
      name: 'Demo Tenant Login',
      host: 'demo.lvh.me',
      loginPath: '/auth/login',
      dashboardPath: '/dashboard',
      logoutPath: '/auth/logout',
      email: 'admin@demo.local',
      password: 'Demo123!@#'
    },
    {
      name: 'Test Cafe Login',
      host: 'test-cafe.lvh.me',
      loginPath: '/auth/login',
      dashboardPath: '/dashboard',
      logoutPath: '/auth/logout',
      email: 'cafe@testcafe.local',
      password: 'Test123!@#'
    }
  ];
  
  for (const scenario of scenarios) {
    await testCompleteFlow(scenario);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ All tests completed!');
}

main().catch(console.error);