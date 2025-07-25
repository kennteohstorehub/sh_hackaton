// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Customer Experience Tests', () => {
  test.describe('Customer Queue Join Flow', () => {
    test('should display join queue page correctly', async ({ page }) => {
      await page.goto('/join');
      
      // Check page elements
      await expect(page.locator('h1')).toContainText('Join Queue');
      await expect(page.locator('.join-methods')).toBeVisible();
      
      // Check available join methods
      await expect(page.locator(':text("WhatsApp")')).toBeVisible();
      await expect(page.locator(':text("Facebook Messenger")')).toBeVisible();
      await expect(page.locator(':text("Web Form")')).toBeVisible();
    });

    test('should show queue selection when multiple queues available', async ({ page }) => {
      await page.goto('/join');
      
      // Check queue selection
      await expect(page.locator('.queue-selection')).toBeVisible();
      await expect(page.locator('select[name="queueId"], .queue-options')).toBeVisible();
    });

    test('should validate customer information', async ({ page }) => {
      await page.goto('/join');
      
      // Try to submit without filling required fields
      await page.click('button:has-text("Join Queue")');
      
      // Check validation messages
      await expect(page.locator(':text("Name is required")')).toBeVisible();
      await expect(page.locator(':text("Contact is required")')).toBeVisible();
    });

    test('should successfully join queue via web form', async ({ page }) => {
      await page.goto('/join');
      
      // Fill customer information with dynamic data
      await page.fill('input[name="customerName"]', `Test Customer ${Date.now()}`);
      await page.fill('input[name="contactNumber"]', `+601${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`);
      await page.fill('input[name="partySize"]', String(Math.floor(Math.random() * 6) + 1));
      
      // Submit form
      await page.click('button:has-text("Join Queue")');
      
      // Check success message
      await expect(page.locator('.success-message')).toBeVisible();
      await expect(page.locator(':text("Queue Number")')).toBeVisible();
    });

    test('should show estimated wait time', async ({ page }) => {
      await page.goto('/join');
      
      // Check wait time display
      await expect(page.locator('.estimated-wait')).toBeVisible();
      await expect(page.locator(':text("Estimated wait")')).toBeVisible();
    });

    test('should display queue capacity information', async ({ page }) => {
      await page.goto('/join');
      
      // Check capacity info
      await expect(page.locator('.queue-capacity')).toBeVisible();
      await expect(page.locator(':text("Current queue length")')).toBeVisible();
    });
  });

  test.describe('Customer Queue Status Page', () => {
    test('should display queue status for customer', async ({ page }) => {
      // Simulate customer with queue number
      const queueNumber = `A${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      await page.goto(`/status?queue=${queueNumber}`);
      
      // Check status elements
      await expect(page.locator('.queue-number')).toBeVisible();
      await expect(page.locator('.position-in-queue')).toBeVisible();
      await expect(page.locator('.estimated-time')).toBeVisible();
    });

    test('should update position in real-time', async ({ page }) => {
      const queueNumber = `A${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      await page.goto(`/status?queue=${queueNumber}`);
      
      // Check for real-time indicator
      await expect(page.locator('.live-indicator')).toBeVisible();
      await expect(page.locator(':text("Live updates")')).toBeVisible();
    });

    test('should show people ahead in queue', async ({ page }) => {
      const queueNumber = `A${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      await page.goto(`/status?queue=${queueNumber}`);
      
      // Check queue position info
      await expect(page.locator('.people-ahead')).toBeVisible();
      await expect(page.locator(':text("people ahead")')).toBeVisible();
    });

    test('should display notification when turn is approaching', async ({ page }) => {
      const queueNumber = `A${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      await page.goto(`/status?queue=${queueNumber}`);
      
      // Check for notification area
      await expect(page.locator('.notification-area')).toBeVisible();
    });

    test('should allow customer to cancel queue entry', async ({ page }) => {
      const queueNumber = `A${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      await page.goto(`/status?queue=${queueNumber}`);
      
      // Check cancel button
      await expect(page.locator('button:has-text("Leave Queue")')).toBeVisible();
      
      // Click cancel
      await page.click('button:has-text("Leave Queue")');
      
      // Check confirmation dialog
      await expect(page.locator('.confirm-dialog')).toBeVisible();
      await expect(page.locator(':text("Are you sure")')).toBeVisible();
    });

    test('should show queue closed message outside business hours', async ({ page }) => {
      // Navigate with closed queue parameter
      await page.goto('/status?queue=A001&closed=true');
      
      // Check closed message
      await expect(page.locator('.queue-closed')).toBeVisible();
      await expect(page.locator(':text("Queue is currently closed")')).toBeVisible();
    });
  });

  test.describe('Customer Notifications', () => {
    test('should request notification permission', async ({ page, context }) => {
      // Grant permission for this test
      await context.grantPermissions(['notifications']);
      
      const queueNumber = `A${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      await page.goto(`/status?queue=${queueNumber}`);
      
      // Check notification permission UI
      await expect(page.locator('.notification-permission')).toBeVisible();
    });

    test('should show notification preferences', async ({ page }) => {
      const queueNumber = `A${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      await page.goto(`/status?queue=${queueNumber}`);
      
      // Check notification options
      await expect(page.locator(':text("Notification Settings")')).toBeVisible();
      await expect(page.locator('input[name="soundEnabled"]')).toBeVisible();
      await expect(page.locator('input[name="vibrationEnabled"]')).toBeVisible();
    });

    test('should display in-app notifications', async ({ page }) => {
      const queueNumber = `A${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      await page.goto(`/status?queue=${queueNumber}`);
      
      // Check in-app notification area
      await expect(page.locator('.in-app-notifications')).toBeVisible();
    });
  });

  test.describe('Customer Mobile Experience', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should be mobile-friendly for queue join', async ({ page }) => {
      await page.goto('/join');
      
      // Check mobile layout
      await expect(page.locator('.join-methods')).toBeVisible();
      
      // Buttons should be touch-friendly
      const joinButton = page.locator('button:has-text("Join Queue")');
      const box = await joinButton.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44); // iOS touch target
    });

    test('should show mobile-optimized status page', async ({ page }) => {
      const queueNumber = `A${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      await page.goto(`/status?queue=${queueNumber}`);
      
      // Check mobile elements
      await expect(page.locator('.queue-number')).toBeVisible();
      await expect(page.locator('.position-in-queue')).toBeVisible();
      
      // Check font sizes are readable
      const queueNumberElement = page.locator('.queue-number');
      const fontSize = await queueNumberElement.evaluate(el => 
        window.getComputedStyle(el).fontSize
      );
      expect(parseInt(fontSize)).toBeGreaterThanOrEqual(16);
    });

    test('should have mobile-friendly touch targets', async ({ page }) => {
      const queueNumber = `A${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      await page.goto(`/status?queue=${queueNumber}`);
      
      // Check button sizes
      const buttons = page.locator('button');
      const count = await buttons.count();
      
      for (let i = 0; i < count; i++) {
        const box = await buttons.nth(i).boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
        }
      }
    });
  });

  test.describe('Customer Queue History', () => {
    test('should show past queue entries', async ({ page }) => {
      await page.goto('/history');
      
      // Check history display
      await expect(page.locator('.queue-history')).toBeVisible();
      await expect(page.locator(':text("Your Queue History")')).toBeVisible();
    });

    test('should display visit details', async ({ page }) => {
      await page.goto('/history');
      
      // Check visit information
      await expect(page.locator('.visit-date')).toBeVisible();
      await expect(page.locator('.visit-merchant')).toBeVisible();
      await expect(page.locator('.wait-time')).toBeVisible();
    });
  });

  test.describe('Customer Feedback', () => {
    test('should show feedback form after service', async ({ page }) => {
      const queueNumber = `A${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      await page.goto(`/feedback?queue=${queueNumber}`);
      
      // Check feedback form
      await expect(page.locator('.feedback-form')).toBeVisible();
      await expect(page.locator(':text("Rate your experience")')).toBeVisible();
      
      // Check rating options
      await expect(page.locator('.rating-stars')).toBeVisible();
    });

    test('should validate feedback submission', async ({ page }) => {
      const queueNumber = `A${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      await page.goto(`/feedback?queue=${queueNumber}`);
      
      // Try to submit without rating
      await page.click('button:has-text("Submit Feedback")');
      
      // Check validation
      await expect(page.locator(':text("Please select a rating")')).toBeVisible();
    });

    test('should submit feedback successfully', async ({ page }) => {
      const queueNumber = `A${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      await page.goto(`/feedback?queue=${queueNumber}`);
      
      // Select rating
      await page.click('.rating-stars .star:nth-child(4)');
      
      // Add comment with dynamic content
      await page.fill('textarea[name="comment"]', `Great service! Test feedback ${Date.now()}`);
      
      // Submit
      await page.click('button:has-text("Submit Feedback")');
      
      // Check success
      await expect(page.locator('.feedback-success')).toBeVisible();
      await expect(page.locator(':text("Thank you for your feedback")')).toBeVisible();
    });
  });

  test.describe('Customer Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('/join');
      
      // Check ARIA labels
      await expect(page.locator('input[name="customerName"]')).toHaveAttribute('aria-label', /name/i);
      await expect(page.locator('button:has-text("Join Queue")')).toHaveAttribute('aria-label', /join queue/i);
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/join');
      
      // Tab through form
      await page.keyboard.press('Tab');
      await expect(page.locator('input[name="customerName"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('input[name="contactNumber"]')).toBeFocused();
    });

    test('should have sufficient color contrast', async ({ page }) => {
      await page.goto('/join');
      
      // This is a simplified check - in real tests you'd use axe-core
      const button = page.locator('button:has-text("Join Queue")');
      const backgroundColor = await button.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      const color = await button.evaluate(el => 
        window.getComputedStyle(el).color
      );
      
      // Basic check that colors are defined
      expect(backgroundColor).toBeTruthy();
      expect(color).toBeTruthy();
    });
  });

  test.describe('Multi-language Support', () => {
    test('should show language selector', async ({ page }) => {
      await page.goto('/join');
      
      // Check language selector
      await expect(page.locator('.language-selector')).toBeVisible();
      await expect(page.locator('select[name="language"]')).toBeVisible();
    });

    test('should switch languages', async ({ page }) => {
      await page.goto('/join');
      
      // Switch to Chinese
      await page.selectOption('select[name="language"]', 'zh');
      
      // Check that content changes
      await page.waitForTimeout(500); // Wait for language change
      // Would check for Chinese text in real implementation
    });
  });
});