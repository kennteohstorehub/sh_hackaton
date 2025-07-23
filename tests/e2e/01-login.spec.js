const { test, expect } = require('@playwright/test');
const { LoginPage } = require('./pages/LoginPage');

test.describe('Login Page Tests', () => {
  let loginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('should display login page correctly', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Login - StoreHub Queue Management System/);
    
    // Check form elements
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
    await expect(loginPage.registerLink).toBeVisible();
    
    // Check labels
    await expect(page.locator('label[for="email"]')).toHaveText('Email Address');
    await expect(page.locator('label[for="password"]')).toHaveText('Password');
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    // Click submit without filling fields
    await loginPage.submitButton.click();
    
    // Check for validation messages
    await expect(page.locator(':text("Email is required")')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await loginPage.login('invalid@email.com', 'wrongpassword');
    
    // Wait for error message
    await expect(loginPage.errorMessage).toBeVisible();
    await expect(loginPage.errorMessage).toContainText('Invalid email or password');
  });

  test('should login successfully with demo credentials', async ({ page }) => {
    // Login with demo credentials
    await loginPage.login('demo@smartqueue.com', 'demo123456');
    
    // Should redirect to dashboard
    await page.waitForURL('**/dashboard');
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // Check for welcome message
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should show password field as password type', async ({ page }) => {
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
  });

  test('should navigate to register page', async ({ page }) => {
    await loginPage.registerLink.click();
    await expect(page).toHaveURL(/.*\/auth\/register/);
  });

  test('should handle XSS attempts in login fields', async ({ page }) => {
    const xssPayload = '<script>alert("XSS")</script>';
    await loginPage.login(xssPayload, xssPayload);
    
    // Should not execute script, should show error
    await expect(loginPage.errorMessage).toBeVisible();
    
    // Check that script tags are not rendered
    const pageContent = await page.content();
    expect(pageContent).not.toContain('<script>alert("XSS")</script>');
  });

  test('should persist session after login', async ({ page, context }) => {
    // Login
    await loginPage.login('demo@smartqueue.com', 'demo123456');
    await page.waitForURL('**/dashboard');
    
    // Open new page in same context
    const newPage = await context.newPage();
    await newPage.goto('/dashboard');
    
    // Should still be logged in
    await expect(newPage).toHaveURL(/.*\/dashboard/);
    await expect(newPage.locator('h1')).toContainText('Dashboard');
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    // Try to access dashboard without login
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*\/auth\/login/);
  });
});

test.describe('Login Page Accessibility', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // Check form accessibility
    await expect(loginPage.emailInput).toHaveAttribute('aria-label', /email/i);
    await expect(loginPage.passwordInput).toHaveAttribute('aria-label', /password/i);
    
    // Check form role
    const form = page.locator('form');
    await expect(form).toHaveAttribute('role', 'form');
  });

  test('should be keyboard navigable', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // Tab through form
    await page.keyboard.press('Tab'); // Focus email
    await expect(loginPage.emailInput).toBeFocused();
    
    await page.keyboard.press('Tab'); // Focus password
    await expect(loginPage.passwordInput).toBeFocused();
    
    await page.keyboard.press('Tab'); // Focus submit
    await expect(loginPage.submitButton).toBeFocused();
  });
});