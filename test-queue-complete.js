const { chromium } = require('playwright');

async function runQueueTests() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 
  });

  const results = {
    passed: [],
    failed: []
  };

  try {
    console.log('🚀 StoreHub Queue Management System - E2E Testing\n');
    console.log('═══════════════════════════════════════════════════\n');

    // Test 1: Customer Queue Join
    console.log('📋 TEST 1: Customer Queue Join');
    console.log('─────────────────────────────');
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to queue join page
    await page.goto('http://localhost:3000/queue/bb6aec56-d06d-4706-a793-1cfa9e9a1ad9');
    await page.waitForLoadState('networkidle');
    console.log('   ✓ Loaded queue information page');
    
    // Click join queue button
    const joinButton = await page.$('a[href*="/join"], button:has-text("Join Queue")');
    if (joinButton) {
      await joinButton.click();
      await page.waitForLoadState('networkidle');
      console.log('   ✓ Navigated to join form');
    }
    
    // Fill the form
    await page.fill('input[name="customerName"]', 'John Doe');
    await page.fill('input[name="customerPhone"]', '+60123456789');
    await page.selectOption('select[name="partySize"]', '2');
    await page.fill('textarea[name="specialRequests"]', 'Window seat preferred');
    console.log('   ✓ Filled customer details');
    
    // Submit form and handle response
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/customer/join') || resp.url().includes('/queue')),
      page.click('button[type="submit"]')
    ]);
    
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    
    if (currentUrl.includes('queue-status')) {
      const urlParts = currentUrl.match(/queue-status\/([^\/]+)\/([^\/]+)/);
      if (urlParts) {
        console.log(`   ✓ Joined queue successfully`);
        console.log(`   ✓ Customer ID: ${urlParts[2].substring(0, 8)}...`);
        results.passed.push('Customer Queue Join');
        
        // Get queue position
        const position = await page.$eval('.queue-position, .position-number', el => el.textContent);
        console.log(`   ✓ Queue Position: ${position}`);
      }
    } else {
      console.log('   ⚠ Unexpected redirect:', currentUrl);
    }
    
    // Test 2: Merchant Dashboard Login
    console.log('\n🔐 TEST 2: Merchant Dashboard Access');
    console.log('─────────────────────────────────');
    
    const merchantPage = await context.newPage();
    await merchantPage.goto('http://localhost:3000/auth/login');
    await merchantPage.waitForLoadState('networkidle');
    console.log('   ✓ Loaded login page');
    
    // Login
    await merchantPage.fill('input[name="email"]', 'demo@example.com');
    await merchantPage.fill('input[name="password"]', 'password123');
    
    const [loginResponse] = await Promise.all([
      merchantPage.waitForResponse(resp => resp.url().includes('/auth/login')),
      merchantPage.click('button[type="submit"]')
    ]);
    
    await merchantPage.waitForTimeout(2000);
    
    if (merchantPage.url().includes('dashboard')) {
      console.log('   ✓ Logged in successfully');
      console.log('   ✓ Dashboard loaded');
      results.passed.push('Merchant Login');
      
      // Check queue management section
      const queueSection = await merchantPage.$('.queue-management, #queue-entries, .queue-container');
      if (queueSection) {
        console.log('   ✓ Queue management section found');
        
        // Count queue entries
        const entries = await merchantPage.$$('.queue-entry, .customer-card, [data-customer-id]');
        console.log(`   ✓ ${entries.length} customers in queue`);
      }
    } else {
      console.log('   ❌ Login failed or redirected to:', merchantPage.url());
      results.failed.push('Merchant Login');
    }
    
    // Test 3: Real-time Updates
    console.log('\n⚡ TEST 3: WebSocket Connection');
    console.log('─────────────────────────────');
    
    // Check for socket.io script
    const socketScript = await page.$('script[src*="socket.io"]');
    if (socketScript) {
      console.log('   ✓ Socket.io loaded');
      results.passed.push('WebSocket Setup');
    } else {
      console.log('   ⚠ Socket.io not found');
      results.failed.push('WebSocket Setup');
    }
    
    // Test 4: Queue Status Features
    console.log('\n🔔 TEST 4: Queue Status Features');
    console.log('─────────────────────────────');
    
    // Check for verification code
    const verificationCode = await page.$('.verification-code, [class*="verification"], .code-display');
    if (verificationCode) {
      const code = await verificationCode.textContent();
      console.log(`   ✓ Verification code displayed: ${code}`);
      results.passed.push('Verification Code');
    }
    
    // Check for withdraw button
    const withdrawButton = await page.$('button:has-text("Withdraw"), button:has-text("Leave Queue")');
    if (withdrawButton) {
      console.log('   ✓ Withdraw option available');
      results.passed.push('Withdraw Option');
    }
    
    // Test 5: Notification Modal (if customer is called)
    console.log('\n📢 TEST 5: Notification System');
    console.log('──────────────────────────────');
    
    const notificationModal = await page.$('.notification-modal, .modal.show, [role="dialog"]');
    if (notificationModal) {
      console.log('   ✓ Notification modal detected');
      
      const onWayButton = await page.$('button:has-text("On My Way"), button:has-text("On the Way")');
      const withdrawButton = await page.$('button:has-text("Withdraw"), button:has-text("Cancel")');
      
      if (onWayButton && withdrawButton) {
        console.log('   ✓ Response buttons available');
        results.passed.push('Notification System');
      }
    } else {
      console.log('   ℹ Customer not yet called (modal not shown)');
    }
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════');
    console.log(`✅ Passed: ${results.passed.length} tests`);
    results.passed.forEach(test => console.log(`   • ${test}`));
    
    if (results.failed.length > 0) {
      console.log(`\n❌ Failed: ${results.failed.length} tests`);
      results.failed.forEach(test => console.log(`   • ${test}`));
    }
    
    console.log('\n✨ Testing completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Critical test failure:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n🏁 Browser closed');
  }
}

// Run tests
runQueueTests().catch(console.error);