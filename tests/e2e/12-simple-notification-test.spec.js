const { test, expect } = require('@playwright/test');

test.describe('Simple WebSocket Notification Test', () => {
  test('Basic notification flow works', async ({ page, context }) => {
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'log') {
        console.log('Browser log:', msg.text());
      }
    });

    // Step 1: Join queue as customer
    await page.goto('/queue/join/7a99f35e-0f73-4f8e-831c-fde8fc3a5532');
    
    // Fill in customer details
    const customerName = `Test User ${Date.now()}`;
    await page.fill('input[name="name"]', customerName);
    await page.fill('input[name="phone"]', '+60191234567');
    await page.fill('input[name="partySize"]', '2');
    await page.fill('textarea[name="specialRequests"]', 'Playwright E2E Test');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for queue number
    await page.waitForSelector('.queue-number, .queue-info, [data-queue-number]', { timeout: 10000 });
    
    // Get queue details
    const queueInfo = await page.evaluate(() => {
      const queueNumber = document.querySelector('.queue-number, [data-queue-number]')?.textContent;
      const position = document.querySelector('.position, [data-position]')?.textContent;
      const sessionId = window.sessionId || window.queueSessionId || localStorage.getItem('queueSessionId');
      return { queueNumber, position, sessionId };
    });
    
    console.log('Customer joined queue:', queueInfo);
    expect(queueInfo.queueNumber).toBeTruthy();
    
    // Step 2: Open merchant dashboard in new tab
    const merchantPage = await context.newPage();
    
    // Login as merchant
    await merchantPage.goto('/login');
    await merchantPage.fill('input[name="email"]', 'demo@storehub.com');
    await merchantPage.fill('input[name="password"]', 'demo1234');
    await merchantPage.click('button[type="submit"]');
    
    // Wait for dashboard
    await merchantPage.waitForURL('**/dashboard');
    await expect(merchantPage.locator('h1')).toContainText('Dashboard');
    
    // Step 3: Find customer in dashboard
    await merchantPage.waitForTimeout(2000); // Allow time for data to sync
    await merchantPage.reload(); // Refresh to get latest data
    
    // Look for customer
    const customerEntry = merchantPage.locator(`.customer-entry:has-text("${customerName}"), tr:has-text("${customerName}")`);
    await expect(customerEntry).toBeVisible({ timeout: 10000 });
    
    // Step 4: Set up notification listener on customer page
    const notificationReceived = page.evaluate(() => {
      return new Promise((resolve) => {
        // Listen for various notification events
        window.notificationReceived = false;
        
        if (window.socket) {
          window.socket.on('customer-called', (data) => {
            console.log('Received customer-called:', data);
            window.notificationReceived = true;
            resolve(data);
          });
          
          window.socket.on('notification', (data) => {
            console.log('Received notification:', data);
            window.notificationReceived = true;
            resolve(data);
          });
        }
        
        // Also listen for DOM changes
        const observer = new MutationObserver(() => {
          const hasNotification = document.body.textContent.includes('YOUR TURN') || 
                                document.body.textContent.includes('ready') ||
                                document.querySelector('.notification-alert');
          if (hasNotification) {
            window.notificationReceived = true;
            resolve({ type: 'dom-update' });
          }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Timeout after 15 seconds
        setTimeout(() => resolve(null), 15000);
      });
    });
    
    // Step 5: Click notify button in merchant dashboard
    const notifyButton = customerEntry.locator('button:has-text("Notify")').first();
    await expect(notifyButton).toBeVisible();
    
    console.log('Clicking notify button...');
    await notifyButton.click();
    
    // Step 6: Wait for notification
    const notification = await notificationReceived;
    console.log('Notification result:', notification);
    
    // Verify notification was received (either via WebSocket or DOM update)
    const wasNotified = await page.evaluate(() => window.notificationReceived);
    expect(wasNotified).toBeTruthy();
    
    // Additional verification: Check if customer status changed in merchant dashboard
    await merchantPage.reload();
    
    // Customer might be removed from waiting list or marked as called
    const customerGone = await customerEntry.isVisible().then(v => !v).catch(() => true);
    const customerCalled = await customerEntry.textContent().then(t => t.includes('called')).catch(() => false);
    
    expect(customerGone || customerCalled).toBeTruthy();
    
    // Clean up
    await merchantPage.close();
  });

  test('WebSocket connection is established', async ({ page }) => {
    await page.goto('/queue/join/7a99f35e-0f73-4f8e-831c-fde8fc3a5532');
    
    // Wait for page to load
    await page.waitForTimeout(1000);
    
    // Check if WebSocket is connected
    const socketStatus = await page.evaluate(() => {
      if (window.socket) {
        return {
          exists: true,
          connected: window.socket.connected,
          id: window.socket.id
        };
      }
      return { exists: false };
    });
    
    console.log('Socket status:', socketStatus);
    expect(socketStatus.exists).toBeTruthy();
    expect(socketStatus.connected).toBeTruthy();
  });

  test('Customer can check queue status', async ({ page }) => {
    // Join queue first
    await page.goto('/queue/join/7a99f35e-0f73-4f8e-831c-fde8fc3a5532');
    
    const customerName = `Status Test ${Date.now()}`;
    await page.fill('input[name="name"]', customerName);
    await page.fill('input[name="phone"]', '+60191234567');
    await page.fill('input[name="partySize"]', '1');
    await page.click('button[type="submit"]');
    
    // Wait for success
    await page.waitForSelector('.queue-number, .queue-info', { timeout: 10000 });
    
    // Get session ID
    const sessionId = await page.evaluate(() => {
      return window.sessionId || window.queueSessionId || localStorage.getItem('queueSessionId');
    });
    
    expect(sessionId).toBeTruthy();
    
    // Check status via API
    const response = await page.request.get(`/api/webchat/status/${sessionId}`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBeTruthy();
    expect(data.queueEntry).toBeTruthy();
    expect(data.status).toBe('waiting');
  });
});