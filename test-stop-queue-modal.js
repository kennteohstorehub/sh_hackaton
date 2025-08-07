const { chromium } = require('playwright');

async function testStopQueueModal() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      console.log('❌ Console Error:', text);
    } else if (type === 'warning' && text.includes('Origin-Agent-Cluster')) {
      console.log('⚠️ Origin-Agent-Cluster Warning:', text);
    }
  });
  
  try {
    console.log('Testing stop queue modal after fixes...\n');
    
    // Login
    await page.goto('http://demo.lvh.me:3838/auth/login');
    await page.waitForLoadState('networkidle');
    
    await page.locator('input[name="email"]').fill('admin@demo.local');
    await page.locator('input[name="password"]').fill('Demo123!@#');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForURL('**/dashboard');
    console.log('✅ Logged in successfully');
    
    // Check if queue is running
    const stopButton = await page.$('button:has-text("Stop Queue")');
    const startButton = await page.$('button:has-text("Start Queue")');
    
    if (startButton) {
      console.log('📍 Queue is stopped, starting it first...');
      await startButton.click();
      await page.waitForTimeout(2000);
      await page.reload();
      await page.waitForLoadState('networkidle');
    }
    
    // Now test stop functionality
    const stopButtonNew = await page.$('button:has-text("Stop Queue")');
    if (stopButtonNew) {
      console.log('\n🔄 Testing STOP functionality...');
      
      // Click stop button
      await stopButtonNew.click();
      
      // Wait for modal
      await page.waitForSelector('.stop-queue-modal, #stopQueueModal', { timeout: 5000 });
      console.log('✅ Stop queue modal appeared');
      
      // Check for console errors
      await page.waitForTimeout(1000);
      
      // Type confirmation
      const confirmInput = await page.$('#stopQueueConfirmInput');
      if (confirmInput) {
        await confirmInput.fill('Yes I want to stop queue');
        console.log('✅ Typed confirmation text');
      }
      
      // Take screenshot of modal
      await page.screenshot({ path: 'screenshots/stop-queue-modal.png' });
      console.log('📸 Modal screenshot saved');
      
      // Click confirm button
      const confirmButton = await page.$('.modal-footer .btn-danger, button:has-text("Stop Queue"):not(.btn-sm)');
      if (confirmButton) {
        await confirmButton.click();
        console.log('✅ Clicked confirm button');
        
        // Wait for response
        await page.waitForTimeout(2000);
        
        // Check if page reloaded
        try {
          await page.waitForLoadState('networkidle', { timeout: 5000 });
          console.log('✅ Page reloaded after stopping queue');
          
          // Check if button changed to Start
          const newStartButton = await page.$('button:has-text("Start Queue")');
          if (newStartButton) {
            console.log('✅ Queue successfully STOPPED - button changed to "Start Queue"');
          }
        } catch (e) {
          console.log('⚠️ Page did not reload - checking for errors');
        }
      }
    } else {
      console.log('❌ Stop Queue button not found');
    }
    
    // Final screenshot
    await page.screenshot({ path: 'screenshots/queue-stopped-final.png' });
    console.log('\n📸 Final screenshot saved: queue-stopped-final.png');
    
  } catch (error) {
    console.error('\n❌ Test Error:', error);
    await page.screenshot({ path: 'screenshots/stop-queue-error.png' });
  } finally {
    await browser.close();
  }
}

testStopQueueModal();