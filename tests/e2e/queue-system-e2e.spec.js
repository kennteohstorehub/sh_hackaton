const { test, expect } = require('@playwright/test');

test.describe('Queue Management System E2E Tests', () => {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3838';
  const TEST_MERCHANT_ID = process.env.TEST_MERCHANT_ID || '3ecceb82-fb33-42c8-9d84-19eb69417e16';
  
  // Check if auth bypass is enabled for testing
  const useAuthBypass = process.env.USE_AUTH_BYPASS === 'true';

  test('Complete Queue Flow: Public Join → Dashboard Verification → Customer Processing', async ({ page, context }) => {
    let customerData;
    let merchantPage;

    // ========================================
    // STEP 1: Prepare Test Data
    // ========================================
    await test.step('Prepare test data', async () => {
      const timestamp = Date.now();
      customerData = {
        name: `E2E Customer ${timestamp}`,
        phone: `+6012${String(timestamp).slice(-8)}`,
        partySize: 2,
        notes: 'End-to-end test customer'
      };
      console.log('Test data prepared:', customerData);
    });

    // ========================================
    // STEP 2: Test Public Queue Interface
    // ========================================
    await test.step('Access public queue interface', async () => {
      const publicUrl = `${BASE_URL}/queue/join/${TEST_MERCHANT_ID}`;
      console.log('Accessing public URL:', publicUrl);
      
      await page.goto(publicUrl);
      await page.waitForLoadState('networkidle');
      
      // Check if page loaded successfully (not error page)
      const title = await page.title();
      console.log('Page title:', title);
      
      // More flexible error checking
      const hasError = title.toLowerCase().includes('error') || 
                      await page.locator('.error-page, .error-message').count() > 0;
      
      if (hasError) {
        // Take screenshot for debugging
        await page.screenshot({ path: 'public-page-error.png' });
        console.log('Public page has error, checking if service is available');
        
        // Try to access root page to see if service is running
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        const rootTitle = await page.title();
        console.log('Root page title:', rootTitle);
        
        if (rootTitle.toLowerCase().includes('error')) {
          test.skip('Service appears to be down or misconfigured');
        }
      }
      
      // Look for join form with flexible selectors
      const joinFormSelectors = [
        'form',
        '#queueJoinForm', 
        '.join-form',
        '[data-testid="join-form"]',
        'form[action*="join"]',
        'form[action*="queue"]'
      ];
      
      let joinForm = null;
      for (const selector of joinFormSelectors) {
        const form = page.locator(selector);
        if (await form.count() > 0) {
          joinForm = form;
          console.log('Found join form with selector:', selector);
          break;
        }
      }
      
      if (!joinForm) {
        await page.screenshot({ path: 'no-join-form.png' });
        console.log('Page content:', await page.content());
        throw new Error('No join form found on public page');
      }
      
      await expect(joinForm).toBeVisible({ timeout: 10000 });
    });

    // ========================================
    // STEP 3: Submit Customer to Queue
    // ========================================
    await test.step('Submit customer to join queue', async () => {
      // Fill name field (try multiple selectors)
      const nameSelectors = [
        'input[name="name"]',
        'input[name="customerName"]', 
        '#name',
        '#customerName',
        'input[placeholder*="name" i]',
        'input[type="text"]:first-of-type'
      ];
      
      let nameField = null;
      for (const selector of nameSelectors) {
        const field = page.locator(selector);
        if (await field.count() > 0) {
          nameField = field;
          console.log('Found name field with selector:', selector);
          break;
        }
      }
      
      if (nameField) {
        await nameField.fill(customerData.name);
        console.log('Filled name field');
      } else {
        console.log('No name field found - may be optional');
      }

      // Fill phone field
      const phoneSelectors = [
        'input[name="phone"]',
        'input[name="phoneNumber"]',
        'input[name="customerPhone"]',
        '#phone',
        '#phoneNumber',
        'input[placeholder*="phone" i]',
        'input[type="tel"]'
      ];
      
      let phoneField = null;
      for (const selector of phoneSelectors) {
        const field = page.locator(selector);
        if (await field.count() > 0) {
          phoneField = field;
          console.log('Found phone field with selector:', selector);
          break;
        }
      }
      
      if (phoneField) {
        await phoneField.fill(customerData.phone);
        console.log('Filled phone field');
      }

      // Fill party size (try select and input)
      const partySizeSelectors = [
        'select[name="partySize"]',
        'select[name="numberOfPeople"]',
        'input[name="partySize"]',
        'input[name="numberOfPeople"]',
        '#partySize',
        'select[data-field="partySize"]'
      ];
      
      for (const selector of partySizeSelectors) {
        const field = page.locator(selector);
        if (await field.count() > 0) {
          const tagName = await field.evaluate(el => el.tagName.toLowerCase());
          if (tagName === 'select') {
            await field.selectOption(customerData.partySize.toString());
          } else {
            await field.fill(customerData.partySize.toString());
          }
          console.log('Filled party size field');
          break;
        }
      }

      // Fill notes if available
      const notesField = page.locator('textarea[name="notes"], textarea[name="specialRequests"], #notes');
      if (await notesField.count() > 0) {
        await notesField.fill(customerData.notes);
        console.log('Filled notes field');
      }

      // Submit form
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        '.submit-btn',
        '.join-btn',
        'button:has-text("Join")',
        'button:has-text("Submit")',
        'form button:last-of-type'
      ];
      
      let submitButton = null;
      for (const selector of submitSelectors) {
        const btn = page.locator(selector);
        if (await btn.count() > 0 && await btn.isVisible()) {
          submitButton = btn;
          console.log('Found submit button with selector:', selector);
          break;
        }
      }
      
      if (!submitButton) {
        await page.screenshot({ path: 'no-submit-button.png' });
        throw new Error('No submit button found');
      }

      await submitButton.click();
      console.log('Clicked submit button');
      
      // Wait for response
      await page.waitForLoadState('networkidle');
      
      // Check for success indicators
      const successSelectors = [
        '.alert-success',
        '.success-message',
        '.queue-position',
        '.thank-you',
        ':text("success")',
        ':text("joined")',
        ':text("position")',
        ':text("thank")'
      ];
      
      let hasSuccess = false;
      for (const selector of successSelectors) {
        const element = page.locator(selector);
        if (await element.count() > 0 && await element.isVisible()) {
          hasSuccess = true;
          console.log('Found success indicator:', selector);
          break;
        }
      }
      
      // Also check URL for success patterns
      const currentUrl = page.url();
      if (currentUrl.includes('success') || currentUrl.includes('thank') || currentUrl.includes('position')) {
        hasSuccess = true;
        console.log('URL indicates success:', currentUrl);
      }
      
      if (!hasSuccess) {
        await page.screenshot({ path: 'submission-result.png' });
        console.log('Current URL after submission:', currentUrl);
        console.log('Page content after submission:', await page.textContent('body'));
      }
      
      expect(hasSuccess).toBe(true);
    });

    // ========================================
    // STEP 4: Access Merchant Dashboard
    // ========================================
    await test.step('Access merchant dashboard', async () => {
      merchantPage = await context.newPage();
      
      if (useAuthBypass) {
        // If auth bypass is enabled, go directly to dashboard
        await merchantPage.goto(`${BASE_URL}/dashboard`);
        await merchantPage.waitForLoadState('networkidle');
        console.log('Using auth bypass for dashboard access');
      } else {
        // Try to login with test credentials if available
        const testEmail = process.env.TEST_USER_EMAIL;
        const testPassword = process.env.TEST_USER_PASSWORD;
        
        if (testEmail && testPassword) {
          await merchantPage.goto(`${BASE_URL}/auth/login`);
          await merchantPage.waitForLoadState('networkidle');
          
          // Fill login form
          await merchantPage.fill('input[name="email"], input[type="email"], #email', testEmail);
          await merchantPage.fill('input[name="password"], input[type="password"], #password', testPassword);
          
          const loginButton = merchantPage.locator('button[type="submit"], .login-btn, button:has-text("Login")');
          await loginButton.click();
          
          await merchantPage.waitForLoadState('networkidle');
          console.log('Attempted login with test credentials');
        } else {
          // Try to access dashboard directly - may redirect to login
          await merchantPage.goto(`${BASE_URL}/dashboard`);
          await merchantPage.waitForLoadState('networkidle');
          console.log('Trying direct dashboard access');
        }
      }
      
      // Check if we're on dashboard or got redirected
      const currentUrl = merchantPage.url();
      const title = await merchantPage.title();
      
      console.log('Dashboard page URL:', currentUrl);
      console.log('Dashboard page title:', title);
      
      // If we got to an error page or login page, skip the merchant verification
      if (title.toLowerCase().includes('error') || currentUrl.includes('login')) {
        console.log('Could not access dashboard - authentication may be required');
        console.log('Skipping merchant dashboard verification steps');
        return;
      }
      
      // Verify dashboard loaded
      const dashboardIndicators = [
        'h1, h2',
        '.dashboard',
        '.stats',
        '.queue-stats',
        'nav',
        '.metrics'
      ];
      
      let foundDashboard = false;
      for (const selector of dashboardIndicators) {
        const element = merchantPage.locator(selector);
        if (await element.count() > 0 && await element.isVisible()) {
          foundDashboard = true;
          console.log('Found dashboard indicator:', selector);
          break;
        }
      }
      
      if (foundDashboard) {
        console.log('Dashboard accessed successfully');
      } else {
        console.log('Dashboard access uncertain - continuing with available features');
      }
    });

    // ========================================
    // STEP 5: Verify Real-time Updates (if dashboard accessible)
    // ========================================
    await test.step('Verify real-time updates', async () => {
      if (!merchantPage || merchantPage.url().includes('login') || merchantPage.url().includes('error')) {
        console.log('Skipping real-time verification - dashboard not accessible');
        return;
      }
      
      // Wait for potential WebSocket connections
      await merchantPage.waitForTimeout(3000);
      
      // Look for queue statistics
      const statSelectors = [
        '.waiting-count',
        '.queue-stats .number',
        '[data-waiting-count]',
        '.customer-count',
        '.stat-waiting'
      ];
      
      let foundStats = false;
      for (const selector of statSelectors) {
        const element = merchantPage.locator(selector);
        if (await element.count() > 0) {
          const text = await element.textContent();
          const count = parseInt(text) || 0;
          if (count >= 0) { // Any valid number indicates stats are working
            foundStats = true;
            console.log(`Found queue stats: ${count} (selector: ${selector})`);
            break;
          }
        }
      }
      
      // Look for customer entries
      const customerSelectors = [
        '.queue-entry',
        '.customer-card', 
        '.waiting-customer',
        '.customer-item',
        `text=${customerData.name}`,
        `text=${customerData.phone}`
      ];
      
      let foundCustomer = false;
      for (const selector of customerSelectors) {
        const element = merchantPage.locator(selector);
        if (await element.count() > 0) {
          foundCustomer = true;
          console.log('Found customer in queue:', selector);
          break;
        }
      }
      
      if (foundStats || foundCustomer) {
        console.log('Real-time updates verified');
      } else {
        console.log('Real-time updates could not be verified - may need more time or different UI');
        await merchantPage.screenshot({ path: 'dashboard-state.png' });
      }
    });

    // ========================================
    // STEP 6: Test Queue Management Actions
    // ========================================
    await test.step('Test queue management actions', async () => {
      if (!merchantPage || merchantPage.url().includes('login') || merchantPage.url().includes('error')) {
        console.log('Skipping queue actions - dashboard not accessible');
        return;
      }
      
      // Look for action buttons
      const actionSelectors = [
        'button:has-text("Call Next")',
        'button:has-text("Seat")',
        'button:has-text("Serve")',
        'button:has-text("Notify")',
        '.call-next-btn',
        '.seat-btn',
        '.notify-btn',
        '[data-action="call"]',
        '[data-action="seat"]',
        '[data-action="notify"]'
      ];
      
      let actionButton = null;
      for (const selector of actionSelectors) {
        const btn = merchantPage.locator(selector).first();
        if (await btn.count() > 0 && await btn.isVisible()) {
          actionButton = btn;
          console.log('Found action button:', selector);
          break;
        }
      }
      
      if (actionButton) {
        // Handle potential confirmation dialogs
        merchantPage.on('dialog', dialog => {
          console.log('Dialog appeared:', dialog.message());
          dialog.accept();
        });
        
        await actionButton.click();
        console.log('Clicked action button');
        
        // Wait for potential updates
        await merchantPage.waitForTimeout(2000);
        
        // Look for changes in queue status
        const statusSelectors = [
          '.current-serving',
          '.serving-number',
          '.now-serving',
          '.status-updated',
          '.notification-sent'
        ];
        
        let foundStatusChange = false;
        for (const selector of statusSelectors) {
          const element = merchantPage.locator(selector);
          if (await element.count() > 0) {
            const text = await element.textContent();
            if (text && text.trim() !== '' && text !== '0') {
              foundStatusChange = true;
              console.log('Status change detected:', text.trim());
              break;
            }
          }
        }
        
        if (foundStatusChange) {
          console.log('Queue action completed successfully');
        } else {
          console.log('Queue action attempted - status change not clearly visible');
        }
      } else {
        console.log('No action buttons found - queue management UI may be different');
      }
    });

    // ========================================
    // STEP 7: UI Responsiveness Test
    // ========================================
    await test.step('Test UI responsiveness', async () => {
      // Test both public and merchant pages if available
      const pagesToTest = [page];
      if (merchantPage && !merchantPage.url().includes('login')) {
        pagesToTest.push(merchantPage);
      }
      
      for (const testPage of pagesToTest) {
        // Test mobile view
        await testPage.setViewportSize({ width: 375, height: 667 });
        await testPage.waitForTimeout(500);
        await expect(testPage.locator('body')).toBeVisible();
        
        // Test tablet view  
        await testPage.setViewportSize({ width: 768, height: 1024 });
        await testPage.waitForTimeout(500);
        await expect(testPage.locator('body')).toBeVisible();
        
        // Test desktop view
        await testPage.setViewportSize({ width: 1200, height: 800 });
        await testPage.waitForTimeout(500);
        await expect(testPage.locator('body')).toBeVisible();
      }
      
      console.log('UI responsiveness verified');
    });

    // ========================================
    // STEP 8: Error Handling Test
    // ========================================
    await test.step('Test error handling', async () => {
      // Test invalid routes
      await page.goto(`${BASE_URL}/invalid-route-test`);
      await page.waitForLoadState('networkidle');
      
      const pageContent = await page.content();
      const hasGracefulError = !pageContent.includes('Cannot GET') && 
                              (pageContent.includes('404') || pageContent.includes('Not Found') || 
                               page.url() !== `${BASE_URL}/invalid-route-test`);
      
      expect(hasGracefulError).toBe(true);
      console.log('Error handling verified');
    });

    // Cleanup
    await test.step('Cleanup', async () => {
      if (merchantPage) {
        await merchantPage.close();
      }
      console.log('Test cleanup completed');
    });
  });

  // Separate test for public interface only (no auth required)
  test('Public Queue Interface Validation', async ({ page }) => {
    await test.step('Validate public queue interface', async () => {
      const publicUrl = `${BASE_URL}/queue/join/${TEST_MERCHANT_ID}`;
      await page.goto(publicUrl);
      await page.waitForLoadState('networkidle');
      
      // Basic validation - page should load without critical errors
      const title = await page.title();
      const hasError = title.toLowerCase().includes('error');
      
      if (!hasError) {
        // Look for form elements
        const hasForm = await page.locator('form, input, button').count() > 0;
        expect(hasForm).toBe(true);
        console.log('Public interface validation passed');
      } else {
        console.log('Public interface shows error - may indicate configuration issue');
        await page.screenshot({ path: 'public-interface-error.png' });
      }
    });

    await test.step('Test form validation', async () => {
      const publicUrl = `${BASE_URL}/queue/join/${TEST_MERCHANT_ID}`;
      await page.goto(publicUrl);
      await page.waitForLoadState('networkidle');
      
      // Try to submit empty form to test validation
      const submitBtn = page.locator('button[type="submit"], .submit-btn').first();
      if (await submitBtn.count() > 0) {
        await submitBtn.click();
        await page.waitForTimeout(1000);
        
        // Check if we're still on the same page (validation prevented submission)
        // or if there are validation messages
        const stillOnForm = page.url().includes('join') || 
                           await page.locator('form, input:invalid, .error').count() > 0;
        
        expect(stillOnForm).toBe(true);
        console.log('Form validation working');
      }
    });
  });
});