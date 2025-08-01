const { test, expect } = require('@playwright/test');
const { LoginPage } = require('./pages/LoginPage');
const { QueueManagementPage } = require('./pages/QueueManagementPage');

test.describe('Comprehensive Queue Management E2E Flow', () => {
  let loginPage;
  let queuePage;
  let merchantId;
  let queueId;
  let testQueueName;

  test.beforeAll(async ({ browser }) => {
    // Setup test environment
    testQueueName = `E2E Test Queue ${Date.now()}`;
  });

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    queuePage = new QueueManagementPage(page);
    
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    
    if (!testEmail || !testPassword) {
      test.skip('Test credentials not configured');
      return;
    }
    
    // Login to dashboard
    await loginPage.goto();
    await loginPage.login(testEmail, testPassword);
    await page.waitForURL('**/dashboard');
  });

  test('Complete queue flow: Dashboard → Create Queue → Public Join → Seat Customer', async ({ page, context }) => {
    // ========================================
    // STEP 1: Merchant Dashboard - Create Queue
    // ========================================
    test.step('1. Open merchant dashboard and verify loading', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Verify dashboard loads correctly
      await expect(page.locator('h1, h2')).toContainText(/Dashboard|Queue/);
      await expect(page.locator('body')).not.toHaveClass(/error/);
      
      // Check for connection status indicator
      const connectionStatus = page.locator('#connection-status, .connection-status');
      if (await connectionStatus.count() > 0) {
        await expect(connectionStatus).toBeVisible({ timeout: 10000 });
      }
    });

    test.step('2. Navigate to queue management', async () => {
      // Go to queue management section
      await queuePage.goto();
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the right page
      await expect(page).toHaveURL(/.*\/queues.*|.*\/dashboard.*/);
      await expect(page.locator('body')).toBeVisible();
    });

    test.step('3. Create new queue with proper validation', async () => {
      const initialCount = await queuePage.getQueueCount();
      
      // Create queue with comprehensive settings
      await queuePage.createQueue({
        name: testQueueName,
        description: 'Comprehensive E2E test queue with full flow validation',
        maxCapacity: 50,
        avgServiceTime: 15,
        isActive: true
      });
      
      // Verify queue creation success
      await expect(page.locator('.alert-success, .success-message')).toBeVisible({ timeout: 10000 });
      
      // Verify queue count increased
      const newCount = await queuePage.getQueueCount();
      expect(newCount).toBe(initialCount + 1);
      
      // Store queue info for later steps
      merchantId = await page.evaluate(() => {
        // Try to extract merchant ID from page context
        return window.merchantId || document.querySelector('[data-merchant-id]')?.dataset.merchantId;
      });
    });

    // ========================================
    // STEP 2: Public Queue View - Customer Experience
    // ========================================
    test.step('4. Navigate to public queue view', async () => {
      // Get merchant ID from current context or use test default
      if (!merchantId) {
        // Extract from current URL or page context
        const currentUrl = page.url();
        const urlMatch = currentUrl.match(/merchant[\/=]([a-f0-9-]+)/i);
        if (urlMatch) {
          merchantId = urlMatch[1];
        } else {
          // Use a test merchant ID - this should be available in test environment
          merchantId = process.env.TEST_MERCHANT_ID || '3ecceb82-fb33-42c8-9d84-19eb69417e16';
        }
      }
      
      // Navigate to public queue join page
      const publicUrl = `/queue/join/${merchantId}`;
      await page.goto(publicUrl);
      await page.waitForLoadState('networkidle');
      
      // Verify public view is accessible
      await expect(page.locator('body')).not.toHaveClass(/error/);
      await expect(page.locator('h1, h2, .queue-title')).toBeVisible();
      
      // Check for queue join form
      const joinForm = page.locator('form, .join-form, #queueJoinForm');
      await expect(joinForm).toBeVisible({ timeout: 10000 });
    });

    test.step('5. Submit customer information to join queue', async () => {
      // Generate unique customer data
      const timestamp = Date.now();
      const customerData = {
        name: `E2E Test Customer ${timestamp}`,
        phone: `+6012${String(timestamp).slice(-8)}`,
        partySize: Math.floor(Math.random() * 4) + 1,
        notes: 'End-to-end test customer entry'
      };
      
      // Fill out the join form
      await page.fill('input[name="name"], #customerName', customerData.name);
      await page.fill('input[name="phone"], #customerPhone', customerData.phone);
      
      // Handle party size (could be select or input)
      const partySizeSelect = page.locator('select[name="partySize"], #partySize');
      const partySizeInput = page.locator('input[name="partySize"]');
      
      if (await partySizeSelect.count() > 0) {
        await partySizeSelect.selectOption(customerData.partySize.toString());
      } else if (await partySizeInput.count() > 0) {
        await partySizeInput.fill(customerData.partySize.toString());
      }
      
      // Add notes if field exists
      const notesField = page.locator('textarea[name="notes"], #customerNotes');
      if (await notesField.count() > 0) {
        await notesField.fill(customerData.notes);
      }
      
      // Submit the form
      const submitButton = page.locator('button[type="submit"], .submit-btn, .join-btn');
      await submitButton.click();
      
      // Wait for submission response
      await page.waitForLoadState('networkidle');
      
      // Verify successful submission
      const successIndicators = [
        '.alert-success',
        '.success-message', 
        '.queue-position',
        'text=success',
        'text=joined',
        'text=position'
      ];
      
      let foundSuccess = false;
      for (const selector of successIndicators) {
        if (await page.locator(selector).count() > 0) {
          await expect(page.locator(selector)).toBeVisible();
          foundSuccess = true;
          break;
        }
      }
      
      if (!foundSuccess) {
        // Check if we were redirected to a success page
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/success|queue|position|thank/i);
      }
    });

    // ========================================
    // STEP 3: Real-time Updates Verification
    // ========================================
    test.step('6. Verify customer appears in merchant dashboard', async () => {
      // Open new tab for merchant dashboard
      const merchantPage = await context.newPage();
      const merchantLogin = new LoginPage(merchantPage);
      const merchantQueue = new QueueManagementPage(merchantPage);
      
      // Login to merchant dashboard
      await merchantLogin.goto();
      await merchantLogin.login(process.env.TEST_USER_EMAIL, process.env.TEST_USER_PASSWORD);
      await merchantPage.waitForURL('**/dashboard');
      
      // Navigate to dashboard and check queue status
      await merchantPage.goto('/dashboard');
      await merchantPage.waitForLoadState('networkidle');
      
      // Wait for real-time updates (WebSocket)
      await merchantPage.waitForTimeout(2000);
      
      // Verify queue statistics show the new customer
      const waitingCountElements = [
        '.waiting-count',
        '.queue-stats .number',
        '[data-waiting-count]',
        '.stat-waiting'
      ];
      
      let waitingCount = 0;
      for (const selector of waitingCountElements) {
        const element = merchantPage.locator(selector).first();
        if (await element.count() > 0) {
          const countText = await element.textContent();
          waitingCount = parseInt(countText) || 0;
          if (waitingCount > 0) break;
        }
      }
      
      expect(waitingCount).toBeGreaterThan(0);
      
      // Check for customer in queue list
      const customerList = merchantPage.locator('.queue-entry, .customer-card, .waiting-customer');
      if (await customerList.count() > 0) {
        await expect(customerList.first()).toBeVisible();
      }
    });

    // ========================================
    // STEP 4: Notification System Testing
    // ========================================
    test.step('7. Test notification system', async () => {
      // Return to merchant dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Find and click notify button
      const notifyButtons = [
        'button.btn-notify',
        '.notify-btn',
        'button:has-text("Notify")',
        '[data-action="notify"]'
      ];
      
      let notifyButton = null;
      for (const selector of notifyButtons) {
        const btn = page.locator(selector).first();
        if (await btn.count() > 0) {
          notifyButton = btn;
          break;
        }
      }
      
      if (notifyButton) {
        // Handle potential confirmation dialog
        page.on('dialog', dialog => dialog.accept());
        
        await notifyButton.click();
        
        // Wait for notification modal or response
        const notificationModal = page.locator('.notification-modal, .modal, .alert');
        if (await notificationModal.count() > 0) {
          await expect(notificationModal).toBeVisible({ timeout: 5000 });
          
          // Check for verification code display
          const codeDisplay = page.locator('.code-box, .verification-code, .queue-number');
          if (await codeDisplay.count() > 0) {
            await expect(codeDisplay).toBeVisible();
          }
          
          // Close modal if there's a close button
          const closeButton = page.locator('.modal button, .close-btn, button:has-text("Close")');
          if (await closeButton.count() > 0) {
            await closeButton.click();
          }
        }
      }
    });

    // ========================================  
    // STEP 5: Customer Processing to Seated
    // ========================================
    test.step('8. Process customer through to seated status', async () => {
      // Navigate to queue management
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Find the customer in the queue
      const customerEntries = page.locator('.queue-entry, .customer-card, .waiting-customer');
      
      if (await customerEntries.count() > 0) {
        const firstCustomer = customerEntries.first();
        
        // Look for "Call Next" or "Seat" button
        const actionButtons = [
          'button:has-text("Call Next")',
          'button:has-text("Seat")',
          'button:has-text("Serve")',
          '.call-next-btn',
          '.seat-btn',
          '[data-action="call"]',
          '[data-action="seat"]'
        ];
        
        let actionButton = null;
        for (const selector of actionButtons) {
          const btn = page.locator(selector).first();
          if (await btn.count() > 0) {
            actionButton = btn;
            break;
          }
        }
        
        if (actionButton) {
          await actionButton.click();
          
          // Wait for status update
          await page.waitForTimeout(1000);
          
          // Verify customer status changed
          const currentServing = page.locator('.current-serving, .serving-number, .now-serving');
          if (await currentServing.count() > 0) {
            const servingNumber = await currentServing.textContent();
            expect(parseInt(servingNumber) || 0).toBeGreaterThan(0);
          }
          
          // Check for seated confirmation
          const seatedIndicators = [
            '.seated-customer',
            '.customer-seated',
            'text=seated',
            '.status-seated'
          ];
          
          for (const indicator of seatedIndicators) {
            const element = page.locator(indicator);
            if (await element.count() > 0) {
              await expect(element).toBeVisible();
              break;
            }
          }
        }
      }
    });

    // ========================================
    // STEP 6: UI Elements and Responsiveness
    // ========================================
    test.step('9. Verify all UI elements respond correctly', async () => {
      // Test responsive design by changing viewport
      await page.setViewportSize({ width: 375, height: 667 }); // Mobile
      await page.waitForTimeout(500);
      
      // Verify mobile layout
      await expect(page.locator('body')).toBeVisible();
      
      // Test tablet view
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);
      
      // Test desktop view
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(500);
      
      // Verify all critical elements are still visible
      const criticalElements = [
        'nav, .navbar, .header',
        'main, .main-content, .dashboard',
        '.queue-stats, .stats, .metrics'
      ];
      
      for (const selector of criticalElements) {
        const element = page.locator(selector);
        if (await element.count() > 0) {
          await expect(element).toBeVisible();
        }
      }
      
      // Test navigation consistency
      const navLinks = page.locator('nav a, .nav-link');
      if (await navLinks.count() > 0) {
        const linkCount = await navLinks.count();
        expect(linkCount).toBeGreaterThan(0);
        
        // Verify all links are clickable
        for (let i = 0; i < Math.min(linkCount, 5); i++) {
          const link = navLinks.nth(i);
          if (await link.isVisible()) {
            await expect(link).toBeEnabled();
          }
        }
      }
    });

    // ========================================
    // STEP 7: Performance and Error Handling
    // ========================================
    test.step('10. Verify performance and error handling', async () => {
      // Check page load performance
      const startTime = Date.now();
      await page.reload();
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Dashboard should load within reasonable time
      expect(loadTime).toBeLessThan(10000); // 10 seconds max
      
      // Test error handling with invalid routes
      await page.goto('/dashboard/invalid-route');
      
      // Should handle gracefully (either 404 or redirect)
      const pageContent = await page.content();
      expect(pageContent).not.toContain('Cannot GET');
      
      // Return to dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Verify WebSocket connection is working
      const wsStatus = page.locator('#connection-status, .connection-status');
      if (await wsStatus.count() > 0) {
        await expect(wsStatus).toHaveClass(/connected|online/, { timeout: 5000 });
      }
      
      // Test browser console for critical errors
      const logs = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          logs.push(msg.text());
        }
      });
      
      await page.waitForTimeout(2000);
      
      // Filter out common non-critical errors
      const criticalErrors = logs.filter(log => 
        !log.includes('favicon') && 
        !log.includes('sourcemap') &&
        !log.includes('404') &&
        !log.includes('net::ERR_')
      );
      
      expect(criticalErrors.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: Try to delete the test queue if it was created
    try {
      if (testQueueName) {
        await page.goto('/dashboard/queues');
        await page.waitForLoadState('networkidle');
        
        // Look for delete button for our test queue
        const deleteButton = page.locator(`button[data-queue-name="${testQueueName}"], .delete-queue-btn`);
        if (await deleteButton.count() > 0) {
          await deleteButton.click();
          
          // Confirm deletion if modal appears
          const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Confirm")');
          if (await confirmButton.count() > 0) {
            await confirmButton.click();
          }
        }
      }
    } catch (error) {
      console.log('Cleanup error (non-critical):', error.message);
    }
  });
});

