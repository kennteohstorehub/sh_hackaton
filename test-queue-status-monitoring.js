const { chromium } = require('playwright');

(async () => {
  console.log('Starting Queue Status Monitoring Test...');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    permissions: ['notifications']
  });

  const page = await context.newPage();

  try {
    // Use the existing queue entry for Test Customer 1754487343318
    const queueId = '244ef284-bf07-4934-9151-8c2f968f8964';
    const entryId = '43ad00c1-68a8-47fb-97ce-91a62fe2fb07';
    const statusUrl = `http://localhost:3000/queue-status/${queueId}/${entryId}`;
    
    console.log('\n1. Navigating to queue status page...');
    console.log('URL:', statusUrl);
    
    await page.goto(statusUrl);
    await page.waitForTimeout(2000);
    
    // Take initial screenshot
    await page.screenshot({ path: 'screenshots/status-01-initial.png' });
    
    // Check page title and content
    const title = await page.title();
    console.log('Page Title:', title);
    
    // Look for queue position
    console.log('\n2. Checking queue position...');
    const positionSelectors = [
      '.queue-position',
      '.position-number',
      '[data-position]',
      '.position',
      '#position',
      'h1:has-text("Position")',
      'span.position'
    ];
    
    let positionText = null;
    for (const selector of positionSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          positionText = await element.textContent();
          console.log(`Found position with selector ${selector}: ${positionText}`);
          break;
        }
      } catch (e) {
        // Continue
      }
    }
    
    // Look for wait time
    console.log('\n3. Checking estimated wait time...');
    const waitTimeSelectors = [
      '.wait-time',
      '.estimated-wait',
      '[data-wait-time]',
      '.estimate',
      '#waitTime',
      'span:has-text("minutes")'
    ];
    
    let waitTimeText = null;
    for (const selector of waitTimeSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          waitTimeText = await element.textContent();
          console.log(`Found wait time with selector ${selector}: ${waitTimeText}`);
          break;
        }
      } catch (e) {
        // Continue
      }
    }
    
    // Check for customer name
    console.log('\n4. Checking customer information...');
    const nameSelectors = [
      '.customer-name',
      '[data-customer-name]',
      'h2:has-text("Test Customer")',
      'span:has-text("Test Customer")'
    ];
    
    for (const selector of nameSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const name = await element.textContent();
          console.log(`Customer name: ${name}`);
          break;
        }
      } catch (e) {
        // Continue
      }
    }
    
    // Check for webchat widget
    console.log('\n5. Checking for webchat functionality...');
    const chatSelectors = [
      '.webchat-container',
      '#webchat',
      '.chat-widget',
      '.chat-button',
      '[data-chat]'
    ];
    
    let chatFound = false;
    for (const selector of chatSelectors) {
      const element = await page.$(selector);
      if (element) {
        chatFound = true;
        console.log(`Found chat widget with selector: ${selector}`);
        await page.screenshot({ path: 'screenshots/status-02-with-chat.png' });
        
        // Try to open chat
        try {
          await element.click();
          await page.waitForTimeout(1000);
          console.log('Opened chat widget');
          
          // Look for chat input
          const chatInput = await page.$('input[type="text"][placeholder*="message"], textarea[placeholder*="message"], .chat-input');
          if (chatInput) {
            await chatInput.fill('Hello, when will my table be ready?');
            console.log('Typed message in chat');
            
            // Look for send button
            const sendButton = await page.$('button:has-text("Send"), .send-button, button[type="submit"]');
            if (sendButton) {
              await sendButton.click();
              console.log('Sent chat message');
              await page.waitForTimeout(2000);
              await page.screenshot({ path: 'screenshots/status-03-chat-sent.png' });
            }
          }
        } catch (e) {
          console.log('Could not interact with chat:', e.message);
        }
        break;
      }
    }
    
    if (!chatFound) {
      console.log('No chat widget found on page');
    }
    
    // Monitor for status updates
    console.log('\n6. Monitoring for status updates (30 seconds)...');
    
    let updateCount = 0;
    const startTime = Date.now();
    
    const checkForUpdates = setInterval(async () => {
      try {
        // Check for notifications or status changes
        const notifications = await page.$$('.notification, .alert, .toast, .update-message');
        if (notifications.length > updateCount) {
          console.log(`New update detected! (${notifications.length} total)`);
          await page.screenshot({ path: `screenshots/status-update-${notifications.length}.png` });
          updateCount = notifications.length;
        }
        
        // Check if status changed
        const statusElement = await page.$('.queue-status, .status, [data-status], .current-status');
        if (statusElement) {
          const currentStatus = await statusElement.textContent();
          if (currentStatus.toLowerCase().includes('called') || 
              currentStatus.toLowerCase().includes('ready') ||
              currentStatus.toLowerCase().includes('serving')) {
            console.log('\n🎉 Status changed! Customer is being served!');
            console.log('New status:', currentStatus);
            await page.screenshot({ path: 'screenshots/status-04-called.png' });
            clearInterval(checkForUpdates);
          }
        }
        
        // Check for position changes
        if (positionText) {
          const currentPosElement = await page.$(positionSelectors[0]);
          if (currentPosElement) {
            const currentPos = await currentPosElement.textContent();
            if (currentPos !== positionText) {
              console.log(`Position changed from ${positionText} to ${currentPos}`);
              positionText = currentPos;
              await page.screenshot({ path: `screenshots/status-position-${currentPos}.png` });
            }
          }
        }
        
        // Stop after 30 seconds
        if (Date.now() - startTime > 30000) {
          console.log('Monitoring complete after 30 seconds');
          clearInterval(checkForUpdates);
        }
      } catch (e) {
        console.log('Error during monitoring:', e.message);
      }
    }, 2000);
    
    // Wait for monitoring to complete
    await page.waitForTimeout(32000);
    
    // Test leave queue functionality
    console.log('\n7. Testing leave queue functionality...');
    const leaveSelectors = [
      'button:has-text("Leave Queue")',
      'button:has-text("Cancel")',
      '.leave-queue-btn',
      '.cancel-btn',
      'button.btn-danger'
    ];
    
    let leaveButton = null;
    for (const selector of leaveSelectors) {
      leaveButton = await page.$(selector);
      if (leaveButton && await leaveButton.isVisible()) {
        console.log(`Found leave button with selector: ${selector}`);
        await leaveButton.click();
        await page.waitForTimeout(1000);
        
        // Check for confirmation
        const confirmButton = await page.$('button:has-text("Confirm"), button:has-text("Yes")');
        if (confirmButton) {
          console.log('Confirmation dialog appeared');
          await page.screenshot({ path: 'screenshots/status-05-leave-confirm.png' });
          // Don't actually leave for this test
          const cancelButton = await page.$('button:has-text("Cancel"), button:has-text("No")');
          if (cancelButton) {
            await cancelButton.click();
            console.log('Cancelled leaving queue');
          }
        }
        break;
      }
    }
    
    if (!leaveButton) {
      console.log('No leave queue button found');
    }
    
    // Final screenshot
    await page.screenshot({ path: 'screenshots/status-06-final.png' });
    
    console.log('\n✅ Queue status monitoring test completed!');
    console.log('Screenshots saved in screenshots/ directory');
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'screenshots/status-error.png' });
  }

  // Keep browser open for 5 seconds to see final state
  await page.waitForTimeout(5000);
  await browser.close();
})();