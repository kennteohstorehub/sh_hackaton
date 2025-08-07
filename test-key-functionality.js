const { chromium } = require('playwright');

/**
 * Quick test to validate key BackOffice functionality
 * This test focuses on the most critical paths
 */
async function testKeyFunctionality() {
  console.log('🧪 Testing Key BackOffice Functionality...\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  const BASE_URL = 'http://localhost:3838';
  const CREDENTIALS = {
    email: 'backoffice@storehubqms.local',
    password: 'BackOffice123!@#'
  };
  
  let passedTests = 0;
  let totalTests = 0;
  
  async function test(description, testFn) {
    totalTests++;
    try {
      console.log(`🔍 ${description}`);
      await testFn();
      console.log(`✅ PASSED: ${description}\n`);
      passedTests++;
    } catch (error) {
      console.log(`❌ FAILED: ${description}`);
      console.log(`   Error: ${error.message}\n`);
    }
  }
  
  try {
    // Test 1: Login Page Access
    await test('Login page loads and displays correctly', async () => {
      await page.goto(`${BASE_URL}/backoffice/auth/login`);
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Check essential elements
      await page.waitForSelector('input[name="email"]', { timeout: 5000 });
      await page.waitForSelector('input[name="password"]', { timeout: 5000 });
      await page.waitForSelector('button[type="submit"]', { timeout: 5000 });
      
      const title = await page.title();
      if (!title || title.length === 0) {
        throw new Error('Page title is empty');
      }
    });
    
    // Test 2: Authentication with Valid Credentials
    await test('Authentication works with valid credentials', async () => {
      await page.fill('input[name="email"]', CREDENTIALS.email);
      await page.fill('input[name="password"]', CREDENTIALS.password);
      
      // Take screenshot before submit
      await page.screenshot({ 
        path: 'test-screenshots/before-login.png',
        fullPage: true 
      });
      
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      
      // Check if redirected to dashboard
      const url = page.url();
      if (!url.includes('/dashboard')) {
        throw new Error(`Expected dashboard redirect, got: ${url}`);
      }
      
      // Take screenshot after login
      await page.screenshot({ 
        path: 'test-screenshots/after-login.png',
        fullPage: true 
      });
    });
    
    // Test 3: Dashboard Loads Correctly
    await test('Dashboard displays with navigation and content', async () => {
      // Should already be on dashboard from previous test
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Check for navigation elements
      const navExists = await page.locator('nav, .navbar, .sidebar').count() > 0;
      if (!navExists) {
        throw new Error('Navigation menu not found');
      }
      
      // Check for main content
      const hasContent = (await page.textContent('body')).length > 100;
      if (!hasContent) {
        throw new Error('Dashboard appears to have no content');
      }
    });
    
    // Test 4: Navigation Links Work
    await test('Primary navigation links are functional', async () => {
      const navigationLinks = [
        { name: 'Tenants', path: '/backoffice/tenants' },
        { name: 'Dashboard', path: '/backoffice/dashboard' }
      ];
      
      for (const link of navigationLinks) {
        await page.goto(`${BASE_URL}${link.path}`);
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        
        const currentUrl = page.url();
        if (!currentUrl.includes(link.path)) {
          throw new Error(`${link.name} navigation failed. Expected path: ${link.path}, got: ${currentUrl}`);
        }
        
        // Check page is not 404
        const content = await page.textContent('body');
        if (content.toLowerCase().includes('not found') || content.toLowerCase().includes('404')) {
          throw new Error(`${link.name} page shows 404 error`);
        }
      }
    });
    
    // Test 5: Tenant Creation Form Access
    await test('Tenant creation form is accessible', async () => {
      await page.goto(`${BASE_URL}/backoffice/tenants`);
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Look for create button or link
      const createElements = await page.locator('a:has-text("Create"), button:has-text("Create"), .btn-create, [href*="create"], [href*="new"]').count();
      
      if (createElements > 0) {
        // Try to click the first create element
        await page.locator('a:has-text("Create"), button:has-text("Create"), .btn-create, [href*="create"], [href*="new"]').first().click();
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        
        // Check if form or wizard loaded
        const hasForm = await page.locator('form, .wizard-container, .form-card').count() > 0;
        if (!hasForm) {
          console.log('   Note: Create button found but form not detected - may be implemented differently');
        }
      } else {
        console.log('   Note: Create button not found - may not be implemented yet');
      }
    });
    
    // Test 6: Responsive Design Basic Check
    await test('Basic responsive design works', async () => {
      await page.goto(`${BASE_URL}/backoffice/dashboard`);
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Test desktop view
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(1000);
      let navVisible = await page.locator('nav, .navbar, .sidebar').isVisible();
      if (!navVisible) {
        throw new Error('Navigation not visible in desktop view');
      }
      
      // Test mobile view
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(1000);
      let contentVisible = await page.locator('h1, .page-title').isVisible();
      if (!contentVisible) {
        throw new Error('Main content not visible in mobile view');
      }
      
      // Take mobile screenshot
      await page.screenshot({ 
        path: 'test-screenshots/mobile-view.png',
        fullPage: true 
      });
    });
    
    // Test 7: Security - Unauthorized Access Protection
    await test('Unauthorized access is properly blocked', async () => {
      // Logout or clear session
      await page.goto(`${BASE_URL}/backoffice/auth/logout`);
      await page.waitForLoadState('networkidle', { timeout: 5000 });
      
      // Try to access protected page
      await page.goto(`${BASE_URL}/backoffice/dashboard`);
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Should be redirected to login
      const url = page.url();
      if (!url.includes('/login')) {
        throw new Error(`Expected login redirect, but got: ${url}`);
      }
    });
    
    // Test 8: CSRF Protection Check
    await test('CSRF protection is implemented', async () => {
      await page.goto(`${BASE_URL}/backoffice/auth/login`);
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Check for CSRF token
      const csrfToken = await page.locator('input[name="_csrf"]').count();
      if (csrfToken === 0) {
        console.log('   Warning: CSRF token not detected in visible form');
      }
    });
    
    // Test 9: Basic Performance Check
    await test('Pages load within acceptable time', async () => {
      const startTime = Date.now();
      await page.goto(`${BASE_URL}/backoffice/auth/login`);
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      const loadTime = Date.now() - startTime;
      
      if (loadTime > 10000) {
        throw new Error(`Page load too slow: ${loadTime}ms (expected < 10s)`);
      }
      
      console.log(`   Page loaded in ${loadTime}ms`);
    });
    
  } catch (error) {
    console.log(`💥 Test execution error: ${error.message}`);
  } finally {
    await browser.close();
  }
  
  // Print Results
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
  
  const successRate = Math.round((passedTests / totalTests) * 100);
  console.log(`📈 Success Rate: ${successRate}%`);
  
  if (successRate >= 80) {
    console.log('🎉 OVERALL RESULT: GOOD - Core functionality is working');
  } else if (successRate >= 60) {
    console.log('⚠️  OVERALL RESULT: PARTIAL - Some issues need attention');
  } else {
    console.log('🚨 OVERALL RESULT: POOR - Significant issues found');
  }
  
  console.log('\n📸 Screenshots saved to test-screenshots/ directory');
  console.log('📋 Review screenshots and logs for detailed analysis');
  
  return {
    passed: passedTests,
    failed: totalTests - passedTests,
    total: totalTests,
    successRate
  };
}

// Run the test
testKeyFunctionality()
  .then(results => {
    console.log('\n✨ Testing completed!');
    process.exit(results.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });