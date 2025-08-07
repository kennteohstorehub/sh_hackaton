#!/usr/bin/env node

/**
 * Test all login scenarios for the multi-tenant authentication system
 */

const { chromium } = require('playwright');
const logger = require('./server/utils/logger');

const TEST_SCENARIOS = [
  {
    name: 'BackOffice Login',
    url: 'http://admin.lvh.me:3838',
    loginUrl: 'http://admin.lvh.me:3838/backoffice/auth/login',
    email: 'backoffice@storehubqms.local',
    password: 'BackOffice123!@#',
    expectedDashboard: '/backoffice/dashboard',
    portalType: 'BackOffice'
  },
  {
    name: 'Demo Tenant Login',
    url: 'http://demo.lvh.me:3838',
    loginUrl: 'http://demo.lvh.me:3838/auth/login',
    email: 'admin@demo.local',
    password: 'Demo123!@#',
    expectedDashboard: '/dashboard',
    portalType: 'Tenant'
  },
  {
    name: 'Test Cafe Login',
    url: 'http://test-cafe.lvh.me:3838',
    loginUrl: 'http://test-cafe.lvh.me:3838/auth/login',
    email: 'cafe@testcafe.local',
    password: 'Test123!@#',
    expectedDashboard: '/dashboard',
    portalType: 'Tenant'
  }
];

async function testLogin(scenario) {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      // Important: Clear cookies between tests for proper isolation
      storageState: undefined
    });
    
    const page = await context.newPage();
    
    console.log(`\n🧪 Testing ${scenario.name}`);
    console.log('─'.repeat(50));
    
    // Step 1: Navigate to login page
    console.log(`1. Navigating to ${scenario.loginUrl}...`);
    await page.goto(scenario.loginUrl, { waitUntil: 'networkidle' });
    
    // Verify we're on the login page
    const loginTitle = await page.textContent('h4, h2');
    console.log(`   ✅ Login page loaded: "${loginTitle}"`);
    
    // Take screenshot of login page
    await page.screenshot({ 
      path: `test-screenshots/${scenario.name.toLowerCase().replace(/ /g, '-')}-login-page.png` 
    });
    
    // Step 2: Fill login form
    console.log(`2. Filling login form...`);
    await page.fill('input[name="email"]', scenario.email);
    await page.fill('input[name="password"]', scenario.password);
    console.log(`   ✅ Credentials entered`);
    
    // Take screenshot of filled form
    await page.screenshot({ 
      path: `test-screenshots/${scenario.name.toLowerCase().replace(/ /g, '-')}-login-filled.png` 
    });
    
    // Step 3: Submit form
    console.log(`3. Submitting login form...`);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }),
      page.click('button[type="submit"]')
    ]);
    
    // Step 4: Check result
    const currentUrl = page.url();
    console.log(`4. Checking login result...`);
    console.log(`   Current URL: ${currentUrl}`);
    
    if (currentUrl.includes(scenario.expectedDashboard)) {
      console.log(`   ✅ SUCCESS: Redirected to ${scenario.portalType} dashboard`);
      
      // Take screenshot of dashboard
      await page.screenshot({ 
        path: `test-screenshots/${scenario.name.toLowerCase().replace(/ /g, '-')}-dashboard.png` 
      });
      
      // Check for dashboard content
      const dashboardTitle = await page.textContent('h1, h2, h3').catch(() => 'No title found');
      console.log(`   Dashboard title: "${dashboardTitle}"`);
      
      // Test logout
      console.log(`5. Testing logout...`);
      const logoutLink = await page.$('a[href*="logout"]');
      if (logoutLink) {
        await logoutLink.click();
        await page.waitForNavigation({ waitUntil: 'networkidle' });
        console.log(`   ✅ Logout successful`);
      } else {
        console.log(`   ⚠️  No logout link found`);
      }
      
    } else if (currentUrl.includes('login')) {
      console.log(`   ❌ FAILED: Still on login page`);
      
      // Check for error messages
      const errorText = await page.textContent('.alert-danger, .error').catch(() => null);
      if (errorText) {
        console.log(`   Error message: "${errorText}"`);
      }
      
      // Take screenshot of error
      await page.screenshot({ 
        path: `test-screenshots/${scenario.name.toLowerCase().replace(/ /g, '-')}-error.png` 
      });
    } else {
      console.log(`   ⚠️  Unexpected redirect to: ${currentUrl}`);
    }
    
    await context.close();
    
  } catch (error) {
    console.error(`   ❌ Test failed with error: ${error.message}`);
    
    // Take error screenshot
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.screenshot({ 
        path: `test-screenshots/${scenario.name.toLowerCase().replace(/ /g, '-')}-error.png` 
      });
      await context.close();
    } catch (screenshotError) {
      // Ignore screenshot errors
    }
  } finally {
    await browser.close();
  }
}

async function runAllTests() {
  console.log('🚀 Multi-Tenant Authentication Login Tests');
  console.log('=========================================\n');
  
  // Create screenshots directory
  const fs = require('fs');
  if (!fs.existsSync('test-screenshots')) {
    fs.mkdirSync('test-screenshots');
  }
  
  // Run tests sequentially to avoid session conflicts
  for (const scenario of TEST_SCENARIOS) {
    await testLogin(scenario);
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n\n📊 Test Summary');
  console.log('─'.repeat(50));
  console.log('✅ All login scenarios tested');
  console.log('📸 Screenshots saved in test-screenshots/');
  console.log('\n💡 Next Steps:');
  console.log('1. Check test-screenshots/ for visual verification');
  console.log('2. Review server logs for any authentication errors');
  console.log('3. Verify session isolation between portals');
}

// Run tests
runAllTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});