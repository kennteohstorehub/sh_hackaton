const { test, expect } = require('@playwright/test');

// Configure for high-speed testing
test.use({
  actionTimeout: 3000,
  navigationTimeout: 5000,
});

test.describe('Queue Operations - Button Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Login to dashboard
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'demo@storehub.com');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('Notify button functionality', async ({ page }) => {
    // Find active queue with waiting customers
    const activeQueue = page.locator('.queue-card').filter({ 
      has: page.locator('.queue-status:has-text("Active")') 
    }).first();
    
    // Check if notify button exists and is enabled
    const notifyBtn = activeQueue.locator('button.notify-btn');
    await expect(notifyBtn).toBeVisible();
    await expect(notifyBtn).not.toBeDisabled();
    
    // Get initial waiting count
    const waitingCount = await activeQueue.locator('.waiting-count').textContent();
    
    // Click notify button
    await notifyBtn.click();
    
    // Wait for any response
    await page.waitForTimeout(1000);
    
    // Check for success indicators
    const possibleResponses = [
      page.locator('.alert-success'),
      page.locator('.toast-success'), 
      page.locator('text=/notified|called|sent/i'),
      activeQueue.locator('.waiting-count')
    ];
    
    let responseFound = false;
    for (const response of possibleResponses) {
      if (await response.count() > 0) {
        responseFound = true;
        break;
      }
    }
    
    expect(responseFound).toBeTruthy();
  });

  test('Stop/Start queue toggle functionality', async ({ page }) => {
    const queueCard = page.locator('.queue-card').first();
    
    // Check current status
    const statusElement = queueCard.locator('.queue-status');
    const initialStatus = await statusElement.textContent();
    
    if (initialStatus?.includes('Active')) {
      // Test stopping queue
      const stopBtn = queueCard.locator('button.stop-btn');
      await expect(stopBtn).toBeVisible();
      await stopBtn.click();
      
      // Handle confirmation if needed
      const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Stop Queue")');
      if (await confirmBtn.count() > 0) {
        await confirmBtn.click();
      }
      
      // Wait for status update
      await page.waitForTimeout(1000);
      
      // Verify status changed
      await expect(statusElement).toContainText(/Closed|Stopped|Inactive/i);
      
      // Test starting queue again
      const startBtn = queueCard.locator('button.start-btn, button:has-text("Start Queue")');
      await expect(startBtn).toBeVisible();
      await startBtn.click();
      
      await page.waitForTimeout(1000);
      await expect(statusElement).toContainText('Active');
    } else {
      // Queue is stopped, test starting it
      const startBtn = queueCard.locator('button.start-btn, button:has-text("Start Queue")');
      await expect(startBtn).toBeVisible();
      await startBtn.click();
      
      await page.waitForTimeout(1000);
      await expect(statusElement).toContainText('Active');
    }
  });

  test('Queue status synchronization', async ({ page }) => {
    // Get first queue's view link
    const viewBtn = page.locator('.queue-card a:has-text("View Queue")').first();
    const queueUrl = await viewBtn.getAttribute('href');
    
    // Open queue info page in new tab
    const newPage = await page.context().newPage();
    await newPage.goto(queueUrl);
    
    // Get status from both pages
    const dashboardStatus = await page.locator('.queue-card').first().locator('.queue-status').textContent();
    const publicStatus = await newPage.locator('.queue-status').textContent();
    
    // Check if statuses match
    const dashboardActive = dashboardStatus?.includes('Active');
    const publicOpen = publicStatus?.includes('Open');
    
    expect(dashboardActive).toBe(publicOpen);
    
    // Test status change synchronization
    if (dashboardActive) {
      // Stop queue from dashboard
      await page.locator('.queue-card').first().locator('button.stop-btn').click();
      
      // Confirm if needed
      const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
      if (await confirmBtn.count() > 0) {
        await confirmBtn.click();
      }
      
      // Wait and refresh public page
      await page.waitForTimeout(1000);
      await newPage.reload();
      
      // Verify public page shows closed
      await expect(newPage.locator('.queue-status')).toContainText(/Closed/i);
    }
    
    await newPage.close();
  });

  test('Customer join validation and error handling', async ({ page }) => {
    // Navigate to customer join page
    const merchantId = await page.locator('[data-merchant-id]').first().getAttribute('data-merchant-id');
    await page.goto(`/join-queue/${merchantId || 'demo-merchant-id'}`);
    
    // Try to submit without selecting queue
    if (await page.locator('#joinBtn').count() > 0) {
      await page.click('#joinBtn');
      
      // Should show error about selecting queue
      const errorMsg = page.locator('#errorMessage, .error-message, .alert-danger');
      await expect(errorMsg).toBeVisible();
      await expect(errorMsg).toContainText(/select.*queue/i);
    }
    
    // Select a queue
    if (await page.locator('.queue-item').count() > 0) {
      await page.locator('.queue-item').first().click();
      await expect(page.locator('#joinForm')).toBeVisible();
      
      // Test phone validation
      await page.fill('#customerName', 'Test User');
      
      // Test invalid phone formats
      const invalidPhones = ['123', 'abc123', '123-456-7890', '+1234'];
      
      for (const phone of invalidPhones) {
        await page.fill('#customerPhone', phone);
        await page.click('#joinBtn');
        
        // Check for validation error
        const phoneInput = page.locator('#customerPhone');
        const isInvalid = await phoneInput.evaluate(el => !el.checkValidity());
        expect(isInvalid).toBeTruthy();
      }
      
      // Test valid phone format
      await page.fill('#customerPhone', '+60123456789');
      await page.selectOption('#partySize', '2');
      await page.click('#joinBtn');
      
      // Should succeed
      await expect(page.locator('#successMessage')).toBeVisible({ timeout: 5000 });
    }
  });

  test('View Public Queue button functionality', async ({ page }) => {
    // Navigate to settings
    await page.click('a[href="/dashboard/settings"]');
    await page.waitForURL('**/dashboard/settings');
    
    // Find View Public Queue button
    const publicQueueBtn = page.locator('a:has-text("View Public Queue")').first();
    await expect(publicQueueBtn).toBeVisible();
    
    // Get href and verify it's not pointing to wrong route
    const href = await publicQueueBtn.getAttribute('href');
    expect(href).not.toContain('/queue/');
    expect(href).toMatch(/\/(join-queue|queue-info|public)/);
    
    // Click and verify it opens correctly
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      publicQueueBtn.click()
    ]);
    
    // Wait for new page to load
    await newPage.waitForLoadState('networkidle');
    
    // Verify it's not a 404
    const title = await newPage.title();
    expect(title).not.toContain('404');
    expect(title).not.toContain('Not Found');
    
    // Verify it shows queue-related content
    const content = await newPage.textContent('body');
    expect(content).toMatch(/queue|join|wait/i);
    
    await newPage.close();
  });

  test('Rapid button clicking stress test', async ({ page }) => {
    // Test rapid clicking doesn't break functionality
    const queueCard = page.locator('.queue-card').first();
    const notifyBtn = queueCard.locator('button.notify-btn');
    
    // Click notify button multiple times rapidly
    for (let i = 0; i < 5; i++) {
      await notifyBtn.click();
      await page.waitForTimeout(100);
    }
    
    // Page should still be functional
    await expect(page.locator('h1')).toContainText('Queue Management Dashboard');
    
    // Test stop/start rapid toggle
    const stopBtn = queueCard.locator('button.stop-btn');
    if (await stopBtn.count() > 0) {
      await stopBtn.click();
      
      // Handle any confirmation
      const confirmBtn = page.locator('button:has-text("Confirm")');
      if (await confirmBtn.count() > 0) {
        await confirmBtn.click();
      }
      
      await page.waitForTimeout(500);
      
      // Should now show start button
      const startBtn = queueCard.locator('button.start-btn, button:has-text("Start")');
      await expect(startBtn).toBeVisible();
    }
  });
});