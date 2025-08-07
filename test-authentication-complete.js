#!/usr/bin/env node

const axios = require('axios');
const { JSDOM } = require('jsdom');

// Configuration
const BASE_URL = 'http://localhost:3838';
const TEST_EMAIL = 'downtown@delicious.com';
const TEST_PASSWORD = 'testpassword123';

class AuthenticationTester {
  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      validateStatus: () => true, // Don't throw on HTTP errors
      withCredentials: true
    });
    this.sessionCookies = [];
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  error(message, error = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ ${message}`);
    if (error) {
      console.error(error.message);
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Headers:`, error.response.headers);
        if (error.response.data) {
          console.error(`Data:`, typeof error.response.data === 'string' ? 
            error.response.data.substring(0, 500) : error.response.data);
        }
      }
    }
  }

  success(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ✅ ${message}`);
  }

  updateCookies(response) {
    const setCookieHeader = response.headers['set-cookie'];
    if (setCookieHeader) {
      setCookieHeader.forEach(cookie => {
        const cookieName = cookie.split('=')[0];
        // Remove existing cookie with same name
        this.sessionCookies = this.sessionCookies.filter(c => !c.startsWith(cookieName + '='));
        // Add new cookie
        this.sessionCookies.push(cookie.split(';')[0]);
      });
      
      // Update axios default headers
      this.client.defaults.headers.Cookie = this.sessionCookies.join('; ');
    }
  }

  async makeRequest(method, url, data = null, options = {}) {
    try {
      const response = await this.client({
        method,
        url,
        data,
        ...options
      });

      this.updateCookies(response);
      return response;
    } catch (error) {
      this.error(`Request failed: ${method} ${url}`, error);
      throw error;
    }
  }

  extractCSRFToken(html) {
    const dom = new JSDOM(html);
    const csrfInput = dom.window.document.querySelector('input[name="_csrf"]');
    const csrfMeta = dom.window.document.querySelector('meta[name="csrf-token"]');
    
    return csrfInput?.value || csrfMeta?.getAttribute('content') || null;
  }

  async testServerHealth() {
    this.log('🔍 Testing server health...');
    
    try {
      const response = await this.makeRequest('GET', '/');
      
      if (response.status === 200 || response.status === 302) {
        this.success('Server is responding');
        
        if (response.status === 302) {
          this.log(`Redirected to: ${response.headers.location}`);
        }
        
        return true;
      } else {
        this.error(`Server returned status: ${response.status}`);
        return false;
      }
    } catch (error) {
      this.error('Server health check failed', error);
      return false;
    }
  }

  async testLoginPageAccess() {
    this.log('🔍 Testing login page access...');
    
    try {
      const response = await this.makeRequest('GET', '/auth/login');
      
      if (response.status === 200) {
        this.success('Login page accessible');
        
        // Extract CSRF token
        const csrfToken = this.extractCSRFToken(response.data);
        if (csrfToken) {
          this.success(`CSRF token found: ${csrfToken.substring(0, 20)}...`);
          return { success: true, csrfToken };
        } else {
          this.error('CSRF token not found in login page');
          return { success: false, csrfToken: null };
        }
      } else {
        this.error(`Login page returned status: ${response.status}`);
        return { success: false, csrfToken: null };
      }
    } catch (error) {
      this.error('Login page access failed', error);
      return { success: false, csrfToken: null };
    }
  }

  async testLoginSubmission(csrfToken) {
    this.log('🔍 Testing login submission...');
    
    try {
      const loginData = {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        _csrf: csrfToken
      };

      const response = await this.makeRequest('POST', '/auth/login', loginData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.log(`Login response status: ${response.status}`);
      this.log(`Login response headers:`, response.headers);

      if (response.status === 302) {
        const redirectLocation = response.headers.location;
        this.success(`Login successful - Redirected to: ${redirectLocation}`);
        
        // Check if we got session cookies
        if (this.sessionCookies.length > 0) {
          this.success(`Session cookies set: ${this.sessionCookies.join('; ')}`);
        } else {
          this.error('No session cookies received after login');
        }
        
        return { success: true, redirectLocation };
      } else if (response.status === 200) {
        // Check if there are error messages in the response
        if (response.data.includes('Invalid') || response.data.includes('error')) {
          this.error('Login failed - Invalid credentials or other error');
          return { success: false, redirectLocation: null };
        } else {
          this.error('Login returned 200 instead of redirect - unexpected');
          return { success: false, redirectLocation: null };
        }
      } else {
        this.error(`Login failed with status: ${response.status}`);
        if (response.data) {
          this.log('Response data:', typeof response.data === 'string' ? 
            response.data.substring(0, 1000) : response.data);
        }
        return { success: false, redirectLocation: null };
      }
    } catch (error) {
      this.error('Login submission failed', error);
      return { success: false, redirectLocation: null };
    }
  }

  async testDashboardAccess() {
    this.log('🔍 Testing dashboard access after login...');
    
    try {
      const response = await this.makeRequest('GET', '/dashboard', null, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      
      this.log(`Dashboard response status: ${response.status}`);
      
      if (response.status === 200) {
        this.success('Dashboard accessible after login');
        
        // Check if the response contains expected dashboard content
        if (response.data.includes('Dashboard') || 
            response.data.includes('merchant') || 
            response.data.includes('queue')) {
          this.success('Dashboard contains expected content');
          return { success: true, hasContent: true };
        } else {
          this.error('Dashboard does not contain expected content');
          this.log('Dashboard content preview:', response.data.substring(0, 500));
          return { success: true, hasContent: false };
        }
      } else if (response.status === 302) {
        const redirectLocation = response.headers.location;
        this.error(`Dashboard access redirected to: ${redirectLocation} - Authentication may have failed`);
        return { success: false, hasContent: false };
      } else if (response.status === 500) {
        this.error('Dashboard returned 500 error - Server error');
        this.log('Error response preview:', response.data.substring(0, 1000));
        return { success: false, hasContent: false };
      } else {
        this.error(`Dashboard returned unexpected status: ${response.status}`);
        return { success: false, hasContent: false };
      }
    } catch (error) {
      this.error('Dashboard access failed', error);
      return { success: false, hasContent: false };
    }
  }

  async testSessionPersistence() {
    this.log('🔍 Testing session persistence...');
    
    try {
      // Make multiple requests to see if session persists
      const requests = [
        this.makeRequest('GET', '/dashboard'),
        this.makeRequest('GET', '/'),
        this.makeRequest('GET', '/dashboard')
      ];

      const responses = await Promise.all(requests);
      
      let persistenceScore = 0;
      responses.forEach((response, index) => {
        if (response.status === 200 || (response.status === 302 && response.headers.location === '/dashboard')) {
          persistenceScore++;
        }
        this.log(`Request ${index + 1}: Status ${response.status}, Location: ${response.headers.location || 'none'}`);
      });

      if (persistenceScore === 3) {
        this.success('Session persistence test passed');
        return true;
      } else {
        this.error(`Session persistence test failed - ${persistenceScore}/3 requests successful`);
        return false;
      }
    } catch (error) {
      this.error('Session persistence test failed', error);
      return false;
    }
  }

  async testUserDataLoading() {
    this.log('🔍 Testing user data loading in middleware...');
    
    try {
      const response = await this.makeRequest('GET', '/dashboard');
      
      if (response.status === 200) {
        // Check if user data is present in the rendered HTML
        const userData = response.data;
        
        const hasUserData = userData.includes('merchant') || 
                            userData.includes('businessName') ||
                            userData.includes('user') ||
                            userData.includes(TEST_EMAIL);

        if (hasUserData) {
          this.success('User data appears to be loaded in templates');
          return true;
        } else {
          this.error('User data not found in dashboard template');
          return false;
        }
      } else {
        this.error('Cannot test user data loading - dashboard not accessible');
        return false;
      }
    } catch (error) {
      this.error('User data loading test failed', error);
      return false;
    }
  }

  async testLogout() {
    this.log('🔍 Testing logout functionality...');
    
    try {
      const response = await this.makeRequest('POST', '/auth/logout');
      
      if (response.status === 302) {
        const redirectLocation = response.headers.location;
        this.success(`Logout successful - Redirected to: ${redirectLocation}`);
        
        // Clear our cookies
        this.sessionCookies = [];
        this.client.defaults.headers.Cookie = '';
        
        return true;
      } else {
        this.error(`Logout returned unexpected status: ${response.status}`);
        return false;
      }
    } catch (error) {
      this.error('Logout test failed', error);
      return false;
    }
  }

  async testPostLogoutAccess() {
    this.log('🔍 Testing dashboard access after logout...');
    
    try {
      const response = await this.makeRequest('GET', '/dashboard');
      
      if (response.status === 302) {
        const redirectLocation = response.headers.location;
        if (redirectLocation.includes('/auth/login')) {
          this.success('Dashboard correctly redirects to login after logout');
          return true;
        } else {
          this.error(`Dashboard redirected to unexpected location: ${redirectLocation}`);
          return false;
        }
      } else if (response.status === 200) {
        this.error('Dashboard accessible after logout - Session not properly cleared');
        return false;
      } else {
        this.error(`Unexpected status after logout: ${response.status}`);
        return false;
      }
    } catch (error) {
      this.error('Post-logout access test failed', error);
      return false;
    }
  }

  async runCompleteTest() {
    console.log('🧪 Starting Complete Authentication Flow Test');
    console.log('=' .repeat(60));
    
    const results = {
      serverHealth: false,
      loginPageAccess: false,
      loginSubmission: false,
      dashboardAccess: false,
      sessionPersistence: false,
      userDataLoading: false,
      logout: false,
      postLogoutAccess: false
    };

    try {
      // Test 1: Server Health
      results.serverHealth = await this.testServerHealth();
      if (!results.serverHealth) {
        throw new Error('Server is not responding');
      }

      // Test 2: Login Page Access
      const loginPageResult = await this.testLoginPageAccess();
      results.loginPageAccess = loginPageResult.success;
      if (!results.loginPageAccess) {
        throw new Error('Cannot access login page');
      }

      // Test 3: Login Submission
      const loginResult = await this.testLoginSubmission(loginPageResult.csrfToken);
      results.loginSubmission = loginResult.success;
      if (!results.loginSubmission) {
        throw new Error('Login submission failed');
      }

      // Test 4: Dashboard Access
      const dashboardResult = await this.testDashboardAccess();
      results.dashboardAccess = dashboardResult.success;
      if (!results.dashboardAccess) {
        throw new Error('Dashboard access failed after login');
      }

      // Test 5: Session Persistence
      results.sessionPersistence = await this.testSessionPersistence();

      // Test 6: User Data Loading
      results.userDataLoading = await this.testUserDataLoading();

      // Test 7: Logout
      results.logout = await this.testLogout();

      // Test 8: Post-Logout Access
      results.postLogoutAccess = await this.testPostLogoutAccess();

    } catch (error) {
      this.error('Test sequence interrupted', error);
    }

    // Results Summary
    console.log('\n' + '=' .repeat(60));
    console.log('🧪 AUTHENTICATION FLOW TEST RESULTS');
    console.log('=' .repeat(60));

    const testResults = [
      { name: 'Server Health', passed: results.serverHealth },
      { name: 'Login Page Access', passed: results.loginPageAccess },
      { name: 'Login Submission', passed: results.loginSubmission },
      { name: 'Dashboard Access', passed: results.dashboardAccess },
      { name: 'Session Persistence', passed: results.sessionPersistence },
      { name: 'User Data Loading', passed: results.userDataLoading },
      { name: 'Logout', passed: results.logout },
      { name: 'Post-Logout Access', passed: results.postLogoutAccess }
    ];

    testResults.forEach(test => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test.name}`);
    });

    const passedTests = testResults.filter(t => t.passed).length;
    const totalTests = testResults.length;

    console.log('\n' + '-' .repeat(60));
    console.log(`OVERALL RESULT: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 ALL TESTS PASSED - Authentication system is working correctly!');
    } else if (passedTests >= 6) {
      console.log('⚠️  MOSTLY WORKING - Some minor issues detected');
    } else if (passedTests >= 4) {
      console.log('⚠️  PARTIALLY WORKING - Significant issues detected');
    } else {
      console.log('🚨 AUTHENTICATION SYSTEM HAS MAJOR ISSUES');
    }

    console.log('=' .repeat(60));
    
    return {
      passed: passedTests,
      total: totalTests,
      results,
      success: passedTests === totalTests
    };
  }
}

// Run the test if called directly
if (require.main === module) {
  const tester = new AuthenticationTester();
  
  tester.runCompleteTest()
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = AuthenticationTester;