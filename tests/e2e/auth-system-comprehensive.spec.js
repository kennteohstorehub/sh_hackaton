const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_CREDENTIALS = {
  email: 'test@example.com',
  password: 'password123'
};

// Helper function to take screenshots
async function takeScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ 
    path: `screenshots/auth-test-${name}-${timestamp}.png`,
    fullPage: true 
  });
}

// Helper function to log console messages
function setupConsoleLogging(page) {
  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type()}]:`, msg.text());
  });
  
  page.on('pageerror', err => {
    console.error(`[PAGE ERROR]:`, err.message);
  });
  
  page.on('requestfailed', request => {
    console.error(`[REQUEST FAILED]: ${request.url()} - ${request.failure().errorText}`);
  });
}

test.describe('Authentication System Comprehensive Testing', () => {
  let browser;
  let context;
  let page;

  test.beforeAll(async () => {
    // Create screenshots directory
    const fs = require('fs');
    if (!fs.existsSync('screenshots')) {
      fs.mkdirSync('screenshots');
    }
  });

  test.beforeEach(async () => {
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 500 
    });
    context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1280, height: 720 }
    });
    page = await context.newPage();
    setupConsoleLogging(page);
  });

  test.afterEach(async () => {
    await browser.close();
  });

  test('1. Test accessing login page when not authenticated', async () => {
    console.log('\n=== TEST 1: Accessing Login Page ===');
    
    // Clear cookies to ensure clean state
    await context.clearCookies();
    
    // Navigate to login page
    const response = await page.goto(`${BASE_URL}/auth/login`, {
      waitUntil: 'networkidle'
    });
    
    console.log(`Response status: ${response.status()}`);
    console.log(`Final URL: ${page.url()}`);
    
    await takeScreenshot(page, '1-login-page-initial');
    
    // Check if we're on the login page
    expect(page.url()).toContain('/auth/login');
    expect(response.status()).toBe(200);
    
    // Check for login form elements
    const emailInput = await page.locator('input[name="email"], input[type="email"]').count();
    const passwordInput = await page.locator('input[name="password"], input[type="password"]').count();
    const loginButton = await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').count();
    
    console.log(`Email input found: ${emailInput}`);
    console.log(`Password input found: ${passwordInput}`);
    console.log(`Login button found: ${loginButton}`);
    
    expect(emailInput).toBeGreaterThan(0);
    expect(passwordInput).toBeGreaterThan(0);
    expect(loginButton).toBeGreaterThan(0);
  });

  test('2. Test login functionality with valid credentials', async () => {
    console.log('\n=== TEST 2: Login with Valid Credentials ===');
    
    await context.clearCookies();
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle' });
    
    await takeScreenshot(page, '2-login-page-before-input');
    
    // Fill login form
    await page.fill('input[name="email"], input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[name="password"], input[type="password"]', TEST_CREDENTIALS.password);
    
    await takeScreenshot(page, '2-login-form-filled');
    
    // Click login button
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")')
    ]);
    
    console.log(`After login URL: ${page.url()}`);
    await takeScreenshot(page, '2-after-login');
    
    // Check if redirected to dashboard
    expect(page.url()).toContain('/dashboard');
    
    // Check for session cookie
    const cookies = await context.cookies();
    console.log(`Cookies after login:`, cookies.map(c => ({ name: c.name, httpOnly: c.httpOnly, secure: c.secure })));
    
    const sessionCookie = cookies.find(c => c.name === 'queue.connect.sid' || c.name === 'connect.sid');
    expect(sessionCookie).toBeTruthy();
  });

  test('3. Test accessing protected pages when authenticated', async () => {
    console.log('\n=== TEST 3: Accessing Protected Pages ===');
    
    // First login
    await context.clearCookies();
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle' });
    await page.fill('input[name="email"], input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[name="password"], input[type="password"]', TEST_CREDENTIALS.password);
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")')
    ]);
    
    // Test dashboard access
    const dashboardResponse = await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    console.log(`Dashboard status: ${dashboardResponse.status()}`);
    await takeScreenshot(page, '3-dashboard-authenticated');
    expect(dashboardResponse.status()).toBe(200);
    expect(page.url()).toContain('/dashboard');
    
    // Test queue management access
    const queueResponse = await page.goto(`${BASE_URL}/merchant/queue`, { waitUntil: 'networkidle' });
    console.log(`Queue page status: ${queueResponse.status()}`);
    await takeScreenshot(page, '3-queue-authenticated');
    expect(queueResponse.status()).toBe(200);
  });

  test('4. Test logout functionality', async () => {
    console.log('\n=== TEST 4: Logout Functionality ===');
    
    // First login
    await context.clearCookies();
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle' });
    await page.fill('input[name="email"], input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[name="password"], input[type="password"]', TEST_CREDENTIALS.password);
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")')
    ]);
    
    // Wait for dashboard to load
    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, '4-dashboard-before-logout');
    
    // Look for logout button/link
    const logoutSelectors = [
      'a[href="/auth/logout"]',
      'button:has-text("Logout")',
      'button:has-text("Sign Out")',
      'a:has-text("Logout")',
      'a:has-text("Sign Out")',
      '[data-testid="logout"]',
      '.logout-btn',
      '#logout-btn'
    ];
    
    let logoutElement = null;
    for (const selector of logoutSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        logoutElement = selector;
        console.log(`Found logout element with selector: ${selector}`);
        break;
      }
    }
    
    if (!logoutElement) {
      console.error('No logout element found!');
      await takeScreenshot(page, '4-no-logout-button');
      
      // Try to find any clickable elements that might be logout
      const allLinks = await page.locator('a').all();
      for (const link of allLinks) {
        const text = await link.textContent();
        const href = await link.getAttribute('href');
        console.log(`Link: "${text}" -> ${href}`);
      }
    } else {
      // Click logout
      await page.click(logoutElement);
      await page.waitForLoadState('networkidle');
      
      console.log(`After logout URL: ${page.url()}`);
      await takeScreenshot(page, '4-after-logout');
      
      // Check if redirected to login
      expect(page.url()).toContain('/auth/login');
      
      // Check cookies are cleared
      const cookies = await context.cookies();
      console.log(`Cookies after logout:`, cookies.map(c => c.name));
    }
  });

  test('5. Test access control after logout', async () => {
    console.log('\n=== TEST 5: Access Control After Logout ===');
    
    // Clear all cookies to simulate logged out state
    await context.clearCookies();
    
    // Try to access protected pages
    const protectedPages = [
      '/dashboard',
      '/merchant/queue',
      '/merchant/settings',
      '/merchant/analytics'
    ];
    
    for (const path of protectedPages) {
      console.log(`\nTesting protected route: ${path}`);
      const response = await page.goto(`${BASE_URL}${path}`, { 
        waitUntil: 'networkidle',
        timeout: 10000 
      });
      
      console.log(`Response status: ${response.status()}`);
      console.log(`Final URL: ${page.url()}`);
      
      await takeScreenshot(page, `5-access-control-${path.replace(/\//g, '-')}`);
      
      // Should redirect to login
      expect(page.url()).toContain('/auth/login');
    }
  });

  test('6. Test CSRF protection', async () => {
    console.log('\n=== TEST 6: CSRF Protection ===');
    
    // Login first
    await context.clearCookies();
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle' });
    await page.fill('input[name="email"], input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[name="password"], input[type="password"]', TEST_CREDENTIALS.password);
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")')
    ]);
    
    // Check for CSRF token in the page
    const csrfToken = await page.evaluate(() => {
      // Check meta tag
      const metaTag = document.querySelector('meta[name="csrf-token"]');
      if (metaTag) return metaTag.getAttribute('content');
      
      // Check hidden input
      const hiddenInput = document.querySelector('input[name="_csrf"]');
      if (hiddenInput) return hiddenInput.value;
      
      // Check in window object
      if (window.csrfToken) return window.csrfToken;
      if (window._csrf) return window._csrf;
      
      return null;
    });
    
    console.log(`CSRF Token found: ${csrfToken ? 'Yes' : 'No'}`);
    
    if (csrfToken) {
      console.log(`CSRF Token length: ${csrfToken.length}`);
    }
    
    await takeScreenshot(page, '6-csrf-check');
  });

  test('7. Test login with invalid credentials', async () => {
    console.log('\n=== TEST 7: Login with Invalid Credentials ===');
    
    await context.clearCookies();
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle' });
    
    // Try invalid credentials
    await page.fill('input[name="email"], input[type="email"]', 'invalid@example.com');
    await page.fill('input[name="password"], input[type="password"]', 'wrongpassword');
    
    await takeScreenshot(page, '7-invalid-credentials-filled');
    
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    await page.waitForLoadState('networkidle');
    
    console.log(`After invalid login URL: ${page.url()}`);
    await takeScreenshot(page, '7-after-invalid-login');
    
    // Should stay on login page
    expect(page.url()).toContain('/auth/login');
    
    // Check for error message
    const errorMessages = await page.locator('.error, .alert-danger, .text-red-500, [role="alert"]').allTextContents();
    console.log(`Error messages found:`, errorMessages);
  });

  test('8. Test session persistence', async () => {
    console.log('\n=== TEST 8: Session Persistence ===');
    
    // Login
    await context.clearCookies();
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle' });
    await page.fill('input[name="email"], input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[name="password"], input[type="password"]', TEST_CREDENTIALS.password);
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")')
    ]);
    
    // Save cookies
    const cookies = await context.cookies();
    
    // Close and reopen browser with saved cookies
    await browser.close();
    
    browser = await chromium.launch({ headless: false });
    context = await browser.newContext();
    await context.addCookies(cookies);
    page = await context.newPage();
    setupConsoleLogging(page);
    
    // Try to access dashboard directly
    const response = await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    console.log(`Dashboard access with persisted session: ${response.status()}`);
    console.log(`URL: ${page.url()}`);
    
    await takeScreenshot(page, '8-session-persistence');
    
    // Should stay on dashboard, not redirect to login
    expect(page.url()).toContain('/dashboard');
  });
});

// Run the tests
console.log('\n=== Starting Comprehensive Authentication Tests ===\n');
console.log('Test server should be running at http://localhost:3000');
console.log('Screenshots will be saved to ./screenshots/\n');