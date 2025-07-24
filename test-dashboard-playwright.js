const { chromium } = require('playwright');

async function testDashboard() {
  console.log('🧪 COMPREHENSIVE DASHBOARD TEST');
  console.log('=' .repeat(60));
  console.log('Testing Queue Management System after login fix');
  console.log('=' .repeat(60));
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  
  const results = {
    login: false,
    dashboard: false,
    navigation: false,
    queueCreation: false,
    queueManagement: false,
    errors: []
  };
  
  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      ignoreHTTPSErrors: true
    });
    
    const page = await context.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[Browser Error]:`, msg.text());
        results.errors.push(msg.text());
      }
    });
    
    // Step 1: Login
    console.log('\n1️⃣ Testing Login...');
    await page.goto('https://queuemanagement-vtc2.onrender.com/auth/login', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    await page.fill('input[name="email"]', 'demo@smartqueue.com');
    await page.fill('input[name="password"]', 'demo123456');
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"]')
    ]);
    
    const afterLoginUrl = page.url();
    if (afterLoginUrl.includes('dashboard')) {
      console.log('   ✅ Login successful - redirected to dashboard');
      results.login = true;
    } else {
      console.log('   ❌ Login failed - URL:', afterLoginUrl);
      return results;
    }
    
    // Step 2: Dashboard Access
    console.log('\n2️⃣ Testing Dashboard Access...');
    await page.waitForTimeout(2000); // Wait for dashboard to fully load
    
    // Check for key dashboard elements
    const dashboardElements = {
      title: await page.locator('h1, h2').first().textContent().catch(() => null),
      welcomeMessage: await page.locator('text=/Welcome|Dashboard/i').count(),
      navigation: await page.locator('nav, .navigation, .sidebar').count(),
      queueSection: await page.locator('text=/Queue|Queues/i').count()
    };
    
    console.log('   Dashboard elements found:');
    console.log('   - Title:', dashboardElements.title);
    console.log('   - Welcome/Dashboard text:', dashboardElements.welcomeMessage > 0 ? '✅' : '❌');
    console.log('   - Navigation:', dashboardElements.navigation > 0 ? '✅' : '❌');
    console.log('   - Queue section:', dashboardElements.queueSection > 0 ? '✅' : '❌');
    
    results.dashboard = dashboardElements.welcomeMessage > 0 || dashboardElements.title?.includes('Dashboard');
    
    // Take screenshot of dashboard
    await page.screenshot({ path: 'dashboard-loaded.png', fullPage: true });
    console.log('   📸 Screenshot saved: dashboard-loaded.png');
    
    // Step 3: Test Navigation
    console.log('\n3️⃣ Testing Navigation...');
    
    // Look for navigation links
    const navLinks = await page.locator('a').all();
    console.log(`   Found ${navLinks.length} navigation links`);
    
    // Try to find and click Queue Management link
    const queueLink = await page.locator('a:has-text("Queue"), a:has-text("Queues"), a[href*="queue"]').first();
    if (await queueLink.count() > 0) {
      console.log('   Found queue management link, clicking...');
      await queueLink.click();
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      console.log('   Current URL:', currentUrl);
      results.navigation = true;
    } else {
      console.log('   ⚠️  No queue management link found');
    }
    
    // Step 4: Test Queue Creation
    console.log('\n4️⃣ Testing Queue Creation...');
    
    // Look for "Create Queue" or "Add Queue" button
    const createButton = await page.locator('button:has-text("Create"), button:has-text("Add"), a:has-text("Create"), a:has-text("Add")').first();
    if (await createButton.count() > 0) {
      console.log('   Found create button, clicking...');
      await createButton.click();
      await page.waitForTimeout(2000);
      
      // Check if a form or modal appeared
      const formElements = await page.locator('form, [role="dialog"], .modal').count();
      if (formElements > 0) {
        console.log('   ✅ Queue creation form/modal appeared');
        results.queueCreation = true;
        
        // Take screenshot
        await page.screenshot({ path: 'queue-create-form.png' });
        console.log('   📸 Screenshot saved: queue-create-form.png');
      }
    } else {
      console.log('   ⚠️  No create queue button found');
    }
    
    // Step 5: Check for existing queues
    console.log('\n5️⃣ Checking for Existing Queues...');
    
    // Navigate back to queue list if needed
    await page.goto('https://queuemanagement-vtc2.onrender.com/dashboard', {
      waitUntil: 'networkidle'
    });
    
    // Look for queue items
    const queueItems = await page.locator('.queue-item, .queue-card, [data-queue], tr[data-queue-id]').count();
    console.log(`   Found ${queueItems} queue items`);
    
    if (queueItems > 0) {
      console.log('   ✅ Existing queues displayed');
      results.queueManagement = true;
    } else {
      // Check for empty state message
      const emptyState = await page.locator('text=/No queues|empty|create.*first/i').count();
      if (emptyState > 0) {
        console.log('   ℹ️  No queues exist yet (empty state shown)');
        results.queueManagement = true; // Empty state is valid
      }
    }
    
    // Step 6: Test Session Persistence
    console.log('\n6️⃣ Testing Session Persistence...');
    
    // Reload page
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const urlAfterReload = page.url();
    if (urlAfterReload.includes('dashboard') && !urlAfterReload.includes('login')) {
      console.log('   ✅ Session persisted after reload');
    } else {
      console.log('   ❌ Session lost after reload - redirected to:', urlAfterReload);
    }
    
    // Final screenshot
    await page.screenshot({ path: 'final-state.png', fullPage: true });
    console.log('\n📸 Final screenshot saved: final-state.png');
    
    return results;
    
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    results.errors.push(error.message);
    return results;
  } finally {
    await browser.close();
  }
}

// Run test and report results
testDashboard()
  .then(results => {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('=' .repeat(60));
    
    console.log(`✅ Login: ${results.login ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ Dashboard Access: ${results.dashboard ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ Navigation: ${results.navigation ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ Queue Creation: ${results.queueCreation ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ Queue Management: ${results.queueManagement ? 'PASSED' : 'FAILED'}`);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      results.errors.forEach(err => console.log('  -', err));
    }
    
    const allPassed = Object.values(results)
      .filter(v => typeof v === 'boolean')
      .every(v => v === true);
    
    if (allPassed) {
      console.log('\n🎉 ALL TESTS PASSED! The Queue Management System is fully functional!');
    } else {
      console.log('\n⚠️  Some tests failed. Check the screenshots for more details.');
    }
    
    process.exit(allPassed ? 0 : 1);
  })
  .catch(console.error);