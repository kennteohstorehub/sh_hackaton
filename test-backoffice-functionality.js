const { chromium } = require('playwright');

async function testBackOfficeFunctionality() {
  console.log('🚀 Starting comprehensive BackOffice functionality test...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 // Slow down for better visibility
  });
  const page = await browser.newPage();

  const BASE_URL = 'http://localhost:3838';
  const CREDENTIALS = {
    email: 'backoffice@storehubqms.local',
    password: 'BackOffice123!@#'
  };

  const results = {
    passed: 0,
    failed: 0,
    issues: []
  };

  function logTest(testName, passed, details = null) {
    if (passed) {
      console.log(`✅ ${testName}`);
      results.passed++;
    } else {
      console.log(`❌ ${testName}`);
      results.failed++;
      if (details) results.issues.push(`${testName}: ${details}`);
    }
  }

  async function takeScreenshot(name) {
    await page.screenshot({
      path: `test-screenshots/backoffice-${name}-${Date.now()}.png`,
      fullPage: true
    });
  }

  try {
    // 1. Test Login Page
    console.log('=== 1. AUTHENTICATION TESTS ===');
    
    await page.goto(`${BASE_URL}/backoffice/auth/login`);
    await page.waitForLoadState('networkidle');
    await takeScreenshot('01-login-page');
    
    // Check login page elements
    const hasTitle = await page.title();
    const hasEmailField = await page.locator('input[name="email"]').isVisible();
    const hasPasswordField = await page.locator('input[name="password"]').isVisible();
    const hasSubmitButton = await page.locator('button[type="submit"]').isVisible();
    const hasCSRFToken = await page.locator('input[name="_csrf"]').isVisible();
    
    logTest('Login page loads with proper title', hasTitle.length > 0);
    logTest('Email field is visible', hasEmailField);
    logTest('Password field is visible', hasPasswordField);
    logTest('Submit button is visible', hasSubmitButton);
    logTest('CSRF token is present', hasCSRFToken);
    
    // Test invalid credentials
    await page.fill('input[name="email"]', 'invalid@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    const staysOnLogin = page.url().includes('/login');
    logTest('Invalid credentials rejected (stays on login)', staysOnLogin);
    
    // Test valid credentials
    await page.fill('input[name="email"]', CREDENTIALS.email);
    await page.fill('input[name="password"]', CREDENTIALS.password);
    await takeScreenshot('02-login-filled');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await takeScreenshot('03-after-login');
    
    const redirectsToDashboard = page.url().includes('/dashboard');
    logTest('Valid credentials redirect to dashboard', redirectsToDashboard);
    
    if (!redirectsToDashboard) {
      console.log('Current URL:', page.url());
      console.log('Page content:', await page.textContent('body'));
    }

    // 2. Test Dashboard
    console.log('\n=== 2. DASHBOARD TESTS ===');
    
    await page.goto(`${BASE_URL}/backoffice/dashboard`);
    await page.waitForLoadState('networkidle');
    await takeScreenshot('04-dashboard');
    
    const hasNavigation = await page.locator('nav, .navbar, .sidebar').count() > 0;
    const hasDashboardTitle = (await page.textContent('body')).toLowerCase().includes('dashboard');
    const hasSystemInfo = /system|overview|statistic|tenant|merchant/i.test(await page.textContent('body'));
    
    logTest('Dashboard has navigation elements', hasNavigation);
    logTest('Dashboard has proper title/content', hasDashboardTitle);
    logTest('Dashboard shows system information', hasSystemInfo);

    // 3. Test Navigation
    console.log('\n=== 3. NAVIGATION TESTS ===');
    
    const navigationTests = [
      { name: 'Tenants', path: '/backoffice/tenants' },
      { name: 'Merchants', path: '/backoffice/merchants' },
      { name: 'Audit Logs', path: '/backoffice/audit-logs' },
      { name: 'Settings', path: '/backoffice/settings' },
      { name: 'Users', path: '/backoffice/users' }
    ];

    for (const nav of navigationTests) {
      try {
        await page.goto(`${BASE_URL}${nav.path}`);
        await page.waitForLoadState('networkidle');
        
        const isNotFound = page.url().includes('404') || 
                          (await page.textContent('body')).toLowerCase().includes('not found');
        const hasContent = (await page.textContent('body')).length > 100;
        
        logTest(`${nav.name} page loads without 404`, !isNotFound);
        logTest(`${nav.name} page has content`, hasContent);
        
        if (isNotFound) {
          console.log(`   → ${nav.name} URL: ${page.url()}`);
        }
      } catch (error) {
        logTest(`${nav.name} page accessible`, false, error.message);
      }
    }

    // 4. Test Tenant Management
    console.log('\n=== 4. TENANT MANAGEMENT TESTS ===');
    
    await page.goto(`${BASE_URL}/backoffice/tenants`);
    await page.waitForLoadState('networkidle');
    await takeScreenshot('05-tenants-page');
    
    const tenantsPageContent = await page.textContent('body');
    const hasTenantContent = /tenant/i.test(tenantsPageContent);
    const hasCreateButton = await page.locator('a:has-text("Create"), button:has-text("Create"), .btn-create').count() > 0;
    
    logTest('Tenants page has relevant content', hasTenantContent);
    logTest('Tenants page has create functionality', hasCreateButton);
    
    // Test tenant creation form
    if (hasCreateButton) {
      try {
        const createButton = page.locator('a:has-text("Create"), button:has-text("Create"), .btn-create').first();
        await createButton.click();
        await page.waitForLoadState('networkidle');
        await takeScreenshot('06-tenant-creation');
        
        const hasForm = await page.locator('form, .form-card, .wizard-container').count() > 0;
        const hasNameField = await page.locator('input[name="name"]').count() > 0;
        const hasSubdomainField = await page.locator('input[name="slug"]').count() > 0;
        
        logTest('Tenant creation form displays', hasForm);
        logTest('Tenant creation has name field', hasNameField);
        logTest('Tenant creation has subdomain field', hasSubdomainField);
        
      } catch (error) {
        logTest('Tenant creation form accessible', false, error.message);
      }
    }

    // 5. Test Responsive Design
    console.log('\n=== 5. RESPONSIVE DESIGN TESTS ===');
    
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${BASE_URL}/backoffice/dashboard`);
    await page.waitForLoadState('networkidle');
    await takeScreenshot('07-desktop-view');
    
    const desktopNav = await page.locator('nav, .navbar, .sidebar').isVisible();
    logTest('Desktop layout shows navigation', desktopNav);
    
    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForLoadState('networkidle');
    await takeScreenshot('08-tablet-view');
    
    const tabletUsable = await page.locator('h1, .page-title').isVisible();
    logTest('Tablet layout is usable', tabletUsable);
    
    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');
    await takeScreenshot('09-mobile-view');
    
    const mobileUsable = await page.locator('h1, .page-title').isVisible();
    logTest('Mobile layout is usable', mobileUsable);

    // 6. Test Security Features
    console.log('\n=== 6. SECURITY TESTS ===');
    
    // Test unauthorized access
    await page.goto(`${BASE_URL}/backoffice/auth/logout`);
    await page.waitForLoadState('networkidle');
    
    await page.goto(`${BASE_URL}/backoffice/dashboard`);
    await page.waitForLoadState('networkidle');
    
    const redirectsToLogin = page.url().includes('/login');
    logTest('Unauthorized access redirects to login', redirectsToLogin);
    
    // Test CSRF protection
    await page.goto(`${BASE_URL}/backoffice/auth/login`);
    await page.waitForLoadState('networkidle');
    
    const hasCSRF = await page.locator('input[name="_csrf"]').isVisible();
    logTest('CSRF protection implemented', hasCSRF);

    // 7. Test Error Handling
    console.log('\n=== 7. ERROR HANDLING TESTS ===');
    
    // Test 404 handling
    await page.goto(`${BASE_URL}/backoffice/nonexistent-page`);
    await page.waitForLoadState('networkidle');
    
    const handles404 = page.url().includes('404') || 
                      page.url().includes('/login') ||
                      (await page.textContent('body')).toLowerCase().includes('not found');
    logTest('404 errors handled gracefully', handles404);

    // 8. Test Performance
    console.log('\n=== 8. PERFORMANCE TESTS ===');
    
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/backoffice/auth/login`);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    logTest('Login page loads within 10 seconds', loadTime < 10000);
    console.log(`   → Load time: ${loadTime}ms`);

  } catch (error) {
    console.log('❌ Test execution error:', error.message);
    results.failed++;
  } finally {
    await browser.close();
  }

  // Print Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);
  
  if (results.issues.length > 0) {
    console.log('\n🔍 ISSUES FOUND:');
    results.issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
  }
  
  console.log('\n📸 Screenshots saved to test-screenshots/ directory');
  
  return results;
}

// Run the test
testBackOfficeFunctionality()
  .then(results => {
    console.log('\n🎉 Test completed!');
    process.exit(results.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });