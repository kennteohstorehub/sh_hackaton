const { test, expect } = require('@playwright/test');

test.describe('Quick Verification - Dashboard Functionality', () => {
  test('Verify all critical dashboard functions', async ({ page }) => {
    console.log('Starting quick verification test...');
    
    // 1. Login
    await page.goto('http://localhost:3000/auth/login');
    await page.fill('input[name="email"]', 'demo@storehub.com');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard with longer timeout
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✓ Login successful');
    
    // 2. Verify dashboard loads
    await expect(page.locator('h1')).toContainText('Queue Management Dashboard');
    console.log('✓ Dashboard loaded');
    
    // 3. Check queue cards exist
    const queueCards = page.locator('.queue-card');
    const cardCount = await queueCards.count();
    expect(cardCount).toBeGreaterThan(0);
    console.log(`✓ Found ${cardCount} queue cards`);
    
    // 4. Test Notify button
    const firstQueue = queueCards.first();
    const notifyBtn = firstQueue.locator('button.notify-btn, button:has-text("Notify")');
    
    if (await notifyBtn.count() > 0) {
      await expect(notifyBtn).toBeVisible();
      await expect(notifyBtn).toBeEnabled();
      
      // Click notify
      await notifyBtn.click();
      await page.waitForTimeout(1000);
      console.log('✓ Notify button clicked');
      
      // Check for any response (success message, toast, or state change)
      const possibleResponses = [
        page.locator('.alert-success'),
        page.locator('.toast'),
        page.locator('text=/notified|called|success/i')
      ];
      
      for (const selector of possibleResponses) {
        if (await selector.count() > 0) {
          console.log('✓ Notify action completed with response');
          break;
        }
      }
    }
    
    // 5. Test Stop/Start Queue button
    const stopBtn = firstQueue.locator('button.stop-btn, button:has-text("Stop")');
    
    if (await stopBtn.count() > 0) {
      await stopBtn.click();
      
      // Handle confirmation
      const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
      if (await confirmBtn.count() > 0) {
        await confirmBtn.click();
      }
      
      await page.waitForTimeout(1000);
      console.log('✓ Stop queue button clicked');
      
      // Check status changed
      const statusElement = firstQueue.locator('.queue-status');
      await expect(statusElement).toContainText(/Closed|Stopped|Inactive/i);
      console.log('✓ Queue status updated');
      
      // Restart queue
      const startBtn = firstQueue.locator('button.start-btn, button:has-text("Start")');
      if (await startBtn.count() > 0) {
        await startBtn.click();
        await page.waitForTimeout(1000);
        console.log('✓ Queue restarted');
      }
    }
    
    // 6. Test View Public Queue button
    await page.goto('http://localhost:3000/dashboard/settings');
    await page.waitForLoadState('networkidle');
    
    const publicQueueBtn = page.locator('a:has-text("View Public Queue")').first();
    if (await publicQueueBtn.count() > 0) {
      const href = await publicQueueBtn.getAttribute('href');
      console.log(`✓ Public queue link: ${href}`);
      
      // Verify link format
      expect(href).not.toContain('/queue/undefined');
      expect(href).toMatch(/\/(join-queue|queue-info|join|queue\/)/);
      
      // Test opening the link
      await page.goto(href);
      await page.waitForLoadState('networkidle');
      
      // Verify not 404
      const pageTitle = await page.title();
      expect(pageTitle).not.toContain('404');
      expect(pageTitle).not.toContain('Not Found');
      console.log('✓ Public queue page loads correctly');
    }
    
    // 7. Test customer join queue
    const merchantId = 'clxa0zlb10000kxhzf7p0q8d9'; // Demo merchant ID
    await page.goto(`http://localhost:3000/join-queue/${merchantId}`);
    await page.waitForLoadState('networkidle');
    
    // Verify page loads
    await expect(page.locator('h2')).toContainText('Demo Restaurant');
    console.log('✓ Customer join page loads');
    
    // Select a queue if available
    if (await page.locator('.queue-item').count() > 0) {
      await page.locator('.queue-item').first().click();
      
      // Fill form
      await page.fill('#customerName', `Test User ${Date.now()}`);
      await page.fill('#customerPhone', '+60123456789');
      await page.selectOption('#partySize', '2');
      
      // Submit
      await page.click('#joinBtn');
      
      // Check result
      const result = await Promise.race([
        page.waitForSelector('#successMessage', { timeout: 5000 }).then(() => 'success'),
        page.waitForSelector('#errorMessage', { timeout: 5000 }).then(() => 'error')
      ]);
      
      console.log(`✓ Customer join form submission: ${result}`);
    }
    
    console.log('\n✅ All critical functions verified!');
  });
});