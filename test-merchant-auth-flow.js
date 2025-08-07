#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');

async function testMerchantAuthFlow() {
  console.log('🚀 Testing Merchant Authentication Flow Fix...');
  
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    
    // Step 1: Go to merchant subdomain
    console.log('Step 1: Accessing merchant subdomain (demo.lvh.me:3838)...');
    await page.goto('http://demo.lvh.me:3838', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await page.screenshot({ path: 'test-screenshots/step1-merchant-subdomain.png' });
    
    // Check current URL
    const currentUrl1 = page.url();
    console.log(`Current URL after accessing merchant subdomain: ${currentUrl1}`);
    
    // Step 2: Fill in merchant login credentials
    console.log('Step 2: Filling in merchant login credentials...');
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.type('input[name="email"]', 'admin@demo.local');
    await page.type('input[name="password"]', 'demo123');
    
    await page.screenshot({ path: 'test-screenshots/step2-login-filled.png' });
    
    // Step 3: Submit login form
    console.log('Step 3: Submitting login form...');
    await page.click('button[type="submit"]');
    
    // Wait for navigation or error
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    } catch (e) {
      console.log('Navigation timeout, checking current state...');
    }
    
    const currentUrl2 = page.url();
    console.log(`Current URL after login submit: ${currentUrl2}`);
    
    await page.screenshot({ path: 'test-screenshots/step3-after-login.png' });
    
    // Step 4: Check if redirected correctly
    if (currentUrl2.includes('/dashboard') && !currentUrl2.includes('/backoffice')) {
      console.log('✅ SUCCESS: User was redirected to merchant dashboard');
      console.log(`Final URL: ${currentUrl2}`);
    } else if (currentUrl2.includes('/backoffice')) {
      console.log('❌ ISSUE: User was redirected to backoffice instead of merchant dashboard');
      console.log(`Final URL: ${currentUrl2}`);
    } else {
      console.log('⚠️  UNKNOWN: User was redirected to unexpected location');
      console.log(`Final URL: ${currentUrl2}`);
    }
    
    // Wait a bit to see the final result
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-screenshots/step4-final-result.png' });
    
    // Check for any error messages
    const errorMessages = await page.$$eval('.alert-danger, .error, .text-red-500', 
      elements => elements.map(el => el.textContent.trim()));
    
    if (errorMessages.length > 0) {
      console.log('Error messages found:', errorMessages);
    }
    
    // Check page title
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: 'test-screenshots/error-screenshot.png' });
  } finally {
    await browser.close();
  }
}

// Create screenshots directory if it doesn't exist
if (!fs.existsSync('test-screenshots')) {
  fs.mkdirSync('test-screenshots');
}

testMerchantAuthFlow().catch(console.error);