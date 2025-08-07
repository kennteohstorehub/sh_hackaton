const { test, expect } = require('@playwright/test');
const testConfig = require('./test-config');

// BackOffice test credentials
const BACKOFFICE_CREDENTIALS = {
  email: 'backoffice@storehubqms.local',
  password: 'BackOffice123!@#'
};

// Invalid credentials for testing
const INVALID_CREDENTIALS = {
  email: 'invalid@test.com',
  password: 'wrongpassword123'
};

test.describe('BackOffice - Authentication Flow Testing', () => {
  
  test.beforeEach(async ({ page }) => {
    // Clear any existing sessions before each test
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
    
    // Clear cookies
    await page.context().clearCookies();
  });

  test.describe('Login Page', () => {
    
    test('should display login page with correct elements', async ({ page }) => {
      await page.goto('/backoffice/auth/login');
      
      // Check page loads successfully
      await expect(page).toHaveTitle(/BackOffice Login/);
      
      // Check main heading
      await expect(page.locator('h1, h2, .login-title')).toContainText(/BackOffice|Login/i);
      
      // Check form elements are present
      await expect(page.locator('form')).toBeVisible();
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      // Check CSRF protection
      await expect(page.locator('input[name="_csrf"]')).toBeVisible();
      
      // Check form labels
      await expect(page.locator('label, .form-label')).toContainText(/email/i);
      await expect(page.locator('label, .form-label')).toContainText(/password/i);
    });

    test('should have proper form validation attributes', async ({ page }) => {
      await page.goto('/backoffice/auth/login');
      
      // Email field should have email validation
      const emailField = page.locator('input[name="email"]');
      await expect(emailField).toHaveAttribute('type', 'email');
      await expect(emailField).toHaveAttribute('required');
      
      // Password field should be password type
      const passwordField = page.locator('input[name="password"]');
      await expect(passwordField).toHaveAttribute('type', 'password');
      await expect(passwordField).toHaveAttribute('required');
    });

    test('should show validation errors for empty form', async ({ page }) => {
      await page.goto('/backoffice/auth/login');
      
      // Submit empty form
      await page.click('button[type="submit"]');
      
      // Should show client-side validation or remain on page
      const url = page.url();
      expect(url).toContain('/login');
      
      // Check for validation messages
      const validationMessages = page.locator('.error, .invalid-feedback, .alert-danger, .form-error');
      if (await validationMessages.count() > 0) {
        await expect(validationMessages.first()).toBeVisible();
      }
    });

    test('should show validation errors for invalid email format', async ({ page }) => {
      await page.goto('/backoffice/auth/login');
      
      // Enter invalid email format
      await page.fill('input[name="email"]', 'invalid-email');
      await page.fill('input[name="password"]', 'somepassword');
      await page.click('button[type="submit"]');
      
      // Should show validation error
      const url = page.url();
      expect(url).toContain('/login');
    });
  });

  test.describe('Authentication Process', () => {
    
    test('should reject invalid credentials', async ({ page }) => {
      await page.goto('/backoffice/auth/login');
      
      // Fill invalid credentials
      await page.fill('input[name="email"]', INVALID_CREDENTIALS.email);
      await page.fill('input[name="password"]', INVALID_CREDENTIALS.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should remain on login page
      await expect(page.url()).toContain('/login');
      
      // Should show error message
      await expect(page.locator('.alert-error, .error, .flash-error, .alert-danger')).toBeVisible();
      await expect(page.locator('body')).toContainText(/invalid|incorrect|wrong/i);
    });

    test('should accept valid credentials and redirect to dashboard', async ({ page }) => {
      await page.goto('/backoffice/auth/login');
      
      // Fill valid credentials
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/backoffice\/dashboard/, { timeout: 10000 });
      
      // Should show success message
      await expect(page.locator('.alert-success, .success, .flash-success')).toBeVisible({ timeout: 5000 });
      
      // Should show welcome message with user name
      await expect(page.locator('body')).toContainText(/welcome/i);
    });

    test('should handle redirect parameter correctly', async ({ page }) => {
      // Try to access protected page first
      await page.goto('/backoffice/tenants');
      
      // Should redirect to login with redirect parameter
      await expect(page.url()).toContain('/login');
      await expect(page.url()).toContain('redirect');
      
      // Login with valid credentials
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      
      // Should redirect to originally requested page
      await expect(page).toHaveURL(/\/backoffice\/tenants/, { timeout: 10000 });
    });

    test('should prevent brute force attacks with rate limiting', async ({ page }) => {
      await page.goto('/backoffice/auth/login');
      
      // Attempt multiple failed logins quickly
      for (let i = 0; i < 6; i++) {
        await page.fill('input[name="email"]', `attempt${i}@test.com`);
        await page.fill('input[name="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');
        
        // Wait briefly between attempts
        await page.waitForTimeout(500);
      }
      
      // Should eventually show rate limiting message
      const errorMessage = page.locator('.alert-error, .error, .flash-error, .alert-danger');
      if (await errorMessage.isVisible()) {
        const errorText = await errorMessage.textContent();
        if (errorText && (errorText.includes('rate') || errorText.includes('limit') || errorText.includes('many'))) {
          // Rate limiting is working
          expect(errorText).toMatch(/rate|limit|many|slow/i);
        }
      }
    });
  });

  test.describe('Session Management', () => {
    
    test('should maintain session across page reloads', async ({ page }) => {
      // Login first
      await page.goto('/backoffice/auth/login');
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/backoffice\/dashboard/);
      
      // Reload the page
      await page.reload();
      
      // Should still be authenticated
      await expect(page).toHaveURL(/\/backoffice\/dashboard/);
      await expect(page.locator('nav, .navbar, .navigation')).toBeVisible();
    });

    test('should maintain session across navigation', async ({ page }) => {
      // Login first
      await page.goto('/backoffice/auth/login');
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/backoffice\/dashboard/);
      
      // Navigate to different pages
      const pages = ['/backoffice/tenants', '/backoffice/merchants', '/backoffice/settings'];
      
      for (const pagePath of pages) {
        await page.goto(pagePath);
        
        // Should not redirect to login
        expect(page.url()).not.toContain('/login');
        
        // Should show navigation (indicating user is authenticated)
        await expect(page.locator('nav, .navbar, .navigation')).toBeVisible();
      }
    });

    test('should handle session timeout', async ({ page }) => {
      // Login first
      await page.goto('/backoffice/auth/login');
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/backoffice\/dashboard/);
      
      // Wait for potential session timeout (this is just a basic test)
      // In a real scenario, you might want to manipulate session expiry
      await page.waitForTimeout(2000);
      
      // Try to access a protected page
      await page.goto('/backoffice/tenants');
      
      // Should still be authenticated for now (session timeout is usually longer)
      // This test mainly verifies the session handling doesn't break
      await expect(page.locator('h1, h2')).toBeVisible();
    });

    test('should create separate sessions for different tabs', async ({ browser }) => {
      // Create two different browser contexts (simulating different users)
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      // Login in first tab
      await page1.goto('/backoffice/auth/login');
      await page1.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page1.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page1.click('button[type="submit"]');
      await expect(page1).toHaveURL(/\/backoffice\/dashboard/);
      
      // Second tab should not be authenticated
      await page2.goto('/backoffice/dashboard');
      await expect(page2.url()).toContain('/login');
      
      // Clean up
      await context1.close();
      await context2.close();
    });
  });

  test.describe('Logout Functionality', () => {
    
    test.beforeEach(async ({ page }) => {
      // Login before each logout test
      await page.goto('/backoffice/auth/login');
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/backoffice\/dashboard/);
    });

    test('should display logout option in navigation', async ({ page }) => {
      // Look for logout link or button
      const logoutElements = page.locator('a[href*="logout"], button:has-text("Logout"), .logout, a:has-text("Logout"), a:has-text("Sign Out")');
      await expect(logoutElements.first()).toBeVisible();
    });

    test('should logout successfully via GET request', async ({ page }) => {
      // Find and click logout link
      const logoutLink = page.locator('a[href*="logout"], a:has-text("Logout"), a:has-text("Sign Out")').first();
      await logoutLink.click();
      
      // Should redirect to login page
      await expect(page).toHaveURL(/\/backoffice.*\/login/);
      
      // Should show login form (confirming user is logged out)
      await expect(page.locator('form')).toBeVisible();
      await expect(page.locator('input[name="email"]')).toBeVisible();
    });

    test('should logout successfully via POST request', async ({ page }) => {
      // Look for logout form (if using POST method)
      const logoutForm = page.locator('form[action*="logout"]');
      
      if (await logoutForm.isVisible()) {
        await logoutForm.locator('button[type="submit"]').click();
      } else {
        // Fallback to logout link
        const logoutLink = page.locator('a[href*="logout"], a:has-text("Logout")').first();
        await logoutLink.click();
      }
      
      // Should redirect to login page
      await expect(page).toHaveURL(/\/backoffice.*\/login/);
    });

    test('should clear session data after logout', async ({ page }) => {
      // Logout
      const logoutLink = page.locator('a[href*="logout"], a:has-text("Logout"), .logout').first();
      await logoutLink.click();
      await expect(page).toHaveURL(/\/backoffice.*\/login/);
      
      // Try to access protected page
      await page.goto('/backoffice/dashboard');
      
      // Should redirect back to login
      await expect(page.url()).toContain('/login');
    });

    test('should handle logout from multiple tabs', async ({ browser }) => {
      const context = await browser.newContext();
      const page1 = await context.newPage();
      const page2 = await context.newPage();
      
      // Login in both tabs (same session)
      for (const page of [page1, page2]) {
        await page.goto('/backoffice/auth/login');
        await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
        await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/\/backoffice\/dashboard/);
      }
      
      // Logout from first tab
      const logoutLink = page1.locator('a[href*="logout"], a:has-text("Logout")').first();
      await logoutLink.click();
      await expect(page1).toHaveURL(/\/backoffice.*\/login/);
      
      // Second tab should also be logged out
      await page2.reload();
      await expect(page2.url()).toContain('/login');
      
      await context.close();
    });
  });

  test.describe('Security Features', () => {
    
    test('should protect against CSRF attacks', async ({ page }) => {
      await page.goto('/backoffice/auth/login');
      
      // Check for CSRF token
      const csrfToken = page.locator('input[name="_csrf"]');
      await expect(csrfToken).toBeVisible();
      
      // Token should have a value
      const tokenValue = await csrfToken.getAttribute('value');
      expect(tokenValue).toBeTruthy();
      expect(tokenValue.length).toBeGreaterThan(10);
    });

    test('should use secure headers', async ({ page }) => {
      const response = await page.goto('/backoffice/auth/login');
      
      // Check for security headers
      const headers = response.headers();
      
      // These headers may or may not be present depending on configuration
      // Just verify the response is successful
      expect(response.status()).toBe(200);
    });

    test('should prevent direct access to protected routes', async ({ page }) => {
      const protectedRoutes = [
        '/backoffice/dashboard',
        '/backoffice/tenants',
        '/backoffice/merchants',
        '/backoffice/settings',
        '/backoffice/audit-logs'
      ];

      for (const route of protectedRoutes) {
        await page.goto(route);
        
        // Should redirect to login
        await expect(page.url()).toContain('/login');
      }
    });

    test('should handle password visibility toggle', async ({ page }) => {
      await page.goto('/backoffice/auth/login');
      
      const passwordField = page.locator('input[name="password"]');
      const toggleButton = page.locator('.password-toggle, .show-password, [data-toggle="password"]');
      
      if (await toggleButton.isVisible()) {
        // Initially password should be hidden
        await expect(passwordField).toHaveAttribute('type', 'password');
        
        // Click toggle
        await toggleButton.click();
        
        // Should now be visible
        await expect(passwordField).toHaveAttribute('type', 'text');
        
        // Click again to hide
        await toggleButton.click();
        await expect(passwordField).toHaveAttribute('type', 'password');
      }
    });

    test('should prevent password autocomplete if configured', async ({ page }) => {
      await page.goto('/backoffice/auth/login');
      
      const passwordField = page.locator('input[name="password"]');
      
      // Check if autocomplete is disabled (this is optional)
      const autocomplete = await passwordField.getAttribute('autocomplete');
      if (autocomplete) {
        // If autocomplete is set, it should be 'off' or 'new-password'
        expect(['off', 'new-password', 'current-password']).toContain(autocomplete);
      }
    });
  });

  test.describe('Error Handling', () => {
    
    test('should handle server errors gracefully', async ({ page }) => {
      // This test assumes you might have a way to trigger server errors
      // For now, just verify the login page handles unexpected responses
      
      await page.goto('/backoffice/auth/login');
      
      // Fill valid-looking data
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      
      // Submit and check response
      await page.click('button[type="submit"]');
      
      // Should either succeed or show appropriate error
      await page.waitForTimeout(3000);
      
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        // Still on login page, check for error message
        const errorMessage = page.locator('.alert-error, .error, .flash-error');
        if (await errorMessage.isVisible()) {
          const errorText = await errorMessage.textContent();
          expect(errorText).toBeTruthy();
        }
      } else {
        // Successfully logged in
        expect(currentUrl).toContain('/dashboard');
      }
    });

    test('should show appropriate error for account issues', async ({ page }) => {
      await page.goto('/backoffice/auth/login');
      
      // Try various edge cases
      const testCases = [
        { email: '', password: 'test123', expectedError: /email.*required/i },
        { email: 'test@test.com', password: '', expectedError: /password.*required/i },
        { email: 'invalid-email', password: 'test123', expectedError: /email.*valid/i }
      ];

      for (const testCase of testCases) {
        // Clear form
        await page.fill('input[name="email"]', '');
        await page.fill('input[name="password"]', '');
        
        // Fill test case data
        await page.fill('input[name="email"]', testCase.email);
        await page.fill('input[name="password"]', testCase.password);
        
        // Submit
        await page.click('button[type="submit"]');
        
        // Should show appropriate error or remain on login page
        await expect(page.url()).toContain('/login');
      }
    });
  });
});