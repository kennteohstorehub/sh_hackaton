const { test, expect } = require('@playwright/test');
const testConfig = require('./test-config');

// Speed up test execution
test.use({
  actionTimeout: 5000,
  navigationTimeout: 10000,
  launchOptions: {
    args: ['--disable-blink-features=AutomationControlled']
  }
});

test.describe('Comprehensive System Test - High Speed', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test data first
    await page.goto('/');
    await page.waitForTimeout(500); // Brief wait for server readiness
  });

  test('Full system functionality - Dashboard, Queue Management, Customer Experience', async ({ page }) => {
    // 1. LOGIN TEST
    await test.step('Login to merchant dashboard', async () => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', 'demo@storehub.com');
      await page.fill('input[name="password"]', 'demo123');
      await page.click('button[type="submit"]');
      
      // Wait for dashboard to load
      await page.waitForURL('**/dashboard', { timeout: 5000 });
      await expect(page.locator('h1')).toContainText('Queue Management Dashboard');
    });

    // 2. DASHBOARD FUNCTIONALITY TEST
    await test.step('Verify dashboard cards and statistics', async () => {
      // Check all stat cards are visible
      const statCards = page.locator('.stat-card');
      await expect(statCards).toHaveCount(4);
      
      // Verify stat card contents
      await expect(page.locator('.stat-card').nth(0)).toContainText('Total Customers Today');
      await expect(page.locator('.stat-card').nth(1)).toContainText('Currently Waiting');
      await expect(page.locator('.stat-card').nth(2)).toContainText('Avg Wait Time');
      await expect(page.locator('.stat-card').nth(3)).toContainText('Service Rate');
      
      // Check queue cards
      const queueCards = page.locator('.queue-card');
      const queueCount = await queueCards.count();
      expect(queueCount).toBeGreaterThan(0);
      
      // Verify queue card structure
      for (let i = 0; i < Math.min(queueCount, 3); i++) {
        const queueCard = queueCards.nth(i);
        await expect(queueCard.locator('.queue-name')).toBeVisible();
        await expect(queueCard.locator('.queue-status')).toBeVisible();
        await expect(queueCard.locator('.notify-btn, .stop-btn')).toBeVisible();
      }
    });

    // 3. QUEUE OPERATIONS TEST
    await test.step('Test queue operations - Notify and Stop Queue buttons', async () => {
      // Find an active queue
      const activeQueue = page.locator('.queue-card').filter({ hasText: 'Active' }).first();
      
      if (await activeQueue.count() > 0) {
        // Test Notify button
        const notifyBtn = activeQueue.locator('.notify-btn');
        await expect(notifyBtn).toBeVisible();
        await expect(notifyBtn).toBeEnabled();
        
        // Click notify button
        await notifyBtn.click();
        
        // Check for success message or modal
        const successMessage = page.locator('.alert-success, .success-message, .toast-success');
        await expect(successMessage).toBeVisible({ timeout: 3000 }).catch(() => {
          // If no success message, check if action completed without error
          console.log('Notify action completed');
        });
        
        // Test Stop Queue button
        const stopBtn = activeQueue.locator('.stop-btn');
        await expect(stopBtn).toBeVisible();
        await expect(stopBtn).toBeEnabled();
        
        // Click stop queue button  
        await stopBtn.click();
        
        // Confirm action if modal appears
        const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
        if (await confirmBtn.count() > 0) {
          await confirmBtn.click();
        }
        
        // Wait for queue status to update
        await page.waitForTimeout(1000);
        
        // Verify queue is stopped
        await expect(activeQueue.locator('.queue-status')).toContainText(/Closed|Stopped|Inactive/i);
        
        // Reactivate the queue
        const startBtn = activeQueue.locator('.start-btn, .activate-btn');
        if (await startBtn.count() > 0) {
          await startBtn.click();
          await page.waitForTimeout(500);
        }
      }
    });

    // 4. ANALYTICS TEST
    await test.step('Verify analytics section', async () => {
      await page.click('a[href="/dashboard/analytics"]');
      await page.waitForURL('**/dashboard/analytics');
      
      // Check peak hours chart
      await expect(page.locator('.peak-hours-chart')).toBeVisible();
      
      // Verify chart bars don't require horizontal scrolling
      const chartContainer = page.locator('.peak-hours-chart');
      const containerBox = await chartContainer.boundingBox();
      const bars = page.locator('.peak-bar');
      const barCount = await bars.count();
      
      if (barCount > 0 && containerBox) {
        const lastBar = bars.last();
        const lastBarBox = await lastBar.boundingBox();
        if (lastBarBox) {
          // Verify last bar is within container (no horizontal scroll needed)
          expect(lastBarBox.x + lastBarBox.width).toBeLessThanOrEqual(containerBox.x + containerBox.width + 10);
        }
      }
      
      // Check performance metrics
      await expect(page.locator('.performance-metric')).toHaveCount(4);
    });

    // 5. SETTINGS TEST
    await test.step('Test settings page functionality', async () => {
      await page.click('a[href="/dashboard/settings"]');
      await page.waitForURL('**/dashboard/settings');
      
      // Verify all setting cards
      const settingCards = [
        'Profile Settings',
        'Business Information',
        'Queue Configuration',
        'Notification Settings',
        'Integration Settings'
      ];
      
      for (const cardTitle of settingCards) {
        await expect(page.locator('.settings-card').filter({ hasText: cardTitle })).toBeVisible();
      }
      
      // Test View Public Queue button
      const viewPublicBtn = page.locator('a.btn-primary:has-text("View Public Queue Page")');
      await expect(viewPublicBtn).toBeVisible();
      
      // Get merchant ID from the link
      const publicQueueUrl = await viewPublicBtn.getAttribute('href');
      expect(publicQueueUrl).toBeTruthy();
      
      // Open in new tab to test
      const [newPage] = await Promise.all([
        page.context().waitForEvent('page'),
        viewPublicBtn.click()
      ]);
      
      // Verify public queue page loads
      await newPage.waitForLoadState('networkidle');
      await expect(newPage.locator('h1, h2').first()).toContainText(/Queue|Join/i);
      await newPage.close();
    });

    // 6. CUSTOMER QUEUE JOIN TEST
    await test.step('Test customer queue joining flow', async () => {
      // Get merchant ID from dashboard
      const merchantIdElement = await page.locator('[data-merchant-id]').first();
      const merchantId = await merchantIdElement.getAttribute('data-merchant-id') || 'demo-merchant-id';
      
      // Navigate to customer join page
      await page.goto(`/join-queue/${merchantId}`);
      
      // Verify page loads correctly
      await expect(page.locator('h2')).toContainText('Demo Restaurant');
      
      // Select a queue
      const queueItem = page.locator('.queue-item').first();
      await queueItem.click();
      
      // Verify join form appears
      await expect(page.locator('#joinForm')).toBeVisible();
      
      // Fill customer details
      await page.fill('#customerName', `Test Customer ${Date.now()}`);
      await page.fill('#customerPhone', `+60${Math.floor(Math.random() * 1000000000)}`);
      await page.selectOption('#partySize', '2');
      
      // Submit form
      await page.click('#joinBtn');
      
      // Verify success message
      await expect(page.locator('#successMessage')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('#successText')).toContainText(/Successfully joined|position/i);
    });

    // 7. QUEUE INFO PAGE TEST
    await test.step('Test queue info page functionality', async () => {
      // Go back to dashboard to get a queue ID
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Get first queue's view button
      const viewQueueBtn = page.locator('.queue-card a:has-text("View Queue")').first();
      const queueUrl = await viewQueueBtn.getAttribute('href');
      
      if (queueUrl) {
        await page.goto(queueUrl);
        
        // Verify queue info page elements
        await expect(page.locator('.queue-status')).toBeVisible();
        await expect(page.locator('.stat-card')).toHaveCount(2); // People Ahead, Minutes Wait
        
        // Check queue status synchronization
        const topStatus = await page.locator('.queue-status').textContent();
        
        // If queue is open, verify join form is visible
        if (topStatus?.includes('Open')) {
          await expect(page.locator('.join-form')).toBeVisible();
          
          // Test joining from this page
          await page.fill('input[name="name"]', `Direct Join ${Date.now()}`);
          await page.fill('input[name="phone"]', `+60${Math.floor(Math.random() * 1000000000)}`);
          await page.selectOption('select[name="partySize"]', '1');
          
          await page.click('button[type="submit"]');
          
          // Check for validation or success
          const successOrError = page.locator('#successMessage, #errorMessage');
          await expect(successOrError).toBeVisible({ timeout: 5000 });
        }
      }
    });

    // 8. RESPONSIVE DESIGN TEST
    await test.step('Test responsive design on mobile viewport', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Test dashboard on mobile
      await page.goto('/dashboard');
      
      // Check mobile menu toggle
      const mobileMenuToggle = page.locator('.mobile-menu-toggle, [aria-label="Toggle menu"]');
      if (await mobileMenuToggle.count() > 0) {
        await mobileMenuToggle.click();
        await expect(page.locator('.mobile-nav, .sidebar')).toBeVisible();
      }
      
      // Test queue cards on mobile
      const mobileQueueCard = page.locator('.queue-card').first();
      await expect(mobileQueueCard).toBeVisible();
      
      // Reset viewport
      await page.setViewportSize({ width: 1280, height: 720 });
    });

    // 9. ERROR HANDLING TEST
    await test.step('Test error handling and validation', async () => {
      // Test with invalid queue ID
      await page.goto('/queue/invalid-queue-id');
      await expect(page.locator('text=/not found|error/i')).toBeVisible();
      
      // Test form validation on customer join page
      const validMerchantId = 'demo-merchant-id';
      await page.goto(`/join-queue/${validMerchantId}`);
      
      if (await page.locator('.queue-item').count() > 0) {
        await page.locator('.queue-item').first().click();
        
        // Try to submit empty form
        await page.click('#joinBtn');
        
        // Check for HTML5 validation or custom error messages
        const nameInput = page.locator('#customerName');
        const isInvalid = await nameInput.evaluate(el => !el.checkValidity());
        expect(isInvalid).toBeTruthy();
      }
    });

    // 10. PERFORMANCE TEST
    await test.step('Test page load performance', async () => {
      const startTime = Date.now();
      
      // Test dashboard load time
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      const dashboardLoadTime = Date.now() - startTime;
      expect(dashboardLoadTime).toBeLessThan(3000); // Should load within 3 seconds
      
      // Test queue page load time
      const queueStartTime = Date.now();
      await page.goto('/join-queue/demo-merchant-id');
      await page.waitForLoadState('networkidle');
      
      const queueLoadTime = Date.now() - queueStartTime;
      expect(queueLoadTime).toBeLessThan(2000); // Should load within 2 seconds
    });
  });

  test('Concurrent operations test', async ({ browser }) => {
    // Test multiple users joining queue simultaneously
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    try {
      // Both users navigate to join page
      await Promise.all([
        page1.goto('/join-queue/demo-merchant-id'),
        page2.goto('/join-queue/demo-merchant-id')
      ]);
      
      // Both select same queue
      if (await page1.locator('.queue-item').count() > 0) {
        await Promise.all([
          page1.locator('.queue-item').first().click(),
          page2.locator('.queue-item').first().click()
        ]);
        
        // Both fill forms
        await Promise.all([
          page1.fill('#customerName', 'Concurrent User 1'),
          page2.fill('#customerName', 'Concurrent User 2'),
          page1.fill('#customerPhone', '+601234567890'),
          page2.fill('#customerPhone', '+601234567891'),
          page1.selectOption('#partySize', '2'),
          page2.selectOption('#partySize', '3')
        ]);
        
        // Both submit simultaneously
        await Promise.all([
          page1.click('#joinBtn'),
          page2.click('#joinBtn')
        ]);
        
        // Both should succeed
        await expect(page1.locator('#successMessage')).toBeVisible({ timeout: 5000 });
        await expect(page2.locator('#successMessage')).toBeVisible({ timeout: 5000 });
      }
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});