#!/usr/bin/env node

const { chromium } = require('playwright');

async function runSimpleTest() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('1. Navigating to join queue page...');
    await page.goto('http://localhost:3838/queue/join/7a99f35e-0f73-4f8e-831c-fde8fc3a5532');
    
    console.log('2. Waiting for page to load...');
    await page.waitForLoadState('networkidle');
    
    console.log('3. Checking for form elements...');
    const nameInput = await page.locator('input[name="name"]').isVisible();
    const phoneInput = await page.locator('input[name="phone"]').isVisible();
    console.log('   Name input visible:', nameInput);
    console.log('   Phone input visible:', phoneInput);
    
    console.log('4. Checking Socket.IO status...');
    await page.waitForTimeout(2000); // Give socket time to connect
    
    const socketStatus = await page.evaluate(() => {
      return {
        socketExists: typeof io !== 'undefined',
        windowSocket: typeof window.socket !== 'undefined',
        connected: window.socket?.connected || false,
        socketId: window.socket?.id || null
      };
    });
    console.log('   Socket status:', socketStatus);
    
    console.log('5. Filling form...');
    await page.fill('input[name="name"]', 'Playwright Test User');
    await page.fill('input[name="phone"]', '+60191234567');
    await page.fill('input[name="partySize"]', '2');
    
    console.log('6. Submitting form...');
    await page.click('button[type="submit"]');
    
    console.log('7. Waiting for response...');
    try {
      await page.waitForSelector('.queue-number, .success-message, .alert-success', { timeout: 10000 });
      console.log('   ✅ Queue joined successfully!');
      
      // Get queue details
      const queueInfo = await page.evaluate(() => {
        const queueNumber = document.querySelector('.queue-number, [class*="queue-number"]')?.textContent;
        const position = document.querySelector('.position, [class*="position"]')?.textContent;
        return { queueNumber, position };
      });
      console.log('   Queue info:', queueInfo);
      
    } catch (error) {
      console.log('   ❌ Failed to join queue');
      
      // Check for error messages
      const errorText = await page.textContent('body');
      if (errorText.includes('error') || errorText.includes('Error')) {
        console.log('   Error found on page');
      }
      
      // Take screenshot
      await page.screenshot({ path: 'playwright-test-error.png' });
      console.log('   Screenshot saved: playwright-test-error.png');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    console.log('\nPress Ctrl+C to close browser...');
    // Keep browser open for inspection
    await new Promise(() => {});
  }
}

runSimpleTest();