#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs').promises;

async function testUnlockBehavior() {
  console.log('\n🧪 Testing Configuration Unlock Behavior\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500
  });
  
  const page = await browser.newPage();
  
  try {
    // 1. Go to dashboard and stop the queue
    console.log('1️⃣ Going to dashboard to stop the queue...');
    await page.goto('http://localhost:3838/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Look for stop queue button
    const stopButton = await page.$('button:has-text("Stop Queue")');
    if (stopButton) {
      console.log('Found "Stop Queue" button, clicking...');
      await stopButton.click();
      await page.waitForTimeout(2000);
      console.log('Queue stopped');
    } else {
      console.log('No "Stop Queue" button found - queue might already be stopped');
    }
    
    // 2. Go to settings and check if unlocked
    console.log('\n2️⃣ Checking settings page after stopping queue...');
    await page.goto('http://localhost:3838/dashboard/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Check if locked banner is hidden
    const bannerVisible = await page.evaluate(() => {
      const banner = document.getElementById('settings-locked-banner');
      return banner && window.getComputedStyle(banner).display !== 'none';
    });
    
    console.log(`Locked banner visible: ${bannerVisible ? 'YES (still locked)' : 'NO (unlocked!) 🔓'}`);
    
    // Check if inputs are enabled
    const firstInput = await page.$('input[type="text"]');
    if (firstInput) {
      const isDisabled = await firstInput.isDisabled();
      console.log(`Form inputs disabled: ${isDisabled ? 'YES (still locked)' : 'NO (unlocked!)'}`);
    }
    
    // Check lock indicators
    const lockIndicatorsVisible = await page.evaluate(() => {
      const indicators = document.querySelectorAll('.lock-indicator');
      let visibleCount = 0;
      indicators.forEach(indicator => {
        if (window.getComputedStyle(indicator).display !== 'none') {
          visibleCount++;
        }
      });
      return { total: indicators.length, visible: visibleCount };
    });
    
    console.log(`Lock indicators visible: ${lockIndicatorsVisible.visible}/${lockIndicatorsVisible.total}`);
    
    // Take screenshot
    await fs.mkdir('test-screenshots', { recursive: true });
    await page.screenshot({ 
      path: 'test-screenshots/settings-unlocked-test.png',
      fullPage: true 
    });
    
    // 3. Try to save a form to confirm it works
    if (!bannerVisible) {
      console.log('\n3️⃣ Testing form submission (should work now)...');
      
      // Try to change restaurant name
      const nameInput = await page.$('#restaurantName');
      if (nameInput) {
        await nameInput.fill('Test Restaurant - Updated!');
        
        // Find and click save button
        const saveButton = await page.$('button:has-text("Save Restaurant Information")');
        if (saveButton) {
          await saveButton.click();
          await page.waitForTimeout(2000);
          
          // Check for success message
          const successMessage = await page.$('.alert-success');
          if (successMessage) {
            console.log('✅ Form submission successful!');
          } else {
            console.log('⚠️  No success message found');
          }
        }
      }
    }
    
    console.log('\n✅ Unlock test completed. Check test-screenshots/settings-unlocked-test.png');
    console.log('Browser will remain open for 10 seconds for inspection...');
    
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ 
      path: 'test-screenshots/error-unlock-test.png',
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
}

testUnlockBehavior().catch(console.error);