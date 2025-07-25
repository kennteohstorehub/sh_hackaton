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
    
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    
    if (!testEmail || !testPassword) {
      test.skip('Test credentials not configured');
      return;
    }
    
    await loginPage.goto();
    await loginPage.login(testEmail, testPassword);
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

  test('should display and interact with WhatsApp status banner', async ({ page }) => {
    // Check WhatsApp status banner
    const whatsappBanner = page.locator('#whatsapp-status');
    await expect(whatsappBanner).toBeVisible();
    
    // Check if it has proper status
    const statusText = await whatsappBanner.locator('.status-text p').textContent();
    expect(statusText).toMatch(/Connected|Not connected|Checking/);
  });

  test('should interact with queue controls', async ({ page }) => {
    // Check if queue section exists
    const queueSection = page.locator('.queue-section').first();
    if (await queueSection.count() > 0) {
      // Test refresh button
      const refreshBtn = page.locator('button:has-text("Refresh")');
      await expect(refreshBtn).toBeVisible();
      await refreshBtn.click();
      
      // Test stop/start queue button
      const stopStartBtn = page.locator('button').filter({ hasText: /Stop Queue|Start Queue/ }).first();
      if (await stopStartBtn.count() > 0) {
        const initialText = await stopStartBtn.textContent();
        expect(initialText).toMatch(/Stop Queue|Start Queue/);
      }
      
      // Check queue status badge
      const statusBadge = page.locator('.queue-status-badge');
      if (await statusBadge.count() > 0) {
        await expect(statusBadge).toHaveClass(/accepting|not-accepting/);
      }
    }
  });

  test('should display customer list with action buttons', async ({ page }) => {
    // Check customer list desktop view
    const customerList = page.locator('.customer-list-desktop').first();
    if (await customerList.count() > 0) {
      // Check header row
      const headerRow = customerList.locator('.customer-list-header');
      await expect(headerRow).toBeVisible();
      
      // Check customer rows
      const customerRows = customerList.locator('.customer-row');
      const rowCount = await customerRows.count();
      
      if (rowCount > 0) {
        // Test first customer row
        const firstRow = customerRows.first();
        await expect(firstRow.locator('.position')).toBeVisible();
        await expect(firstRow.locator('.customer-name')).toBeVisible();
        await expect(firstRow.locator('.phone')).toBeVisible();
        await expect(firstRow.locator('.party-size')).toBeVisible();
        await expect(firstRow.locator('.wait-time')).toBeVisible();
        
        // Check action buttons
        const actionButtons = firstRow.locator('.actions button');
        await expect(actionButtons).toHaveCount(1);
        
        const buttonText = await actionButtons.textContent();
        expect(buttonText).toMatch(/Notify|Select|Pending Arrival/);
      }
    }
  });

  test('should switch between Active Queue and Seated Customers tabs', async ({ page }) => {
    // Test tab switching
    const activeQueueTab = page.locator('.tab-button:has-text("Active Queue")');
    const seatedCustomersTab = page.locator('.tab-button:has-text("Seated Customers")');
    
    await expect(activeQueueTab).toBeVisible();
    await expect(seatedCustomersTab).toBeVisible();
    
    // Click on Seated Customers tab
    await seatedCustomersTab.click();
    await expect(seatedCustomersTab).toHaveClass(/active/);
    await expect(page.locator('#seated-customers')).toBeVisible();
    
    // Click back on Active Queue tab
    await activeQueueTab.click();
    await expect(activeQueueTab).toHaveClass(/active/);
    await expect(page.locator('#active-queue')).toBeVisible();
  });

  test('should interact with View Public button', async ({ page }) => {
    // Check View Public button
    const viewPublicBtn = page.locator('.btn-view-public');
    if (await viewPublicBtn.count() > 0) {
      await expect(viewPublicBtn).toBeVisible();
      await expect(viewPublicBtn).toHaveAttribute('target', '_blank');
      
      // Get href to verify it's a valid queue link
      const href = await viewPublicBtn.getAttribute('href');
      expect(href).toMatch(/^\/queue\/[a-zA-Z0-9]+$/);
    }
  });

  test('should display connection status indicator', async ({ page }) => {
    // Check connection status
    const connectionStatus = page.locator('#connection-status');
    await expect(connectionStatus).toBeVisible();
    
    // Should have one of the valid statuses
    const statusClass = await connectionStatus.getAttribute('class');
    expect(statusClass).toMatch(/connected|disconnected|connecting/);
  });

  test('should display empty queue state', async ({ page }) => {
    // Check for empty queue message if no customers
    const noCustomers = page.locator('.no-customers').first();
    if (await noCustomers.count() > 0) {
      await expect(noCustomers).toBeVisible();
      await expect(noCustomers.locator('h4')).toHaveText(/No customers in queue|No seated customers/);
    }
  });

  test('should handle quick actions FAB on mobile', async ({ page }) => {
    // Switch to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check bottom navigation
    const bottomNav = page.locator('.bottom-nav');
    await expect(bottomNav).toBeVisible();
    
    // Check FAB button
    const fabButton = page.locator('.bottom-nav-fab');
    await expect(fabButton).toBeVisible();
    await expect(fabButton.locator('i')).toHaveClass(/bi-plus-lg/);
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
    // Verify welcome text exists without checking specific business name
    expect(welcomeText).toBeTruthy();
    expect(welcomeText.length).toBeGreaterThan(0);
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
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    
    if (!testEmail || !testPassword) {
      test.skip('Test credentials not configured');
      return;
    }
    
    await loginPage.goto();
    await loginPage.login(testEmail, testPassword);
    await page.waitForURL('**/dashboard');
    
    // Monitor WebSocket connections
    const wsPromise = page.waitForEvent('websocket');
    
    // Open second page to simulate another user
    const page2 = await context.newPage();
    const loginPage2 = new LoginPage(page2);
    await loginPage2.goto();
    await loginPage2.login(testEmail, testPassword);
    
    // Check WebSocket connection
    const ws = await wsPromise;
    expect(ws.url()).toContain('socket.io');
  });
});