const { chromium } = require('playwright');

async function testSettingsDebug() {
  console.log('🧪 Debug Testing Settings Page...');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000,
    devtools: true  // Open DevTools
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture all console messages
    page.on('console', msg => {
      console.log(`[${msg.type()}] ${msg.text()}`);
    });
    
    // Capture all errors
    page.on('pageerror', error => {
      console.log('❌ Page Error:', error.message);
    });
    
    // Monitor all network requests
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log('📤 API Request:', request.method(), request.url());
        if (request.method() === 'PUT' || request.method() === 'POST') {
          console.log('   Body:', request.postData());
        }
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log('📥 API Response:', response.status(), response.url());
      }
    });
    
    // Login
    console.log('\n1️⃣ Logging in...');
    await page.goto('http://localhost:3838/auth/login');
    await page.fill('input[name="email"]', 'demo@smartqueue.com');
    await page.fill('input[name="password"]', 'demo123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');
    
    // Navigate to settings
    console.log('\n2️⃣ Navigating to settings...');
    await page.click('a[href="/dashboard/settings"]');
    await page.waitForLoadState('networkidle');
    
    // Check if JavaScript loaded correctly
    console.log('\n3️⃣ Checking JavaScript state...');
    const hasRestaurantForm = await page.evaluate(() => {
      const form = document.getElementById('restaurantForm');
      console.log('Form found:', !!form);
      if (form) {
        // Check if event listener is attached
        const listeners = getEventListeners ? getEventListeners(form) : null;
        console.log('Event listeners:', listeners);
      }
      return !!form;
    });
    
    console.log('Restaurant form exists:', hasRestaurantForm);
    
    // Try to submit form manually via JavaScript
    console.log('\n4️⃣ Attempting form submission via JavaScript...');
    await page.evaluate(() => {
      const form = document.getElementById('restaurantForm');
      if (form) {
        // Create a submit event
        const event = new Event('submit', {
          bubbles: true,
          cancelable: true
        });
        form.dispatchEvent(event);
        console.log('Submit event dispatched');
      }
    });
    
    // Wait a bit to see what happens
    await page.waitForTimeout(5000);
    
    console.log('\n5️⃣ Test complete. Check console output above for details.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    console.log('\n⏸️ Browser will stay open. Close manually when done.');
    // Don't close browser to allow manual inspection
  }
}

testSettingsDebug();