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
    
    await loginPage.goto();
    await loginPage.login('demo@smartqueue.com', 'demo123456');
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
    
    // Add customer
    await queuePage.addCustomerToQueue({
      name: 'John Doe',
      phone: '+60123456789',
      partySize: 4,
      notes: 'Birthday celebration'
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
    
    // Add multiple customers
    await queuePage.addCustomerToQueue({
      name: 'Customer 1',
      phone: '+60111111111',
      partySize: 2
    });
    
    await queuePage.addCustomerToQueue({
      name: 'Customer 2',
      phone: '+60122222222',
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
      name: 'Customer 1',
      phone: '+60111111111'
    });
    
    await queuePage.addCustomerToQueue({
      name: 'Customer 2',
      phone: '+60122222222'
    });
    
    // Try to add beyond capacity
    await queuePage.addCustomerToQueue({
      name: 'Customer 3',
      phone: '+60133333333'
    });
    
    // Should show capacity error
    await expect(page.locator('.alert-danger')).toContainText('capacity');
  });
});

test.describe('Queue Real-time Features', () => {
  test('should update queue status in real-time', async ({ page, context }) => {
    // Login on first page
    const loginPage = new LoginPage(page);
    const queuePage = new QueueManagementPage(page);
    
    await loginPage.goto();
    await loginPage.login('demo@smartqueue.com', 'demo123456');
    await queuePage.goto();
    
    // Create a queue
    const queueName = 'Realtime Test Queue ' + Date.now();
    await queuePage.createQueue({ name: queueName });
    
    // Open second browser tab
    const page2 = await context.newPage();
    const loginPage2 = new LoginPage(page2);
    const queuePage2 = new QueueManagementPage(page2);
    
    await loginPage2.goto();
    await loginPage2.login('demo@smartqueue.com', 'demo123456');
    await queuePage2.goto();
    
    // View queue in first tab
    await queuePage.viewQueue(queueName);
    
    // View same queue in second tab
    await queuePage2.viewQueue(queueName);
    
    // Add customer in first tab
    await queuePage.addCustomerToQueue({
      name: 'Realtime Customer',
      phone: '+60199999999'
    });
    
    // Check if second tab shows updated count
    await page2.waitForTimeout(1000); // Wait for WebSocket update
    const waitingCount = await queuePage2.getWaitingCount();
    expect(parseInt(waitingCount)).toBeGreaterThan(0);
  });
});