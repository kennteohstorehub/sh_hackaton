#!/usr/bin/env node

const { chromium } = require('playwright');

const PRODUCTION_URL = 'https://queuemanagement-vtc2.onrender.com';

async function testProductionDetailed() {
  console.log('🧪 Starting detailed production tests...\n');
  console.log(`🌐 Testing URL: ${PRODUCTION_URL}\n`);
  
  const browser = await chromium.launch({ 
    headless: true,
    timeout: 60000 
  });
  
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Browser console error:', msg.text());
    }
  });
  
  page.on('pageerror', err => {
    console.log('❌ Page error:', err.message);
  });
  
  try {
    // Test 1: Check if site is accessible
    console.log('📍 Test 1: Checking site accessibility...');
    const response = await page.goto(PRODUCTION_URL, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    console.log(`   Response status: ${response.status()}`);
    console.log(`   Response URL: ${response.url()}`);
    
    if (response.status() >= 400) {
      console.log(`❌ Site returned error status: ${response.status()}\n`);
      const body = await page.content();
      console.log('Page content:', body.substring(0, 500));
    } else {
      console.log('✅ Site is accessible\n');
    }
    
    // Take screenshot of home page
    await page.screenshot({ 
      path: 'test-home-page.png',
      fullPage: true 
    });
    console.log('📸 Home page screenshot saved as test-home-page.png\n');
    
    // Test 2: Check login page
    console.log('📍 Test 2: Navigating to login page...');
    const loginResponse = await page.goto(`${PRODUCTION_URL}/auth/login`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    console.log(`   Login page status: ${loginResponse.status()}`);
    console.log(`   Current URL: ${page.url()}`);
    
    // Wait a bit for any redirects
    await page.waitForTimeout(2000);
    console.log(`   Final URL: ${page.url()}`);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-login-page.png',
      fullPage: true 
    });
    console.log('📸 Login page screenshot saved as test-login-page.png\n');
    
    // Check what's on the page
    const pageTitle = await page.title();
    console.log(`   Page title: ${pageTitle}`);
    
    // Try different selectors
    const selectors = [
      'input[name="email"]',
      'input[type="email"]',
      '#email',
      'input',
      'form'
    ];
    
    console.log('   Checking for form elements...');
    for (const selector of selectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`   ✓ Found ${count} elements matching: ${selector}`);
      }
    }
    
    // Get page HTML
    const html = await page.content();
    if (html.includes('502 Bad Gateway')) {
      console.log('❌ Server returned 502 Bad Gateway\n');
    } else if (html.includes('Application error')) {
      console.log('❌ Application error detected\n');
    } else {
      console.log('✅ Login page loaded\n');
      
      // Test 3: Try to find login form
      console.log('📍 Test 3: Looking for login form...');
      const emailInput = await page.locator('input[name="email"], input[type="email"], #email').first();
      const passwordInput = await page.locator('input[name="password"], input[type="password"], #password').first();
      
      if (await emailInput.count() > 0 && await passwordInput.count() > 0) {
        console.log('✅ Login form found\n');
        
        // Test 4: Try to login
        console.log('📍 Test 4: Testing login with demo credentials...');
        await emailInput.fill('demo@smartqueue.com');
        await passwordInput.fill('demo123456');
        
        // Find and click submit button
        const submitButton = await page.locator('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();
        if (await submitButton.count() > 0) {
          await submitButton.click();
          
          // Wait for navigation or error
          try {
            await page.waitForURL(/dashboard|error|login/, { timeout: 10000 });
            const newUrl = page.url();
            console.log(`   After login URL: ${newUrl}`);
            
            if (newUrl.includes('dashboard')) {
              console.log('✅ Login successful!\n');
              
              // Take dashboard screenshot
              await page.screenshot({ 
                path: 'test-dashboard.png',
                fullPage: true 
              });
              console.log('📸 Dashboard screenshot saved as test-dashboard.png\n');
            } else {
              console.log('❌ Login failed - still on login page\n');
              
              // Check for error messages
              const errorMsg = await page.locator('.alert, .error, .alert-danger').first().textContent().catch(() => null);
              if (errorMsg) {
                console.log(`   Error message: ${errorMsg}\n`);
              }
            }
          } catch (e) {
            console.log('❌ Login navigation timeout\n');
          }
        } else {
          console.log('❌ Submit button not found\n');
        }
      } else {
        console.log('❌ Login form not found\n');
        console.log('   Page might be showing an error or different content\n');
      }
    }
    
    // Test 5: Check API
    console.log('📍 Test 5: Testing API health endpoint...');
    try {
      const apiResponse = await page.request.get(`${PRODUCTION_URL}/api/health`);
      console.log(`   API Status: ${apiResponse.status()}`);
      
      if (apiResponse.ok()) {
        const apiData = await apiResponse.json();
        console.log(`   API Response: ${JSON.stringify(apiData, null, 2)}`);
        console.log('✅ API is healthy\n');
      } else {
        console.log('❌ API returned error status\n');
      }
    } catch (e) {
      console.log(`❌ API request failed: ${e.message}\n`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    
    // Take error screenshot
    await page.screenshot({ 
      path: `test-error-${Date.now()}.png`,
      fullPage: true 
    });
    console.log('📸 Error screenshot saved');
    
  } finally {
    await browser.close();
    console.log('\n🏁 Test completed');
  }
}

// Run tests
testProductionDetailed().catch(console.error);