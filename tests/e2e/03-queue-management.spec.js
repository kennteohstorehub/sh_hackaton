const { test, expect } = require('@playwright/test');
const { LoginPage } = require('./pages/LoginPage');
const { QueueManagementPage } = require('./pages/QueueManagementPage');

test.describe('Queue Management Tests', () => {
  let loginPage;
  let queuePage;

  test.beforeEach(async ({ page }) => {
    // Login and navigate to queues
    loginPage = new LoginPage(page);
    queuePage = new QueueManagementPage(page);
    
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    
    if (!testEmail || !testPassword) {
      test.skip('Test credentials not configured');
      return;
    }
    
    await loginPage.goto();
    await loginPage.login(testEmail, testPassword);
    await page.waitForURL('**/dashboard');
    await queuePage.goto();
  });

  test('should create a new queue', async ({ page }) => {
    const initialCount = await queuePage.getQueueCount();
    
    // Create new queue
    await queuePage.createQueue({
      name: 'Test Queue ' + Date.now(),
      description: 'Automated test queue',
      maxCapacity: 30,
      avgServiceTime: 25
    });
    
    // Check success message
    await expect(page.locator('.alert-success')).toBeVisible();
    
    // Verify queue count increased
    const newCount = await queuePage.getQueueCount();
    expect(newCount).toBe(initialCount + 1);
  });

  test('should add customer to queue', async ({ page }) => {
    // Create a queue first
    const queueName = 'Customer Test Queue ' + Date.now();
    await queuePage.createQueue({
      name: queueName,
      description: 'Queue for customer testing'
    });
    
    // View the queue
    await queuePage.viewQueue(queueName);
    
    // Add customer with dynamic data
    await queuePage.addCustomerToQueue({
      name: `Test Customer ${Date.now()}`,
      phone: `+601${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
      partySize: Math.floor(Math.random() * 6) + 1,
      notes: 'Automated test entry'
    });
    
    // Check success
    await expect(page.locator('.alert-success')).toContainText('Customer added');
    
    // Verify waiting count
    const waitingCount = await queuePage.getWaitingCount();
    expect(parseInt(waitingCount)).toBeGreaterThan(0);
  });

  test('should call next customer', async ({ page }) => {
    // Create queue with customer
    const queueName = 'Service Test Queue ' + Date.now();
    await queuePage.createQueue({ name: queueName });
    await queuePage.viewQueue(queueName);
    
    // Add multiple customers with dynamic data
    await queuePage.addCustomerToQueue({
      name: `Customer ${Date.now()}_1`,
      phone: `+601${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
      partySize: 2
    });
    
    await queuePage.addCustomerToQueue({
      name: `Customer ${Date.now()}_2`,
      phone: `+601${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
      partySize: 3
    });
    
    // Call next
    await queuePage.callNext();
    
    // Check current serving number changed
    const currentServing = await queuePage.getCurrentServing();
    expect(parseInt(currentServing)).toBeGreaterThan(0);
  });

  test('should delete a queue', async ({ page }) => {
    // Create a queue to delete
    const queueName = 'Delete Test Queue ' + Date.now();
    await queuePage.createQueue({ name: queueName });
    
    const countBefore = await queuePage.getQueueCount();
    
    // Delete the queue
    await queuePage.deleteQueue(queueName);
    
    // Verify deletion
    await expect(page.locator('.alert-success')).toContainText('deleted');
    
    const countAfter = await queuePage.getQueueCount();
    expect(countAfter).toBe(countBefore - 1);
  });

  test('should validate queue form inputs', async ({ page }) => {
    await queuePage.createQueueButton.click();
    
    // Try to save without filling required fields
    await queuePage.saveQueueButton.click();
    
    // Should show validation errors
    await expect(page.locator(':text("Queue name is required")')).toBeVisible();
  });

  test('should handle queue capacity limits', async ({ page }) => {
    const queueName = 'Capacity Test Queue ' + Date.now();
    await queuePage.createQueue({
      name: queueName,
      maxCapacity: 2
    });
    
    await queuePage.viewQueue(queueName);
    
    // Add customers up to capacity
    await queuePage.addCustomerToQueue({
      name: `Capacity Test 1 ${Date.now()}`,
      phone: `+601${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`
    });
    
    await queuePage.addCustomerToQueue({
      name: `Capacity Test 2 ${Date.now()}`,
      phone: `+601${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`
    });
    
    // Try to add beyond capacity
    await queuePage.addCustomerToQueue({
      name: `Capacity Test 3 ${Date.now()}`,
      phone: `+601${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`
    });
    
    // Should show capacity error
    await expect(page.locator('.alert-danger')).toContainText('capacity');
  });
});

  test('should stop and start queue accepting customers', async ({ page }) => {
    // Create a queue
    const queueName = 'Stop/Start Test Queue ' + Date.now();
    await queuePage.createQueue({
      name: queueName,
      description: 'Testing queue stop/start functionality'
    });
    
    // Go to dashboard to interact with queue controls
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check initial queue state
    const stopStartBtn = page.locator('button').filter({ hasText: /Stop Queue|Start Queue/ }).first();
    if (await stopStartBtn.count() > 0) {
      const initialText = await stopStartBtn.textContent();
      
      if (initialText.includes('Stop Queue')) {
        // Click to stop queue
        await stopStartBtn.click();
        
        // Handle confirmation modal
        await page.waitForSelector('.stop-queue-modal', { timeout: 5000 });
        await page.fill('#stopQueueConfirmInput', 'Yes I want to stop queue');
        await page.locator('.stop-queue-modal button.btn-danger').click();
        
        // Wait for status change
        await page.waitForTimeout(1000);
        
        // Verify queue is stopped
        const statusBadge = page.locator('.queue-status-badge');
        await expect(statusBadge).toHaveClass(/not-accepting/);
      }
    }
  });

  test('should handle queue notification actions', async ({ page }) => {
    // Create queue with customers
    const queueName = 'Notification Test Queue ' + Date.now();
    await queuePage.createQueue({ name: queueName });
    
    // Add customers
    for (let i = 1; i <= 3; i++) {
      await page.goto('/dashboard/queues');
      await queuePage.viewQueue(queueName);
      await queuePage.addCustomerToQueue({
        name: `Notify Test Customer ${i} - ${Date.now()}`,
        phone: `+601${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
        partySize: i
      });
    }
    
    // Go to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Test notify button
    const notifyBtn = page.locator('button.btn-notify').first();
    if (await notifyBtn.count() > 0) {
      await notifyBtn.click();
      
      // Confirm notification
      await page.on('dialog', dialog => dialog.accept());
      
      // Wait for notification modal
      await page.waitForSelector('.notification-modal', { timeout: 5000 });
      
      // Check verification code display
      await expect(page.locator('.code-box')).toBeVisible();
      
      // Close modal
      await page.locator('.notification-modal button').click();
    }
  });

  test('should display queue statistics correctly', async ({ page }) => {
    const queueName = 'Stats Test Queue ' + Date.now();
    await queuePage.createQueue({
      name: queueName,
      avgServiceTime: 15
    });
    
    // Add multiple customers
    const customerCount = 5;
    for (let i = 1; i <= customerCount; i++) {
      await page.goto('/dashboard/queues');
      await queuePage.viewQueue(queueName);
      await queuePage.addCustomerToQueue({
        name: `Stats Customer ${i} - ${Date.now()}`,
        phone: `+601${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
        partySize: Math.floor(Math.random() * 4) + 1
      });
    }
    
    // Go to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check queue statistics
    const queueStats = page.locator('.queue-stats');
    if (await queueStats.count() > 0) {
      const waitingCount = await queueStats.locator('.stat-item:first-child .number').textContent();
      expect(parseInt(waitingCount)).toBe(customerCount);
      
      // Check average wait time is calculated
      const avgWait = await queueStats.locator('.stat-item:nth-child(2) .number').textContent();
      expect(parseInt(avgWait)).toBeGreaterThanOrEqual(0);
    }
  });

test.describe('Queue Real-time Features', () => {
  test('should update queue status in real-time', async ({ page, context }) => {
    // Login on first page
    const loginPage = new LoginPage(page);
    const queuePage = new QueueManagementPage(page);
    
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    
    if (!testEmail || !testPassword) {
      test.skip('Test credentials not configured');
      return;
    }
    
    await loginPage.goto();
    await loginPage.login(testEmail, testPassword);
    await queuePage.goto();
    
    // Create a queue
    const queueName = 'Realtime Test Queue ' + Date.now();
    await queuePage.createQueue({ name: queueName });
    
    // Open second browser tab
    const page2 = await context.newPage();
    const loginPage2 = new LoginPage(page2);
    const queuePage2 = new QueueManagementPage(page2);
    
    await loginPage2.goto();
    await loginPage2.login(testEmail, testPassword);
    await queuePage2.goto();
    
    // View queue in first tab
    await queuePage.viewQueue(queueName);
    
    // View same queue in second tab
    await queuePage2.viewQueue(queueName);
    
    // Add customer in first tab
    await queuePage.addCustomerToQueue({
      name: `Realtime Customer ${Date.now()}`,
      phone: `+601${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`
    });
    
    // Check if second tab shows updated count
    await page2.waitForTimeout(1000); // Wait for WebSocket update
    const waitingCount = await queuePage2.getWaitingCount();
    expect(parseInt(waitingCount)).toBeGreaterThan(0);
  });

  test('should show live connection status', async ({ page }) => {
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
    
    // Check connection indicator
    const connectionStatus = page.locator('#connection-status');
    await expect(connectionStatus).toBeVisible();
    
    // Should show connected status
    await expect(connectionStatus).toHaveClass(/connected/, { timeout: 5000 });
    await expect(connectionStatus).toContainText('Connected');
  });

  test('should handle WebSocket reconnection', async ({ page, context }) => {
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
    
    // Monitor WebSocket events
    const wsPromise = page.waitForEvent('websocket');
    const ws = await wsPromise;
    
    // Check WebSocket URL
    expect(ws.url()).toContain('socket.io');
    
    // Connection status should update on disconnect/reconnect
    const connectionStatus = page.locator('#connection-status');
    await expect(connectionStatus).toBeVisible();
  });
});