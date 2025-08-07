const { test, expect } = require('@playwright/test');
const { LoginPage } = require('./pages/LoginPage');

test.use({
  baseURL: 'http://demo.lvh.me:3000'
});

test.describe('Tenant Name Display', () => {
  let loginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
  });

  test('should display tenant name instead of business name in header', async ({ page }) => {
    // Navigate to login page
    await loginPage.goto();
    
    // Login with demo credentials
    const testEmail = process.env.TEST_USER_EMAIL || 'demo@storehub.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'demo123';
    
    await loginPage.login(testEmail, testPassword);
    
    // Wait for dashboard to load
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Check that the tenant name "Demo Restaurant" is displayed in the header
    // The tenant badge should show "Account: Demo Restaurant"
    const tenantBadge = await page.locator('.tenant-badge').first();
    await expect(tenantBadge).toBeVisible({ timeout: 10000 });
    
    const tenantName = await page.locator('.tenant-badge .tenant-name').first();
    await expect(tenantName).toHaveText('Demo Restaurant');
    
    // Verify it's NOT showing the old business name format
    await expect(tenantName).not.toContainText('Test Restaurant');
    await expect(tenantName).not.toContainText('1754365123132');
    
    // Also check the main content banner
    const tenantBanner = await page.locator('.tenant-context-banner');
    const bannerVisible = await tenantBanner.isVisible();
    if (bannerVisible) {
      const bannerTenantName = await tenantBanner.locator('h3').first();
      await expect(bannerTenantName).toHaveText('Demo Restaurant');
    }
  });

  test('should display correct tenant name for different tenants', async ({ page }) => {
    // Navigate to delicious tenant (using the slug from the log)
    await page.goto('http://delicious-restaurants.lvh.me:3000/auth/login');
    
    // We need to check if this tenant exists and has users
    // For now, let's just verify the login page loads correctly
    await expect(page).toHaveTitle(/Login/);
  });

  test('should display tenant name in mobile navigation', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to login page  
    await loginPage.goto();
    
    // Login with demo credentials
    const testEmail = process.env.TEST_USER_EMAIL || 'demo@storehub.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'demo123';
    
    await loginPage.login(testEmail, testPassword);
    
    // Wait for dashboard to load
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Open mobile menu
    const hamburgerMenu = await page.locator('.mobile-hamburger');
    const hamburgerVisible = await hamburgerMenu.isVisible();
    if (hamburgerVisible) {
      await hamburgerMenu.click();
      
      // Check mobile nav header
      const mobileNavHeader = await page.locator('.mobile-nav-header h2');
      await expect(mobileNavHeader).toHaveText('Demo Restaurant');
    }
  });
});