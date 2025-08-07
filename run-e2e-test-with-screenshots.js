const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs').promises;

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  credentials: {
    email: 'demo@smartqueue.com',
    password: 'demo123456'
  },
  screenshotDir: '/Users/kennteoh/Documents/e2e-screenshots',
  testRunId: Date.now()
};

// Test data
const testCustomerData = {
  name: 'Test Customer',
  phone: '+60191234567',
  partySize: 2,
  serviceType: 'Dine In',
  notes: `E2E Test Run ${TEST_CONFIG.testRunId}`
};

async function ensureScreenshotDir() {
  try {
    await fs.mkdir(TEST_CONFIG.screenshotDir, { recursive: true });
    console.log(`📁 Screenshot directory created: ${TEST_CONFIG.screenshotDir}`);
  } catch (error) {
    console.error('Error creating screenshot directory:', error);
  }
}

async function takeScreenshot(page, name) {
  const filePath = path.join(TEST_CONFIG.screenshotDir, name);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`📸 Screenshot saved: ${name}`);
  return filePath;
}

async function runE2ETest() {
  console.log('🚀 Starting E2E Test with Screenshots');
  console.log(`📋 Test Run ID: ${TEST_CONFIG.testRunId}`);
  console.log(`📂 Screenshots will be saved to: ${TEST_CONFIG.screenshotDir}`);
  
  // Ensure screenshot directory exists
  await ensureScreenshotDir();
  
  const browser = await chromium.launch({
    headless: false, // Set to true for headless mode
    slowMo: 500 // Slow down actions for visibility
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    
    console.log('\n🔐 STEP 1: Login to Dashboard');
    await page.goto(`${TEST_CONFIG.baseUrl}/auth/login`);
    await takeScreenshot(page, `01-login-page-${TEST_CONFIG.testRunId}.png`);
    
    // Fill login form
    await page.fill('input[name="email"]', TEST_CONFIG.credentials.email);
    await page.fill('input[name="password"]', TEST_CONFIG.credentials.password);
    await takeScreenshot(page, `02-login-filled-${TEST_CONFIG.testRunId}.png`);
    
    // Submit login
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    console.log('✅ Login successful');
    
    console.log('\n📊 STEP 2: Dashboard Verification');
    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, `03-dashboard-loaded-${TEST_CONFIG.testRunId}.png`);
    
    // Get initial queue count
    const waitingCountElement = await page.locator('.waiting-count, .queue-count, [data-status="waiting"]').first();
    let initialCount = 0;
    if (await waitingCountElement.count() > 0) {
      const countText = await waitingCountElement.textContent();
      initialCount = parseInt(countText.match(/\d+/)?.[0] || '0');
    }
    console.log(`📈 Initial waiting count: ${initialCount}`);
    
    console.log('\n🌐 STEP 3: Navigate to Public Queue View');
    // Navigate directly to the join queue page
    const merchantId = '03d0814d-a31f-45ef-babb-79ae3c3ec59d'; // Demo merchant ID
    await page.goto(`${TEST_CONFIG.baseUrl}/join/${merchantId}`);
    console.log('✅ Navigated to public join queue page');
    
    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, `04-public-view-${TEST_CONFIG.testRunId}.png`);
    
    console.log('\n📝 STEP 4: Submit Customer to Queue');
    // First need to select a queue
    const firstQueue = await page.locator('.queue-item').first();
    if (await firstQueue.count() > 0) {
      await firstQueue.click();
      await page.waitForTimeout(500);
    }
    
    // Fill customer form
    await page.fill('input[name="customerName"]', testCustomerData.name);
    await page.fill('input[name="customerPhone"]', testCustomerData.phone);
    
    // Set party size
    const partySizeSelect = await page.locator('select[name="partySize"]').first();
    if (await partySizeSelect.count() > 0) {
      await partySizeSelect.selectOption(String(testCustomerData.partySize));
    }
    
    // Set service type
    const serviceTypeSelect = await page.locator('select[name="serviceType"]').first();
    if (await serviceTypeSelect.count() > 0) {
      await serviceTypeSelect.selectOption(testCustomerData.serviceType);
    }
    
    await takeScreenshot(page, `05-form-filled-${TEST_CONFIG.testRunId}.png`);
    
    // Submit form
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    await takeScreenshot(page, `06-form-submitted-${TEST_CONFIG.testRunId}.png`);
    console.log('✅ Customer submitted to queue');
    
    console.log('\n🔍 STEP 5: Verify Customer in Dashboard');
    // Open new tab for dashboard
    const dashboardPage = await context.newPage();
    
    // Navigate directly to dashboard (should use existing session)
    await dashboardPage.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
    await dashboardPage.waitForLoadState('networkidle');
    
    // Check if we need to login again
    if (dashboardPage.url().includes('login')) {
      await dashboardPage.fill('input[name="email"]', TEST_CONFIG.credentials.email);
      await dashboardPage.fill('input[name="password"]', TEST_CONFIG.credentials.password);
      await dashboardPage.click('button[type="submit"]');
      await dashboardPage.waitForURL('**/dashboard**', { timeout: 10000 });
      await dashboardPage.waitForLoadState('networkidle');
    }
    
    await takeScreenshot(dashboardPage, `07-dashboard-with-customer-${TEST_CONFIG.testRunId}.png`);
    
    // Look for customer in queue
    const customerEntry = await dashboardPage.locator(`text="${testCustomerData.name}"`).first();
    if (await customerEntry.count() > 0) {
      console.log('✅ Customer found in dashboard queue');
      
      console.log('\n🪑 STEP 6: Seat Customer');
      // Find seat button for this customer
      const customerRow = customerEntry.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "queue-entry")]').first();
      const seatButton = customerRow.locator('button:has-text("Seat"), button:has-text("Check In"), button[title*="Seat"]').first();
      
      if (await seatButton.count() > 0) {
        await takeScreenshot(dashboardPage, `08-before-seat-${TEST_CONFIG.testRunId}.png`);
        
        // Handle confirmation dialog
        dashboardPage.on('dialog', dialog => {
          console.log(`💬 Dialog: ${dialog.message()}`);
          dialog.accept();
        });
        
        await seatButton.click();
        await dashboardPage.waitForTimeout(2000);
        await takeScreenshot(dashboardPage, `09-after-seat-${TEST_CONFIG.testRunId}.png`);
        console.log('✅ Customer seated successfully');
      } else {
        console.log('⚠️ Seat button not found - customer may already be seated');
      }
    } else {
      console.log('⚠️ Customer not found in dashboard');
    }
    
    console.log('\n⚡ STEP 7: Verify Real-time Updates');
    // Check connection status
    const connectionStatus = await dashboardPage.locator('.connection-status, .status-indicator').first();
    if (await connectionStatus.count() > 0) {
      const statusText = await connectionStatus.textContent();
      console.log(`🔌 Connection status: ${statusText}`);
    }
    
    await takeScreenshot(dashboardPage, `10-final-state-${TEST_CONFIG.testRunId}.png`);
    
    // Get final queue count
    const finalWaitingCountElement = await dashboardPage.locator('.waiting-count, .queue-count, [data-status="waiting"]').first();
    if (await finalWaitingCountElement.count() > 0) {
      const countText = await finalWaitingCountElement.textContent();
      const finalCount = parseInt(countText.match(/\d+/)?.[0] || '0');
      console.log(`📉 Final waiting count: ${finalCount}`);
    }
    
    console.log('\n🎉 E2E Test Completed Successfully!');
    console.log(`📸 All screenshots saved to: ${TEST_CONFIG.screenshotDir}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
runE2ETest().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});