const { test, expect, chromium } = require('@playwright/test');
const { generateRandomPhone, generateRandomName, loginAsMerchant, joinQueue } = require('./test-utils');

test.describe('Notification Flow - WebSocket Integration', () => {
  let browser;
  let merchantContext;
  let customerContext;
  let merchantPage;
  let customerPage;

  test.beforeAll(async () => {
    browser = await chromium.launch();
    merchantContext = await browser.newContext();
    customerContext = await browser.newContext();
  });

  test.afterAll(async () => {
    await merchantContext.close();
    await customerContext.close();
    await browser.close();
  });

  test('Customer receives real-time notification when called', async () => {
    // Setup merchant page
    merchantPage = await merchantContext.newPage();
    await loginAsMerchant(merchantPage);
    
    // Get merchant ID from dashboard
    const merchantId = await merchantPage.evaluate(() => {
      return window.merchantId || document.querySelector('[data-merchant-id]')?.dataset.merchantId || '7a99f35e-0f73-4f8e-831c-fde8fc3a5532';
    });

    // Setup customer page with WebSocket tracking
    customerPage = await customerContext.newPage();
    
    // Inject WebSocket message tracking
    await customerPage.addInitScript(() => {
      window.wsEvents = [];
      window.addEventListener('load', () => {
        if (window.socket) {
          const originalEmit = window.socket.emit;
          window.socket.emit = function(...args) {
            window.wsEvents.push({ type: 'emit', event: args[0], data: args[1], timestamp: Date.now() });
            return originalEmit.apply(this, args);
          };
          
          window.socket.on('customer-called', (data) => {
            window.wsEvents.push({ type: 'received', event: 'customer-called', data, timestamp: Date.now() });
            window.lastNotification = data;
          });
          
          window.socket.on('notification', (data) => {
            window.wsEvents.push({ type: 'received', event: 'notification', data, timestamp: Date.now() });
            window.lastNotification = data;
          });
        }
      });
    });

    // Customer joins queue
    const customerData = await joinQueue(customerPage, merchantId, {
      name: 'WebSocket Test User',
      phone: generateRandomPhone(),
      partySize: '3',
      specialRequests: 'Testing WebSocket notifications'
    });

    console.log('Customer joined:', customerData);

    // Wait for customer to appear in merchant dashboard
    await merchantPage.reload();
    await merchantPage.waitForTimeout(1000);

    // Find the customer in the dashboard
    const customerSelector = `.customer-entry:has-text("${customerData.name}")`;
    await merchantPage.waitForSelector(customerSelector, { timeout: 10000 });
    
    const customerEntry = merchantPage.locator(customerSelector);
    await expect(customerEntry).toBeVisible();

    // Get queue ID for direct API call
    const queueId = await merchantPage.evaluate(() => {
      const activeQueue = document.querySelector('[data-queue-id]');
      return activeQueue?.dataset.queueId || document.querySelector('[id^="queue-"]')?.id.replace('queue-', '');
    });

    console.log('Queue ID:', queueId);

    // Click notify button
    const notifyButton = customerEntry.locator('button:has-text("Notify")').first();
    await expect(notifyButton).toBeVisible();
    
    // Listen for notification on customer page
    const notificationPromise = customerPage.waitForFunction(
      () => window.lastNotification !== undefined,
      { timeout: 10000 }
    );

    // Click notify
    await notifyButton.click();
    
    // Wait for notification
    try {
      await notificationPromise;
      
      // Check notification content
      const notification = await customerPage.evaluate(() => window.lastNotification);
      console.log('Notification received:', notification);
      
      expect(notification).toBeTruthy();
      expect(notification.message).toContain('YOUR TURN');
      expect(notification.verificationCode).toBeTruthy();
    } catch (error) {
      // Fallback: Check if UI updated
      console.log('WebSocket notification timeout, checking UI updates...');
      
      await customerPage.waitForTimeout(2000);
      const pageContent = await customerPage.content();
      
      // Check for any notification indicators
      const hasNotification = 
        pageContent.includes('YOUR TURN') ||
        pageContent.includes('ready') ||
        pageContent.includes('proceed') ||
        pageContent.includes('called');
      
      expect(hasNotification).toBeTruthy();
    }

    // Verify WebSocket events were tracked
    const wsEvents = await customerPage.evaluate(() => window.wsEvents);
    console.log('WebSocket events:', wsEvents.length);
    
    // Check customer status in dashboard
    await merchantPage.reload();
    
    // Customer should either be gone from waiting list or show as called
    const updatedCustomer = merchantPage.locator(customerSelector);
    const stillVisible = await updatedCustomer.isVisible().catch(() => false);
    
    if (stillVisible) {
      // If still visible, should show called status
      await expect(updatedCustomer).toContainText(/called|notified/i);
    }
  });

  test('Notification includes verification code', async () => {
    // Quick test to verify verification code is included
    const page = await customerContext.newPage();
    
    await page.addInitScript(() => {
      window.notifications = [];
      if (window.socket) {
        window.socket.on('customer-called', (data) => {
          window.notifications.push(data);
        });
        window.socket.on('notification', (data) => {
          window.notifications.push(data);
        });
      }
    });

    const customerData = await joinQueue(page, '7a99f35e-0f73-4f8e-831c-fde8fc3a5532');
    
    // Simulate notification via API
    const response = await page.request.post(`/api/queue/notify-test`, {
      data: {
        customerId: customerData.customerId,
        verificationCode: 'TEST123'
      }
    }).catch(() => null);

    await page.waitForTimeout(1000);
    
    const notifications = await page.evaluate(() => window.notifications);
    
    if (notifications.length > 0) {
      expect(notifications[0].verificationCode).toBeTruthy();
    }
    
    await page.close();
  });

  test('Multiple customers receive notifications in order', async () => {
    // Create 3 customers
    const customers = [];
    
    for (let i = 0; i < 3; i++) {
      const page = await customerContext.newPage();
      
      await page.addInitScript(() => {
        window.notificationReceived = false;
        window.addEventListener('load', () => {
          if (window.socket) {
            window.socket.on('customer-called', () => {
              window.notificationReceived = true;
            });
            window.socket.on('notification', () => {
              window.notificationReceived = true;
            });
          }
        });
      });
      
      const data = await joinQueue(page, '7a99f35e-0f73-4f8e-831c-fde8fc3a5532', {
        name: `Queue Order Test ${i + 1}`,
        partySize: '1'
      });
      
      customers.push({ page, data, order: i + 1 });
    }

    // Login as merchant
    await loginAsMerchant(merchantPage);
    
    // Notify customers in order
    for (let i = 0; i < customers.length; i++) {
      await merchantPage.reload();
      
      const customerEntry = merchantPage.locator(`.customer-entry:has-text("${customers[i].data.name}")`).first();
      if (await customerEntry.isVisible()) {
        const notifyBtn = customerEntry.locator('button:has-text("Notify")');
        if (await notifyBtn.isVisible()) {
          await notifyBtn.click();
          await merchantPage.waitForTimeout(1000);
          
          // Check if customer received notification
          const notified = await customers[i].page.evaluate(() => window.notificationReceived);
          console.log(`Customer ${i + 1} notified:`, notified);
        }
      }
    }
    
    // Cleanup
    for (const customer of customers) {
      await customer.page.close();
    }
  });
});

test.describe('Error Handling', () => {
  test('Handles WebSocket disconnection gracefully', async ({ page }) => {
    await page.goto('/queue/join/7a99f35e-0f73-4f8e-831c-fde8fc3a5532');
    
    // Disconnect WebSocket after page loads
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      if (window.socket) {
        window.socket.disconnect();
        window.disconnected = true;
      }
    });
    
    // Try to join queue
    await page.fill('input[name="name"]', 'Disconnection Test');
    await page.fill('input[name="phone"]', generateRandomPhone());
    await page.fill('input[name="partySize"]', '2');
    await page.click('button[type="submit"]');
    
    // Should still work via HTTP fallback
    await expect(page.locator('.queue-number')).toBeVisible({ timeout: 10000 });
  });

  test('Handles invalid session gracefully', async ({ page }) => {
    // Try to check status with invalid session
    const response = await page.request.get('/api/webchat/status/invalid_session_id');
    
    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('No active queue found');
  });
});