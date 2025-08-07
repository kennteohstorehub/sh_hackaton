#!/usr/bin/env node

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testBackOfficeLogin() {
  console.log('\n🔐 Testing BackOffice Login');
  console.log('─'.repeat(50));
  
  try {
    // Step 1: Get CSRF token
    const loginPageRes = await axios.get('http://admin.lvh.me:3838/backoffice/auth/login', {
      headers: { 'Cookie': '' }
    });
    
    const cookies = loginPageRes.headers['set-cookie'];
    const csrfToken = cookies.find(c => c.includes('csrf-token'))?.split('=')[1]?.split(';')[0];
    const sessionCookie = cookies.find(c => c.includes('qms_session'));
    
    console.log('✅ Got CSRF token and session cookie');
    
    // Step 2: Attempt login
    const loginRes = await axios.post('http://admin.lvh.me:3838/backoffice/auth/login', 
      {
        email: 'backoffice@storehubqms.local',
        password: 'BackOffice123!@#',
        _csrf: csrfToken
      },
      {
        headers: {
          'Cookie': sessionCookie,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 500
      }
    );
    
    console.log(`Login response status: ${loginRes.status}`);
    if (loginRes.status === 302) {
      console.log(`Redirect to: ${loginRes.headers.location}`);
      console.log('✅ Login successful!');
    } else {
      console.log('❌ Login failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testTenantLogin(tenantSlug, email, password) {
  console.log(`\n🔐 Testing ${tenantSlug} Tenant Login`);
  console.log('─'.repeat(50));
  
  try {
    // Step 1: Get CSRF token
    const loginPageRes = await axios.get(`http://${tenantSlug}.lvh.me:3838/auth/login`, {
      headers: { 'Cookie': '' }
    });
    
    const cookies = loginPageRes.headers['set-cookie'];
    const csrfToken = cookies.find(c => c.includes('csrf-token'))?.split('=')[1]?.split(';')[0];
    const sessionCookie = cookies.find(c => c.includes('qms_session'));
    
    console.log('✅ Got CSRF token and session cookie');
    
    // Step 2: Attempt login
    const loginRes = await axios.post(`http://${tenantSlug}.lvh.me:3838/auth/login`, 
      {
        email: email,
        password: password,
        _csrf: csrfToken
      },
      {
        headers: {
          'Cookie': sessionCookie,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 500
      }
    );
    
    console.log(`Login response status: ${loginRes.status}`);
    if (loginRes.status === 302) {
      console.log(`Redirect to: ${loginRes.headers.location}`);
      console.log('✅ Login successful!');
      
      // Try to access dashboard
      const dashboardRes = await axios.get(`http://${tenantSlug}.lvh.me:3838/dashboard`, {
        headers: {
          'Cookie': loginRes.headers['set-cookie']?.join('; ') || sessionCookie
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 500
      });
      
      console.log(`Dashboard access status: ${dashboardRes.status}`);
      if (dashboardRes.status === 200) {
        console.log('✅ Dashboard accessible!');
      } else if (dashboardRes.status === 401) {
        console.log('❌ Dashboard returns 401 - Session issue');
      }
      
    } else {
      console.log('❌ Login failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function verifyTestData() {
  console.log('\n📊 Verifying Test Data');
  console.log('─'.repeat(50));
  
  // Check BackOffice user
  const backOfficeUser = await prisma.backOfficeUser.findUnique({
    where: { email: 'backoffice@storehubqms.local' }
  });
  console.log(`BackOffice User: ${backOfficeUser ? '✅ Exists' : '❌ Not found'}`);
  
  // Check tenants
  const demoTenant = await prisma.tenant.findUnique({
    where: { slug: 'demo' }
  });
  console.log(`Demo Tenant: ${demoTenant ? '✅ Exists' : '❌ Not found'}`);
  
  const testCafeTenant = await prisma.tenant.findUnique({
    where: { slug: 'test-cafe' }
  });
  console.log(`Test Cafe Tenant: ${testCafeTenant ? '✅ Exists' : '❌ Not found'}`);
  
  // Check merchants
  const demoMerchant = await prisma.merchant.findUnique({
    where: { email: 'admin@demo.local' }
  });
  console.log(`Demo Merchant: ${demoMerchant ? '✅ Exists' : '❌ Not found'}`);
  
  const cafeMerchant = await prisma.merchant.findUnique({
    where: { email: 'cafe@testcafe.local' }
  });
  console.log(`Cafe Merchant: ${cafeMerchant ? '✅ Exists' : '❌ Not found'}`);
}

async function main() {
  console.log('🚀 Manual Authentication Test');
  console.log('=====================================');
  
  await verifyTestData();
  
  await testBackOfficeLogin();
  await testTenantLogin('demo', 'admin@demo.local', 'Demo123!@#');
  await testTenantLogin('test-cafe', 'cafe@testcafe.local', 'Test123!@#');
  
  await prisma.$disconnect();
}

main().catch(console.error);