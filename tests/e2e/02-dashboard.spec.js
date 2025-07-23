const { test, expect } = require('@playwright/test');
const { LoginPage } = require('./pages/LoginPage');
const { DashboardPage } = require('./pages/DashboardPage');

test.describe('Dashboard Tests', () => {
  let loginPage;
  let dashboardPage;

  test.beforeEach(async ({ page }) => {
    // Login before each test
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    
    await loginPage.goto();
    await loginPage.login('demo@smartqueue.com', 'demo123456');
    await page.waitForURL('**/dashboard');
  });

  test('should display dashboard correctly after login', async ({ page }) => {
    // Check page elements
    await expect(page).toHaveTitle(/Dashboard - StoreHub Queue Management System/);
    await expect(dashboardPage.welcomeMessage).toBeVisible();
    
    // Check navigation menu
    await expect(dashboardPage.navDashboard).toBeVisible();
    await expect(dashboardPage.navQueues).toBeVisible();
    await expect(dashboardPage.navCustomers).toBeVisible();
    await expect(dashboardPage.navAnalytics).toBeVisible();
    await expect(dashboardPage.navSettings).toBeVisible();
  });

  test('should display business statistics', async ({ page }) => {
    // Check stats cards are visible
    await expect(dashboardPage.statsCards).toHaveCount(3);
    
    // Get stats
    const stats = await dashboardPage.getStats();
    
    // Stats should have values (even if 0)
    expect(stats.activeQueues).toBeDefined();
    expect(stats.totalCustomers).toBeDefined();
    expect(stats.avgWaitTime).toBeDefined();
  });

  test('should navigate to queues management', async ({ page }) => {
    await dashboardPage.navigateToQueues();
    
    // Check URL and page content
    await expect(page).toHaveURL(/.*\/dashboard\/queues/);
    await expect(page.locator('h1')).toContainText('Queue Management');
  });

  test('should navigate to customers page', async ({ page }) => {
    await dashboardPage.navigateToCustomers();
    
    // Check URL and page content
    await expect(page).toHaveURL(/.*\/dashboard\/customers/);
    await expect(page.locator('h1')).toContainText('Customers');
  });

  test('should navigate to analytics page', async ({ page }) => {
    await dashboardPage.navigateToAnalytics();
    
    // Check URL and page content
    await expect(page).toHaveURL(/.*\/dashboard\/analytics/);
    await expect(page.locator('h1')).toContainText('Analytics');
  });

  test('should navigate to settings page', async ({ page }) => {
    await dashboardPage.navigateToSettings();
    
    // Check URL and page content
    await expect(page).toHaveURL(/.*\/dashboard\/settings/);
    await expect(page.locator('h1')).toContainText('Settings');
  });

  test('should logout successfully', async ({ page }) => {
    await dashboardPage.logout();
    
    // Should redirect to home or login page
    await expect(page).toHaveURL(/^\/$|.*\/auth\/login/);
  });

  test('should maintain session across page refreshes', async ({ page }) => {
    // Refresh the page
    await page.reload();
    
    // Should still be on dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(dashboardPage.welcomeMessage).toBeVisible();
  });

  test('should show correct merchant information', async ({ page }) => {
    // Check welcome message contains business name
    const welcomeText = await dashboardPage.getWelcomeText();
    expect(welcomeText).toContain('Demo Restaurant');
  });

  test('should handle responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigation should still be accessible (might be in hamburger menu)
    const mobileMenu = page.locator('.mobile-menu-toggle');
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
    }
    
    // Check navigation is still accessible
    await expect(dashboardPage.navDashboard).toBeVisible();
  });
});

test.describe('Dashboard Real-time Updates', () => {
  test('should receive real-time queue updates via WebSocket', async ({ page, context }) => {
    // Login on first page
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('demo@smartqueue.com', 'demo123456');
    await page.waitForURL('**/dashboard');
    
    // Monitor WebSocket connections
    const wsPromise = page.waitForEvent('websocket');
    
    // Open second page to simulate another user
    const page2 = await context.newPage();
    const loginPage2 = new LoginPage(page2);
    await loginPage2.goto();
    await loginPage2.login('demo@smartqueue.com', 'demo123456');
    
    // Check WebSocket connection
    const ws = await wsPromise;
    expect(ws.url()).toContain('socket.io');
  });
});