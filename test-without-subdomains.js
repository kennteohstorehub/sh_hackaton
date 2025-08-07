#!/usr/bin/env node

/**
 * Test authentication without requiring subdomain setup
 * This script simulates subdomain access using Host headers
 */

const axios = require('axios');

async function testAuth(name, host, loginPath, email, password) {
  console.log(`\n🧪 Testing ${name}`);
  console.log('─'.repeat(50));
  
  try {
    // Create axios instance that simulates subdomain access
    const client = axios.create({
      baseURL: 'http://localhost:3838',
      headers: { 'Host': host },
      maxRedirects: 0,
      validateStatus: status => status < 500
    });
    
    // Get login page
    console.log('1. Getting login page...');
    const loginPage = await client.get(loginPath);
    console.log(`   Status: ${loginPage.status}`);
    
    const cookies = loginPage.headers['set-cookie'] || [];
    const cookieString = cookies.map(c => c.split(';')[0]).join('; ');
    const csrfToken = cookies.find(c => c.includes('csrf-token'))?.split('=')[1]?.split(';')[0];
    
    if (!csrfToken) {
      console.log('   ❌ No CSRF token found');
      return;
    }
    
    console.log(`   ✅ Got CSRF token: ${csrfToken.substring(0, 10)}...`);
    
    // Attempt login
    console.log(`2. Logging in as ${email}...`);
    const formData = new URLSearchParams({
      email: email,
      password: password,
      _csrf: csrfToken
    });
    
    const loginRes = await client.post(loginPath, formData, {
      headers: {
        'Cookie': cookieString,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log(`   Status: ${loginRes.status}`);
    if (loginRes.status === 302) {
      console.log(`   ✅ Login successful! Redirects to: ${loginRes.headers.location}`);
    } else {
      console.log('   ❌ Login failed');
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Testing Multi-Tenant Authentication');
  console.log('=====================================');
  console.log('Note: This test simulates subdomain access without DNS setup');
  
  // Start server reminder
  console.log('\nMake sure server is running with: ./quick-start.sh\n');
  
  // Test each environment
  await testAuth(
    'BackOffice',
    'admin.lvh.me',
    '/backoffice/auth/login',
    'backoffice@storehubqms.local',
    'BackOffice123!@#'
  );
  
  await testAuth(
    'Demo Tenant',
    'demo.lvh.me',
    '/auth/login',
    'admin@demo.local',
    'Demo123!@#'
  );
  
  await testAuth(
    'Test Cafe',
    'test-cafe.lvh.me',
    '/auth/login',
    'cafe@testcafe.local',
    'Test123!@#'
  );
  
  console.log('\n✅ Tests complete!');
  console.log('\nTo access via browser, you still need to add hosts entries.');
  console.log('See LOCAL_SUBDOMAIN_SETUP.md for instructions.');
}

main().catch(console.error);