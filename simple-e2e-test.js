const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs').promises;

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  credentials: {
    email: 'demo@smartqueue.com',
    password: 'demo123456'
  },
  screenshotDir: '/Users/kennteoh/Documents/e2e-screenshots',
  testRunId: Date.now()
};

async function ensureScreenshotDir() {
  try {
    await fs.mkdir(TEST_CONFIG.screenshotDir, { recursive: true });
  } catch (error) {
    console.error('Error creating screenshot directory:', error);
  }
}

async function takeScreenshot(page, name) {
  const filePath = path.join(TEST_CONFIG.screenshotDir, name);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`📸 Screenshot saved: ${name}`);
}

async function runSimpleE2ETest() {
  console.log('🚀 Starting Simple E2E Test');
  console.log(`📋 Test Run ID: ${TEST_CONFIG.testRunId}`);
  console.log(`📂 Screenshots will be saved to: ${TEST_CONFIG.screenshotDir}`);
  
  await ensureScreenshotDir();
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000
  });
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // STEP 1: Login
    console.log('\n🔐 STEP 1: Login');
    await page.goto(`${TEST_CONFIG.baseUrl}/auth/login`);
    await takeScreenshot(page, `01-login-${TEST_CONFIG.testRunId}.png`);
    
    await page.fill('input[name="email"]', TEST_CONFIG.credentials.email);
    await page.fill('input[name="password"]', TEST_CONFIG.credentials.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');
    console.log('✅ Login successful');
    
    // STEP 2: Dashboard
    console.log('\n📊 STEP 2: Dashboard');
    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, `02-dashboard-${TEST_CONFIG.testRunId}.png`);
    
    // STEP 3: Navigate to Public Queue
    console.log('\n🌐 STEP 3: Public Queue');
    const merchantId = '03d0814d-a31f-45ef-babb-79ae3c3ec59d';
    await page.goto(`${TEST_CONFIG.baseUrl}/join/${merchantId}`);
    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, `03-public-queue-${TEST_CONFIG.testRunId}.png`);
    
    // STEP 4: Join Queue
    console.log('\n📝 STEP 4: Join Queue');
    // Click on the queue
    await page.click('.queue-item');
    await page.waitForTimeout(500);
    
    // Fill form
    await page.fill('input[name="customerName"]', 'Test Customer');
    await page.fill('input[name="customerPhone"]', '+60191234567');
    await page.selectOption('select[name="partySize"]', '2');
    await takeScreenshot(page, `04-form-filled-${TEST_CONFIG.testRunId}.png`);
    
    // Submit
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await takeScreenshot(page, `05-after-submit-${TEST_CONFIG.testRunId}.png`);
    console.log('✅ Customer joined queue');
    
    // STEP 5: Go back to dashboard
    console.log('\n🔍 STEP 5: Check Dashboard');
    await page.goto(`${TEST_CONFIG.baseUrl}/dashboard`);
    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, `06-dashboard-updated-${TEST_CONFIG.testRunId}.png`);
    
    // STEP 6: Seat Customer
    console.log('\n🪑 STEP 6: Seat Customer');
    const seatButton = await page.locator('button:has-text("Seat"), button[title*="Seat"]').first();
    if (await seatButton.count() > 0) {
      page.on('dialog', dialog => dialog.accept());
      await seatButton.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, `07-seated-${TEST_CONFIG.testRunId}.png`);
      console.log('✅ Customer seated');
    } else {
      console.log('⚠️ No seat button found');
    }
    
    console.log('\n🎉 E2E Test Completed!');
    console.log(`📸 All screenshots saved to: ${TEST_CONFIG.screenshotDir}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

runSimpleE2ETest().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});