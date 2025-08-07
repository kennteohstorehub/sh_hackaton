const { test, expect } = require('@playwright/test');

// Test configuration
const SUPERADMIN_CREDENTIALS = {
  email: 'superadmin@storehubqms.local',
  password: 'SuperAdmin123!@#',
  loginUrl: '/superadmin/auth/login'
};

const TENANT_CREDENTIALS = {
  email: 'admin@demo.local',
  password: 'Demo123!@#',
  loginUrl: '/auth/login'
};

test.describe('Login Credentials Testing', () => {
  
  test('SuperAdmin Login Flow', async ({ page }) => {
    console.log('🔍 Testing SuperAdmin login...');
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`🚨 Browser Console Error: ${msg.text()}`);
      }
    });

    page.on('pageerror', error => {
      console.error(`🚨 Page Error: ${error.message}`);
    });

    // Navigate to SuperAdmin login page
    console.log(`📍 Navigating to: ${SUPERADMIN_CREDENTIALS.loginUrl}`);
    await page.goto(SUPERADMIN_CREDENTIALS.loginUrl, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Take screenshot of login page
    await page.screenshot({ 
      path: 'superadmin-login-page.png',
      fullPage: true 
    });

    // Check if page loaded correctly
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);

    // Look for form elements with multiple selectors
    const emailField = page.locator('input[name="email"], input[type="email"], #email').first();
    const passwordField = page.locator('input[name="password"], input[type="password"], #password').first();
    const submitButton = page.locator('button[type="submit"], input[type="submit"], .btn-primary, .login-btn').first();

    // Check if form elements exist
    try {
      await expect(emailField).toBeVisible({ timeout: 10000 });
      console.log('✅ Email field found');
    } catch (e) {
      console.error('❌ Email field not found');
      const pageContent = await page.content();
      console.log('Page content preview:', pageContent.substring(0, 500));
    }

    try {
      await expect(passwordField).toBeVisible({ timeout: 10000 });
      console.log('✅ Password field found');
    } catch (e) {
      console.error('❌ Password field not found');
    }

    try {
      await expect(submitButton).toBeVisible({ timeout: 10000 });
      console.log('✅ Submit button found');
    } catch (e) {
      console.error('❌ Submit button not found');
      // Try to find any buttons
      const allButtons = await page.locator('button, input[type="submit"]').count();
      console.log(`Found ${allButtons} buttons on page`);
    }

    // Fill credentials if elements are found
    try {
      await emailField.fill(SUPERADMIN_CREDENTIALS.email);
      console.log('✅ Email filled');
      
      await passwordField.fill(SUPERADMIN_CREDENTIALS.password);
      console.log('✅ Password filled');

      // Take screenshot before submission
      await page.screenshot({ 
        path: 'superadmin-login-filled.png',
        fullPage: true 
      });

      // Submit form
      console.log('🚀 Submitting form...');
      await submitButton.click();

      // Wait for navigation or error
      await page.waitForLoadState('networkidle', { timeout: 15000 });

      // Take screenshot after submission
      await page.screenshot({ 
        path: 'superadmin-after-submit.png',
        fullPage: true 
      });

      // Check current URL
      const currentUrl = page.url();
      console.log(`📍 Current URL: ${currentUrl}`);

      // Look for success indicators
      if (currentUrl.includes('/dashboard') || currentUrl.includes('/superadmin')) {
        console.log('✅ Login appears successful - redirected to dashboard area');
      } else {
        console.log('⚠️ Still on login page - checking for errors');
        
        // Look for error messages
        const errorElements = await page.locator('.alert, .error, .text-danger, [role="alert"]').count();
        if (errorElements > 0) {
          const errorText = await page.locator('.alert, .error, .text-danger, [role="alert"]').first().textContent();
          console.log(`❌ Error message: ${errorText}`);
        }
      }

    } catch (error) {
      console.error(`❌ SuperAdmin login failed: ${error.message}`);
      await page.screenshot({ 
        path: 'superadmin-login-error.png',
        fullPage: true 
      });
    }
  });

  test('Regular Tenant Login Flow', async ({ page }) => {
    console.log('🔍 Testing Regular Tenant login...');
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`🚨 Browser Console Error: ${msg.text()}`);
      }
    });

    page.on('pageerror', error => {
      console.error(`🚨 Page Error: ${error.message}`);
    });

    // Navigate to tenant login page
    console.log(`📍 Navigating to: ${TENANT_CREDENTIALS.loginUrl}`);
    await page.goto(TENANT_CREDENTIALS.loginUrl, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Take screenshot of login page
    await page.screenshot({ 
      path: 'tenant-login-page.png',
      fullPage: true 
    });

    // Check if page loaded correctly
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);

    // Look for form elements
    const emailField = page.locator('input[name="email"], input[type="email"], #email').first();
    const passwordField = page.locator('input[name="password"], input[type="password"], #password').first();
    const submitButton = page.locator('button[type="submit"], input[type="submit"], .btn-primary, .login-btn').first();

    // Check if form elements exist
    try {
      await expect(emailField).toBeVisible({ timeout: 10000 });
      console.log('✅ Email field found');
    } catch (e) {
      console.error('❌ Email field not found');
    }

    try {
      await expect(passwordField).toBeVisible({ timeout: 10000 });
      console.log('✅ Password field found');
    } catch (e) {
      console.error('❌ Password field not found');
    }

    try {
      await expect(submitButton).toBeVisible({ timeout: 10000 });
      console.log('✅ Submit button found');
    } catch (e) {
      console.error('❌ Submit button not found');
    }

    // Fill credentials
    try {
      await emailField.fill(TENANT_CREDENTIALS.email);
      console.log('✅ Email filled');
      
      await passwordField.fill(TENANT_CREDENTIALS.password);
      console.log('✅ Password filled');

      // Take screenshot before submission
      await page.screenshot({ 
        path: 'tenant-login-filled.png',
        fullPage: true 
      });

      // Submit form
      console.log('🚀 Submitting form...');
      await submitButton.click();

      // Wait for navigation or error
      await page.waitForLoadState('networkidle', { timeout: 15000 });

      // Take screenshot after submission
      await page.screenshot({ 
        path: 'tenant-after-submit.png',
        fullPage: true 
      });

      // Check current URL
      const currentUrl = page.url();
      console.log(`📍 Current URL: ${currentUrl}`);

      // Look for success indicators
      if (currentUrl.includes('/dashboard')) {
        console.log('✅ Login appears successful - redirected to dashboard');
        
        // Look for dashboard elements
        const dashboardElements = await page.locator('h1, .dashboard, .queue-management').count();
        console.log(`Found ${dashboardElements} dashboard elements`);
        
      } else {
        console.log('⚠️ Still on login page - checking for errors');
        
        // Look for error messages
        const errorElements = await page.locator('.alert, .error, .text-danger, [role="alert"]').count();
        if (errorElements > 0) {
          const errorText = await page.locator('.alert, .error, .text-danger, [role="alert"]').first().textContent();
          console.log(`❌ Error message: ${errorText}`);
        }
      }

    } catch (error) {
      console.error(`❌ Tenant login failed: ${error.message}`);
      await page.screenshot({ 
        path: 'tenant-login-error.png',
        fullPage: true 
      });
    }
  });

  test('Cookie and Session Analysis', async ({ page, context }) => {
    console.log('🔍 Testing cookies and session...');
    
    // Test tenant login and analyze session
    await page.goto(TENANT_CREDENTIALS.loginUrl);
    
    // Fill and submit form
    await page.fill('input[name="email"], input[type="email"], #email', TENANT_CREDENTIALS.email);
    await page.fill('input[name="password"], input[type="password"], #password', TENANT_CREDENTIALS.password);
    await page.click('button[type="submit"], input[type="submit"], .btn-primary, .login-btn');
    
    await page.waitForLoadState('networkidle');
    
    // Analyze cookies
    const cookies = await context.cookies();
    console.log(`🍪 Total cookies: ${cookies.length}`);
    
    const sessionCookies = cookies.filter(cookie => 
      cookie.name.toLowerCase().includes('session') || 
      cookie.name.includes('connect.sid') || 
      cookie.name.toLowerCase().includes('auth') ||
      cookie.name.toLowerCase().includes('token')
    );
    
    console.log(`🔐 Session-related cookies: ${sessionCookies.length}`);
    sessionCookies.forEach(cookie => {
      console.log(`  - ${cookie.name}: ${cookie.value.substring(0, 20)}... (${cookie.httpOnly ? 'HttpOnly' : 'Not HttpOnly'}, ${cookie.secure ? 'Secure' : 'Not Secure'})`);
    });
    
    // Test protected route access
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    const finalUrl = page.url();
    if (finalUrl.includes('/dashboard')) {
      console.log('✅ Session maintained - can access protected routes');
    } else {
      console.log('❌ Session not maintained - redirected away from dashboard');
    }
  });

  test('CSRF Token Analysis', async ({ page }) => {
    console.log('🔍 Checking CSRF protection...');
    
    // Check tenant login page
    await page.goto(TENANT_CREDENTIALS.loginUrl);
    
    // Look for CSRF tokens
    const csrfTokens = await page.locator('input[name="_token"], input[name="csrfToken"], meta[name="csrf-token"], input[name="_csrf"]').count();
    console.log(`🛡️ Found ${csrfTokens} CSRF token(s) on tenant login page`);
    
    if (csrfTokens > 0) {
      const tokenElement = page.locator('input[name="_token"], input[name="csrfToken"], meta[name="csrf-token"], input[name="_csrf"]').first();
      const tokenValue = await tokenElement.getAttribute('value') || await tokenElement.getAttribute('content');
      if (tokenValue) {
        console.log(`🔑 CSRF token found: ${tokenValue.substring(0, 20)}...`);
      }
    } else {
      console.log('⚠️ No CSRF tokens found - potential security issue');
    }
    
    // Check SuperAdmin login page
    await page.goto(SUPERADMIN_CREDENTIALS.loginUrl);
    const superadminCsrfTokens = await page.locator('input[name="_token"], input[name="csrfToken"], meta[name="csrf-token"], input[name="_csrf"]').count();
    console.log(`🛡️ Found ${superadminCsrfTokens} CSRF token(s) on SuperAdmin login page`);
  });

  test('Network Request Monitoring', async ({ page }) => {
    console.log('🔍 Monitoring network requests...');
    
    const requests = [];
    const responses = [];
    
    page.on('request', request => {
      if (request.url().includes('/login') || request.url().includes('/auth')) {
        requests.push({
          method: request.method(),
          url: request.url(),
          headers: request.headers()
        });
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/login') || response.url().includes('/auth') || response.url().includes('/dashboard')) {
        responses.push({
          status: response.status(),
          url: response.url(),
          headers: response.headers()
        });
      }
    });
    
    // Test tenant login with network monitoring
    await page.goto(TENANT_CREDENTIALS.loginUrl);
    await page.fill('input[name="email"], input[type="email"], #email', TENANT_CREDENTIALS.email);
    await page.fill('input[name="password"], input[type="password"], #password', TENANT_CREDENTIALS.password);
    await page.click('button[type="submit"], input[type="submit"], .btn-primary, .login-btn');
    
    await page.waitForLoadState('networkidle');
    
    console.log(`📡 Captured ${requests.length} login-related requests:`);
    requests.forEach(req => {
      console.log(`  ${req.method} ${req.url}`);
    });
    
    console.log(`📡 Captured ${responses.length} login-related responses:`);
    responses.forEach(resp => {
      console.log(`  ${resp.status} ${resp.url}`);
      if (resp.headers['set-cookie']) {
        console.log(`    Sets cookies: ${Array.isArray(resp.headers['set-cookie']) ? resp.headers['set-cookie'].join(', ') : resp.headers['set-cookie']}`);
      }
    });
  });
});