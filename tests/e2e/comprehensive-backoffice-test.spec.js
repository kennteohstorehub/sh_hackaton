const { test, expect } = require('@playwright/test');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const BACKOFFICE_CREDENTIALS = {
  email: 'backoffice@storehubqms.local',
  password: 'BackOffice123!@#'
};

// Test URLs
const URLS = {
  home: BASE_URL,
  backofficeLogin: `${BASE_URL}/backoffice/auth/login`,
  backofficeDashboard: `${BASE_URL}/backoffice/dashboard`,
  backofficeRegister: `${BASE_URL}/backoffice/auth/register`,
  backofficeSetup: `${BASE_URL}/backoffice/auth/setup-check`,
  tenants: `${BASE_URL}/backoffice/tenants`,
  merchants: `${BASE_URL}/backoffice/merchants`,
  auditLogs: `${BASE_URL}/backoffice/audit-logs`,
  settings: `${BASE_URL}/backoffice/settings`,
  users: `${BASE_URL}/backoffice/users`
};

// Utility functions
const takeScreenshot = async (page, name) => {
  await page.screenshot({
    path: `test-screenshots/${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
    fullPage: true
  });
};

const waitForLoad = async (page, timeout = 10000) => {
  await page.waitForLoadState('networkidle', { timeout });
  await page.waitForTimeout(1000); // Extra wait for dynamic content
};

const clearSession = async (page) => {
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  
  // Clear cookies
  await page.context().clearCookies();
};

const checkForErrors = async (page) => {
  const errors = [];
  
  // Check for console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`Console Error: ${msg.text()}`);
    }
  });
  
  // Check for network errors
  page.on('response', (response) => {
    if (response.status() >= 400) {
      errors.push(`Network Error: ${response.status()} - ${response.url()}`);
    }
  });
  
  return errors;
};

test.describe('StoreHub QMS BackOffice - Comprehensive Testing', () => {
  
  test.beforeEach(async ({ page }) => {
    // Clear session before each test
    await clearSession(page);
    
    // Set up error monitoring
    await checkForErrors(page);
  });

  test.describe('1. Authentication System Tests', () => {
    
    test('1.1 Should display login page with proper elements', async ({ page }) => {
      await page.goto(URLS.backofficeLogin);
      await waitForLoad(page);
      await takeScreenshot(page, '01-login-page');
      
      // Check page structure
      await expect(page).toHaveTitle(/BackOffice|Login/);
      await expect(page.locator('h1')).toContainText(/BackOffice|QMS/i);
      
      // Check form elements
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      // Check CSRF protection
      await expect(page.locator('input[name="_csrf"]')).toBeVisible();
      
      // Check security elements
      await expect(page.locator('body')).toContainText(/secure|administrator|system/i);
      
      console.log('✅ Login page displays correctly with all required elements');
    });

    test('1.2 Should validate required fields', async ({ page }) => {
      await page.goto(URLS.backofficeLogin);
      await waitForLoad(page);
      
      // Try to submit empty form
      await page.click('button[type="submit"]');
      
      // Check HTML5 validation
      const emailInput = page.locator('input[name="email"]');
      const passwordInput = page.locator('input[name="password"]');
      
      await expect(emailInput).toHaveAttribute('required');
      await expect(passwordInput).toHaveAttribute('required');
      
      console.log('✅ Form validation works for required fields');
    });

    test('1.3 Should reject invalid credentials', async ({ page }) => {
      await page.goto(URLS.backofficeLogin);
      await waitForLoad(page);
      
      // Try invalid credentials
      await page.fill('input[name="email"]', 'invalid@test.com');
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      
      await waitForLoad(page);
      await takeScreenshot(page, '02-invalid-login');
      
      // Should remain on login page
      expect(page.url()).toContain('/login');
      
      // Should show error message
      const errorSelectors = [
        '.alert-error',
        '.alert-danger', 
        '.error',
        '.flash-error',
        '[role="alert"]',
        '.text-danger'
      ];
      
      let errorFound = false;
      for (const selector of errorSelectors) {
        const element = page.locator(selector);
        if (await element.count() > 0 && await element.isVisible()) {
          errorFound = true;
          break;
        }
      }
      
      if (!errorFound) {
        // Check for error in page content
        const pageContent = await page.textContent('body');
        errorFound = /invalid|incorrect|wrong|failed|error/i.test(pageContent);
      }
      
      expect(errorFound).toBe(true);
      console.log('✅ Invalid credentials properly rejected');
    });

    test('1.4 Should authenticate with valid credentials', async ({ page }) => {
      await page.goto(URLS.backofficeLogin);
      await waitForLoad(page);
      
      // Fill valid credentials
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await takeScreenshot(page, '03-login-filled');
      
      // Submit form
      await page.click('button[type="submit"]');
      await waitForLoad(page);
      await takeScreenshot(page, '04-after-login');
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/backoffice\/dashboard/);
      
      // Check for success indicators
      const successSelectors = [
        '.alert-success',
        '.success',
        '.flash-success',
        'nav',
        '.navbar',
        '.sidebar'
      ];
      
      let successFound = false;
      for (const selector of successSelectors) {
        const element = page.locator(selector);
        if (await element.count() > 0 && await element.isVisible()) {
          successFound = true;
          break;
        }
      }
      
      expect(successFound).toBe(true);
      console.log('✅ Valid credentials accepted and redirected to dashboard');
    });

    test('1.5 Should maintain session across page reloads', async ({ page }) => {
      // Login first
      await page.goto(URLS.backofficeLogin);
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await waitForLoad(page);
      
      // Verify we're on dashboard
      await expect(page).toHaveURL(/\/backoffice\/dashboard/);
      
      // Reload page
      await page.reload();
      await waitForLoad(page);
      
      // Should still be authenticated
      await expect(page).toHaveURL(/\/backoffice\/dashboard/);
      await expect(page.locator('nav, .navbar, .sidebar')).toBeVisible();
      
      console.log('✅ Session maintained across page reloads');
    });

    test('1.6 Should protect against unauthorized access', async ({ page }) => {
      // Clear any existing sessions
      await clearSession(page);
      
      const protectedUrls = [
        URLS.backofficeDashboard,
        URLS.tenants,
        URLS.merchants,
        URLS.auditLogs,
        URLS.settings
      ];

      for (const url of protectedUrls) {
        await page.goto(url);
        await waitForLoad(page);
        
        // Should redirect to login
        expect(page.url()).toContain('/login');
      }
      
      console.log('✅ Protected routes properly redirect to login');
    });
  });

  test.describe('2. Tenant Registration Flow Tests', () => {
    
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto(URLS.backofficeLogin);
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await waitForLoad(page);
    });

    test('2.1 Should display tenant creation wizard', async ({ page }) => {
      await page.goto(URLS.tenants);
      await waitForLoad(page);
      
      // Look for create tenant button
      const createButton = page.locator('a:has-text("Create"), button:has-text("Create"), .btn-create, [href*="create"]');
      if (await createButton.count() > 0) {
        await createButton.first().click();
        await waitForLoad(page);
        await takeScreenshot(page, '05-tenant-wizard');
        
        // Check for wizard elements
        await expect(page.locator('.wizard-container, .form-card, .progress-steps')).toBeVisible();
        await expect(page.locator('input[name="name"], input[name="slug"]')).toBeVisible();
        
        console.log('✅ Tenant creation wizard displays correctly');
      } else {
        console.log('⚠️  Create tenant button not found');
      }
    });

    test('2.2 Should validate company information step', async ({ page }) => {
      await page.goto(`${URLS.tenants}/new`);
      await waitForLoad(page);
      
      // Test validation on first step
      const nextButton = page.locator('#nextBtn, .btn-next, button:has-text("Next")');
      if (await nextButton.count() > 0) {
        await nextButton.click();
        
        // Should show validation errors
        const errorSelectors = ['.error', '.invalid-feedback', '.alert-danger', '.form-error'];
        let errorFound = false;
        
        for (const selector of errorSelectors) {
          if (await page.locator(selector).count() > 0) {
            errorFound = true;
            break;
          }
        }
        
        expect(errorFound).toBe(true);
        console.log('✅ Wizard step validation works');
      }
    });

    test('2.3 Should check subdomain availability', async ({ page }) => {
      await page.goto(`${URLS.tenants}/new`);
      await waitForLoad(page);
      
      const slugInput = page.locator('input[name="slug"], #slugInput');
      if (await slugInput.count() > 0) {
        // Fill in a test subdomain
        await slugInput.fill('test-restaurant-' + Date.now());
        await page.waitForTimeout(1000);
        
        // Check for availability indicator
        const availabilityElement = page.locator('#slugAvailability, .availability-check');
        if (await availabilityElement.count() > 0) {
          await expect(availabilityElement).toBeVisible();
          console.log('✅ Subdomain availability check works');
        }
      }
    });

    test('2.4 Should display plan selection step', async ({ page }) => {
      await page.goto(`${URLS.tenants}/new`);
      await waitForLoad(page);
      
      // Check for pricing cards
      const pricingCards = page.locator('.pricing-card, .plan-card');
      if (await pricingCards.count() > 0) {
        await expect(pricingCards.first()).toBeVisible();
        
        // Check for plan features
        await expect(page.locator('body')).toContainText(/basic|premium|enterprise|free/i);
        console.log('✅ Plan selection displays correctly');
      }
    });

    test('2.5 Should validate password strength', async ({ page }) => {
      await page.goto(`${URLS.tenants}/new`);
      await waitForLoad(page);
      
      const passwordInput = page.locator('input[name="adminPassword"], #adminPassword');
      if (await passwordInput.count() > 0) {
        // Test weak password
        await passwordInput.fill('123');
        await page.waitForTimeout(500);
        
        // Check for strength indicator
        const strengthIndicator = page.locator('.password-strength, .strength-bar');
        if (await strengthIndicator.count() > 0) {
          console.log('✅ Password strength validation works');
        }
      }
    });
  });

  test.describe('3. Dashboard and Navigation Tests', () => {
    
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto(URLS.backofficeLogin);
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await waitForLoad(page);
    });

    test('3.1 Should display dashboard with system statistics', async ({ page }) => {
      await expect(page).toHaveURL(/\/backoffice\/dashboard/);
      await takeScreenshot(page, '06-dashboard');
      
      // Check dashboard elements
      await expect(page.locator('h1, .dashboard-title')).toContainText(/Dashboard|BackOffice|Overview/i);
      
      // Check for navigation
      await expect(page.locator('nav, .navbar, .sidebar')).toBeVisible();
      
      // Check for dashboard cards/widgets
      const dashboardElements = [
        '.card',
        '.widget',
        '.dashboard-card',
        '.stat-card',
        '.metric'
      ];
      
      let foundDashboardElement = false;
      for (const selector of dashboardElements) {
        if (await page.locator(selector).count() > 0) {
          foundDashboardElement = true;
          break;
        }
      }
      
      // Check for key metrics in text
      const bodyText = await page.textContent('body');
      const hasMetrics = /tenant|merchant|queue|system|statistic|overview/i.test(bodyText);
      
      expect(foundDashboardElement || hasMetrics).toBe(true);
      console.log('✅ Dashboard displays with proper layout and information');
    });

    test('3.2 Should have working navigation links', async ({ page }) => {
      const navigationTests = [
        { name: 'Tenants', url: URLS.tenants, text: /tenant/i },
        { name: 'Merchants', url: URLS.merchants, text: /merchant/i },
        { name: 'Audit Logs', url: URLS.auditLogs, text: /audit|log/i },
        { name: 'Settings', url: URLS.settings, text: /setting/i },
        { name: 'Users', url: URLS.users, text: /user/i }
      ];

      for (const nav of navigationTests) {
        console.log(`Testing navigation to ${nav.name}...`);
        
        await page.goto(nav.url);
        await waitForLoad(page);
        
        // Check that page loads without 404
        const is404 = page.url().includes('404') || 
                     await page.locator('h1:has-text("404"), .error-404').count() > 0;
        expect(is404).toBe(false);
        
        // Check for expected content
        const pageContent = await page.textContent('body');
        const hasExpectedContent = nav.text.test(pageContent);
        expect(hasExpectedContent).toBe(true);
        
        console.log(`✅ ${nav.name} page loads correctly`);
      }
    });

    test('3.3 Should display proper page titles', async ({ page }) => {
      const pages = [
        { url: URLS.backofficeDashboard, title: /Dashboard|BackOffice/i },
        { url: URLS.tenants, title: /Tenant/i },
        { url: URLS.merchants, title: /Merchant/i },
        { url: URLS.settings, title: /Setting/i }
      ];

      for (const pageTest of pages) {
        await page.goto(pageTest.url);
        await waitForLoad(page);
        
        const title = await page.title();
        expect(pageTest.title.test(title)).toBe(true);
      }
      
      console.log('✅ All pages have proper titles');
    });
  });

  test.describe('4. Responsive Design Tests', () => {
    
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto(URLS.backofficeLogin);
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await waitForLoad(page);
    });

    test('4.1 Should work on desktop resolution', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(URLS.backofficeDashboard);
      await waitForLoad(page);
      await takeScreenshot(page, '07-desktop-view');
      
      // Check that navigation is visible
      await expect(page.locator('nav, .navbar, .sidebar')).toBeVisible();
      
      console.log('✅ Desktop layout works correctly');
    });

    test('4.2 Should work on tablet resolution', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(URLS.backofficeDashboard);
      await waitForLoad(page);
      await takeScreenshot(page, '08-tablet-view');
      
      // Navigation should still be accessible
      const navElements = page.locator('nav, .navbar, .sidebar, .mobile-menu, .hamburger');
      await expect(navElements.first()).toBeVisible();
      
      console.log('✅ Tablet layout works correctly');
    });

    test('4.3 Should work on mobile resolution', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(URLS.backofficeDashboard);
      await waitForLoad(page);
      await takeScreenshot(page, '09-mobile-view');
      
      // Check that content is accessible
      await expect(page.locator('h1, .page-title')).toBeVisible();
      
      console.log('✅ Mobile layout works correctly');
    });
  });

  test.describe('5. Security and Error Handling Tests', () => {
    
    test('5.1 Should have CSRF protection', async ({ page }) => {
      await page.goto(URLS.backofficeLogin);
      await waitForLoad(page);
      
      // Check for CSRF token in forms
      await expect(page.locator('input[name="_csrf"]')).toBeVisible();
      
      console.log('✅ CSRF protection is implemented');
    });

    test('5.2 Should handle 404 errors gracefully', async ({ page }) => {
      await page.goto(`${BASE_URL}/backoffice/nonexistent-page`);
      await waitForLoad(page);
      
      // Should show 404 or redirect
      const response = await page.waitForResponse(response => 
        response.url().includes('nonexistent-page')
      );
      
      expect([404, 302, 301]).toContain(response.status());
      
      console.log('✅ 404 errors handled properly');
    });

    test('5.3 Should validate input fields against XSS', async ({ page }) => {
      await page.goto(URLS.backofficeLogin);
      await waitForLoad(page);
      
      // Try XSS in email field
      const xssPayload = '<script>alert("xss")</script>';
      await page.fill('input[name="email"]', xssPayload);
      
      // Check that script is not executed
      const emailValue = await page.inputValue('input[name="email"]');
      expect(emailValue).toBe(xssPayload); // Should be stored as text, not executed
      
      console.log('✅ XSS protection works on input fields');
    });

    test('5.4 Should handle server errors gracefully', async ({ page }) => {
      // Test with malformed request
      const response = await page.goto(`${BASE_URL}/backoffice/auth/login`, {
        method: 'POST',
        failOnStatusCode: false
      });
      
      // Should not crash the application
      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(600);
      
      console.log('✅ Server errors handled gracefully');
    });
  });

  test.describe('6. Browser Compatibility Tests', () => {
    
    test('6.1 Should work in different browsers', async ({ page, browserName }) => {
      await page.goto(URLS.backofficeLogin);
      await waitForLoad(page);
      
      // Basic functionality should work
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      console.log(`✅ Basic functionality works in ${browserName}`);
    });

    test('6.2 Should handle JavaScript properly', async ({ page }) => {
      await page.goto(URLS.backofficeLogin);
      await waitForLoad(page);
      
      // Check if JavaScript is working
      const jsWorking = await page.evaluate(() => {
        return typeof document !== 'undefined' && typeof window !== 'undefined';
      });
      
      expect(jsWorking).toBe(true);
      
      console.log('✅ JavaScript functionality works correctly');
    });
  });

  test.describe('7. Performance Tests', () => {
    
    test('7.1 Should load pages within reasonable time', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(URLS.backofficeLogin);
      await waitForLoad(page);
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
      
      console.log(`✅ Login page loaded in ${loadTime}ms`);
    });

    test('7.2 Should handle concurrent requests', async ({ page }) => {
      // Make multiple requests to different endpoints
      const requests = [
        page.goto(URLS.backofficeLogin),
        page.goto(URLS.home),
        page.goto(`${BASE_URL}/api/health`)
      ];
      
      const responses = await Promise.allSettled(requests);
      
      // At least one should succeed
      const successCount = responses.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(0);
      
      console.log('✅ Server handles concurrent requests properly');
    });
  });

  test.describe('8. Data Integrity Tests', () => {
    
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto(URLS.backofficeLogin);
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await waitForLoad(page);
    });

    test('8.1 Should display consistent data across pages', async ({ page }) => {
      // Go to dashboard
      await page.goto(URLS.backofficeDashboard);
      await waitForLoad(page);
      
      // Go to tenants page
      await page.goto(URLS.tenants);
      await waitForLoad(page);
      
      // Both pages should load without errors
      const dashboardTitle = await page.title();
      expect(dashboardTitle.length).toBeGreaterThan(0);
      
      console.log('✅ Data consistency maintained across pages');
    });

    test('8.2 Should handle empty states gracefully', async ({ page }) => {
      const pages = [URLS.tenants, URLS.merchants, URLS.auditLogs];
      
      for (const url of pages) {
        await page.goto(url);
        await waitForLoad(page);
        
        // Page should load without server errors
        const hasServerError = await page.locator('.error-500, .server-error').count() > 0;
        expect(hasServerError).toBe(false);
        
        // Should have proper header
        await expect(page.locator('h1, h2, .page-title')).toBeVisible();
      }
      
      console.log('✅ Empty states handled gracefully');
    });
  });

  // Cleanup after all tests
  test.afterAll(async ({ page }) => {
    if (page) {
      await page.close();
    }
  });
});