const { test, expect } = require('@playwright/test');
const { PublicQueuePage } = require('./pages/PublicQueuePage');
const { LoginPage } = require('./pages/LoginPage');
const { QueueManagementPage } = require('./pages/QueueManagementPage');

test.describe('Comprehensive Queue Management System Tests', () => {
  let publicQueuePage, loginPage, queueManagementPage;
  
  test.beforeEach(async ({ page }) => {
    publicQueuePage = new PublicQueuePage(page);
    loginPage = new LoginPage(page);
    queueManagementPage = new QueueManagementPage(page);
    
    await page.goto('http://localhost:3000');
  });

  test('Customer Queue Flow: Join, Status, and Notification', async ({ page, context }) => {
    // Customer Flow
    await test.step('Join Queue', async () => {
      await publicQueuePage.navigateToQueueJoin();
      await publicQueuePage.fillQueueJoinForm({
        name: 'Test Customer',
        phone: '+1234567890',
        purpose: 'General Inquiry'
      });
      await publicQueuePage.submitQueueJoin();
      
      // Verify redirect and queue status
      await expect(page).toHaveURL(/queue-status/);
      const queueId = await publicQueuePage.getQueueId();
      expect(queueId).toBeTruthy();
    });

    // Merchant Dashboard Flow (in a separate context)
    await test.step('Merchant Queue Management', async () => {
      const merchantPage = await context.newPage();
      await merchantPage.goto('http://localhost:3000/backoffice/login');
      
      await loginPage.login('demo@example.com', 'password123');
      await queueManagementPage.navigateToQueueManagement();
      
      // Call customer and verify
      await queueManagementPage.callNextCustomer();
      const tableAssigned = await queueManagementPage.assignTable();
      expect(tableAssigned).toBeTruthy();
    });

    // Real-time WebSocket Test
    await test.step('Real-time Notification Test', async () => {
      // Verify customer receives notification when called
      await expect(publicQueuePage.getNotificationElement()).toBeVisible();
      
      // Test customer actions
      await publicQueuePage.clickOnMyWayButton();
      await publicQueuePage.clickWithdrawButton();
    });
  });

  test('Error Handling Scenarios', async ({ page }) => {
    await test.step('Invalid Queue ID', async () => {
      await page.goto('http://localhost:3000/queue-status/invalid-id');
      await expect(page).toHaveURL(/error/);
    });

    await test.step('Session Expiry', async () => {
      // Simulate session timeout
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload();
      await expect(page).toHaveURL(/login/);
    });
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: Reset application state
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });
});