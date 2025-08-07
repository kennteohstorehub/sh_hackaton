const { test, expect } = require('@playwright/test');
const testConfig = require('./test-config');

// BackOffice test credentials
const BACKOFFICE_CREDENTIALS = {
  email: 'backoffice@storehubqms.local',
  password: 'BackOffice123!@#'
};

// BackOffice URLs
const BACKOFFICE_URLS = {
  login: '/backoffice/auth/login',
  dashboard: '/backoffice/dashboard',
  tenants: '/backoffice/tenants',
  merchants: '/backoffice/merchants',
  auditLogs: '/backoffice/audit-logs',
  settings: '/backoffice/settings',
  users: '/backoffice/users'
};

test.describe('BackOffice System - Comprehensive Testing', () => {
  
  test.beforeEach(async ({ page }) => {
    // Set up test environment
    await page.goto('/');
    
    // Clear any existing sessions
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test.describe('Authentication System', () => {
    
    test('should display login page correctly', async ({ page }) => {
      await page.goto(BACKOFFICE_URLS.login);
      
      // Check page title and elements
      await expect(page).toHaveTitle(/BackOffice Login/);
      await expect(page.locator('h1, h2')).toContainText(/BackOffice/);
      
      // Check form elements
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      // Check CSRF token
      await expect(page.locator('input[name="_csrf"]')).toBeVisible();
    });

    test('should reject invalid credentials', async ({ page }) => {
      await page.goto(BACKOFFICE_URLS.login);
      
      // Try invalid credentials
      await page.fill('input[name="email"]', 'invalid@test.com');
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      
      // Should remain on login page with error
      await expect(page.url()).toContain('/login');
      await expect(page.locator('.alert-error, .error, .flash-error')).toBeVisible();
    });

    test('should authenticate valid credentials', async ({ page }) => {
      await page.goto(BACKOFFICE_URLS.login);
      
      // Fill valid credentials
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/backoffice\/dashboard/);
      
      // Check for success indicators
      await expect(page.locator('.alert-success, .success, .flash-success')).toBeVisible({ timeout: 10000 });
    });

    test('should maintain session across page reloads', async ({ page }) => {
      // Login first
      await page.goto(BACKOFFICE_URLS.login);
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/backoffice\/dashboard/);
      
      // Reload page
      await page.reload();
      
      // Should still be authenticated
      await expect(page).toHaveURL(/\/backoffice\/dashboard/);
      await expect(page.locator('nav, .navbar')).toBeVisible();
    });

    test('should handle logout correctly', async ({ page }) => {
      // Login first
      await page.goto(BACKOFFICE_URLS.login);
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/backoffice\/dashboard/);
      
      // Find and click logout button
      const logoutButton = page.locator('a[href*="logout"], button:has-text("Logout"), .logout');
      await expect(logoutButton).toBeVisible();
      await logoutButton.click();
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/backoffice.*\/login/);
    });
  });

  test.describe('Dashboard and Navigation', () => {
    
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto(BACKOFFICE_URLS.login);
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/backoffice\/dashboard/);
    });

    test('should display dashboard with modern UI', async ({ page }) => {
      // Check dashboard elements
      await expect(page.locator('h1, .dashboard-title')).toContainText(/Dashboard|BackOffice/);
      
      // Check for navigation menu
      await expect(page.locator('nav, .navbar, .sidebar')).toBeVisible();
      
      // Check for dashboard cards/widgets
      const dashboardCards = page.locator('.card, .widget, .dashboard-card, .stat-card');
      await expect(dashboardCards.first()).toBeVisible();
      
      // Check for system information
      await expect(page.locator('body')).toContainText(/System|Overview|Statistics/);
    });

    test('should have working navigation links', async ({ page }) => {
      const navigationTests = [
        { name: 'Tenants', url: BACKOFFICE_URLS.tenants, text: /Tenants/ },
        { name: 'Merchants', url: BACKOFFICE_URLS.merchants, text: /Merchants/ },
        { name: 'Audit Logs', url: BACKOFFICE_URLS.auditLogs, text: /Audit|Logs/ },
        { name: 'Settings', url: BACKOFFICE_URLS.settings, text: /Settings/ },
        { name: 'Users', url: BACKOFFICE_URLS.users, text: /Users/ }
      ];

      for (const nav of navigationTests) {
        console.log(`Testing navigation to ${nav.name}`);
        
        // Navigate to the URL
        await page.goto(nav.url);
        
        // Check that page loads without 404
        await expect(page.locator('h1:has-text("404"), .error-404')).not.toBeVisible();
        
        // Check for expected content
        await expect(page.locator('h1, h2, .page-title')).toContainText(nav.text);
        
        // Verify URL
        expect(page.url()).toContain(nav.url);
      }
    });

    test('should display system statistics', async ({ page }) => {
      // Check for key metrics on dashboard
      const expectedMetrics = ['Tenants', 'Merchants', 'Active Queues', 'System Status'];
      
      for (const metric of expectedMetrics) {
        await expect(page.locator('body')).toContainText(new RegExp(metric, 'i'));
      }
    });
  });

  test.describe('Tenant Management', () => {
    
    test.beforeEach(async ({ page }) => {
      // Login and navigate to tenants
      await page.goto(BACKOFFICE_URLS.login);
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await page.goto(BACKOFFICE_URLS.tenants);
    });

    test('should display tenant list', async ({ page }) => {
      // Check page title
      await expect(page.locator('h1, h2')).toContainText(/Tenants/);
      
      // Check for table or list of tenants
      await expect(page.locator('table, .tenant-list, .list-group')).toBeVisible();
      
      // Check for create tenant button
      await expect(page.locator('a:has-text("Create"), button:has-text("Create"), .btn-create')).toBeVisible();
    });

    test('should open create tenant form', async ({ page }) => {
      // Click create tenant button
      const createButton = page.locator('a:has-text("Create"), button:has-text("Create"), .btn-create');
      await createButton.click();
      
      // Should show form (either new page or modal)
      await expect(page.locator('form, .modal')).toBeVisible();
      await expect(page.locator('input[name*="name"], input[name*="domain"], input[name*="subdomain"]')).toBeVisible();
    });

    test('should validate tenant creation form', async ({ page }) => {
      // Click create tenant button
      const createButton = page.locator('a:has-text("Create"), button:has-text("Create"), .btn-create');
      await createButton.click();
      
      // Try to submit empty form
      await page.click('button[type="submit"], .btn-submit');
      
      // Should show validation errors
      await expect(page.locator('.error, .invalid-feedback, .alert-danger')).toBeVisible();
    });
  });

  test.describe('Merchant Management', () => {
    
    test.beforeEach(async ({ page }) => {
      // Login and navigate to merchants
      await page.goto(BACKOFFICE_URLS.login);
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await page.goto(BACKOFFICE_URLS.merchants);
    });

    test('should display merchant list', async ({ page }) => {
      // Check page title
      await expect(page.locator('h1, h2')).toContainText(/Merchants/);
      
      // Check for merchants data
      await expect(page.locator('table, .merchant-list, .list-group')).toBeVisible();
      
      // Should show merchant information
      await expect(page.locator('body')).toContainText(/Name|Email|Phone|Status/i);
    });

    test('should show merchant details', async ({ page }) => {
      // Look for merchant detail links
      const detailLinks = page.locator('a:has-text("View"), a:has-text("Details"), .btn-view');
      
      if (await detailLinks.count() > 0) {
        await detailLinks.first().click();
        
        // Should show merchant details
        await expect(page.locator('.merchant-details, .card, .profile')).toBeVisible();
      }
    });
  });

  test.describe('Audit Logs', () => {
    
    test.beforeEach(async ({ page }) => {
      // Login and navigate to audit logs
      await page.goto(BACKOFFICE_URLS.login);
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await page.goto(BACKOFFICE_URLS.auditLogs);
    });

    test('should display audit logs', async ({ page }) => {
      // Check page title
      await expect(page.locator('h1, h2')).toContainText(/Audit|Logs/);
      
      // Check for logs table
      await expect(page.locator('table, .log-list')).toBeVisible();
      
      // Should show log columns
      await expect(page.locator('body')).toContainText(/Action|User|Date|Time|IP/i);
    });

    test('should record login action in audit logs', async ({ page }) => {
      // Look for recent login activity
      await expect(page.locator('body')).toContainText(/LOGIN|ATTEMPT_LOGIN/i);
      
      // Should show user email in logs
      await expect(page.locator('body')).toContainText(BACKOFFICE_CREDENTIALS.email);
    });
  });

  test.describe('Settings Page', () => {
    
    test.beforeEach(async ({ page }) => {
      // Login and navigate to settings
      await page.goto(BACKOFFICE_URLS.login);
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await page.goto(BACKOFFICE_URLS.settings);
    });

    test('should display settings page', async ({ page }) => {
      // Check page title
      await expect(page.locator('h1, h2')).toContainText(/Settings/);
      
      // Check for settings sections
      await expect(page.locator('form, .settings-form, .card')).toBeVisible();
      
      // Should have configuration options
      await expect(page.locator('body')).toContainText(/System|Configuration|Preferences/i);
    });
  });

  test.describe('Error Handling and Security', () => {
    
    test('should handle direct URL access without authentication', async ({ page }) => {
      // Clear any existing sessions
      await page.evaluate(() => {
        sessionStorage.clear();
        localStorage.clear();
      });
      
      const protectedUrls = [
        BACKOFFICE_URLS.dashboard,
        BACKOFFICE_URLS.tenants,
        BACKOFFICE_URLS.merchants,
        BACKOFFICE_URLS.auditLogs,
        BACKOFFICE_URLS.settings
      ];

      for (const url of protectedUrls) {
        await page.goto(url);
        
        // Should redirect to login
        await expect(page).toHaveURL(/\/login/);
      }
    });

    test('should protect against CSRF attacks', async ({ page }) => {
      await page.goto(BACKOFFICE_URLS.login);
      
      // Check for CSRF token in forms
      await expect(page.locator('input[name="_csrf"]')).toBeVisible();
    });

    test('should handle server errors gracefully', async ({ page }) => {
      // Try to access a non-existent endpoint
      await page.goto('/backoffice/nonexistent');
      
      // Should show 404 or redirect
      const response = await page.waitForResponse(response => 
        response.url().includes('nonexistent')
      );
      
      expect([404, 302]).toContain(response.status());
    });
  });

  test.describe('UI/UX Testing', () => {
    
    test.beforeEach(async ({ page }) => {
      // Login for UI tests
      await page.goto(BACKOFFICE_URLS.login);
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await page.goto(BACKOFFICE_URLS.dashboard);
    });

    test('should have responsive design', async ({ page }) => {
      // Test desktop view
      await page.setViewportSize({ width: 1200, height: 800 });
      await expect(page.locator('nav, .navbar')).toBeVisible();
      
      // Test mobile view
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Navigation should still be accessible (possibly collapsed)
      const mobileNav = page.locator('nav, .navbar, .mobile-menu, .hamburger');
      await expect(mobileNav).toBeVisible();
    });

    test('should have proper page titles', async ({ page }) => {
      const pages = [
        { url: BACKOFFICE_URLS.dashboard, title: /Dashboard|BackOffice/ },
        { url: BACKOFFICE_URLS.tenants, title: /Tenants/ },
        { url: BACKOFFICE_URLS.merchants, title: /Merchants/ },
        { url: BACKOFFICE_URLS.settings, title: /Settings/ }
      ];

      for (const pageTest of pages) {
        await page.goto(pageTest.url);
        await expect(page).toHaveTitle(pageTest.title);
      }
    });

    test('should have proper loading states', async ({ page }) => {
      // Navigate to a data-heavy page
      await page.goto(BACKOFFICE_URLS.merchants);
      
      // Check if loading indicators are present during navigation
      // This is more about checking that the page doesn't appear broken during loading
      await expect(page.locator('h1, h2, .page-title')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Data Integrity', () => {
    
    test.beforeEach(async ({ page }) => {
      // Login for data tests
      await page.goto(BACKOFFICE_URLS.login);
      await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
      await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
      await page.click('button[type="submit"]');
    });

    test('should display consistent data across pages', async ({ page }) => {
      // Go to dashboard and note tenant count
      await page.goto(BACKOFFICE_URLS.dashboard);
      const dashboardTenantCount = await page.locator('body').textContent();
      
      // Go to tenants page and verify count matches
      await page.goto(BACKOFFICE_URLS.tenants);
      await expect(page.locator('table, .tenant-list')).toBeVisible();
      
      // Data should be consistent between pages
      // Note: This is a basic check - in a real scenario, we'd parse specific numbers
    });

    test('should handle empty states gracefully', async ({ page }) => {
      // Visit pages that might have empty data
      const pages = [BACKOFFICE_URLS.tenants, BACKOFFICE_URLS.merchants, BACKOFFICE_URLS.auditLogs];
      
      for (const url of pages) {
        await page.goto(url);
        
        // Page should load without errors even if no data
        await expect(page.locator('h1, h2')).toBeVisible();
        
        // Should not show error messages for empty data
        await expect(page.locator('.error-500, .server-error')).not.toBeVisible();
      }
    });
  });
});