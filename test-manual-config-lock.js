#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs').promises;

async function testManually() {
  console.log('\n🧪 Manual Configuration Lock Test\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000  // Slow down to see what's happening
  });
  
  const page = await browser.newPage();
  
  try {
    // 1. Go to dashboard
    console.log('1️⃣ Opening dashboard...');
    await page.goto('http://localhost:3838/dashboard');
    await page.waitForLoadState('networkidle');
    console.log('Dashboard loaded. Please check the browser.');
    
    // 2. Check if there's an active queue
    const hasStartButton = await page.isVisible('button:has-text("Start Queue")');
    const hasStopButton = await page.isVisible('button:has-text("Stop Queue")');
    
    console.log(`Queue status: ${hasStopButton ? 'Active' : 'Inactive'}`);
    
    // 3. Go to settings
    console.log('\n2️⃣ Opening settings page...');
    await page.goto('http://localhost:3838/dashboard/settings');
    await page.waitForLoadState('networkidle');
    
    // 4. Check if locked banner is visible
    const isLocked = await page.isVisible('#settings-locked-banner');
    console.log(`Settings are: ${isLocked ? 'LOCKED 🔒' : 'UNLOCKED 🔓'}`);
    
    // Take screenshot
    await fs.mkdir('test-screenshots', { recursive: true });
    await page.screenshot({ 
      path: `test-screenshots/settings-${isLocked ? 'locked' : 'unlocked'}.png`,
      fullPage: true 
    });
    
    if (!isLocked && hasStartButton) {
      console.log('\n3️⃣ Starting queue to test locking...');
      await page.goto('http://localhost:3838/dashboard');
      await page.click('button:has-text("Start Queue")');
      await page.waitForTimeout(2000);
      
      // Go back to settings
      await page.goto('http://localhost:3838/dashboard/settings');
      await page.waitForLoadState('networkidle');
      
      const isLockedNow = await page.isVisible('#settings-locked-banner');
      console.log(`After starting queue - Settings are: ${isLockedNow ? 'LOCKED 🔒' : 'UNLOCKED 🔓'}`);
      
      await page.screenshot({ 
        path: 'test-screenshots/settings-after-start.png',
        fullPage: true 
      });
    }
    
    console.log('\n✅ Test completed. Check screenshots in test-screenshots folder.');
    console.log('Keep browser open to inspect manually...');
    
    // Keep browser open for manual inspection
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testManually().catch(console.error);