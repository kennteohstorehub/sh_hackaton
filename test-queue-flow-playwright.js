const { chromium } = require('playwright');

(async () => {
  console.log('Starting Queue Registration and Flow Test...');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  try {
    // Step 1: Navigate to queue join page
    console.log('\n1. Navigating to queue join page...');
    // Using the Bakery Orders queue
    await page.goto('http://localhost:3000/queue/244ef284-bf07-4934-9151-8c2f968f8964/join');
    await page.screenshot({ path: 'screenshots/01-queue-join-page.png' });
    
    // Wait for page to load
    await page.waitForTimeout(2000);

    // Step 2: Select a queue (if there are multiple)
    console.log('\n2. Checking for available queues...');
    
    // Check if we're on the queue selection page
    const queueCards = await page.$$('.queue-card');
    if (queueCards.length > 0) {
      console.log(`Found ${queueCards.length} queues available`);
      
      // Click on the first queue
      await queueCards[0].click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/02-queue-selected.png' });
    }

    // Step 3: Fill in customer information
    console.log('\n3. Filling in customer information...');
    
    // Check if we're on the registration form
    const nameInput = await page.$('input[name="customerName"], #customerName');
    if (nameInput) {
      await nameInput.fill('Test Customer');
      
      const phoneInput = await page.$('input[name="customerPhone"], #customerPhone');
      if (phoneInput) {
        await phoneInput.fill('+60123456789');
      }
      
      const partySizeInput = await page.$('input[name="partySize"], #partySize, select[name="partySize"]');
      if (partySizeInput) {
        const tagName = await partySizeInput.evaluate(el => el.tagName);
        if (tagName === 'SELECT') {
          await partySizeInput.selectOption('2');
        } else {
          await partySizeInput.fill('2');
        }
      }
      
      const notesInput = await page.$('textarea[name="notes"], #notes, textarea[name="specialRequests"]');
      if (notesInput) {
        await notesInput.fill('Testing queue registration flow');
      }
      
      await page.screenshot({ path: 'screenshots/03-form-filled.png' });
      
      // Submit the form
      console.log('\n4. Joining the queue...');
      
      // Scroll down to find submit button
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      
      // Try multiple selectors for the submit button
      const submitSelectors = [
        'button[type="submit"]',
        'button:has-text("Join Queue")',
        'button:has-text("Join")',
        'button:has-text("Submit")',
        '.btn-primary',
        'button.btn'
      ];
      
      let submitButton = null;
      for (const selector of submitSelectors) {
        try {
          submitButton = await page.$(selector);
          if (submitButton) {
            const isVisible = await submitButton.isVisible();
            if (isVisible) {
              console.log(`Found submit button with selector: ${selector}`);
              break;
            }
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (submitButton) {
        await page.screenshot({ path: 'screenshots/03b-before-submit.png' });
        await submitButton.click();
        console.log('Clicked join queue button');
      } else {
        console.log('Could not find submit button');
      }
    }

    // Step 4: Wait for queue status page
    console.log('\n5. Waiting for queue status page...');
    await page.waitForTimeout(3000);
    
    // Check if we're on the status page
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    if (currentUrl.includes('queue-status') || currentUrl.includes('status')) {
      console.log('Successfully joined queue - now on status page');
      await page.screenshot({ path: 'screenshots/04-queue-status.png' });
      
      // Get queue position
      const positionElement = await page.$('.queue-position, .position-number, [data-position]');
      if (positionElement) {
        const position = await positionElement.textContent();
        console.log('Queue Position:', position);
      }
      
      // Get estimated wait time
      const waitTimeElement = await page.$('.wait-time, .estimated-wait, [data-wait-time]');
      if (waitTimeElement) {
        const waitTime = await waitTimeElement.textContent();
        console.log('Estimated Wait Time:', waitTime);
      }
      
      // Check for webchat
      const webchatElement = await page.$('.webchat-container, #webchat, .chat-widget');
      if (webchatElement) {
        console.log('Webchat widget is available');
      }
      
      // Monitor for notifications
      console.log('\n6. Monitoring for notifications...');
      
      // Listen for notification events
      page.on('dialog', async dialog => {
        console.log('Browser notification:', dialog.message());
        await dialog.accept();
      });
      
      // Check for on-page notifications
      let notificationCount = 0;
      const checkInterval = setInterval(async () => {
        const notifications = await page.$$('.notification, .alert, .toast');
        if (notifications.length > notificationCount) {
          console.log(`New notification detected (${notifications.length} total)`);
          await page.screenshot({ path: `screenshots/05-notification-${notifications.length}.png` });
          notificationCount = notifications.length;
        }
        
        // Check if status changed to "called" or "seated"
        const statusElement = await page.$('.queue-status, .status, [data-status]');
        if (statusElement) {
          const status = await statusElement.textContent();
          if (status.toLowerCase().includes('called') || status.toLowerCase().includes('seated') || status.toLowerCase().includes('ready')) {
            console.log('\n🎉 Customer has been called/seated!');
            console.log('Status:', status);
            await page.screenshot({ path: 'screenshots/06-customer-called.png' });
            clearInterval(checkInterval);
          }
        }
      }, 2000);
      
      // Wait for 30 seconds to monitor notifications
      console.log('Monitoring queue status for 30 seconds...');
      await page.waitForTimeout(30000);
      clearInterval(checkInterval);
      
    } else {
      console.log('Queue join might have failed or redirected elsewhere');
      console.log('Current page title:', await page.title());
      
      // Check for error messages
      const errorElement = await page.$('.error, .alert-danger, .error-message');
      if (errorElement) {
        const errorText = await errorElement.textContent();
        console.log('Error message:', errorText);
      }
      
      await page.screenshot({ path: 'screenshots/error-page.png' });
    }

    // Step 5: Test leaving the queue
    console.log('\n7. Testing leave queue functionality...');
    const leaveButton = await page.$('button:has-text("Leave Queue"), button:has-text("Cancel"), .leave-queue-btn');
    if (leaveButton) {
      console.log('Found leave queue button');
      await leaveButton.click();
      await page.waitForTimeout(2000);
      
      // Confirm leave if there's a confirmation dialog
      const confirmButton = await page.$('button:has-text("Confirm"), button:has-text("Yes")');
      if (confirmButton) {
        await confirmButton.click();
        console.log('Confirmed leaving queue');
      }
      
      await page.screenshot({ path: 'screenshots/07-left-queue.png' });
    }

    console.log('\n✅ Queue registration and flow test completed!');
    console.log('Screenshots saved in screenshots/ directory');

  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'screenshots/error-state.png' });
  }

  // Keep browser open for 5 seconds to see final state
  await page.waitForTimeout(5000);
  await browser.close();
})();