const { chromium } = require('playwright');

async function testJoinQueueFix() {
  console.log('🧪 Testing Join Queue Fix...');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate directly to join queue page
    const merchantId = '03d0814d-a31f-45ef-babb-79ae3c3ec59d';
    await page.goto(`http://localhost:3838/join/${merchantId}`);
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({ 
      path: '/Users/kennteoh/Documents/e2e-screenshots/join-queue-fixed.png',
      fullPage: true 
    });
    
    console.log('✅ Join queue page loaded');
    console.log('📸 Screenshot saved to: /Users/kennteoh/Documents/e2e-screenshots/join-queue-fixed.png');
    
    // Check if queue selection is visible
    const queueSelection = await page.locator('.queue-list').first();
    const queueStatsDisplay = await page.locator('.queue-stats-display').first();
    
    if (await queueSelection.count() > 0) {
      console.log('❌ Queue selection still visible (should be hidden for single queue)');
    } else if (await queueStatsDisplay.count() > 0) {
      console.log('✅ Queue stats display shown (correct for single queue)');
      const statsText = await queueStatsDisplay.textContent();
      console.log('📊 Queue info:', statsText.substring(0, 100) + '...');
    }
    
    // Check if form is already visible
    const joinForm = await page.locator('#joinForm').first();
    const hasActiveClass = await joinForm.evaluate(el => el.classList.contains('active'));
    console.log('📝 Join form active:', hasActiveClass);
    
    // Check if queue is pre-selected
    const selectedQueueName = await page.locator('#selectedQueueName').textContent();
    console.log('✅ Pre-selected queue:', selectedQueueName || 'None');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

testJoinQueueFix();