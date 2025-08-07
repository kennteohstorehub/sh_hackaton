#!/usr/bin/env node

/**
 * Test BackOffice Login End-to-End
 * Tests the complete login flow including CSRF protection
 */

const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'http://admin.lvh.me:3838';
const CREDENTIALS = {
  email: 'backoffice@storehubqms.local',
  password: 'BackOffice123!@#'
};

async function testBackOfficeLogin() {
  try {
    console.log('🧪 Testing BackOffice Login End-to-End...\n');
    
    // Step 1: Get login page and extract CSRF token
    console.log('1. Getting login page...');
    const loginPageResponse = await axios.get(`${BASE_URL}/backoffice/auth/login`, {
      maxRedirects: 0,
      validateStatus: () => true
    });
    
    if (loginPageResponse.status !== 200) {
      throw new Error(`Failed to get login page: ${loginPageResponse.status}`);
    }
    
    console.log('✅ Login page loaded successfully');
    
    // Extract CSRF token from HTML
    const $ = cheerio.load(loginPageResponse.data);
    const csrfToken = $('input[name="_csrf"]').val();
    
    if (!csrfToken) {
      throw new Error('CSRF token not found in login page');
    }
    
    console.log(`✅ CSRF token extracted: ${csrfToken.substring(0, 16)}...`);
    
    // Extract session cookie
    const sessionCookie = loginPageResponse.headers['set-cookie']
      ?.find(cookie => cookie.startsWith('qms_session='));
    
    if (!sessionCookie) {
      throw new Error('Session cookie not found');
    }
    
    console.log('✅ Session cookie extracted');
    
    // Step 2: Submit login form
    console.log('\n2. Submitting login form...');
    const loginResponse = await axios.post(`${BASE_URL}/backoffice/auth/login`, 
      new URLSearchParams({
        email: CREDENTIALS.email,
        password: CREDENTIALS.password,
        _csrf: csrfToken
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': sessionCookie
        },
        maxRedirects: 0,
        validateStatus: () => true
      }
    );
    
    console.log(`Login response status: ${loginResponse.status}`);
    
    if (loginResponse.status === 302) {
      const redirectLocation = loginResponse.headers.location;
      console.log(`✅ Login successful! Redirecting to: ${redirectLocation}`);
      
      // Step 3: Follow redirect to dashboard
      console.log('\n3. Following redirect to dashboard...');
      const allCookies = loginResponse.headers['set-cookie']
        ?.map(cookie => cookie.split(';')[0])
        .join('; ') || sessionCookie.split(';')[0];
      
      const dashboardResponse = await axios.get(`${BASE_URL}${redirectLocation}`, {
        headers: {
          'Cookie': allCookies
        },
        validateStatus: () => true
      });
      
      if (dashboardResponse.status === 200) {
        console.log('✅ Dashboard loaded successfully');
        
        // Check if we're actually logged in
        const dashboardHtml = dashboardResponse.data;
        if (dashboardHtml.includes('BackOffice') || dashboardHtml.includes('Dashboard')) {
          console.log('✅ Login verification: User is authenticated and can access dashboard');
          return { success: true, message: 'Login test completed successfully' };
        } else {
          console.log('❌ Dashboard loaded but user may not be properly authenticated');
          return { success: false, message: 'Authentication verification failed' };
        }
      } else {
        console.log(`❌ Dashboard failed to load: ${dashboardResponse.status}`);
        return { success: false, message: `Dashboard load failed: ${dashboardResponse.status}` };
      }
    } else if (loginResponse.status === 400) {
      console.log('❌ Login failed with validation error');
      console.log('Response:', loginResponse.data);
      return { success: false, message: 'Login validation failed', details: loginResponse.data };
    } else if (loginResponse.status === 403) {
      console.log('❌ Login failed with CSRF error');
      return { success: false, message: 'CSRF validation failed' };
    } else {
      console.log(`❌ Login failed with unexpected status: ${loginResponse.status}`);
      console.log('Response:', loginResponse.data.substring(0, 200));
      return { success: false, message: `Unexpected status: ${loginResponse.status}` };
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return { success: false, message: error.message };
  }
}

// Run the test
if (require.main === module) {
  testBackOfficeLogin()
    .then(result => {
      console.log('\n📊 Test Results:');
      console.log('================');
      console.log(`Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`Message: ${result.message}`);
      if (result.details) {
        console.log('Details:', JSON.stringify(result.details, null, 2));
      }
      
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { testBackOfficeLogin };