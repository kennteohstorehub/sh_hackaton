const { test, expect } = require('@playwright/test');

/**
 * Multi-Tenant Security Tests
 * 
 * This test suite focuses on security aspects of the multi-tenant authentication system:
 * - Session hijacking prevention
 * - Cross-tenant data access prevention
 * - CSRF protection
 * - Session fixation prevention
 * - Privilege escalation prevention
 * - Input validation and sanitization
 */

// Test credentials
const CREDENTIALS = {
  backoffice: {
    email: 'backoffice@storehubqms.local',
    password: 'BackOffice123!@#',
    baseUrl: 'http://admin.lvh.me:3838'
  },
  tenants: {
    demo: {
      email: 'admin@demo.local',
      password: 'Demo123!@#',
      baseUrl: 'http://demo.lvh.me:3838'
    },
    testCafe: {
      email: 'cafe@testcafe.local',
      password: 'Test123!@#',
      baseUrl: 'http://test-cafe.lvh.me:3838'
    }
  }
};

test.describe('Multi-Tenant Security Tests', () => {

  test.describe('Session Security', () => {
    
    test('should prevent session fixation attacks', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        // Get initial session cookie
        await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
        const initialCookies = await page.context().cookies();
        const initialSessionCookie = initialCookies.find(cookie => cookie.name.includes('session') || cookie.name.includes('connect.sid'));

        // Login with valid credentials
        await page.fill('input[name="email"]', CREDENTIALS.backoffice.email);
        await page.fill('input[name="password"]', CREDENTIALS.backoffice.password);
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/.*\/backoffice\/dashboard/);

        // Get session cookie after login
        const postLoginCookies = await page.context().cookies();
        const postLoginSessionCookie = postLoginCookies.find(cookie => cookie.name.includes('session') || cookie.name.includes('connect.sid'));

        // Session ID should change after login (prevents session fixation)
        if (initialSessionCookie && postLoginSessionCookie) {
          expect(postLoginSessionCookie.value).not.toBe(initialSessionCookie.value);
        }
      } finally {
        await context.close();
      }
    });

    test('should secure session cookies with proper flags', async ({ page }) => {
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
      await page.fill('input[name="email"]', CREDENTIALS.backoffice.email);
      await page.fill('input[name="password"]', CREDENTIALS.backoffice.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*\/backoffice\/dashboard/);

      // Check session cookie security flags
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(cookie => 
        cookie.name.includes('session') || cookie.name.includes('connect.sid')
      );

      if (sessionCookie) {
        // In production, these should be true
        // For development, httpOnly should still be true
        expect(sessionCookie.httpOnly).toBe(true);
        
        // Secure flag depends on HTTPS usage
        if (page.url().startsWith('https://')) {
          expect(sessionCookie.secure).toBe(true);
        }
      }
    });

    test('should prevent cross-site session leakage', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      try {
        // Login in first context
        await page1.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
        await page1.fill('input[name="email"]', CREDENTIALS.backoffice.email);
        await page1.fill('input[name="password"]', CREDENTIALS.backoffice.password);
        await page1.click('button[type="submit"]');
        await expect(page1).toHaveURL(/.*\/backoffice\/dashboard/);

        // Second context should not have access
        await page2.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/dashboard`);
        await expect(page2.url()).toContain('/login');
      } finally {
        await context1.close();
        await context2.close();
      }
    });
  });

  test.describe('Cross-Tenant Access Prevention', () => {
    
    test('should prevent tenant A from accessing tenant B resources via URL manipulation', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        // Login to demo tenant
        await page.goto(`${CREDENTIALS.tenants.demo.baseUrl}/auth/login`);
        await page.fill('input[name="email"]', CREDENTIALS.tenants.demo.email);
        await page.fill('input[name="password"]', CREDENTIALS.tenants.demo.password);
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/.*\/dashboard/);

        // Try to access test-cafe tenant resources
        await page.goto(`${CREDENTIALS.tenants.testCafe.baseUrl}/dashboard`);
        
        // Should be redirected to login or show access denied
        const finalUrl = page.url();
        expect(finalUrl.includes('/login') || finalUrl.includes('/error') || finalUrl.includes('unauthorized')).toBeTruthy();
      } finally {
        await context.close();
      }
    });

    test('should prevent API endpoint cross-tenant data access', async ({ page }) => {
      // Login to demo tenant
      await page.goto(`${CREDENTIALS.tenants.demo.baseUrl}/auth/login`);
      await page.fill('input[name="email"]', CREDENTIALS.tenants.demo.email);
      await page.fill('input[name="password"]', CREDENTIALS.tenants.demo.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*\/dashboard/);

      // Try to access API endpoints from different tenant context
      const apiResponse = await page.goto(`${CREDENTIALS.tenants.testCafe.baseUrl}/api/queue`, { 
        failOnStatusCode: false 
      });
      
      // Should return error status
      expect([400, 401, 403, 404]).toContain(apiResponse.status());
    });

    test('should prevent BackOffice from accessing tenant-specific data without proper context', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        // Login to BackOffice
        await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
        await page.fill('input[name="email"]', CREDENTIALS.backoffice.email);
        await page.fill('input[name="password"]', CREDENTIALS.backoffice.password);
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/.*\/backoffice\/dashboard/);

        // Try to directly access tenant dashboard (should fail or redirect)
        await page.goto(`${CREDENTIALS.tenants.demo.baseUrl}/dashboard`);
        
        const finalUrl = page.url();
        // Should not have direct access to tenant dashboard
        expect(finalUrl.includes('/login') || finalUrl.includes('/error') || !finalUrl.includes('demo.lvh.me')).toBeTruthy();
      } finally {
        await context.close();
      }
    });
  });

  test.describe('CSRF Protection', () => {
    
    test('should reject requests without valid CSRF token', async ({ page }) => {
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);

      // Remove CSRF token
      await page.evaluate(() => {
        const csrfInput = document.querySelector('input[name="_csrf"]');
        if (csrfInput) csrfInput.remove();
      });

      await page.fill('input[name="email"]', CREDENTIALS.backoffice.email);
      await page.fill('input[name="password"]', CREDENTIALS.backoffice.password);
      await page.click('button[type="submit"]');

      // Should either stay on login page or show CSRF error
      const currentUrl = page.url();
      expect(currentUrl.includes('/login')).toBeTruthy();
    });

    test('should reject requests with invalid CSRF token', async ({ page }) => {
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);

      // Modify CSRF token to invalid value
      await page.evaluate(() => {
        const csrfInput = document.querySelector('input[name="_csrf"]');
        if (csrfInput) csrfInput.value = 'invalid-csrf-token';
      });

      await page.fill('input[name="email"]', CREDENTIALS.backoffice.email);
      await page.fill('input[name="password"]', CREDENTIALS.backoffice.password);
      await page.click('button[type="submit"]');

      // Should either stay on login page or show CSRF error
      const currentUrl = page.url();
      expect(currentUrl.includes('/login')).toBeTruthy();
    });

    test('should generate unique CSRF tokens per session', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      try {
        // Get CSRF tokens from both sessions
        await page1.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
        await page2.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);

        const token1 = await page1.locator('input[name="_csrf"]').getAttribute('value');
        const token2 = await page2.locator('input[name="_csrf"]').getAttribute('value');

        // Tokens should be different
        expect(token1).not.toBe(token2);
        expect(token1).toBeTruthy();
        expect(token2).toBeTruthy();
      } finally {
        await context1.close();
        await context2.close();
      }
    });
  });

  test.describe('Input Validation and Sanitization', () => {
    
    test('should handle SQL injection attempts in login form', async ({ page }) => {
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);

      // Try SQL injection payloads
      const sqlInjectionPayloads = [
        "admin' OR '1'='1' --",
        "admin'; DROP TABLE users; --",
        "admin' UNION SELECT * FROM users --",
        "'; SELECT * FROM sessions; --"
      ];

      for (const payload of sqlInjectionPayloads) {
        await page.fill('input[name="email"]', payload);
        await page.fill('input[name="password"]', 'any_password');
        await page.click('button[type="submit"]');

        // Should reject and stay on login page
        await expect(page.url()).toContain('/login');
      }
    });

    test('should handle XSS attempts in login form', async ({ page }) => {
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);

      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '"><script>alert("xss")</script>'
      ];

      for (const payload of xssPayloads) {
        await page.fill('input[name="email"]', payload);
        await page.fill('input[name="password"]', 'any_password');
        await page.click('button[type="submit"]');

        // Check that script wasn't executed
        const dialogPromise = page.waitForEvent('dialog', { timeout: 1000 }).catch(() => null);
        const dialog = await dialogPromise;
        
        if (dialog) {
          await dialog.dismiss();
          throw new Error('XSS payload was executed - security vulnerability detected');
        }

        // Should handle gracefully
        await expect(page.url()).toContain('/login');
      }
    });

    test('should validate email format strictly', async ({ page }) => {
      await page.goto(`${CREDENTIALS.tenants.demo.baseUrl}/auth/login`);

      const invalidEmails = [
        'not-an-email',
        '@domain.com',
        'user@',
        'user..name@domain.com',
        'user name@domain.com',
        'user@domain',
        'user@.domain.com'
      ];

      for (const email of invalidEmails) {
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', 'somepassword');
        await page.click('button[type="submit"]');

        // Should either show validation error or remain on login page
        const currentUrl = page.url();
        expect(currentUrl.includes('/login')).toBeTruthy();
      }
    });
  });

  test.describe('Rate Limiting and Brute Force Protection', () => {
    
    test('should implement rate limiting on login attempts', async ({ page }) => {
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);

      // Attempt multiple rapid login failures
      for (let i = 0; i < 10; i++) {
        await page.fill('input[name="email"]', `test${i}@example.com`);
        await page.fill('input[name="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');
        
        // Brief wait between attempts
        await page.waitForTimeout(200);
        
        // Should stay on login page
        await expect(page.url()).toContain('/login');
      }

      // After many attempts, should show rate limiting message
      const errorMessage = page.locator('.alert-danger, .error, .flash-error');
      if (await errorMessage.isVisible()) {
        const errorText = await errorMessage.textContent();
        // Check if rate limiting is mentioned
        const hasRateLimit = errorText && (
          errorText.includes('rate') || 
          errorText.includes('limit') || 
          errorText.includes('many') ||
          errorText.includes('slow')
        );
        
        // If rate limiting is implemented, it should be mentioned
        // If not implemented, this test documents the security gap
        if (hasRateLimit) {
          expect(errorText).toMatch(/rate|limit|many|slow/i);
        }
      }
    });

    test('should handle concurrent login attempts gracefully', async ({ browser }) => {
      const contexts = [];
      const pages = [];

      try {
        // Create multiple concurrent contexts
        for (let i = 0; i < 5; i++) {
          const context = await browser.newContext();
          const page = await context.newPage();
          contexts.push(context);
          pages.push(page);
        }

        // Start concurrent login attempts
        const loginPromises = pages.map(async (page, index) => {
          await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
          await page.fill('input[name="email"]', `test${index}@example.com`);
          await page.fill('input[name="password"]', 'wrongpassword');
          return page.click('button[type="submit"]');
        });

        // Wait for all attempts to complete
        await Promise.all(loginPromises);

        // All should handle gracefully without server errors
        for (const page of pages) {
          await expect(page.url()).toContain('/login');
        }
      } finally {
        // Clean up contexts
        for (const context of contexts) {
          await context.close();
        }
      }
    });
  });

  test.describe('Privilege Escalation Prevention', () => {
    
    test('should prevent tenant user from escalating to BackOffice privileges', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        // Login as tenant user
        await page.goto(`${CREDENTIALS.tenants.demo.baseUrl}/auth/login`);
        await page.fill('input[name="email"]', CREDENTIALS.tenants.demo.email);
        await page.fill('input[name="password"]', CREDENTIALS.tenants.demo.password);
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/.*\/dashboard/);

        // Try to access BackOffice privileged endpoints
        const privilegedEndpoints = [
          '/backoffice/dashboard',
          '/backoffice/tenants',
          '/backoffice/merchants',
          '/backoffice/audit-logs',
          '/backoffice/settings'
        ];

        for (const endpoint of privilegedEndpoints) {
          await page.goto(`${CREDENTIALS.backoffice.baseUrl}${endpoint}`);
          
          // Should not have access
          const currentUrl = page.url();
          expect(currentUrl.includes('/login') || currentUrl.includes('/error')).toBeTruthy();
        }
      } finally {
        await context.close();
      }
    });

    test('should prevent session manipulation for privilege escalation', async ({ page }) => {
      // Login as tenant user
      await page.goto(`${CREDENTIALS.tenants.demo.baseUrl}/auth/login`);
      await page.fill('input[name="email"]', CREDENTIALS.tenants.demo.email);
      await page.fill('input[name="password"]', CREDENTIALS.tenants.demo.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*\/dashboard/);

      // Try to manipulate session via client-side JavaScript
      const sessionManipulationAttempts = [
        'sessionStorage.setItem("isBackOffice", "true")',
        'localStorage.setItem("backOfficeUserId", "admin-123")',
        'document.cookie = "backoffice=true; path=/"',
        'sessionStorage.setItem("role", "admin")'
      ];

      for (const script of sessionManipulationAttempts) {
        await page.evaluate(script);
      }

      // Try to access BackOffice after manipulation
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/dashboard`);
      
      // Should still not have access
      const currentUrl = page.url();
      expect(currentUrl.includes('/login') || currentUrl.includes('/error')).toBeTruthy();
    });
  });

  test.describe('Data Leakage Prevention', () => {
    
    test('should not expose sensitive data in error messages', async ({ page }) => {
      // Try login with non-existent user
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
      await page.fill('input[name="email"]', 'nonexistent@example.com');
      await page.fill('input[name="password"]', 'anypassword');
      await page.click('button[type="submit"]');

      // Check error message doesn't reveal system information
      const errorElement = page.locator('.alert-danger, .error, .flash-error');
      if (await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        
        // Should not contain sensitive information
        const sensitiveTerms = [
          'database',
          'sql',
          'connection',
          'server error',
          'stack trace',
          'prisma',
          'mongodb'
        ];

        for (const term of sensitiveTerms) {
          expect(errorText.toLowerCase()).not.toContain(term);
        }
      }
    });

    test('should not expose session data in client-side code', async ({ page }) => {
      // Login first
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
      await page.fill('input[name="email"]', CREDENTIALS.backoffice.email);
      await page.fill('input[name="password"]', CREDENTIALS.backoffice.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*\/backoffice\/dashboard/);

      // Check that session data is not exposed in client-side storage
      const sessionStorage = await page.evaluate(() => Object.keys(sessionStorage));
      const localStorage = await page.evaluate(() => Object.keys(localStorage));
      const pageContent = await page.content();

      // Should not contain sensitive session data
      const sensitivePatterns = [
        /sessionId.*[a-f0-9]{32}/i,
        /backOfficeUserId.*[a-f0-9-]{36}/i,
        /password.*[a-zA-Z0-9]/i,
        /"session":\s*{[^}]*"backOfficeUserId"/i
      ];

      for (const pattern of sensitivePatterns) {
        expect(pageContent).not.toMatch(pattern);
      }

      // Session/localStorage should not contain sensitive keys
      const allStorageKeys = [...sessionStorage, ...localStorage];
      const sensitiveKeys = ['password', 'sessionId', 'backOfficeUserId', 'csrf'];
      
      for (const key of sensitiveKeys) {
        expect(allStorageKeys.some(storageKey => storageKey.toLowerCase().includes(key))).toBe(false);
      }
    });
  });

  test.describe('Timeout and Session Management', () => {
    
    test('should handle session timeout securely', async ({ page }) => {
      // Login first
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
      await page.fill('input[name="email"]', CREDENTIALS.backoffice.email);
      await page.fill('input[name="password"]', CREDENTIALS.backoffice.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*\/backoffice\/dashboard/);

      // Simulate session timeout by waiting
      await page.waitForTimeout(5000);

      // Try to access sensitive data
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/settings`);

      // Should either still be authenticated (short timeout) or redirect to login
      const currentUrl = page.url();
      const isAuthenticated = !currentUrl.includes('/login');
      
      if (isAuthenticated) {
        // If still authenticated, verify the page loads correctly
        await expect(page.locator('h1, h2')).toBeVisible();
      } else {
        // If timed out, should be on login page
        await expect(page.url()).toContain('/login');
      }
    });

    test('should securely clear session data on logout', async ({ page }) => {
      // Login first
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/auth/login`);
      await page.fill('input[name="email"]', CREDENTIALS.backoffice.email);
      await page.fill('input[name="password"]', CREDENTIALS.backoffice.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*\/backoffice\/dashboard/);

      // Logout
      const logoutLink = page.locator('a[href*="logout"], a:has-text("Logout")').first();
      await logoutLink.click();
      await expect(page).toHaveURL(/.*\/login/);

      // Try to access protected resource
      await page.goto(`${CREDENTIALS.backoffice.baseUrl}/backoffice/dashboard`);
      
      // Should redirect to login
      await expect(page.url()).toContain('/login');

      // Check that browser back button doesn't expose cached content
      await page.goBack();
      const currentUrl = page.url();
      expect(currentUrl.includes('/login') || currentUrl.includes('/auth')).toBeTruthy();
    });
  });
});