// Additional helper test for isolated public queue functionality
test.describe('Public Queue Interface Tests', () => {
  test('Public queue join form validation and functionality', async ({ page }) => {
    // Use default test merchant
    const merchantId = process.env.TEST_MERCHANT_ID || '3ecceb82-fb33-42c8-9d84-19eb69417e16';
    
    test.step('Navigate to public queue page', async () => {
      await page.goto(`/queue/join/${merchantId}`);
      await page.waitForLoadState('networkidle');
      
      // Verify page loads correctly
      await expect(page.locator('body')).not.toHaveClass(/error/);
      await expect(page.locator('form, .join-form')).toBeVisible();
    });

    test.step('Test form validation', async () => {
      // Try to submit empty form
      const submitButton = page.locator('button[type="submit"], .submit-btn');
      await submitButton.click();
      
      // Should show validation errors
      const errorMessages = [
        '.error-message',
        '.alert-danger', 
        '.field-error',
        'input:invalid'
      ];
      
      let foundValidation = false;
      for (const selector of errorMessages) {
        if (await page.locator(selector).count() > 0) {
          foundValidation = true;
          break;
        }
      }
      
      expect(foundValidation).toBe(true);
    });

    test.step('Test successful form submission', async () => {
      // Fill valid data
      const timestamp = Date.now();
      await page.fill('input[name="name"]', `Test Customer ${timestamp}`);
      await page.fill('input[name="phone"]', `+6012${String(timestamp).slice(-8)}`);
      
      // Submit form
      const submitButton = page.locator('button[type="submit"], .submit-btn');
      await submitButton.click();
      
      await page.waitForLoadState('networkidle');
      
      // Should show success or redirect to success page
      const successIndicators = page.locator('.alert-success, .success-message, .queue-position');
      if (await successIndicators.count() > 0) {
        await expect(successIndicators.first()).toBeVisible();
      } else {
        // Check URL for success indicators
        expect(page.url()).toMatch(/success|thank|position/i);
      }
    });
  });
});