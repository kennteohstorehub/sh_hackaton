#!/usr/bin/env node

/**
 * Visual test for BackOffice login page
 * Tests styling, functionality, and user experience
 */

const { chromium } = require('playwright');

async function testLoginPageVisual() {
  let browser;
  try {
    console.log('🎭 Starting visual login test...\n');
    
    browser = await chromium.launch({ 
      headless: false, // Show browser for visual verification
      slowMo: 1000 // Slow down for better visibility
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Browser console error:', msg.text());
      }
    });
    
    // Listen for network errors
    page.on('requestfailed', request => {
      console.log('❌ Network request failed:', request.url(), request.failure().errorText);
    });
    
    // Step 1: Navigate to login page
    console.log('1. Navigating to login page...');
    await page.goto('http://admin.lvh.me:3838/backoffice/auth/login');
    
    // Wait for page to load
    await page.waitForSelector('form', { timeout: 5000 });
    console.log('✅ Login page loaded');
    
    // Step 2: Check if CSS is loaded properly
    const hasBlueBackground = await page.evaluate(() => {
      const body = document.body;
      const computedStyle = window.getComputedStyle(body);
      return computedStyle.background.includes('gradient') || 
             computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)';
    });
    
    if (hasBlueBackground) {
      console.log('✅ CSS styling is loaded correctly');
    } else {
      console.log('❌ CSS styling may not be loaded properly');
    }
    
    // Step 3: Check form elements
    const emailInput = await page.$('#email');
    const passwordInput = await page.$('#password');
    const submitButton = await page.$('button[type="submit"]');
    
    if (emailInput && passwordInput && submitButton) {
      console.log('✅ All form elements are present');
    } else {
      console.log('❌ Some form elements are missing');
    }
    
    // Step 4: Test form interaction
    console.log('\n2. Testing form interaction...');
    await page.fill('#email', 'backoffice@storehubqms.local');
    await page.fill('#password', 'BackOffice123!@#');
    console.log('✅ Form fields filled');
    
    // Step 5: Submit form and check result
    console.log('\n3. Submitting login form...');
    
    // Wait for navigation after form submission
    const [response] = await Promise.all([
      page.waitForNavigation({ timeout: 10000 }),
      page.click('button[type="submit"]')
    ]);
    
    console.log(`Response status: ${response.status()}`);
    console.log(`Current URL: ${page.url()}`);
    
    if (page.url().includes('/backoffice/dashboard')) {
      console.log('✅ Successfully redirected to dashboard');
      
      // Wait for dashboard to load
      await page.waitForTimeout(2000);
      
      // Check if dashboard content is visible
      const hasContent = await page.evaluate(() => {
        return document.body.textContent.length > 100;
      });
      
      if (hasContent) {
        console.log('✅ Dashboard has content');
      } else {
        console.log('❌ Dashboard appears to be empty');
      }
      
    } else if (page.url().includes('/login')) {
      console.log('❌ Redirected back to login - authentication failed');
      
      // Check for error messages
      const errorMessage = await page.$('.alert-error');
      if (errorMessage) {
        const errorText = await errorMessage.textContent();
        console.log(`Error message: ${errorText}`);
      }
    } else {
      console.log(`❌ Unexpected redirect to: ${page.url()}`);
    }
    
    // Keep browser open for manual inspection
    console.log('\n📱 Browser will remain open for 10 seconds for manual inspection...');
    await page.waitForTimeout(10000);
    
    return {
      success: page.url().includes('/backoffice/dashboard'),
      url: page.url(),
      hasCSS: hasBlueBackground
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return { success: false, error: error.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run test if called directly
if (require.main === module) {
  testLoginPageVisual()
    .then(result => {
      console.log('\n📊 Visual Test Results:');
      console.log('======================');
      console.log(`Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
      if (result.url) console.log(`Final URL: ${result.url}`);
      if (result.hasCSS !== undefined) console.log(`CSS Loaded: ${result.hasCSS ? '✅' : '❌'}`);
      if (result.error) console.log(`Error: ${result.error}`);
      
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { testLoginPageVisual };