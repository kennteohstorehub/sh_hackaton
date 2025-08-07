const { test, expect } = require('@playwright/test');

test.describe('WebChat Notification System', () => {
  const BASE_URL = 'http://localhost:3000';
  const MERCHANT_ID = '6540e8d5861e79dc6ef4f88e';
  
  test('Should receive notifications in webchat after joining queue', async ({ page, context }) => {
    // Enable console logging for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text());
      } else {
        console.log('Browser console:', msg.text());
      }
    });
    
    // Step 1: Join queue via form
    await page.goto(`${BASE_URL}/queue/${MERCHANT_ID}`);
    
    // Fill out the queue form
    await page.fill('input[name="customerName"]', 'Playwright Test User');
    await page.fill('input[name="customerPhone"]', '+60123456789');
    await page.fill('input[name="partySize"]', '2');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Step 2: Wait for redirect to queue-chat
    await page.waitForURL(/\/queue-chat\//);
    console.log('Redirected to queue chat:', page.url());
    
    // Step 3: Verify welcome messages appear
    await expect(page.locator('.message.bot').first()).toBeVisible({ timeout: 10000 });
    
    // Check for welcome message
    const welcomeMessage = await page.locator('.message.bot').first().textContent();
    expect(welcomeMessage).toContain('Welcome');
    expect(welcomeMessage).toContain('Playwright Test User');
    
    // Step 4: Verify queue info is displayed
    await expect(page.locator('.message.bot').nth(1)).toBeVisible({ timeout: 5000 });
    const queueInfo = await page.locator('.message.bot').nth(1).textContent();
    expect(queueInfo).toContain('successfully joined the queue');
    expect(queueInfo).toContain('Queue Number');
    
    // Step 5: Extract entry ID from console logs
    const entryId = await page.evaluate(() => {
      return window.queueChat?.queueData?.entryId || window.queueChat?.queueData?.id;
    });
    console.log('Queue Entry ID:', entryId);
    expect(entryId).toBeTruthy();
    
    // Step 6: Open admin dashboard in new tab
    const adminPage = await context.newPage();
    await adminPage.goto(`${BASE_URL}/dashboard`);
    
    // Login if needed (adjust based on your auth)
    // await adminPage.fill('#username', 'admin');
    // await adminPage.fill('#password', 'password');
    // await adminPage.click('button[type="submit"]');
    
    // Step 7: Find and notify the test customer
    await adminPage.waitForSelector('.queue-entry', { timeout: 10000 });
    
    // Find our test user
    const testUserEntry = await adminPage.locator('.queue-entry')
      .filter({ hasText: 'Playwright Test User' })
      .first();
    
    await expect(testUserEntry).toBeVisible();
    
    // Click notify button
    await testUserEntry.locator('button:has-text("Notify")').click();
    
    // Step 8: Verify notification received in webchat
    await page.waitForTimeout(2000); // Allow time for socket message
    
    // Look for notification message
    const notificationMessage = await page.locator('.message')
      .filter({ hasText: 'YOUR TURN' })
      .first();
    
    await expect(notificationMessage).toBeVisible({ timeout: 10000 });
    
    // Verify verification code is displayed
    const verificationDisplay = page.locator('#verificationDisplay');
    await expect(verificationDisplay).toBeVisible();
    
    const verifyCode = await page.locator('#headerVerifyCode').textContent();
    expect(verifyCode).toMatch(/^\d{4}$/); // Should be 4 digits
    
    // Step 9: Verify browser notification (if supported)
    const notifications = await context.waitForEvent('notification', { timeout: 5000 })
      .catch(() => null);
    
    if (notifications) {
      expect(notifications.title).toContain('Your Turn');
      expect(notifications.body).toContain('proceed to counter');
    }
    
    console.log('✅ WebChat notification test passed!');
  });
  
  test('Should handle DOM race conditions gracefully', async ({ page }) => {
    // Test rapid navigation to ensure no race conditions
    for (let i = 0; i < 3; i++) {
      await page.goto(`${BASE_URL}/queue-chat/qc_test_${Date.now()}`);
      
      // Should not see any console errors about null elements
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error' && msg.text().includes('Cannot read properties of null')) {
          consoleErrors.push(msg.text());
        }
      });
      
      await page.waitForTimeout(1000);
      
      // Verify no null reference errors
      expect(consoleErrors).toHaveLength(0);
      
      // Verify welcome message appears
      await expect(page.locator('.message.bot').first()).toBeVisible({ timeout: 5000 });
    }
  });
  
  test('Should recover from missing DOM elements', async ({ page }) => {
    await page.goto(`${BASE_URL}/queue-chat/qc_test_recovery`);
    
    // Inject a scenario where DOM element is temporarily missing
    await page.evaluate(() => {
      const container = document.getElementById('messagesContainer');
      if (container) {
        container.id = 'messagesContainer-temp';
        setTimeout(() => {
          container.id = 'messagesContainer';
        }, 500);
      }
    });
    
    // Try to send a message
    await page.fill('#messageInput', 'Test message');
    await page.press('#messageInput', 'Enter');
    
    // Should eventually show the message once DOM is restored
    await expect(page.locator('.message.user').filter({ hasText: 'Test message' }))
      .toBeVisible({ timeout: 5000 });
  });
});

// Run with: npx playwright test tests/e2e/webchat-notification-fix.spec.js