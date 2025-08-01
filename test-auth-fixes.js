#!/usr/bin/env node

/**
 * Test script to verify authentication fixes
 * Tests:
 * 1. Login page is accessible
 * 2. Login works without CSRF errors
 * 3. Session persists after login
 * 4. Protected pages are accessible after login
 * 5. Logout works properly
 */

const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

// Create axios instance with cookie support
const jar = new CookieJar();
const client = wrapper(axios.create({ 
  jar,
  baseURL: 'http://localhost:3838',
  validateStatus: () => true, // Don't throw on any status
  maxRedirects: 0, // Don't follow redirects automatically
  withCredentials: true // Important for session cookies
}));

// Test credentials
const TEST_EMAIL = 'admin@storehub.com';
const TEST_PASSWORD = 'password123';

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const color = type === 'success' ? colors.green : 
                type === 'error' ? colors.red : 
                type === 'warning' ? colors.yellow : colors.blue;
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

async function extractCSRFToken(html) {
  const match = html.match(/name="_csrf"\s+value="([^"]+)"/);
  return match ? match[1] : null;
}

async function testAuth() {
  log('Starting authentication tests...', 'info');
  
  try {
    // Test 1: Check if login page is accessible
    log('\nTest 1: Checking if login page is accessible...', 'info');
    const loginPageResponse = await client.get('/auth/login');
    
    if (loginPageResponse.status === 200) {
      log('✓ Login page is accessible', 'success');
      
      // Extract CSRF token
      const csrfToken = await extractCSRFToken(loginPageResponse.data);
      if (csrfToken) {
        log(`✓ CSRF token found: ${csrfToken.substring(0, 10)}...`, 'success');
      } else {
        log('✗ CSRF token not found in login page', 'error');
        return;
      }
      
      // Test 2: Attempt login
      log('\nTest 2: Testing login functionality...', 'info');
      const loginResponse = await client.post('/auth/login', {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        _csrf: csrfToken
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      if (loginResponse.status === 302 || loginResponse.status === 303) {
        const redirectLocation = loginResponse.headers.location;
        log(`✓ Login successful, redirecting to: ${redirectLocation}`, 'success');
        
        // Test 3: Check if we can access dashboard
        log('\nTest 3: Testing dashboard access after login...', 'info');
        const dashboardResponse = await client.get('/dashboard');
        
        if (dashboardResponse.status === 200) {
          log('✓ Dashboard accessible after login', 'success');
          
          // Check if user data is present
          if (dashboardResponse.data.includes('StoreHub Restaurant')) {
            log('✓ User data loaded correctly', 'success');
          }
          
          // Test 4: Test logout
          log('\nTest 4: Testing logout functionality...', 'info');
          
          // Get logout page to get new CSRF token
          const logoutCsrfToken = await extractCSRFToken(dashboardResponse.data);
          if (!logoutCsrfToken) {
            log('✗ Could not find CSRF token for logout', 'error');
            return;
          }
          
          const logoutResponse = await client.post('/auth/logout', {
            _csrf: logoutCsrfToken
          }, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });
          
          if (logoutResponse.status === 302 || logoutResponse.status === 303) {
            log('✓ Logout successful', 'success');
            
            // Test 5: Verify dashboard is no longer accessible
            log('\nTest 5: Verifying dashboard is protected after logout...', 'info');
            const protectedResponse = await client.get('/dashboard');
            
            if (protectedResponse.status === 302 && protectedResponse.headers.location?.includes('/auth/login')) {
              log('✓ Dashboard correctly redirects to login after logout', 'success');
            } else {
              log('✗ Dashboard still accessible after logout', 'error');
            }
          } else {
            log(`✗ Logout failed with status: ${logoutResponse.status}`, 'error');
          }
        } else if (dashboardResponse.status === 302) {
          log(`✗ Dashboard redirected to: ${dashboardResponse.headers.location}`, 'error');
          log('This might indicate a session persistence issue', 'warning');
        } else {
          log(`✗ Dashboard returned status: ${dashboardResponse.status}`, 'error');
        }
      } else if (loginResponse.status === 200) {
        // Check if we're back at login page with error
        if (loginResponse.data.includes('Invalid email or password')) {
          log('✗ Login failed: Invalid credentials', 'error');
          log('Make sure the test user exists in the database', 'warning');
        } else if (loginResponse.data.includes('Invalid CSRF token')) {
          log('✗ Login failed: CSRF token validation error', 'error');
        } else {
          log('✗ Login failed: Returned to login page', 'error');
        }
      } else {
        log(`✗ Login failed with status: ${loginResponse.status}`, 'error');
      }
    } else if (loginPageResponse.status === 302) {
      log(`✗ Login page redirected to: ${loginPageResponse.headers.location}`, 'error');
      log('This indicates a redirect loop issue', 'warning');
    } else {
      log(`✗ Login page returned status: ${loginPageResponse.status}`, 'error');
    }
    
    log('\n=== Authentication Test Summary ===', 'info');
    log('All critical authentication issues should be fixed:', 'info');
    log('1. No redirect loops', 'info');
    log('2. CSRF tokens preserved during session regeneration', 'info');
    log('3. Session persistence after login', 'info');
    log('4. Proper auth bypass logic (explicit opt-in only)', 'info');
    
  } catch (error) {
    log(`\n✗ Test failed with error: ${error.message}`, 'error');
    if (error.response) {
      log(`Response status: ${error.response.status}`, 'error');
      log(`Response headers: ${JSON.stringify(error.response.headers)}`, 'error');
    }
  }
}

// Run the test
testAuth().catch(console.error);