#!/usr/bin/env node

/**
 * Test script to verify authentication redirect loop fixes
 * Tests both SuperAdmin and regular tenant login flows
 */

const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'http://localhost:3838';

// Test configuration
const TEST_CONFIG = {
  // Regular tenant user
  tenant: {
    subdomain: 'testcompany',
    url: `${BASE_URL}`,
    user: {
      email: 'admin@testcompany.com',
      password: 'testpassword123'
    }
  },
  // SuperAdmin user
  superadmin: {
    url: `${BASE_URL}`,
    user: {
      email: 'admin@example.com',
      password: 'superadmin123'
    }
  }
};

class AuthTester {
  constructor() {
    this.results = {
      tenantAuth: { success: false, details: [] },
      superAdminAuth: { success: false, details: [] }
    };
  }

  async log(category, message, isError = false) {
    const timestamp = new Date().toISOString();
    const level = isError ? 'ERROR' : 'INFO';
    console.log(`[${timestamp}] [${level}] [${category}] ${message}`);
    
    if (this.results[category]) {
      this.results[category].details.push({
        timestamp,
        level,
        message
      });
    }
  }

  async extractCSRFToken(html) {
    const $ = cheerio.load(html);
    return $('input[name="_csrf"]').val() || $('meta[name="csrf-token"]').attr('content');
  }

