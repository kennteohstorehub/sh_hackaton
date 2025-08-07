const { chromium } = require('playwright');

async function testQueueToggle() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Console Error:', msg.text());
    }
  });
  
  // Capture network errors
  page.on('response', response => {
    if (!response.ok() && response.url().includes('api')) {
      console.log(`❌ API Error: ${response.status()} ${response.url()}`);
    }
  });
  
  try {
    console.log('Testing queue toggle functionality after fix...\n');
    
    // Login as demo merchant
    await page.goto('http://demo.lvh.me:3838/auth/login');
    await page.waitForLoadState('networkidle');
    
    await page.locator('input[name="email"]').fill('admin@demo.local');
    await page.locator('input[name="password"]').fill('Demo123!@#');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForURL('**/dashboard');
    console.log('✅ Logged in successfully');
    
    // Check initial state
    const startButton = await page.$('button:has-text("Start Queue")');
    const stopButton = await page.$('button:has-text("Stop Queue")');
    
    if (startButton) {
      console.log('\n📍 Initial state: Queue is STOPPED');
      console.log('🔄 Testing START functionality...');
      
      // Check if StoreHubDS is available
      const hasStoreHubDS = await page.evaluate(() => typeof window.StoreHubDS !== 'undefined');
      console.log('StoreHubDS available:', hasStoreHubDS);
      
      // Click start button
      await startButton.click();
      
      // Wait a bit for the API call
      await page.waitForTimeout(2000);
      
      // Check for any errors or check if page is reloading
      try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
        console.log('✅ Page reloaded after API call');
      } catch (e) {
        console.log('⚠️ Page did not reload - checking for errors');
        
        // Check if there's a toast or any error
        const toastExists = await page.$('.storehub-toast');
        if (toastExists) {
          const toastText = await toastExists.textContent();
          console.log('Toast message:', toastText);
        }
      }
      
      // Check if button changed to Stop
      const newStopButton = await page.$('button:has-text("Stop Queue")');
      if (newStopButton) {
        console.log('✅ Queue successfully STARTED - button changed to "Stop Queue"');
        
        // Take screenshot
        await page.screenshot({ path: 'screenshots/queue-started.png' });
        console.log('📸 Screenshot saved: queue-started.png');
      } else {
        console.log('❌ Failed to start queue - button did not change');
      }
      
    } else if (stopButton) {
      console.log('\n📍 Initial state: Queue is RUNNING');
      console.log('🔄 Testing STOP functionality...');
      
      // Click stop button
      await stopButton.click();
      
      // Wait for modal
      await page.waitForSelector('.stop-queue-modal', { timeout: 5000 });
      console.log('✅ Stop queue modal appeared');
      
      // Type confirmation
      await page.fill('#stopQueueConfirmInput', 'Yes I want to stop queue');
      
      // Click confirm
      await page.click('.modal-footer .btn-danger');
      
      // Wait for toast
      await page.waitForSelector('.storehub-toast', { timeout: 5000 });
      const toastText = await page.locator('.storehub-toast').textContent();
      console.log('✅ Toast notification:', toastText);
      
      // Wait for page reload
      await page.waitForLoadState('networkidle');
      
      // Check if button changed to Start
      const newStartButton = await page.$('button:has-text("Start Queue")');
      if (newStartButton) {
        console.log('✅ Queue successfully STOPPED - button changed to "Start Queue"');
        
        // Take screenshot
        await page.screenshot({ path: 'screenshots/queue-stopped.png' });
        console.log('📸 Screenshot saved: queue-stopped.png');
      } else {
        console.log('❌ Failed to stop queue - button did not change');
      }
    } else {
      console.log('❌ Neither Start nor Stop button found');
    }
    
    // Test the API directly to verify it works
    console.log('\n🔧 Testing API directly...');
    
    // Get cookies for authentication
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'qms_session');
    const csrfToken = await page.locator('meta[name="csrf-token"]').getAttribute('content');
    
    if (sessionCookie && csrfToken) {
      console.log('✅ Got authentication tokens');
      
      // You could test the API directly here using fetch/axios with the cookies
      console.log('✅ API authentication ready for direct testing');
    }
    
  } catch (error) {
    console.error('\n❌ Error during test:', error);
    
    // Take error screenshot
    await page.screenshot({ path: 'screenshots/queue-toggle-error.png' });
    console.log('📸 Error screenshot saved: queue-toggle-error.png');
  } finally {
    await browser.close();
  }
}

testQueueToggle();