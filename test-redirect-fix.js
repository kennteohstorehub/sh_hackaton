#!/usr/bin/env node

const axios = require('axios');

async function testRedirectFix() {
  console.log('🔍 Testing Authentication Redirect Fix...');
  
  try {
    // Test 1: Check if accessing a merchant subdomain shows login page
    console.log('\n1. Testing merchant subdomain access...');
    const response1 = await axios.get('http://demo.lvh.me:3838', {
      maxRedirects: 5,
      validateStatus: () => true
    });
    
    console.log(`Status: ${response1.status}`);
    console.log(`Final URL: ${response1.request.res.responseUrl || response1.config.url}`);
    
    if (response1.request.res.responseUrl && response1.request.res.responseUrl.includes('/auth/login')) {
      console.log('✅ Correctly redirected to merchant login page');
    } else {
      console.log('❌ Not redirected to login page');
    }
    
    // Test 2: Check if the /dashboard route exists now (without authentication)
    console.log('\n2. Testing dashboard route accessibility...');
    const response2 = await axios.get('http://demo.lvh.me:3838/dashboard', {
      maxRedirects: 5,
      validateStatus: () => true
    });
    
    console.log(`Status: ${response2.status}`);
    console.log(`Final URL: ${response2.request.res.responseUrl || response2.config.url}`);
    
    if (response2.request.res.responseUrl && response2.request.res.responseUrl.includes('/auth/login')) {
      console.log('✅ Dashboard route exists and redirects to login (correct behavior)');
    } else if (response2.status === 404) {
      console.log('❌ Dashboard route not found - may need additional setup');
    } else {
      console.log('⚠️  Unexpected behavior on dashboard route');
    }
    
    // Test 3: Check admin subdomain still works
    console.log('\n3. Testing admin subdomain access...');
    const response3 = await axios.get('http://admin.lvh.me:3838', {
      maxRedirects: 5,
      validateStatus: () => true
    });
    
    console.log(`Status: ${response3.status}`);
    console.log(`Final URL: ${response3.request.res.responseUrl || response3.config.url}`);
    
    if (response3.request.res.responseUrl && response3.request.res.responseUrl.includes('/backoffice')) {
      console.log('✅ Admin subdomain correctly redirects to backoffice');
    } else {
      console.log('❌ Admin subdomain not working properly');
    }
    
    console.log('\n🎯 Summary:');
    console.log('- Fixed requireGuest middleware to redirect merchants to /dashboard instead of /backoffice/dashboard');
    console.log('- Removed problematic /dashboard* -> /backoffice/dashboard redirect rule');
    console.log('- Added proper merchant dashboard route with authentication');
    console.log('- Admin subdomain should still work for backoffice access');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testRedirectFix();