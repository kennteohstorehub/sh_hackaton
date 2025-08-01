const { test, expect } = require('@playwright/test');
const { loginAsMerchant, generateRandomEmail } = require('./test-utils');
const testConfig = require('./test-config');

test.describe('Authentication - Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing sessions by visiting logout
    await page.goto('/auth/logout', { waitUntil: 'networkidle' });
  });

  test('Login page loads correctly with all required elements', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Verify page title
    await expect(page).toHaveTitle(/Sign In/i);
    
    // Verify all form elements are present
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Verify CSRF token is present
    const csrfMeta = page.locator('meta[name="csrf-token"]');
    await expect(csrfMeta).toHaveAttribute('content', /[\w-]+/);
    
    const csrfInput = page.locator('input[name="_csrf"]');
    await expect(csrfInput).toHaveValue(/[\w-]+/);
    
    // Verify remember me checkbox
    await expect(page.locator('input[name="rememberMe"]')).toBeVisible();
    
    // Verify links
    await expect(page.locator('a[href="/auth/register"]')).toBeVisible();
    await expect(page.locator('a[href="/auth/forgot-password"]')).toBeVisible();
  });

  test('Successful login with valid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Fill login form
    await page.fill('input[name="email"]', testConfig.testUser.email);
    await page.fill('input[name="password"]', testConfig.testUser.password);
    
    // Submit form
    await Promise.all([
      page.waitForNavigation({ url: '/dashboard' }),
      page.click('button[type="submit"]')
    ]);
    
    // Verify redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Verify user is logged in
    await expect(page.locator('body')).toContainText(/Dashboard/i);
    
    // Verify session cookie is set
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'qms_session');
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie.httpOnly).toBe(true);
    expect(sessionCookie.sameSite).toBe('Lax');
  });

  test('Failed login with invalid email', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Fill form with invalid email
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'anypassword');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should stay on login page
    await expect(page).toHaveURL(/\/auth\/login/);
    
    // Check for error message
    await expect(page.locator('.alert-danger')).toBeVisible();
    await expect(page.locator('.alert-danger')).toContainText(/Invalid email or password/i);
    
    // Verify form values are preserved (except password)
    await expect(page.locator('input[name="email"]')).toHaveValue('invalid@example.com');
    await expect(page.locator('input[name="password"]')).toHaveValue('');
  });

  test('Failed login with invalid password', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Fill form with valid email but wrong password
    await page.fill('input[name="email"]', testConfig.testUser.email);
    await page.fill('input[name="password"]', 'wrongpassword');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should stay on login page
    await expect(page).toHaveURL(/\/auth\/login/);
    
    // Check for error message
    await expect(page.locator('.alert-danger')).toBeVisible();
    await expect(page.locator('.alert-danger')).toContainText(/Invalid email or password/i);
  });

  test('Login with remember me option', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Fill form and check remember me
    await page.fill('input[name="email"]', testConfig.testUser.email);
    await page.fill('input[name="password"]', testConfig.testUser.password);
    await page.check('input[name="rememberMe"]');
    
    // Submit form
    await Promise.all([
      page.waitForNavigation({ url: '/dashboard' }),
      page.click('button[type="submit"]')
    ]);
    
    // Check session cookie has extended expiry
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'qms_session');
    
    // Cookie should expire in more than 7 days
    const expiryDate = new Date(sessionCookie.expires * 1000);
    const now = new Date();
    const daysDiff = (expiryDate - now) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeGreaterThan(7);
  });

  test('Login with redirect parameter', async ({ page }) => {
    // Try to access protected page
    await page.goto('/dashboard/queue-management');
    
    // Should redirect to login with redirect parameter
    await expect(page).toHaveURL(/\/auth\/login\?redirect=/);
    
    // Login
    await page.fill('input[name="email"]', testConfig.testUser.email);
    await page.fill('input[name="password"]', testConfig.testUser.password);
    
    // Submit and verify redirect to original page
    await Promise.all([
      page.waitForNavigation({ url: '/dashboard/queue-management' }),
      page.click('button[type="submit"]')
    ]);
    
    await expect(page).toHaveURL('/dashboard/queue-management');
  });

  test('Login form validation', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Test empty form submission
    await page.click('button[type="submit"]');
    
    // Check HTML5 validation
    const emailInput = page.locator('input[name="email"]');
    const emailValidity = await emailInput.evaluate(el => el.validity.valid);
    expect(emailValidity).toBe(false);
    
    // Test invalid email format
    await page.fill('input[name="email"]', 'notanemail');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Should show validation error
    const emailValidity2 = await emailInput.evaluate(el => el.validity.valid);
    expect(emailValidity2).toBe(false);
  });

  test('Login rate limiting', async ({ page }) => {
    // Attempt multiple failed logins
    for (let i = 0; i < 5; i++) {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', testConfig.testUser.email);
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
    }
    
    // Check if rate limit message appears or request is blocked
    // The exact behavior depends on implementation
    const errorMessage = page.locator('.alert');
    const errorText = await errorMessage.textContent();
    
    // Should either show rate limit message or generic error
    expect(errorText).toMatch(/too many|rate limit|try again/i);
  });

  test('Session regeneration on login', async ({ page }) => {
    // Get initial session cookie
    await page.goto('/');
    const initialCookies = await page.context().cookies();
    const initialSession = initialCookies.find(c => c.name === 'qms_session');
    
    // Login
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', testConfig.testUser.email);
    await page.fill('input[name="password"]', testConfig.testUser.password);
    
    await Promise.all([
      page.waitForNavigation({ url: '/dashboard' }),
      page.click('button[type="submit"]')
    ]);
    
    // Get new session cookie
    const newCookies = await page.context().cookies();
    const newSession = newCookies.find(c => c.name === 'qms_session');
    
    // Session ID should be different
    if (initialSession && newSession) {
      expect(newSession.value).not.toBe(initialSession.value);
    }
  });

  test('Concurrent login attempts', async ({ browser }) => {
    // Create two contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    try {
      // Load login page in both
      await Promise.all([
        page1.goto('/auth/login'),
        page2.goto('/auth/login')
      ]);
      
      // Fill forms in both
      await Promise.all([
        page1.fill('input[name="email"]', testConfig.testUser.email),
        page2.fill('input[name="email"]', testConfig.testUser.email),
        page1.fill('input[name="password"]', testConfig.testUser.password),
        page2.fill('input[name="password"]', testConfig.testUser.password)
      ]);
      
      // Submit both forms simultaneously
      const [nav1, nav2] = await Promise.all([
        page1.waitForNavigation({ url: '/dashboard' }),
        page2.waitForNavigation({ url: '/dashboard' }),
        page1.click('button[type="submit"]'),
        page2.click('button[type="submit"]')
      ]);
      
      // Both should succeed
      await expect(page1).toHaveURL('/dashboard');
      await expect(page2).toHaveURL('/dashboard');
      
      // Both should have valid sessions
      const cookies1 = await context1.cookies();
      const cookies2 = await context2.cookies();
      
      const session1 = cookies1.find(c => c.name === 'qms_session');
      const session2 = cookies2.find(c => c.name === 'qms_session');
      
      expect(session1).toBeTruthy();
      expect(session2).toBeTruthy();
      
      // Sessions should be different
      expect(session1.value).not.toBe(session2.value);
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('XSS prevention in login error messages', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Try to inject script in email field
    const xssPayload = '<script>alert("XSS")</script>@example.com';
    await page.fill('input[name="email"]', xssPayload);
    await page.fill('input[name="password"]', 'password');
    
    await page.click('button[type="submit"]');
    
    // Check that script is not executed
    const alertFired = await page.evaluate(() => {
      let alertCalled = false;
      const originalAlert = window.alert;
      window.alert = () => { alertCalled = true; };
      
      // Wait a bit to see if alert fires
      return new Promise(resolve => {
        setTimeout(() => {
          window.alert = originalAlert;
          resolve(alertCalled);
        }, 1000);
      });
    });
    
    expect(alertFired).toBe(false);
    
    // Check error message is properly escaped
    const errorMessage = await page.locator('.alert-danger').textContent();
    expect(errorMessage).not.toContain('<script>');
  });

  test('Password field security', async ({ page }) => {
    await page.goto('/auth/login');
    
    const passwordInput = page.locator('input[name="password"]');
    
    // Verify password field type
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Verify autocomplete attribute
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
    
    // Verify password is not visible in page source
    await page.fill('input[name="password"]', 'mysecretpassword');
    const pageContent = await page.content();
    expect(pageContent).not.toContain('mysecretpassword');
  });

  test('Login persistence across page refresh', async ({ page }) => {
    // Login
    await loginAsMerchant(page, testConfig.testUser.email, testConfig.testUser.password);
    
    // Refresh page
    await page.reload();
    
    // Should still be on dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Navigate to another protected page
    await page.goto('/dashboard/queue-management');
    await expect(page).toHaveURL('/dashboard/queue-management');
  });

  test('Login with special characters in credentials', async ({ page }) => {
    // This test assumes there's a test account with special characters
    // or tests the error handling for such cases
    await page.goto('/auth/login');
    
    const specialEmail = 'test+special@example.com';
    const specialPassword = 'P@ssw0rd!#$%^&*()';
    
    await page.fill('input[name="email"]', specialEmail);
    await page.fill('input[name="password"]', specialPassword);
    await page.click('button[type="submit"]');
    
    // Should handle special characters properly (either login or show error)
    // No JavaScript errors should occur
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));
    
    await page.waitForLoadState('networkidle');
    expect(jsErrors).toHaveLength(0);
  });
});