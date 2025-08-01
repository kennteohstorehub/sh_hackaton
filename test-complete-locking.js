#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs').promises;

async function testCompleteLocking() {
  console.log('\n🧪 Complete Configuration Locking Test\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('📋 TEST SCENARIO: Queue is active, settings should be locked\n');
    
    // 1. Go to dashboard first (to establish session)
    await page.goto('http://localhost:3838/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check current queue status via API
    console.log('1️⃣ Checking queue status via API...');
    const apiResponse = await page.evaluate(async () => {
      const response = await fetch('http://localhost:3838/api/queue/status');
      return await response.json();
    });
    console.log('API Response:', apiResponse);
    
    // 2. Go to settings page
    console.log('\n2️⃣ Opening settings page...');
    await page.goto('http://localhost:3838/dashboard/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // 3. Comprehensive UI check
    console.log('\n3️⃣ Checking UI lock state...');
    
    const lockState = await page.evaluate(() => {
      const banner = document.getElementById('settings-locked-banner');
      const bannerDisplay = window.getComputedStyle(banner).display;
      
      const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
      const disabledInputs = inputs.filter(input => input.disabled);
      
      const sections = Array.from(document.querySelectorAll('.section'));
      const lockedSections = sections.filter(section => section.classList.contains('locked'));
      
      const indicators = Array.from(document.querySelectorAll('.lock-indicator'));
      const visibleIndicators = indicators.filter(ind => window.getComputedStyle(ind).display !== 'none');
      
      const queueNameElement = document.getElementById('active-queue-name');
      const queueName = queueNameElement ? queueNameElement.textContent : 'N/A';
      
      return {
        bannerVisible: bannerDisplay !== 'none',
        queueName: queueName,
        inputs: {
          total: inputs.length,
          disabled: disabledInputs.length
        },
        sections: {
          total: sections.length,
          locked: lockedSections.length
        },
        indicators: {
          total: indicators.length,
          visible: visibleIndicators.length
        }
      };
    });
    
    console.log('Lock State Summary:');
    console.log(`  Banner visible: ${lockState.bannerVisible ? 'YES 🔒' : 'NO'}`);
    console.log(`  Active queue: "${lockState.queueName}"`);
    console.log(`  Disabled inputs: ${lockState.inputs.disabled}/${lockState.inputs.total}`);
    console.log(`  Locked sections: ${lockState.sections.locked}/${lockState.sections.total}`);
    console.log(`  Visible indicators: ${lockState.indicators.visible}/${lockState.indicators.total}`);
    
    // Take screenshot
    await fs.mkdir('test-screenshots', { recursive: true });
    await page.screenshot({ 
      path: 'test-screenshots/complete-lock-test.png',
      fullPage: true 
    });
    
    // 4. Test if forms are actually locked
    console.log('\n4️⃣ Testing form interaction...');
    try {
      const nameInput = await page.$('#restaurantName');
      if (nameInput) {
        const isDisabled = await nameInput.isDisabled();
        console.log(`Restaurant name input disabled: ${isDisabled ? 'YES' : 'NO'}`);
        
        if (!isDisabled) {
          console.log('⚠️  WARNING: Input should be disabled but is not!');
        }
      }
    } catch (error) {
      console.log('Cannot interact with form - properly locked');
    }
    
    // 5. Summary
    console.log('\n📊 TEST SUMMARY:');
    if (apiResponse.hasActiveQueue && lockState.bannerVisible && 
        lockState.inputs.disabled === lockState.inputs.total &&
        lockState.sections.locked === lockState.sections.total) {
      console.log('✅ PASS: Configuration locking is working correctly!');
      console.log('   - Active queue detected');
      console.log('   - Lock banner displayed');
      console.log('   - All inputs disabled');
      console.log('   - All sections locked');
    } else {
      console.log('❌ FAIL: Configuration locking has issues:');
      if (!apiResponse.hasActiveQueue) console.log('   - No active queue detected by API');
      if (!lockState.bannerVisible) console.log('   - Lock banner not visible');
      if (lockState.inputs.disabled < lockState.inputs.total) console.log('   - Some inputs not disabled');
      if (lockState.sections.locked < lockState.sections.total) console.log('   - Some sections not locked');
    }
    
    console.log('\n✅ Test completed. Browser will close in 5 seconds...');
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    await page.screenshot({ 
      path: 'test-screenshots/error-complete-test.png',
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
}

testCompleteLocking().catch(console.error);