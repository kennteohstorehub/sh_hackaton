// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('WhatsApp Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page and login
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    
    if (!testEmail || !testPassword) {
      test.skip('Test credentials not configured');
      return;
    }
    
    await page.goto('/login');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test.describe('WhatsApp Setup', () => {
    test('should display WhatsApp integration page', async ({ page }) => {
      // Navigate to WhatsApp settings
      await page.goto('/whatsapp-settings');
      
      // Check page elements
      await expect(page.locator('h1')).toContainText('WhatsApp Integration');
      await expect(page.locator('.qr-code-container')).toBeVisible();
      await expect(page.locator('.connection-status')).toBeVisible();
    });

    test('should show QR code for authentication', async ({ page }) => {
      await page.goto('/whatsapp-settings');
      
      // Check QR code is displayed
      const qrCode = page.locator('.qr-code-container img');
      await expect(qrCode).toBeVisible();
      
      // Check instructions are shown
      await expect(page.locator(':text("Scan this QR code with WhatsApp")')).toBeVisible();
    });

    test('should display connection status', async ({ page }) => {
      await page.goto('/whatsapp-settings');
      
      // Check status indicators
      const status = page.locator('.connection-status');
      await expect(status).toBeVisible();
      
      // Should show either connected or disconnected
      const statusText = await status.textContent();
      expect(statusText).toMatch(/Connected|Disconnected|Connecting/i);
    });

    test('should show whitelist configuration', async ({ page }) => {
      await page.goto('/whatsapp-settings');
      
      // Check whitelist section
      await expect(page.locator(':text("Allowed Phone Numbers")')).toBeVisible();
      await expect(page.locator('.whitelist-numbers')).toBeVisible();
      
      // Check if phone number configuration is shown
      await expect(page.locator('.whitelist-numbers')).toBeVisible();
    });
  });

  test.describe('WhatsApp Commands', () => {
    test('should display available commands', async ({ page }) => {
      await page.goto('/whatsapp-settings');
      
      // Check commands section
      await expect(page.locator(':text("Available Commands")')).toBeVisible();
      
      // Check for common commands
      const commands = ['join', 'status', 'cancel', 'help'];
      for (const cmd of commands) {
        await expect(page.locator(`:text("${cmd}")`)).toBeVisible();
      }
    });

    test('should show command examples', async ({ page }) => {
      await page.goto('/whatsapp-settings');
      
      // Check for example messages
      await expect(page.locator(':text("Example:")')).toBeVisible();
      await expect(page.locator(':text("join")')).toBeVisible();
      await expect(page.locator(':text("status")')).toBeVisible();
    });
  });

  test.describe('WhatsApp Analytics', () => {
    test('should show WhatsApp usage statistics', async ({ page }) => {
      await page.goto('/whatsapp-settings');
      
      // Check analytics section
      await expect(page.locator(':text("WhatsApp Statistics")')).toBeVisible();
      
      // Check for key metrics
      await expect(page.locator(':text("Total Messages")')).toBeVisible();
      await expect(page.locator(':text("Active Conversations")')).toBeVisible();
      await expect(page.locator(':text("Queue Joins via WhatsApp")')).toBeVisible();
    });
  });

  test.describe('WhatsApp Queue Integration', () => {
    test('should show WhatsApp option in queue settings', async ({ page }) => {
      // Navigate to queue management
      await page.goto('/queues');
      
      // Create or edit a queue
      await page.click('button:has-text("Create New Queue")');
      
      // Check for WhatsApp integration option
      await expect(page.locator(':text("Enable WhatsApp")')).toBeVisible();
      await expect(page.locator('input[name="whatsappEnabled"]')).toBeVisible();
    });

    test('should display WhatsApp join instructions for queue', async ({ page }) => {
      // Navigate to a specific queue
      await page.goto('/queues');
      await page.click('.queue-card:first-child');
      
      // Check for WhatsApp instructions
      await expect(page.locator(':text("Join via WhatsApp")')).toBeVisible();
      await expect(page.locator(':text("Send \'join\' to")')).toBeVisible();
    });
  });

  test.describe('WhatsApp Notifications', () => {
    test('should have notification settings for WhatsApp', async ({ page }) => {
      await page.goto('/whatsapp-settings');
      
      // Check notification options
      await expect(page.locator(':text("Notification Settings")')).toBeVisible();
      await expect(page.locator(':text("Queue position updates")')).toBeVisible();
      await expect(page.locator(':text("Turn approaching")')).toBeVisible();
      await expect(page.locator(':text("Service completed")')).toBeVisible();
    });

    test('should allow customizing notification messages', async ({ page }) => {
      await page.goto('/whatsapp-settings');
      
      // Check for message templates
      await expect(page.locator(':text("Message Templates")')).toBeVisible();
      await expect(page.locator('textarea[name="welcomeMessage"]')).toBeVisible();
      await expect(page.locator('textarea[name="positionUpdateMessage"]')).toBeVisible();
    });
  });

  test.describe('WhatsApp Security', () => {
    test('should enforce phone number whitelist', async ({ page }) => {
      await page.goto('/whatsapp-settings');
      
      // Check whitelist enforcement indicator
      await expect(page.locator(':text("Whitelist Enabled")')).toBeVisible();
      await expect(page.locator('.security-status')).toHaveClass(/enabled|active/);
    });

    test('should allow adding numbers to whitelist', async ({ page }) => {
      await page.goto('/whatsapp-settings');
      
      // Check add number functionality
      await expect(page.locator('input[placeholder*="phone number"]')).toBeVisible();
      await expect(page.locator('button:has-text("Add Number")')).toBeVisible();
    });

    test('should validate phone number format', async ({ page }) => {
      await page.goto('/whatsapp-settings');
      
      // Try adding invalid number
      await page.fill('input[placeholder*="phone number"]', 'invalid_phone_123');
      await page.click('button:has-text("Add Number")');
      
      // Check for validation error
      await expect(page.locator(':text("Invalid phone number")')).toBeVisible();
    });
  });

  test.describe('WhatsApp Error Handling', () => {
    test('should handle disconnection gracefully', async ({ page }) => {
      await page.goto('/whatsapp-settings');
      
      // Check for reconnect button when disconnected
      const status = await page.locator('.connection-status').textContent();
      if (status?.includes('Disconnected')) {
        await expect(page.locator('button:has-text("Reconnect")')).toBeVisible();
      }
    });

    test('should show error messages clearly', async ({ page }) => {
      await page.goto('/whatsapp-settings');
      
      // Check for error display area
      await expect(page.locator('.error-container')).toBeVisible();
    });
  });

  test.describe('WhatsApp Mobile Responsiveness', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should be responsive on mobile', async ({ page }) => {
      await page.goto('/whatsapp-settings');
      
      // Check mobile layout
      await expect(page.locator('.qr-code-container')).toBeVisible();
      await expect(page.locator('.connection-status')).toBeVisible();
      
      // QR code should scale appropriately
      const qrCode = page.locator('.qr-code-container img');
      const box = await qrCode.boundingBox();
      expect(box?.width).toBeLessThan(350);
    });
  });
});

test.describe('WhatsApp Customer Flow', () => {
  test('should show customer instructions clearly', async ({ page }) => {
    // Navigate to customer-facing page
    await page.goto('/join');
    
    // Check for WhatsApp join option
    await expect(page.locator(':text("Join via WhatsApp")')).toBeVisible();
    await expect(page.locator('.whatsapp-instructions')).toBeVisible();
    
    // Check for phone number display (check for any phone number format)
    await expect(page.locator('[class*="phone"], [class*="number"]')).toBeVisible();
  });

  test('should provide clear join instructions', async ({ page }) => {
    await page.goto('/join');
    
    // Check step-by-step instructions
    await expect(page.locator(':text("1. Save our number")')).toBeVisible();
    await expect(page.locator(':text("2. Send \'join\'")')).toBeVisible();
    await expect(page.locator(':text("3. Follow the prompts")')).toBeVisible();
  });

  test('should show WhatsApp benefits', async ({ page }) => {
    await page.goto('/join');
    
    // Check benefits section
    await expect(page.locator(':text("Real-time updates")')).toBeVisible();
    await expect(page.locator(':text("No app download required")')).toBeVisible();
    await expect(page.locator(':text("Queue from anywhere")')).toBeVisible();
  });
});