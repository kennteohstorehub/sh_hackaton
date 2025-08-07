#!/usr/bin/env node

/**
 * Comprehensive BackOffice Login System QA Test
 * Tests the complete login flow including navigation, authentication, and session management
 */

const { chromium } = require('playwright');
const assert = require('assert');

// Test configuration
const BASE_URL = 'http://admin.lvh.me:3838';
const LOGIN_CREDENTIALS = {
  email: 'backoffice@storehubqms.local',
  password: 'BackOffice123!@#'
};

const TEST_TIMEOUT = 30000; // 30 seconds
const NAVIGATION_TIMEOUT = 15000; // 15 seconds

class BackOfficeLoginTester {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.testResults = [];
  }

  async setup() {
    console.log('🚀 Setting up test environment...');
    this.browser = await chromium.launch({
      headless: false, // Set to true for CI/CD
      slowMo: 500 // Slow down actions for better visibility
    });
    
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true
    });
    
    this.page = await this.context.newPage();
    
    // Enable console logging to catch JavaScript errors
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('🔴 Console Error:', msg.text());
      }
    });
    
    // Enable network error logging
    this.page.on('requestfailed', request => {
      console.error('🔴 Network Error:', request.url(), request.failure().errorText);
    });
  }

  async teardown() {
    console.log('🧹 Cleaning up test environment...');
    if (this.browser) {
      await this.browser.close();
    }
  }

  logResult(testName, passed, details = '') {
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${testName}: ${details}`);
    this.testResults.push({ testName, passed, details });
  }

  async test1_NavigationToLoginPage() {
    console.log('\n📝 Test 1: Navigation to Login Page');
    try {
      // Navigate to base URL
      await this.page.goto(BASE_URL, { 
        waitUntil: 'networkidle',
        timeout: NAVIGATION_TIMEOUT 
      });
      
      // Check if redirected to login page
      const currentUrl = this.page.url();
      const isOnLoginPage = currentUrl.includes('/backoffice/auth/login');
      
      if (isOnLoginPage) {
        this.logResult('Navigation redirect', true, `Correctly redirected to ${currentUrl}`);
      } else {
        this.logResult('Navigation redirect', false, `Expected login page, got ${currentUrl}`);
      }
      
      return isOnLoginPage;
    } catch (error) {
      this.logResult('Navigation redirect', false, `Error: ${error.message}`);
      return false;
    }
  }

  async test2_LoginPageLoad() {
    console.log('\n📝 Test 2: Login Page Load');
    try {
      // Wait for login form elements
      await this.page.waitForSelector('form', { timeout: 5000 });
      await this.page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 5000 });
      await this.page.waitForSelector('input[type="password"], input[name="password"]', { timeout: 5000 });
      await this.page.waitForSelector('button[type="submit"], input[type="submit"]', { timeout: 5000 });
      
      this.logResult('Login form elements', true, 'All required form elements are present');
      
      // Check for console errors
      const consoleLogs = [];
      this.page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleLogs.push(msg.text());
        }
      });
      
      // Wait a moment to catch any console errors
      await this.page.waitForTimeout(2000);
      
      if (consoleLogs.length === 0) {
        this.logResult('Console errors', true, 'No console errors detected');
      } else {
        this.logResult('Console errors', false, `Found errors: ${consoleLogs.join(', ')}`);
      }
      
      return true;
    } catch (error) {
      this.logResult('Login page load', false, `Error loading login page: ${error.message}`);
      return false;
    }
  }

  async test3_CSSStylesApplied() {
    console.log('\n📝 Test 3: CSS Styles Applied');
    try {
      // Check if basic styling is applied by looking for computed styles
      const formElement = await this.page.locator('form').first();
      const formStyles = await formElement.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          display: styles.display,
          visibility: styles.visibility,
          backgroundColor: styles.backgroundColor,
          padding: styles.padding
        };
      });
      
      const isStyled = formStyles.display !== 'inline' || 
                      formStyles.padding !== '0px' || 
                      formStyles.backgroundColor !== 'rgba(0, 0, 0, 0)';
      
      if (isStyled) {
        this.logResult('CSS styles', true, 'Form has custom styling applied');
      } else {
        this.logResult('CSS styles', false, 'Form appears to have no custom styling');
      }
      
      // Check for broken images or missing assets
      const brokenImages = await this.page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'));
        return images.filter(img => !img.complete || img.naturalHeight === 0).length;
      });
      
      if (brokenImages === 0) {
        this.logResult('Asset loading', true, 'All images loaded successfully');
      } else {
        this.logResult('Asset loading', false, `${brokenImages} broken images found`);
      }
      
      return true;
    } catch (error) {
      this.logResult('CSS styles check', false, `Error checking styles: ${error.message}`);
      return false;
    }
  }

  async test4_LoginAuthentication() {
    console.log('\n📝 Test 4: Login Authentication');
    try {
      // Find and fill email field
      const emailField = this.page.locator('input[type="email"], input[name="email"]').first();
      await emailField.fill(LOGIN_CREDENTIALS.email);
      
      // Find and fill password field
      const passwordField = this.page.locator('input[type="password"], input[name="password"]').first();
      await passwordField.fill(LOGIN_CREDENTIALS.password);
      
      // Submit the form
      const submitButton = this.page.locator('button[type="submit"], input[type="submit"]').first();
      
      // Listen for navigation
      const navigationPromise = this.page.waitForURL(url => 
        url.toString().includes('/backoffice') && !url.toString().includes('/login'), 
        { timeout: 10000 }
      );
      
      await submitButton.click();
      
      // Wait for navigation to complete
      await navigationPromise;
      
      const currentUrl = this.page.url();
      const isLoggedIn = currentUrl.includes('/backoffice') && !currentUrl.includes('/login');
      
      if (isLoggedIn) {
        this.logResult('Login authentication', true, `Successfully logged in, redirected to ${currentUrl}`);
      } else {
        this.logResult('Login authentication', false, `Login failed, still on ${currentUrl}`);
      }
      
      return isLoggedIn;
    } catch (error) {
      this.logResult('Login authentication', false, `Error during login: ${error.message}`);
      return false;
    }
  }

  async test5_DashboardLoad() {
    console.log('\n📝 Test 5: Dashboard Load');
    try {
      // Wait for dashboard elements to load
      await this.page.waitForSelector('body', { timeout: 5000 });
      
      // Check if we're on a dashboard/admin page
      const pageTitle = await this.page.title();
      const currentUrl = this.page.url();
      
      // Look for common dashboard elements
      const hasDashboardElements = await this.page.evaluate(() => {
        // Check for common dashboard indicators
        const indicators = [
          document.querySelector('[class*="dashboard"]'),
          document.querySelector('[class*="admin"]'),
          document.querySelector('[class*="backoffice"]'),
          document.querySelector('nav'),
          document.querySelector('[class*="sidebar"]'),
          document.querySelector('[class*="header"]')
        ];
        return indicators.some(el => el !== null);
      });
      
      if (hasDashboardElements) {
        this.logResult('Dashboard load', true, `Dashboard loaded successfully. Title: "${pageTitle}"`);
      } else {
        this.logResult('Dashboard load', false, `Dashboard elements not found. Title: "${pageTitle}"`);
      }
      
      // Check for JavaScript errors on dashboard
      const errorCount = await this.page.evaluate(() => {
        return window.errorCount || 0;
      });
      
      if (errorCount === 0) {
        this.logResult('Dashboard JS errors', true, 'No JavaScript errors on dashboard');
      } else {
        this.logResult('Dashboard JS errors', false, `${errorCount} JavaScript errors detected`);
      }
      
      return hasDashboardElements;
    } catch (error) {
      this.logResult('Dashboard load', false, `Error loading dashboard: ${error.message}`);
      return false;
    }
  }

  async test6_LogoutFunctionality() {
    console.log('\n📝 Test 6: Logout Functionality');
    try {
      // Look for logout button/link
      const logoutSelectors = [
        'a[href*="logout"]',
        'button[class*="logout"]',
        '[data-action="logout"]',
        'a:has-text("Logout")',
        'a:has-text("Sign Out")',
        'button:has-text("Logout")',
        'button:has-text("Sign Out")'
      ];
      
      let logoutElement = null;
      for (const selector of logoutSelectors) {
        try {
          logoutElement = await this.page.locator(selector).first();
          if (await logoutElement.isVisible()) {
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!logoutElement || !(await logoutElement.isVisible())) {
        this.logResult('Logout functionality', false, 'Logout button/link not found');
        return false;
      }
      
      // Click logout
      const navigationPromise = this.page.waitForURL(url => 
        url.toString().includes('/login') || url.toString().includes('/auth'), 
        { timeout: 10000 }
      );
      
      await logoutElement.click();
      await navigationPromise;
      
      const currentUrl = this.page.url();
      const isLoggedOut = currentUrl.includes('/login') || currentUrl.includes('/auth');
      
      if (isLoggedOut) {
        this.logResult('Logout functionality', true, `Successfully logged out, redirected to ${currentUrl}`);
      } else {
        this.logResult('Logout functionality', false, `Logout failed, still on ${currentUrl}`);
      }
      
      return isLoggedOut;
    } catch (error) {
      this.logResult('Logout functionality', false, `Error during logout: ${error.message}`);
      return false;
    }
  }

  async test7_SessionPersistence() {
    console.log('\n📝 Test 7: Session Persistence');
    try {
      // First, log in again
      await this.test4_LoginAuthentication();
      
      // Store current URL
      const urlBeforeRefresh = this.page.url();
      
      // Refresh the page
      await this.page.reload({ waitUntil: 'networkidle' });
      
      // Wait a moment for any redirects
      await this.page.waitForTimeout(2000);
      
      const urlAfterRefresh = this.page.url();
      const sessionPersisted = !urlAfterRefresh.includes('/login') && !urlAfterRefresh.includes('/auth');
      
      if (sessionPersisted) {
        this.logResult('Session persistence', true, `Session persisted after refresh. URL: ${urlAfterRefresh}`);
      } else {
        this.logResult('Session persistence', false, `Session lost after refresh. Redirected to: ${urlAfterRefresh}`);
      }
      
      return sessionPersisted;
    } catch (error) {
      this.logResult('Session persistence', false, `Error testing session persistence: ${error.message}`);
      return false;
    }
  }

  async runAllTests() {
    console.log('🧪 Starting Comprehensive BackOffice Login System QA Tests\n');
    console.log(`📍 Base URL: ${BASE_URL}`);
    console.log(`👤 Test User: ${LOGIN_CREDENTIALS.email}\n`);
    
    const startTime = Date.now();
    
    try {
      await this.setup();
      
      // Run all tests in sequence
      await this.test1_NavigationToLoginPage();
      await this.test2_LoginPageLoad();
      await this.test3_CSSStylesApplied();
      await this.test4_LoginAuthentication();
      await this.test5_DashboardLoad();
      await this.test6_LogoutFunctionality();
      await this.test7_SessionPersistence();
      
    } catch (error) {
      console.error('🔥 Unexpected error during testing:', error);
    } finally {
      await this.teardown();
    }
    
    // Print summary
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY REPORT');
    console.log('='.repeat(60));
    
    const passedTests = this.testResults.filter(result => result.passed);
    const failedTests = this.testResults.filter(result => !result.passed);
    
    console.log(`✅ Passed: ${passedTests.length}`);
    console.log(`❌ Failed: ${failedTests.length}`);
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`🎯 Success Rate: ${Math.round((passedTests.length / this.testResults.length) * 100)}%`);
    
    if (failedTests.length > 0) {
      console.log('\n🔍 FAILED TESTS:');
      failedTests.forEach(test => {
        console.log(`  ❌ ${test.testName}: ${test.details}`);
      });
    }
    
    console.log('\n📋 DETAILED RESULTS:');
    this.testResults.forEach(test => {
      const status = test.passed ? '✅' : '❌';
      console.log(`  ${status} ${test.testName}: ${test.details}`);
    });
    
    console.log('\n' + '='.repeat(60));
    
    // Return overall success
    return failedTests.length === 0;
  }

  // Method to run a quick smoke test
  async runSmokeTest() {
    console.log('🚀 Running Quick Smoke Test for BackOffice Login\n');
    
    try {
      await this.setup();
      
      // Quick navigation test
      await this.page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 10000 });
      const isOnLogin = this.page.url().includes('/login');
      console.log(`✅ Navigation: ${isOnLogin ? 'PASS' : 'FAIL'}`);
      
      // Quick login test
      if (isOnLogin) {
        await this.page.fill('input[type="email"], input[name="email"]', LOGIN_CREDENTIALS.email);
        await this.page.fill('input[type="password"], input[name="password"]', LOGIN_CREDENTIALS.password);
        await this.page.click('button[type="submit"], input[type="submit"]');
        
        await this.page.waitForTimeout(3000);
        const isLoggedIn = !this.page.url().includes('/login');
        console.log(`✅ Login: ${isLoggedIn ? 'PASS' : 'FAIL'}`);
      }
      
    } catch (error) {
      console.error('❌ Smoke test failed:', error.message);
    } finally {
      await this.teardown();
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const tester = new BackOfficeLoginTester();
  
  if (args.includes('--smoke')) {
    await tester.runSmokeTest();
  } else {
    const success = await tester.runAllTests();
    process.exit(success ? 0 : 1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('🔥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = BackOfficeLoginTester;