  async testTenantAuthentication() {
    this.log('tenantAuth', 'Starting tenant authentication test...');
    
    try {
      // Create axios instance with cookie jar
      const client = axios.create({
        baseURL: TEST_CONFIG.tenant.url,
        withCredentials: true,
        maxRedirects: 5,
        validateStatus: () => true // Don't throw on any status
      });

      // Step 1: Get login page
      this.log('tenantAuth', 'Step 1: Getting login page...');
      const loginPageResponse = await client.get('/auth/login');
      
      if (loginPageResponse.status !== 200) {
        throw new Error(`Login page returned status ${loginPageResponse.status}`);
      }

      // Extract CSRF token
      const csrfToken = await this.extractCSRFToken(loginPageResponse.data);
      if (!csrfToken) {
        throw new Error('No CSRF token found on login page');
      }
      this.log('tenantAuth', `CSRF token extracted: ${csrfToken.substring(0, 10)}...`);

      // Extract cookies from response
      const cookies = loginPageResponse.headers['set-cookie'];
      if (cookies) {
        client.defaults.headers.Cookie = cookies.join('; ');
      }

      // Step 2: Submit login form
      this.log('tenantAuth', 'Step 2: Submitting login form...');
      const loginData = {
        email: TEST_CONFIG.tenant.user.email,
        password: TEST_CONFIG.tenant.user.password,
        _csrf: csrfToken
      };

      const loginResponse = await client.post('/auth/login', loginData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        maxRedirects: 0 // Don't follow redirects automatically
      });

      this.log('tenantAuth', `Login response status: ${loginResponse.status}`);

      // Step 3: Check if login was successful (should redirect)
      if (loginResponse.status === 302 || loginResponse.status === 301) {
        const redirectUrl = loginResponse.headers.location;
        this.log('tenantAuth', `Login successful, redirecting to: ${redirectUrl}`);

        // Follow the redirect
        const dashboardResponse = await client.get(redirectUrl);
        
        if (dashboardResponse.status === 200) {
          this.log('tenantAuth', 'Successfully accessed dashboard after login');
          
          // Check if we're not in a redirect loop by looking for dashboard content
          if (dashboardResponse.data.includes('dashboard') || dashboardResponse.data.includes('Dashboard')) {
            this.log('tenantAuth', 'Dashboard content confirmed - no redirect loop detected');
            this.results.tenantAuth.success = true;
          } else {
            throw new Error('Dashboard accessed but content looks suspicious');
          }
        } else {
          throw new Error(`Dashboard access failed with status ${dashboardResponse.status}`);
        }
      } else if (loginResponse.status === 200) {
        // Login form returned - likely authentication failed
        if (loginResponse.data.includes('Invalid email or password')) {
          throw new Error('Authentication failed - invalid credentials');
        } else {
          throw new Error('Login form returned unexpectedly');
        }
      } else {
        throw new Error(`Unexpected login response status: ${loginResponse.status}`);
      }

    } catch (error) {
      this.log('tenantAuth', `Test failed: ${error.message}`, true);
      this.results.tenantAuth.success = false;
    }
  }

  async testSuperAdminAuthentication() {
    this.log('superAdminAuth', 'Starting SuperAdmin authentication test...');
    
    try {
      // Create axios instance with cookie jar
      const client = axios.create({
        baseURL: TEST_CONFIG.superadmin.url,
        withCredentials: true,
        maxRedirects: 5,
        validateStatus: () => true // Don't throw on any status
      });

      // Step 1: Get SuperAdmin login page
      this.log('superAdminAuth', 'Step 1: Getting SuperAdmin login page...');
      const loginPageResponse = await client.get('/superadmin/auth/login');
      
      if (loginPageResponse.status !== 200) {
        throw new Error(`SuperAdmin login page returned status ${loginPageResponse.status}`);
      }

      // Extract CSRF token
      const csrfToken = await this.extractCSRFToken(loginPageResponse.data);
      if (!csrfToken) {
        throw new Error('No CSRF token found on SuperAdmin login page');
      }
      this.log('superAdminAuth', `CSRF token extracted: ${csrfToken.substring(0, 10)}...`);

      // Extract cookies from response
      const cookies = loginPageResponse.headers['set-cookie'];
      if (cookies) {
        client.defaults.headers.Cookie = cookies.join('; ');
      }

      // Step 2: Submit SuperAdmin login form
      this.log('superAdminAuth', 'Step 2: Submitting SuperAdmin login form...');
      const loginData = {
        email: TEST_CONFIG.superadmin.user.email,
        password: TEST_CONFIG.superadmin.user.password,
        _csrf: csrfToken
      };

      const loginResponse = await client.post('/superadmin/auth/login', loginData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        maxRedirects: 0 // Don't follow redirects automatically
      });

      this.log('superAdminAuth', `SuperAdmin login response status: ${loginResponse.status}`);

      // Step 3: Check if SuperAdmin login was successful (should redirect)
      if (loginResponse.status === 302 || loginResponse.status === 301) {
        const redirectUrl = loginResponse.headers.location;
        this.log('superAdminAuth', `SuperAdmin login successful, redirecting to: ${redirectUrl}`);

        // Follow the redirect
        const dashboardResponse = await client.get(redirectUrl);
        
        if (dashboardResponse.status === 200) {
          this.log('superAdminAuth', 'Successfully accessed SuperAdmin dashboard after login');
          
          // Check if we're not in a redirect loop by looking for SuperAdmin dashboard content
          if (dashboardResponse.data.includes('superadmin') || dashboardResponse.data.includes('SuperAdmin')) {
            this.log('superAdminAuth', 'SuperAdmin dashboard content confirmed - no redirect loop detected');
            this.results.superAdminAuth.success = true;
          } else {
            throw new Error('SuperAdmin dashboard accessed but content looks suspicious');
          }
        } else {
          throw new Error(`SuperAdmin dashboard access failed with status ${dashboardResponse.status}`);
        }
      } else if (loginResponse.status === 200) {
        // Login form returned - likely authentication failed
        if (loginResponse.data.includes('Invalid email or password')) {
          throw new Error('SuperAdmin authentication failed - invalid credentials');
        } else {
          throw new Error('SuperAdmin login form returned unexpectedly');
        }
      } else {
        throw new Error(`Unexpected SuperAdmin login response status: ${loginResponse.status}`);
      }

    } catch (error) {
      this.log('superAdminAuth', `Test failed: ${error.message}`, true);
      this.results.superAdminAuth.success = false;
    }
  }

  async testRedirectLoopPrevention() {
    console.log('\n=== Testing Redirect Loop Prevention ===');
    
    try {
      // Test that authenticated users accessing login pages get redirected appropriately
      const client = axios.create({
        baseURL: BASE_URL,
        withCredentials: true,
        maxRedirects: 3,
        validateStatus: () => true
      });

      // This test requires manual setup of authenticated sessions
      // For now, we'll just log that this test needs to be run manually
      console.log('Note: Redirect loop prevention test requires authenticated sessions');
      console.log('Manual test: After logging in, try accessing /auth/login - should redirect to dashboard');
      console.log('Manual test: After SuperAdmin login, try accessing /superadmin/auth/login - should redirect to SuperAdmin dashboard');
      
    } catch (error) {
      console.error('Redirect loop test error:', error.message);
    }
  }

  printResults() {
    console.log('\n=== AUTHENTICATION TEST RESULTS ===\n');
    
    // Tenant Authentication Results
    console.log('TENANT AUTHENTICATION:');
    console.log(`Status: ${this.results.tenantAuth.success ? '✅ PASSED' : '❌ FAILED'}`);
    if (this.results.tenantAuth.details.length > 0) {
      console.log('Details:');
      this.results.tenantAuth.details.forEach(detail => {
        console.log(`  ${detail.level === 'ERROR' ? '❌' : 'ℹ️'} ${detail.message}`);
      });
    }
    
    console.log('\nSUPERADMIN AUTHENTICATION:');
    console.log(`Status: ${this.results.superAdminAuth.success ? '✅ PASSED' : '❌ FAILED'}`);
    if (this.results.superAdminAuth.details.length > 0) {
      console.log('Details:');
      this.results.superAdminAuth.details.forEach(detail => {
        console.log(`  ${detail.level === 'ERROR' ? '❌' : 'ℹ️'} ${detail.message}`);
      });
    }

    // Overall Result
    const overallSuccess = this.results.tenantAuth.success && this.results.superAdminAuth.success;
    console.log(`\nOVERALL RESULT: ${overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (overallSuccess) {
      console.log('\n🎉 Authentication redirect loop issue appears to be fixed!');
    } else {
      console.log('\n⚠️  Some authentication issues remain. Check the details above.');
    }
  }
}

async function runTests() {
  console.log('🧪 Starting Authentication Fix Verification Tests...');
  console.log(`Target server: ${BASE_URL}`);
  console.log('='.repeat(60));

  const tester = new AuthTester();

  // Run tests
  await tester.testTenantAuthentication();
  await tester.testSuperAdminAuthentication();
  await tester.testRedirectLoopPrevention();

  // Print results
  tester.printResults();

  // Exit with appropriate code
  const success = tester.results.tenantAuth.success && tester.results.superAdminAuth.success;
  process.exit(success ? 0 : 1);
}

// Handle script execution
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { AuthTester, runTests };