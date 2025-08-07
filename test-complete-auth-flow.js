#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function testCompleteAuthFlow() {
  console.log('🧪 Testing Complete Authentication Flow...');
  
  const browser = await puppeteer.launch({
    headless: true, // Run headless for speed
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Step 1: Go to merchant subdomain (should redirect to login)
    console.log('Step 1: Accessing merchant subdomain...');
    await page.goto('http://demo.lvh.me:3838', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    const loginUrl = page.url();
    if (loginUrl.includes('/auth/login')) {
      console.log('✅ Correctly redirected to login page');
    } else {
      console.log('❌ Not redirected to login page:', loginUrl);
      return;
    }
    
    // Step 2: Fill in merchant credentials and submit
    console.log('Step 2: Logging in with merchant credentials...');
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.type('input[name="email"]', 'admin@demo.local');
    await page.type('input[name="password"]', 'Demo123!@#');
    
    // Click submit and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
      page.click('button[type="submit"]')
    ]);
    
    const afterLoginUrl = page.url();
    console.log('Current URL after login:', afterLoginUrl);
    
    // Check if we're at the right place
    if (afterLoginUrl.includes('/dashboard') && !afterLoginUrl.includes('/backoffice')) {
      console.log('✅ SUCCESS: Merchant redirected to merchant dashboard');
      console.log('✅ Authentication flow working correctly!');
      
      // Get page title to confirm we're on the right page
      const title = await page.title();
      console.log('Page title:', title);
      
    } else if (afterLoginUrl.includes('/backoffice')) {
      console.log('❌ ISSUE: Merchant was redirected to backoffice dashboard');
      console.log('❌ The fix did not work properly');
      
    } else if (afterLoginUrl.includes('/auth/login')) {
      console.log('❌ ISSUE: Still on login page - login may have failed');
      
      // Check for error messages
      const errorMsg = await page.$eval('.alert-danger, .error', el => el.textContent).catch(() => 'No error message found');
      console.log('Error message:', errorMsg);
      
    } else {
      console.log('❌ UNEXPECTED: Redirected to unexpected location');
    }
    
    // Step 3: Test that already-logged-in user gets redirected correctly
    console.log('\nStep 3: Testing redirect for already-logged-in user...');
    await page.goto('http://demo.lvh.me:3838/auth/login', { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });
    
    const finalUrl = page.url();
    if (finalUrl.includes('/dashboard') && !finalUrl.includes('/backoffice')) {
      console.log('✅ SUCCESS: Already-logged-in user redirected to merchant dashboard');
    } else {
      console.log('❌ ISSUE: Already-logged-in user not redirected properly:', finalUrl);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testCompleteAuthFlow().catch(console.error);