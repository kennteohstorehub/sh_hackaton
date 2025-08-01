#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs').promises;

async function testUILocking() {
  console.log('\n🧪 Testing Configuration Locking UI\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500
  });
  
  const page = await browser.newPage();
  
  try {
    // 1. Open settings page directly
    console.log('1️⃣ Opening settings page...');
    await page.goto('http://localhost:3838/dashboard/settings');
    await page.waitForLoadState('networkidle');
    
    // Wait for potential JS to execute
    await page.waitForTimeout(2000);
    
    // 2. Check if locked banner is visible
    const bannerVisible = await page.evaluate(() => {
      const banner = document.getElementById('settings-locked-banner');
      return banner && window.getComputedStyle(banner).display !== 'none';
    });
    
    console.log(`Locked banner visible: ${bannerVisible ? 'YES 🔒' : 'NO'}`);
    
    // 3. Check if inputs are disabled
    const firstInput = await page.$('input[type="text"]');
    if (firstInput) {
      const isDisabled = await firstInput.isDisabled();
      console.log(`Form inputs disabled: ${isDisabled ? 'YES' : 'NO'}`);
    }
    
    // 4. Check if lock indicators are visible
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
    
    console.log(`Lock indicators: ${lockIndicatorsVisible.visible}/${lockIndicatorsVisible.total} visible`);
    
    // 5. Check if sections have locked class
    const lockedSections = await page.evaluate(() => {
      const sections = document.querySelectorAll('.section');
      let lockedCount = 0;
      sections.forEach(section => {
        if (section.classList.contains('locked')) {
          lockedCount++;
        }
      });
      return { total: sections.length, locked: lockedCount };
    });
    
    console.log(`Locked sections: ${lockedSections.locked}/${lockedSections.total} locked`);
    
    // Take screenshot
    await fs.mkdir('test-screenshots', { recursive: true });
    await page.screenshot({ 
      path: 'test-screenshots/settings-ui-test.png',
      fullPage: true 
    });
    
    // Get console logs
    page.on('console', msg => console.log('Browser console:', msg.type(), msg.text()));
    
    // Check active queue name if banner is visible
    if (bannerVisible) {
      const queueName = await page.textContent('#active-queue-name');
      console.log(`Active queue name: "${queueName}"`);
    }
    
    console.log('\n✅ UI test completed. Check test-screenshots/settings-ui-test.png');
    console.log('Browser will remain open for 10 seconds for inspection...');
    
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ 
      path: 'test-screenshots/error-ui-test.png',
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
}

testUILocking().catch(console.error);