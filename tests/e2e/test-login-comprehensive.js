const { test, expect } = require('@playwright/test');

// Test configuration
const BASE_URL = 'http://localhost:3000';

// Test credentials
const SUPERADMIN_CREDENTIALS = {
  email: 'superadmin@storehubqms.local',
  password: 'SuperAdmin123!@#',
  loginUrl: `${BASE_URL}/superadmin/auth/login`,
  expectedRedirect: `${BASE_URL}/superadmin/dashboard`
};

const TENANT_CREDENTIALS = {
  email: 'admin@demo.local',
  password: 'Demo123!@#',
  loginUrl: `${BASE_URL}/auth/login`,
  expectedRedirect: `${BASE_URL}/dashboard`
};

test.describe('Login Functionality Tests', () => {
  let page;
  let context;

  test.beforeEach(async ({ browser }) => {
    // Create a new context for each test to ensure clean state
    context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1280, height: 720 }
    });
    page = await context.newPage();

    // Enable console logging to catch JavaScript errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`Browser Console Error: ${msg.text()}`);
      }
    });

    // Listen for page errors
    page.on('pageerror', error => {
      console.error(`Page Error: ${error.message}`);
    });

    // Listen for network requests
    page.on('response', response => {
      if (response.status() >= 400) {
        console.log(`HTTP Error: ${response.status()} ${response.url()}`);
      }
    });
  });

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  test('SuperAdmin Login Flow', async () => {
    console.log('Testing SuperAdmin login flow...');
    
    try {
      // Navigate to SuperAdmin login page
      console.log(`Navigating to: ${SUPERADMIN_CREDENTIALS.loginUrl}`);
      await page.goto(SUPERADMIN_CREDENTIALS.loginUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Take screenshot of login page
      await page.screenshot({ 
        path: 'superadmin-login-page.png',
        fullPage: true 
      });

      // Check if login form elements exist
      const emailField = page.locator('input[name="email"], input[type="email"], #email');
      const passwordField = page.locator('input[name="password"], input[type="password"], #password');
      const submitButton = page.locator('button[type="submit"], input[type="submit"], .login-btn, .submit-btn');

      // Verify form elements are present
      await expect(emailField).toBeVisible({ timeout: 10000 });
      await expect(passwordField).toBeVisible({ timeout: 10000 });
      await expect(submitButton).toBeVisible({ timeout: 10000 });

      console.log('Form elements found, filling credentials...');

      // Fill in credentials
      await emailField.fill(SUPERADMIN_CREDENTIALS.email);
      await passwordField.fill(SUPERADMIN_CREDENTIALS.password);

      // Take screenshot before submission
      await page.screenshot({ 
        path: 'superadmin-login-filled.png',
        fullPage: true 
      });

      // Check for CSRF token
      const csrfToken = await page.locator('input[name="_token"], input[name="csrfToken"], meta[name="csrf-token"]').first();
      if (await csrfToken.count() > 0) {
        console.log('CSRF token found on page');
      } else {
        console.log('No CSRF token found');
      }

      // Submit form and wait for navigation
      console.log('Submitting login form...');
      const [response] = await Promise.all([
        page.waitForResponse(response => 
          response.url().includes('/login') || 
          response.url().includes('/auth') ||
          response.url().includes('/dashboard'), 
          { timeout: 30000 }
        ),
        submitButton.click()
      ]);

      console.log(`Login response status: ${response.status()}`);
      console.log(`Response URL: ${response.url()}`);

      // Wait for any redirects
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      // Take screenshot after submission
      await page.screenshot({ 
        path: 'superadmin-after-login.png',
        fullPage: true 
      });

      // Check current URL
      const currentUrl = page.url();
      console.log(`Current URL after login: ${currentUrl}`);

      // Verify successful login by checking for dashboard elements or successful redirect
      if (currentUrl.includes('/dashboard') || currentUrl.includes('/superadmin')) {
        console.log('✅ SuperAdmin login appears successful');
        
        // Look for dashboard elements
        const dashboardElements = await page.locator('h1, .dashboard, .admin-panel, [data-testid="dashboard"]').count();
        if (dashboardElements > 0) {
          console.log('✅ Dashboard elements found');
        }
        
        // Check for any error messages
        const errorMessages = await page.locator('.error, .alert-danger, .text-danger, [role="alert"]').count();
        if (errorMessages > 0) {
          const errorText = await page.locator('.error, .alert-danger, .text-danger, [role="alert"]').first().textContent();
          console.log(`⚠️ Error message found: ${errorText}`);
        }
      } else {
        console.log('❌ SuperAdmin login may have failed - not on dashboard');
        
        // Check for error messages
        const errorMessages = await page.locator('.error, .alert-danger, .text-danger, [role="alert"]');
        if (await errorMessages.count() > 0) {
          const errorText = await errorMessages.first().textContent();
          console.log(`❌ Login error: ${errorText}`);
        }
      }

    } catch (error) {
      console.error(`SuperAdmin login test failed: ${error.message}`);
      await page.screenshot({ 
        path: 'superadmin-login-error.png',
        fullPage: true 
      });
      throw error;
    }
  });

  test('Regular Tenant Login Flow', async () => {
    console.log('Testing regular tenant login flow...');
    
    try {
      // Navigate to tenant login page
      console.log(`Navigating to: ${TENANT_CREDENTIALS.loginUrl}`);
      await page.goto(TENANT_CREDENTIALS.loginUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Take screenshot of login page
      await page.screenshot({ 
        path: 'tenant-login-page.png',
        fullPage: true 
      });

      // Check if login form elements exist
      const emailField = page.locator('input[name="email"], input[type="email"], #email');
      const passwordField = page.locator('input[name="password"], input[type="password"], #password');
      const submitButton = page.locator('button[type="submit"], input[type="submit"], .login-btn, .submit-btn');

      // Verify form elements are present
      await expect(emailField).toBeVisible({ timeout: 10000 });
      await expect(passwordField).toBeVisible({ timeout: 10000 });
      await expect(submitButton).toBeVisible({ timeout: 10000 });

      console.log('Form elements found, filling credentials...');

      // Fill in credentials
      await emailField.fill(TENANT_CREDENTIALS.email);
      await passwordField.fill(TENANT_CREDENTIALS.password);

      // Take screenshot before submission
      await page.screenshot({ 
        path: 'tenant-login-filled.png',
        fullPage: true 
      });

      // Check for CSRF token
      const csrfToken = await page.locator('input[name="_token"], input[name="csrfToken"], meta[name="csrf-token"]').first();
      if (await csrfToken.count() > 0) {
        console.log('CSRF token found on page');
      } else {
        console.log('No CSRF token found');
      }

      // Submit form and wait for navigation
      console.log('Submitting login form...');
      const [response] = await Promise.all([
        page.waitForResponse(response => 
          response.url().includes('/login') || 
          response.url().includes('/auth') ||
          response.url().includes('/dashboard'), 
          { timeout: 30000 }
        ),
        submitButton.click()
      ]);

      console.log(`Login response status: ${response.status()}`);
      console.log(`Response URL: ${response.url()}`);

      // Wait for any redirects
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      // Take screenshot after submission
      await page.screenshot({ 
        path: 'tenant-after-login.png',
        fullPage: true 
      });

      // Check current URL
      const currentUrl = page.url();
      console.log(`Current URL after login: ${currentUrl}`);

      // Verify successful login
      if (currentUrl.includes('/dashboard')) {
        console.log('✅ Tenant login appears successful');
        
        // Look for dashboard elements
        const dashboardElements = await page.locator('h1, .dashboard, .queue-management, [data-testid="dashboard"]').count();
        if (dashboardElements > 0) {
          console.log('✅ Dashboard elements found');
        }
        
        // Check for any error messages
        const errorMessages = await page.locator('.error, .alert-danger, .text-danger, [role="alert"]').count();
        if (errorMessages > 0) {
          const errorText = await page.locator('.error, .alert-danger, .text-danger, [role="alert"]').first().textContent();
          console.log(`⚠️ Error message found: ${errorText}`);
        }
      } else {
        console.log('❌ Tenant login may have failed - not on dashboard');
        
        // Check for error messages
        const errorMessages = await page.locator('.error, .alert-danger, .text-danger, [role="alert"]');
        if (await errorMessages.count() > 0) {
          const errorText = await errorMessages.first().textContent();
          console.log(`❌ Login error: ${errorText}`);
        }
      }

    } catch (error) {
      console.error(`Tenant login test failed: ${error.message}`);
      await page.screenshot({ 
        path: 'tenant-login-error.png',
        fullPage: true 
      });
      throw error;
    }
  });

  test('Session and Cookie Verification', async () => {
    console.log('Testing session and cookie functionality...');
    
    try {
      // Test tenant login first
      await page.goto(TENANT_CREDENTIALS.loginUrl);
      
      // Fill and submit login form
      await page.fill('input[name="email"], input[type="email"], #email', TENANT_CREDENTIALS.email);
      await page.fill('input[name="password"], input[type="password"], #password', TENANT_CREDENTIALS.password);
      await page.click('button[type="submit"], input[type="submit"], .login-btn, .submit-btn');
      
      // Wait for login to complete
      await page.waitForLoadState('networkidle');
      
      // Check cookies
      const cookies = await context.cookies();
      console.log(`Found ${cookies.length} cookies:`);
      
      const sessionCookies = cookies.filter(cookie => 
        cookie.name.includes('session') || 
        cookie.name.includes('connect.sid') || 
        cookie.name.includes('auth')
      );
      
      sessionCookies.forEach(cookie => {
        console.log(`Session cookie: ${cookie.name} = ${cookie.value.substring(0, 20)}...`);
        console.log(`  - Domain: ${cookie.domain}`);
        console.log(`  - Path: ${cookie.path}`);
        console.log(`  - HttpOnly: ${cookie.httpOnly}`);
        console.log(`  - Secure: ${cookie.secure}`);
      });
      
      if (sessionCookies.length > 0) {
        console.log('✅ Session cookies found');
      } else {
        console.log('❌ No session cookies found');
      }
      
      // Test navigation to protected page
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');
      
      const finalUrl = page.url();
      if (finalUrl.includes('/dashboard')) {
        console.log('✅ Session maintained for protected route');
      } else {
        console.log('❌ Session not maintained - redirected to login');
      }
      
    } catch (error) {
      console.error(`Session test failed: ${error.message}`);
      await page.screenshot({ 
        path: 'session-test-error.png',
        fullPage: true 
      });
    }
  });

  test('Invalid Credentials Test', async () => {
    console.log('Testing invalid credentials handling...');
    
    try {
      // Test with invalid tenant credentials
      await page.goto(TENANT_CREDENTIALS.loginUrl);
      
      await page.fill('input[name="email"], input[type="email"], #email', 'invalid@test.com');
      await page.fill('input[name="password"], input[type="password"], #password', 'wrongpassword');
      
      await page.click('button[type="submit"], input[type="submit"], .login-btn, .submit-btn');
      await page.waitForLoadState('networkidle');
      
      // Should stay on login page or show error
      const currentUrl = page.url();
      const hasError = await page.locator('.error, .alert-danger, .text-danger, [role="alert"]').count() > 0;
      
      if (currentUrl.includes('/login') || hasError) {
        console.log('✅ Invalid credentials properly rejected');
        
        if (hasError) {
          const errorText = await page.locator('.error, .alert-danger, .text-danger, [role="alert"]').first().textContent();
          console.log(`Error message: ${errorText}`);
        }
      } else {
        console.log('❌ Invalid credentials were accepted - security issue!');
      }
      
      await page.screenshot({ 
        path: 'invalid-credentials-test.png',
        fullPage: true 
      });
      
    } catch (error) {
      console.error(`Invalid credentials test failed: ${error.message}`);
    }
  });

  test('Network Request Analysis', async () => {
    console.log('Analyzing network requests during login...');
    
    const requests = [];
    const responses = [];
    
    // Capture network activity
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData()
      });
    });
    
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        headers: response.headers()
      });
    });
    
    try {
      // Perform tenant login
      await page.goto(TENANT_CREDENTIALS.loginUrl);
      await page.fill('input[name="email"], input[type="email"], #email', TENANT_CREDENTIALS.email);
      await page.fill('input[name="password"], input[type="password"], #password', TENANT_CREDENTIALS.password);
      await page.click('button[type="submit"], input[type="submit"], .login-btn, .submit-btn');
      await page.waitForLoadState('networkidle');
      
      // Analyze login-related requests
      const loginRequests = requests.filter(req => 
        req.url.includes('/login') || 
        req.url.includes('/auth') ||
        req.method === 'POST'
      );
      
      console.log(`\nLogin-related requests (${loginRequests.length}):`);
      loginRequests.forEach(req => {
        console.log(`${req.method} ${req.url}`);
        if (req.postData) {
          console.log(`  Body: ${req.postData.substring(0, 100)}...`);
        }
      });
      
      const loginResponses = responses.filter(resp => 
        resp.url.includes('/login') || 
        resp.url.includes('/auth') ||
        resp.url.includes('/dashboard')
      );
      
      console.log(`\nLogin-related responses (${loginResponses.length}):`);
      loginResponses.forEach(resp => {
        console.log(`${resp.status} ${resp.url}`);
        if (resp.headers['set-cookie']) {
          console.log(`  Sets cookies: ${resp.headers['set-cookie']}`);
        }
      });
      
    } catch (error) {
      console.error(`Network analysis failed: ${error.message}`);
    }
  });
});

// Helper function to run the tests
async function runLoginTests() {
  console.log('🧪 Starting comprehensive login tests...');
  console.log('📍 Server should be running on http://localhost:3000');
  console.log('');
  
  // Note: This would normally be run with: npx playwright test test-login-comprehensive.js
  console.log('To run these tests, execute:');
  console.log('npx playwright test test-login-comprehensive.js --headed');
  console.log('');
  console.log('Or to run specific tests:');
  console.log('npx playwright test test-login-comprehensive.js -g "SuperAdmin Login"');
  console.log('npx playwright test test-login-comprehensive.js -g "Tenant Login"');
}

if (require.main === module) {
  runLoginTests();
}

module.exports = { runLoginTests };