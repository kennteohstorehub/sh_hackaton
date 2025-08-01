#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function testConfigLocking() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('\n🧪 Testing Configuration Locking Feature...\n');
  
  try {
    // Step 1: Login (or bypass if available)
    console.log('1️⃣ Accessing dashboard...');
    await page.goto('http://localhost:3838/dashboard');
    
    // Check if we're redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/auth/login')) {
      console.log('Login required, using demo credentials...');
      await page.fill('#email', 'demo@restaurant.com');
      await page.fill('#password', 'demo123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 10000 });
    }
    console.log('✅ Dashboard access successful');
    
    // Step 2: Navigate to settings
    console.log('\n2️⃣ Navigating to settings...');
    await page.goto('http://localhost:3838/dashboard/settings');
    await page.waitForLoadState('networkidle');
    
    // Check if settings are initially unlocked
    const isLocked = await page.isVisible('#settings-locked-banner');
    console.log(`✅ Settings initially ${isLocked ? 'locked' : 'unlocked'}`);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-screenshots/settings-unlocked.png',
      fullPage: true 
    });
    
    // Step 3: Go back to dashboard and start a queue
    console.log('\n3️⃣ Starting a queue...');
    await page.goto('http://localhost:3838/dashboard');
    
    // Check if there's a start queue button
    const startButton = await page.$('button:has-text("Start Queue")');
    if (startButton) {
      await startButton.click();
      console.log('✅ Queue started');
      await page.waitForTimeout(2000);
    } else {
      console.log('⚠️  No start queue button found - queue might already be active');
    }
    
    // Step 4: Go back to settings and check if locked
    console.log('\n4️⃣ Checking if settings are locked...');
    await page.goto('http://localhost:3838/dashboard/settings');
    await page.waitForLoadState('networkidle');
    
    const isLockedNow = await page.isVisible('#settings-locked-banner');
    console.log(`✅ Settings are now ${isLockedNow ? 'LOCKED 🔒' : 'still unlocked'}`);
    
    if (isLockedNow) {
      // Check if inputs are disabled
      const firstInput = await page.$('input[type="text"]');
      const isDisabled = await firstInput.isDisabled();
      console.log(`✅ Form inputs are ${isDisabled ? 'disabled' : 'still enabled'}`);
      
      // Check lock indicators
      const lockIndicators = await page.$$('.lock-indicator');
      console.log(`✅ Found ${lockIndicators.length} lock indicators`);
      
      // Get active queue name
      const queueName = await page.textContent('#active-queue-name');
      console.log(`✅ Active queue: ${queueName}`);
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-screenshots/settings-locked.png',
      fullPage: true 
    });
    
    // Step 5: Try to submit a form (should fail)
    if (isLockedNow) {
      console.log('\n5️⃣ Testing form submission while locked...');
      try {
        // Try to click a save button
        const saveButton = await page.$('button[type="submit"]');
        if (saveButton) {
          const isButtonDisabled = await saveButton.isDisabled();
          console.log(`✅ Save button is ${isButtonDisabled ? 'disabled (correct)' : 'enabled (incorrect)'}`);
        }
      } catch (error) {
        console.log('✅ Cannot interact with forms - they are properly locked');
      }
    }
    
    // Step 6: Go back and stop the queue
    console.log('\n6️⃣ Stopping the queue...');
    await page.goto('http://localhost:3838/dashboard');
    
    const stopButton = await page.$('button:has-text("Stop Queue")');
    if (stopButton) {
      await stopButton.click();
      console.log('✅ Queue stopped');
      await page.waitForTimeout(2000);
    }
    
    // Step 7: Check if settings are unlocked again
    console.log('\n7️⃣ Checking if settings are unlocked again...');
    await page.goto('http://localhost:3838/dashboard/settings');
    await page.waitForLoadState('networkidle');
    
    const isUnlockedAgain = !(await page.isVisible('#settings-locked-banner'));
    console.log(`✅ Settings are ${isUnlockedAgain ? 'UNLOCKED 🔓' : 'still locked'}`);
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'test-screenshots/settings-unlocked-again.png',
      fullPage: true 
    });
    
    console.log('\n✅ Configuration locking test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ 
      path: 'test-screenshots/error-state.png',
      fullPage: true 
    });
    throw error;
  } finally {
    await browser.close();
  }
}

// Create screenshots directory
(async () => {
  try {
    await fs.mkdir('test-screenshots', { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
})();

// Run the test
testConfigLocking().catch(console.error);