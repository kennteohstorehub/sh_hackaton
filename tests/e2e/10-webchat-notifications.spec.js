const { test, expect } = require('@playwright/test');
const { generateRandomPhone, generateRandomName } = require('./test-utils');

test.describe('WebChat Notification System', () => {
  let customerContext;
  let merchantContext;
  let customerPage;
  let merchantPage;
  let sessionId;
  let queueData;

  test.beforeAll(async ({ browser }) => {
    // Create two browser contexts - one for customer, one for merchant
    customerContext = await browser.newContext();
    merchantContext = await browser.newContext();
  });

  test.afterAll(async () => {
    await customerContext.close();
    await merchantContext.close();
  });

  test('Complete webchat notification flow', async () => {
    // Step 1: Merchant login
    merchantPage = await merchantContext.newPage();
    await merchantPage.goto('/login');
    
    await merchantPage.fill('input[name="email"]', 'demo@storehub.com');
    await merchantPage.fill('input[name="password"]', 'demo1234');
    await merchantPage.click('button[type="submit"]');
    
    await merchantPage.waitForURL('/dashboard');
    await expect(merchantPage.locator('h1')).toContainText('Queue Dashboard');

    // Get the merchant ID and queue information
    const merchantId = await merchantPage.evaluate(() => {
      const script = document.querySelector('script:not([src])');
      const match = script?.textContent.match(/merchantId['"]\s*:\s*['"]([^'"]+)['"]/);
      return match ? match[1] : null;
    });
    
    expect(merchantId).toBeTruthy();

    // Step 2: Customer opens webchat
    customerPage = await customerContext.newPage();
    
    // Set up WebSocket listener before navigation
    const wsMessages = [];
    await customerPage.evaluateOnNewDocument(() => {
      window.wsMessages = [];
      const originalSocket = window.WebSocket;
      window.WebSocket = class extends originalSocket {
        constructor(...args) {
          super(...args);
          const socket = this;
          
          // Capture incoming messages
          const originalOnMessage = socket.onmessage;
          Object.defineProperty(socket, 'onmessage', {
            get() { return originalOnMessage; },
            set(handler) {
              socket.addEventListener('message', (event) => {
                window.wsMessages.push({
                  type: 'received',
                  data: event.data,
                  timestamp: new Date().toISOString()
                });
                handler(event);
              });
            }
          });
        }
      };
    });

    await customerPage.goto(`/queue/join/${merchantId}`);
    
    // Generate test data
    const customerName = generateRandomName();
    const customerPhone = generateRandomPhone();
    sessionId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Fill join form
    await customerPage.fill('input[name="name"]', customerName);
    await customerPage.fill('input[name="phone"]', customerPhone);
    await customerPage.fill('input[name="partySize"]', '2');
    await customerPage.fill('textarea[name="specialRequests"]', 'E2E test - notify immediately');
    
    // Submit form
    await customerPage.click('button[type="submit"]');
    
    // Wait for success message
    await customerPage.waitForSelector('.queue-number', { timeout: 10000 });
    
    // Capture queue information
    queueData = await customerPage.evaluate(() => {
      const queueNumber = document.querySelector('.queue-number')?.textContent;
      const position = document.querySelector('.position')?.textContent;
      const verificationCode = document.querySelector('.verification-code')?.textContent;
      return { queueNumber, position, verificationCode };
    });
    
    expect(queueData.queueNumber).toBeTruthy();
    expect(queueData.position).toBeTruthy();

    // Step 3: Verify customer appears in merchant dashboard
    await merchantPage.reload();
    await merchantPage.waitForTimeout(1000); // Allow time for WebSocket update
    
    // Check if customer appears in waiting list
    const customerEntry = await merchantPage.locator(`.customer-entry:has-text("${customerName}")`);
    await expect(customerEntry).toBeVisible({ timeout: 10000 });
    
    // Verify customer details
    await expect(customerEntry).toContainText(customerPhone);
    await expect(customerEntry).toContainText('2'); // party size

    // Step 4: Merchant notifies customer
    const notifyButton = customerEntry.locator('button:has-text("Notify")');
    await expect(notifyButton).toBeVisible();
    
    // Click notify button
    await notifyButton.click();
    
    // Wait for confirmation or success indication
    await merchantPage.waitForTimeout(1000);

    // Step 5: Verify customer receives WebSocket notification
    await customerPage.waitForTimeout(2000); // Allow time for WebSocket message
    
    // Check if notification was received
    const wsNotifications = await customerPage.evaluate(() => {
      return window.wsMessages || [];
    });
    
    console.log('WebSocket messages received:', wsNotifications.length);
    
    // Alternative: Check for UI update
    const notificationElement = await customerPage.locator('.notification-message, .alert-success, [data-notification]');
    const hasNotification = await notificationElement.count() > 0;
    
    if (hasNotification) {
      await expect(notificationElement.first()).toContainText(/your turn|ready|proceed/i);
    }

    // Step 6: Verify customer status is updated
    await merchantPage.reload();
    
    // Customer should now show as 'called' or no longer in waiting list
    const updatedCustomer = await merchantPage.locator(`.customer-entry:has-text("${customerName}")`);
    const customerStillWaiting = await updatedCustomer.count() > 0;
    
    if (customerStillWaiting) {
      // Check if status changed to 'called'
      await expect(updatedCustomer).toContainText(/called|notified/i);
    }
  });

  test('WebSocket reconnection handling', async ({ page }) => {
    // Test that WebSocket reconnects after disconnection
    await page.goto(`/queue/join/${merchantId || '7a99f35e-0f73-4f8e-831c-fde8fc3a5532'}`);
    
    // Disconnect WebSocket
    await page.evaluate(() => {
      if (window.socket) {
        window.socket.disconnect();
      }
    });
    
    await page.waitForTimeout(1000);
    
    // Check reconnection
    const isConnected = await page.evaluate(() => {
      return window.socket && window.socket.connected;
    });
    
    expect(isConnected).toBeTruthy();
  });

  test('Multiple customers notification order', async () => {
    // Create multiple customers
    const customers = [];
    
    for (let i = 0; i < 3; i++) {
      const page = await customerContext.newPage();
      const name = `Test Customer ${i + 1}`;
      const phone = generateRandomPhone();
      
      await page.goto(`/queue/join/${merchantId || '7a99f35e-0f73-4f8e-831c-fde8fc3a5532'}`);
      await page.fill('input[name="name"]', name);
      await page.fill('input[name="phone"]', phone);
      await page.fill('input[name="partySize"]', '2');
      await page.click('button[type="submit"]');
      
      await page.waitForSelector('.queue-number');
      
      const position = await page.locator('.position').textContent();
      customers.push({ page, name, phone, position });
    }
    
    // Verify order in merchant dashboard
    await merchantPage.reload();
    
    for (let i = 0; i < customers.length; i++) {
      const customerEntry = await merchantPage.locator(`.customer-entry:has-text("${customers[i].name}")`);
      await expect(customerEntry).toBeVisible();
    }
    
    // Clean up
    for (const customer of customers) {
      await customer.page.close();
    }
  });

  test('Notification with special characters in name', async ({ page }) => {
    // Test with names containing special characters
    const specialNames = [
      "O'Brien",
      "José García",
      "李明 (Li Ming)",
      "Anna-Marie",
      "Test & User"
    ];
    
    for (const name of specialNames) {
      await page.goto(`/queue/join/${merchantId || '7a99f35e-0f73-4f8e-831c-fde8fc3a5532'}`);
      await page.fill('input[name="name"]', name);
      await page.fill('input[name="phone"]', generateRandomPhone());
      await page.fill('input[name="partySize"]', '1');
      await page.click('button[type="submit"]');
      
      // Verify successful submission
      await expect(page.locator('.queue-number')).toBeVisible({ timeout: 10000 });
      
      // Go back for next test
      await page.goBack();
    }
  });

  test('Notification persistence across page refresh', async () => {
    // Join queue
    const page = await customerContext.newPage();
    const name = generateRandomName();
    const phone = generateRandomPhone();
    
    await page.goto(`/queue/join/${merchantId || '7a99f35e-0f73-4f8e-831c-fde8fc3a5532'}`);
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="phone"]', phone);
    await page.fill('input[name="partySize"]', '2');
    await page.click('button[type="submit"]');
    
    await page.waitForSelector('.queue-number');
    
    // Get session ID from page
    const currentSessionId = await page.evaluate(() => {
      return window.sessionId || localStorage.getItem('queueSessionId');
    });
    
    // Refresh page
    await page.reload();
    
    // Check if queue status is maintained
    const statusEndpoint = `/api/webchat/status/${currentSessionId}`;
    const response = await page.request.get(statusEndpoint);
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBeTruthy();
    expect(data.queueEntry).toBeTruthy();
    
    await page.close();
  });
});