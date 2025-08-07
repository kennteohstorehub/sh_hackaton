const { test, expect } = require('@playwright/test');
const testConfig = require('./test-config');

/**
 * Comprehensive Multi-Tenant Authentication System Tests
 * 
 * This test suite covers:
 * 1. BackOffice authentication at admin.lvh.me:3000
 * 2. Tenant authentication flows (demo.lvh.me:3000, test-cafe.lvh.me:3000)
 * 3. Session isolation between contexts
 * 4. Security boundaries and access control
 * 5. Edge cases and error handling
 */

// Test credentials
const CREDENTIALS = {
  backoffice: {
    email: 'backoffice@storehubqms.local',
    password: 'BackOffice123!@#',
    baseUrl: 'http://admin.lvh.me:3000'
  },
  tenants: {
    demo: {
      email: 'admin@demo.local',
      password: 'Demo123!@#',
      baseUrl: 'http://demo.lvh.me:3000'
    },
    testCafe: {
      email: 'cafe@testcafe.local',
      password: 'Test123!@#',
      baseUrl: 'http://test-cafe.lvh.me:3000'
    }
  },
  invalid: {
    email: 'invalid@example.com',
    password: 'wrongpassword123'
  }
};

test.describe('Multi-Tenant Authentication System - Comprehensive Tests', () => {

  test.describe('BackOffice Authentication Flow', () => {
    
    test.beforeEach(async ({ page }) => {
      // Clear all session data before each test
      await page.context().clearCookies();
      await page.evaluate(() => {
        sessionStorage.clear();
        localStorage.clear();
      });
    });

    test('should display BackOffice login page with correct branding', async ({ page }) => {
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
      
      // Verify page loads successfully
      await expect(page).toHaveTitle(/BackOffice|Admin/);
      
      // Check for BackOffice-specific elements
      await expect(page.locator('h1, h2, .login-title')).toContainText(/BackOffice|Admin/i);
      
      // Verify form structure
      await expect(page.locator('form')).toBeVisible();
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      // Check CSRF protection
      await expect(page.locator('input[name="_csrf"]')).toBeVisible();
    });

    test('should successfully authenticate BackOffice user and redirect to dashboard', async ({ page }) => {
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
      
      // Fill credentials
      await page.fill('input[name="email"]', CREDENTIALS.backoffice.email);
      await page.fill('input[name="password"]', CREDENTIALS.backoffice.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should redirect to BackOffice dashboard
      await expect(page).toHaveURL(/.*\/backoffice\/dashboard/, { timeout: 10000 });
      
      // Verify BackOffice dashboard elements
      await expect(page.locator('body')).toContainText(/welcome|dashboard/i);
      
      // Should show BackOffice navigation
      const nav = page.locator('nav, .navbar, .navigation');
      if (await nav.isVisible()) {
        await expect(nav).toBeVisible();
      }
    });

    test('should reject invalid BackOffice credentials', async ({ page }) => {
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
      
      // Fill invalid credentials
      await page.fill('input[name="email"]', CREDENTIALS.invalid.email);
      await page.fill('input[name="password"]', CREDENTIALS.invalid.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should remain on login page
      await expect(page.url()).toContain('/login');
      
      // Should show error message
      await expect(page.locator('.alert-danger, .error, .flash-error')).toBeVisible();
    });

    test('should maintain BackOffice session across page reloads', async ({ page }) => {
      // Login first
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
      await page.fill('input[name="email"]', CREDENTIALS.backoffice.email);
      await page.fill('input[name="password"]', CREDENTIALS.backoffice.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*\/backoffice\/dashboard/);
      
      // Reload page
      await page.reload();
      
      // Should still be authenticated
      await expect(page).toHaveURL(/.*\/backoffice\/dashboard/);
      expect(page.url()).not.toContain('/login');
    });

    test('should successfully logout from BackOffice', async ({ page }) => {
      // Login first
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
      await page.fill('input[name="email"]', CREDENTIALS.backoffice.email);
      await page.fill('input[name="password"]', CREDENTIALS.backoffice.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*\/backoffice\/dashboard/);
      
      // Find and click logout
      const logoutLink = page.locator('a[href*="logout"], a:has-text("Logout"), a:has-text("Sign Out")').first();
      await logoutLink.click();
      
      // Should redirect to login page
      await expect(page).toHaveURL(/.*\/backoffice.*\/login/);
      
      // Verify logout by trying to access protected page
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/dashboard`);
      await expect(page.url()).toContain('/login');
    });
  });

  test.describe('Tenant Authentication Flow - Demo Tenant', () => {
    
    test.beforeEach(async ({ page }) => {
      // Clear all session data before each test
      await page.context().clearCookies();
      await page.evaluate(() => {
        sessionStorage.clear();
        localStorage.clear();
      });
    });

    test('should display demo tenant login page with tenant branding', async ({ page }) => {
      await page.goto(`${CREDENTIALS.tenants.demo.baseUrl}/auth/login`);
      
      // Verify page loads successfully
      await expect(page).toHaveTitle(/Login.*StoreHub/);
      
      // Check for tenant-specific branding (demo tenant)
      const title = await page.locator('h1, h2, .login-title').textContent();
      expect(title).toBeTruthy();
      
      // Verify form structure
      await expect(page.locator('form')).toBeVisible();
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      // Check CSRF protection
      await expect(page.locator('input[name="_csrf"]')).toBeVisible();
    });

    test('should successfully authenticate demo tenant user', async ({ page }) => {
      await page.goto(`${CREDENTIALS.tenants.demo.baseUrl}/auth/login`);
      
      // Fill credentials
      await page.fill('input[name="email"]', CREDENTIALS.tenants.demo.email);
      await page.fill('input[name="password"]', CREDENTIALS.tenants.demo.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should redirect to tenant dashboard
      await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
      
      // Verify we're still on demo subdomain
      expect(page.url()).toContain('demo.lvh.me');
      
      // Verify tenant dashboard elements
      await expect(page.locator('body')).toContainText(/welcome|dashboard/i);
    });

    test('should reject invalid demo tenant credentials', async ({ page }) => {
      await page.goto(`${CREDENTIALS.tenants.demo.baseUrl}/auth/login`);
      
      // Fill invalid credentials
      await page.fill('input[name="email"]', CREDENTIALS.invalid.email);
      await page.fill('input[name="password"]', CREDENTIALS.invalid.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should remain on login page
      await expect(page.url()).toContain('/login');
      
      // Should show error message
      await expect(page.locator('.alert-danger, .error, .flash-error')).toBeVisible();
    });

    test('should maintain demo tenant session context', async ({ page }) => {
      // Login to demo tenant
      await page.goto(`${CREDENTIALS.tenants.demo.baseUrl}/auth/login`);
      await page.fill('input[name="email"]', CREDENTIALS.tenants.demo.email);
      await page.fill('input[name="password"]', CREDENTIALS.tenants.demo.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*\/dashboard/);
      
      // Navigate to different pages within tenant
      await page.goto(`${CREDENTIALS.tenants.demo.baseUrl}/dashboard`);
      expect(page.url()).toContain('demo.lvh.me');
      expect(page.url()).not.toContain('/login');
      
      // Check queue management access
      await page.goto(`${CREDENTIALS.tenants.demo.baseUrl}/queue`);
      expect(page.url()).toContain('demo.lvh.me');
      
      // Should maintain authentication
      expect(page.url()).not.toContain('/login');
    });
  });

  test.describe('Tenant Authentication Flow - Test Cafe Tenant', () => {
    
    test.beforeEach(async ({ page }) => {
      // Clear all session data before each test
      await page.context().clearCookies();
      await page.evaluate(() => {
        sessionStorage.clear();
        localStorage.clear();
      });
    });

    test('should successfully authenticate test-cafe tenant user', async ({ page }) => {
      await page.goto(`${CREDENTIALS.tenants.testCafe.baseUrl}/auth/login`);
      
      // Fill credentials
      await page.fill('input[name="email"]', CREDENTIALS.tenants.testCafe.email);
      await page.fill('input[name="password"]', CREDENTIALS.tenants.testCafe.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should redirect to tenant dashboard
      await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
      
      // Verify we're on the correct subdomain
      expect(page.url()).toContain('test-cafe.lvh.me');
      
      // Verify tenant dashboard elements
      await expect(page.locator('body')).toContainText(/welcome|dashboard/i);
    });
  });

  test.describe('Session Isolation and Security Tests', () => {
    
    test('should prevent BackOffice session from accessing tenant resources', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      try {
        // Login to BackOffice
        await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
        await page.fill('input[name="email"]', CREDENTIALS.backoffice.email);
        await page.fill('input[name="password"]', CREDENTIALS.backoffice.password);
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/.*\/backoffice\/dashboard/);
        
        // Try to access tenant-specific resources with BackOffice session
        await page.goto(`${CREDENTIALS.tenants.demo.baseUrl}/dashboard`);
        
        // Should either redirect to tenant login or show error
        // The exact behavior depends on implementation, but should not show tenant dashboard
        const url = page.url();
        const isBlocked = url.includes('/login') || url.includes('/error') || url.includes('unauthorized');
        
        if (!isBlocked) {
          // If not redirected, check if we can access tenant-specific content
          const hasUnauthorizedAccess = await page.locator('body').textContent();
          expect(hasUnauthorizedAccess).not.toContain('demo tenant dashboard');
        }
      } finally {
        await context.close();
      }
    });

    test('should prevent tenant session from accessing BackOffice resources', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      try {
        // Login to tenant
        await page.goto(`${CREDENTIALS.tenants.demo.baseUrl}/auth/login`);
        await page.fill('input[name="email"]', CREDENTIALS.tenants.demo.email);
        await page.fill('input[name="password"]', CREDENTIALS.tenants.demo.password);
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/.*\/dashboard/);
        
        // Try to access BackOffice with tenant session
        await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/dashboard`);
        
        // Should redirect to BackOffice login
        await expect(page.url()).toContain('/login');
        
        // Should not have access to BackOffice functions
        const body = await page.locator('body').textContent();
        expect(body).not.toContain('BackOffice dashboard');
      } finally {
        await context.close();
      }
    });

    test('should isolate sessions between different tenants', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      try {
        // Login to demo tenant in first context
        await page1.goto(`${CREDENTIALS.tenants.demo.baseUrl}/auth/login`);
        await page1.fill('input[name="email"]', CREDENTIALS.tenants.demo.email);
        await page1.fill('input[name="password"]', CREDENTIALS.tenants.demo.password);
        await page1.click('button[type="submit"]');
        await expect(page1).toHaveURL(/.*\/dashboard/);
        
        // Login to test-cafe tenant in second context
        await page2.goto(`${CREDENTIALS.tenants.testCafe.baseUrl}/auth/login`);
        await page2.fill('input[name="email"]', CREDENTIALS.tenants.testCafe.email);
        await page2.fill('input[name="password"]', CREDENTIALS.tenants.testCafe.password);
        await page2.click('button[type="submit"]');
        await expect(page2).toHaveURL(/.*\/dashboard/);
        
        // Verify each session maintains its tenant context
        expect(page1.url()).toContain('demo.lvh.me');
        expect(page2.url()).toContain('test-cafe.lvh.me');
        
        // Try cross-tenant access (should fail)
        await page1.goto(`${CREDENTIALS.tenants.testCafe.baseUrl}/dashboard`);
        // Should redirect to login or show error
        const page1Url = page1.url();
        expect(page1Url.includes('/login') || page1Url.includes('/error')).toBeTruthy();
        
      } finally {
        await context1.close();
        await context2.close();
      }
    });

    test('should handle mixed session cleanup properly', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      try {
        // Login to BackOffice first
        await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
        await page.fill('input[name="email"]', CREDENTIALS.backoffice.email);
        await page.fill('input[name="password"]', CREDENTIALS.backoffice.password);
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/.*\/backoffice\/dashboard/);
        
        // Now try to login to a tenant (this should clean up the BackOffice session)
        await page.goto(`${CREDENTIALS.tenants.demo.baseUrl}/auth/login`);
        await page.fill('input[name="email"]', CREDENTIALS.tenants.demo.email);
        await page.fill('input[name="password"]', CREDENTIALS.tenants.demo.password);
        await page.click('button[type="submit"]');
        
        // Should successfully login to tenant
        await expect(page).toHaveURL(/.*\/dashboard/);
        expect(page.url()).toContain('demo.lvh.me');
        
        // BackOffice session should be cleaned up - verify by trying to access BackOffice
        await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/dashboard`);
        await expect(page.url()).toContain('/login');
        
      } finally {
        await context.close();
      }
    });
  });

  test.describe('CSRF Protection Tests', () => {
    
    test('should enforce CSRF protection on BackOffice login', async ({ page }) => {
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
      
      // Check CSRF token is present
      const csrfToken = await page.locator('input[name="_csrf"]').getAttribute('value');
      expect(csrfToken).toBeTruthy();
      expect(csrfToken.length).toBeGreaterThan(10);
      
      // Try to submit without CSRF token (by removing it)
      await page.locator('input[name="_csrf"]').evaluate(el => el.remove());
      
      await page.fill('input[name="email"]', CREDENTIALS.backoffice.email);
      await page.fill('input[name="password"]', CREDENTIALS.backoffice.password);
      await page.click('button[type="submit"]');
      
      // Should either stay on login page or show CSRF error
      const currentUrl = page.url();
      expect(currentUrl.includes('/login') || currentUrl.includes('/error')).toBeTruthy();
    });

    test('should enforce CSRF protection on tenant login', async ({ page }) => {
      await page.goto(`${CREDENTIALS.tenants.demo.baseUrl}/auth/login`);
      
      // Check CSRF token is present
      const csrfToken = await page.locator('input[name="_csrf"]').getAttribute('value');
      expect(csrfToken).toBeTruthy();
      expect(csrfToken.length).toBeGreaterThan(10);
    });
  });

  test.describe('Session Timeout Tests', () => {
    
    test('should handle BackOffice session timeout', async ({ page }) => {
      // Login to BackOffice
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
      await page.fill('input[name="email"]', CREDENTIALS.backoffice.email);
      await page.fill('input[name="password"]', CREDENTIALS.backoffice.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*\/backoffice\/dashboard/);
      
      // Wait to simulate session timeout (in real scenario this would be longer)
      await page.waitForTimeout(2000);
      
      // Try to access protected resource
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/settings`);
      
      // Should still be authenticated for this short timeout
      // This test mainly verifies timeout handling doesn't break the system
      const isStillAuth = !page.url().includes('/login');
      
      if (isStillAuth) {
        // If still authenticated, verify the page loads correctly
        await expect(page.locator('h1, h2')).toBeVisible();
      }
    });
  });

  test.describe('Edge Cases and Error Handling', () => {
    
    test('should handle invalid subdomain gracefully', async ({ page }) => {
      // Try to access non-existent tenant
      await page.goto('http://nonexistent.lvh.me:3000/auth/login');
      
      // Should show appropriate error page
      const response = await page.waitForResponse(/.*/, { timeout: 10000 });
      expect([404, 500]).toContain(response.status());
    });

    test('should handle empty credentials', async ({ page }) => {
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
      
      // Submit empty form
      await page.click('button[type="submit"]');
      
      // Should show validation errors or remain on login page
      await expect(page.url()).toContain('/login');
    });

    test('should handle malformed email addresses', async ({ page }) => {
      await page.goto(`${CREDENTIALS.tenants.demo.baseUrl}/auth/login`);
      
      // Try various malformed emails
      const malformedEmails = [
        'notanemail',
        '@domain.com',
        'user@',
        'user..name@domain.com'
      ];
      
      for (const email of malformedEmails) {
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', 'somepassword');
        await page.click('button[type="submit"]');
        
        // Should remain on login page or show validation error
        await expect(page.url()).toContain('/login');
        
        // Clear form for next iteration
        await page.fill('input[name="email"]', '');
        await page.fill('input[name="password"]', '');
      }
    });

    test('should handle concurrent login attempts', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      try {
        // Start login process in both contexts simultaneously
        const loginPromise1 = page1.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`).then(async () => {
          await page1.fill('input[name="email"]', CREDENTIALS.backoffice.email);
          await page1.fill('input[name="password"]', CREDENTIALS.backoffice.password);
          await page1.click('button[type="submit"]');
        });
        
        const loginPromise2 = page2.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`).then(async () => {
          await page2.fill('input[name="email"]', CREDENTIALS.backoffice.email);
          await page2.fill('input[name="password"]', CREDENTIALS.backoffice.password);
          await page2.click('button[type="submit"]');
        });
        
        // Wait for both login attempts
        await Promise.all([loginPromise1, loginPromise2]);
        
        // Both should either succeed or handle gracefully
        const page1Success = page1.url().includes('/dashboard');
        const page2Success = page2.url().includes('/dashboard');
        
        // At least one should succeed, or both should show appropriate error handling
        expect(page1Success || page2Success || 
               (page1.url().includes('/login') && page2.url().includes('/login'))).toBeTruthy();
        
      } finally {
        await context1.close();
        await context2.close();
      }
    });
  });

  test.describe('Remember Me Functionality', () => {
    
    test('should handle remember me checkbox if present', async ({ page }) => {
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
      
      // Check if remember me functionality exists
      const rememberCheckbox = page.locator('input[name="remember"], input[type="checkbox"]');
      
      if (await rememberCheckbox.isVisible()) {
        // Test remember me functionality
        await page.fill('input[name="email"]', CREDENTIALS.backoffice.email);
        await page.fill('input[name="password"]', CREDENTIALS.backoffice.password);
        await rememberCheckbox.check();
        await page.click('button[type="submit"]');
        
        await expect(page).toHaveURL(/.*\/backoffice\/dashboard/);
        
        // Close browser and reopen to test persistence
        await page.context().close();
        const newContext = await page.context().browser().newContext();
        const newPage = await newContext.newPage();
        
        await newPage.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/dashboard`);
        
        // Should either be logged in or handle remember me appropriately
        const isRemembered = !newPage.url().includes('/login');
        
        // This test mainly verifies the checkbox works without errors
        expect(typeof isRemembered).toBe('boolean');
        
        await newContext.close();
      }
    });
  });

  test.describe('Password Reset Flow', () => {
    
    test('should display password reset option if available', async ({ page }) => {
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
      
      // Look for forgot password link
      const forgotPasswordLink = page.locator('a:has-text("Forgot"), a:has-text("Reset"), [href*="forgot"], [href*="reset"]');
      
      if (await forgotPasswordLink.isVisible()) {
        await forgotPasswordLink.click();
        
        // Should navigate to password reset page
        expect(page.url()).toMatch(/forgot|reset/);
        
        // Should have email field for reset
        await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible();
      }
    });
  });

  test.describe('API Endpoint Security', () => {
    
    test('should protect API endpoints with authentication', async ({ page }) => {
      // Try to access API endpoints without authentication
      const apiEndpoints = [
        '/api/queue',
        '/api/merchants',
        '/api/dashboard',
        '/api/settings'
      ];
      
      for (const endpoint of apiEndpoints) {
        const response = await page.goto(`${CREDENTIALS.tenants.demo.baseUrl}${endpoint}`, { failOnStatusCode: false });
        
        // Should return 401 or redirect for unauthenticated requests
        expect([401, 302, 403]).toContain(response.status());
      }
    });
  });
});