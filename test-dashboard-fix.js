const { chromium } = require('playwright');

async function testDashboardFix() {
  console.log('🧪 Testing Dashboard Fix...');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });
  
  try {
    const page = await browser.newPage();
    
    // Login
    await page.goto('http://localhost:3838/auth/login');
    await page.fill('input[name="email"]', 'demo@smartqueue.com');
    await page.fill('input[name="password"]', 'demo123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');
    
    // Take screenshot
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: '/Users/kennteoh/Documents/e2e-screenshots/dashboard-fixed.png',
      fullPage: true 
    });
    
    console.log('✅ Dashboard loaded successfully');
    console.log('📸 Screenshot saved to: /Users/kennteoh/Documents/e2e-screenshots/dashboard-fixed.png');
    
    // Check if queue section exists
    const queueSection = await page.locator('.queue-section, .no-queue-section').first();
    if (await queueSection.count() > 0) {
      console.log('✅ Queue section is now visible!');
      const text = await queueSection.textContent();
      console.log('📋 Queue section content:', text.substring(0, 100) + '...');
    } else {
      console.log('❌ Queue section still missing');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

testDashboardFix();