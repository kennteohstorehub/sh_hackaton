const { chromium } = require('playwright');

async function testSettingsFinal() {
  console.log('🧪 Final Settings Test...\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000
  });
  
  try {
    const page = await browser.newPage();
    
    // Login
    console.log('1️⃣ Logging in...');
    await page.goto('http://localhost:3838/auth/login');
    await page.fill('input[name="email"]', 'demo@smartqueue.com');
    await page.fill('input[name="password"]', 'demo123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');
    console.log('✅ Logged in');
    
    // Go to settings
    console.log('\n2️⃣ Going to settings page...');
    await page.goto('http://localhost:3838/dashboard/settings');
    await page.waitForLoadState('networkidle');
    
    // Check if page loaded correctly
    const pageTitle = await page.title();
    console.log('📄 Page title:', pageTitle);
    
    // Check for CSRF token
    const csrfToken = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="csrf-token"]');
      return meta ? meta.getAttribute('content') : null;
    });
    console.log('🔑 CSRF Token:', csrfToken || 'NOT FOUND');
    
    // Check if form exists
    const formExists = await page.evaluate(() => {
      return !!document.getElementById('restaurantForm');
    });
    console.log('📝 Restaurant form exists:', formExists);
    
    if (!formExists) {
      console.log('❌ Form not found. Taking screenshot...');
      await page.screenshot({ 
        path: '/Users/kennteoh/Documents/e2e-screenshots/settings-no-form.png',
        fullPage: true 
      });
      return;
    }
    
    // Fill form
    console.log('\n3️⃣ Filling form...');
    await page.fill('#restaurantName', 'Final Test Restaurant');
    await page.fill('#restaurantPhone', '+60177777777');
    
    // Monitor network
    let requestMade = false;
    page.on('request', request => {
      if (request.url().includes('/api/merchant/profile') && request.method() === 'PUT') {
        requestMade = true;
        console.log('\n📤 API Request captured!');
        console.log('Headers:', request.headers());
      }
    });
    
    page.on('response', async response => {
      if (response.url().includes('/api/merchant/profile') && response.request().method() === 'PUT') {
        console.log('📥 API Response:', response.status());
        if (response.status() !== 200) {
          console.log('Response body:', await response.text());
        }
      }
    });
    
    // Submit form
    console.log('\n4️⃣ Submitting form...');
    const submitButton = await page.locator('#restaurantForm button[type="submit"]');
    await submitButton.click();
    
    // Wait for result
    await page.waitForTimeout(3000);
    
    if (requestMade) {
      console.log('\n✅ API request was made!');
    } else {
      console.log('\n❌ No API request was made');
    }
    
    // Check for alerts
    const alerts = await page.locator('.alert').all();
    if (alerts.length > 0) {
      console.log('\n📢 Alerts found:');
      for (const alert of alerts) {
        console.log('Alert:', await alert.textContent());
      }
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: '/Users/kennteoh/Documents/e2e-screenshots/settings-final-result.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    console.log('\n✅ Test complete. Browser will close in 5 seconds...');
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

testSettingsFinal();