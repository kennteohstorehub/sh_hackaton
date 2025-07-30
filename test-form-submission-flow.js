/**
 * Test the form submission flow to queue-chat redirect
 */

const axios = require('axios');
const { chromium } = require('playwright');
const logger = require('./server/utils/logger');

const BASE_URL = 'http://localhost:3838';
const DEMO_QUEUE_ID = '453b1b29-7d3b-4c0e-92d6-d86cc9952f8e';

async function testFormSubmissionFlow() {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
    });
    
    // Monitor network errors
    page.on('pageerror', error => {
      console.error('[Page Error]:', error.message);
    });
    
    logger.info('=== Testing Form Submission to Queue Chat Flow ===\n');
    
    // Step 1: Navigate to queue info page
    logger.info('Step 1: Navigating to queue info page...');
    await page.goto(`${BASE_URL}/queue/${DEMO_QUEUE_ID}`);
    await page.waitForLoadState('networkidle');
    
    // Step 2: Fill out the form
    logger.info('Step 2: Filling out join queue form...');
    await page.fill('#customerName', 'Test User ' + Date.now());
    await page.fill('#customerPhone', '0123456789');
    await page.selectOption('#partySize', '2');
    await page.fill('#specialRequests', 'Testing form submission flow');
    
    // Step 3: Submit the form
    logger.info('Step 3: Submitting form...');
    
    // Listen for the redirect
    const navigationPromise = page.waitForNavigation();
    await page.click('#joinBtn');
    
    // Wait for redirect to queue-chat
    await navigationPromise;
    
    const currentUrl = page.url();
    logger.info('Step 4: Redirected to:', currentUrl);
    
    // Wait for queue chat to initialize
    await page.waitForTimeout(3000);
    
    // Check for errors in console
    const hasErrors = await page.evaluate(() => {
      return window.queueChatErrors || false;
    });
    
    if (hasErrors) {
      logger.error('Queue chat initialization errors detected!');
    }
    
    // Check if greeting message appears
    const messages = await page.locator('.message').count();
    logger.info(`Step 5: Found ${messages} messages in chat`);
    
    // Check if verification code is displayed
    const verificationDisplay = await page.isVisible('#verificationDisplay');
    logger.info(`Step 6: Verification code display visible: ${verificationDisplay}`);
    
    if (verificationDisplay) {
      const verificationCode = await page.textContent('#headerVerifyCode');
      logger.info(`Verification code: ${verificationCode}`);
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'queue-chat-test.png',
      fullPage: true 
    });
    logger.info('Screenshot saved as queue-chat-test.png');
    
    // Keep browser open for manual inspection
    logger.info('\n✅ Test completed. Browser will remain open for inspection.');
    logger.info('Press Ctrl+C to close.');
    
    await new Promise(() => {}); // Keep process alive
    
  } catch (error) {
    logger.error('Test failed:', error);
    await browser.close();
  }
}

// Add error tracking to page
const errorTrackingScript = `
window.queueChatErrors = false;
window.addEventListener('error', (e) => {
  console.error('Global error:', e.message);
  window.queueChatErrors = true;
});
`;

testFormSubmissionFlow();