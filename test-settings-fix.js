const { chromium } = require('playwright');

async function testSettingsFix() {
  console.log('🧪 Testing Settings Page Fix...');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable console monitoring
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Console Error:', msg.text());
      }
    });
    
    // Monitor network failures
    page.on('requestfailed', request => {
      console.log('❌ Request failed:', request.url(), request.failure().errorText);
    });
    
    // Login
    console.log('\n1️⃣ Logging in...');
    await page.goto('http://localhost:3838/auth/login');
    await page.fill('input[name="email"]', 'demo@smartqueue.com');
    await page.fill('input[name="password"]', 'demo123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');
    console.log('✅ Login successful');
    
    // Navigate to settings
    console.log('\n2️⃣ Navigating to settings...');
    await page.click('a[href="/dashboard/settings"]');
    await page.waitForLoadState('networkidle');
    console.log('✅ Settings page loaded');
    
    // Test editing business name
    console.log('\n3️⃣ Testing business name edit...');
    const businessNameInput = await page.locator('input[name="businessName"]').first();
    const originalName = await businessNameInput.inputValue();
    console.log('Original name:', originalName);
    
    await businessNameInput.clear();
    await businessNameInput.fill('Test Restaurant Updated');
    
    // Test editing phone
    console.log('\n4️⃣ Testing phone number edit...');
    const phoneInput = await page.locator('input[name="phone"]').first();
    const originalPhone = await phoneInput.inputValue();
    console.log('Original phone:', originalPhone);
    
    await phoneInput.clear();
    await phoneInput.fill('+60123456799');
    
    // Submit form
    console.log('\n5️⃣ Submitting form...');
    const submitButton = await page.locator('button[type="submit"]').first();
    
    // Monitor the API response
    const responsePromise = page.waitForResponse(resp => 
      resp.url().includes('/api/merchant/profile') && resp.request().method() === 'PUT'
    );
    
    await submitButton.click();
    
    try {
      const response = await responsePromise;
      console.log('API Response Status:', response.status());
      
      if (response.status() === 200) {
        console.log('✅ Form submitted successfully!');
        const responseData = await response.json();
        console.log('Updated data:', JSON.stringify(responseData, null, 2));
      } else {
        console.log('❌ Form submission failed with status:', response.status());
        const errorText = await response.text();
        console.log('Error response:', errorText);
      }
    } catch (error) {
      console.log('❌ No API response received:', error.message);
    }
    
    // Check for success message
    await page.waitForTimeout(2000);
    const successMessage = await page.locator('.alert-success, .success-message').first();
    if (await successMessage.count() > 0) {
      console.log('✅ Success message displayed');
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: '/Users/kennteoh/Documents/e2e-screenshots/settings-fixed.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved to: /Users/kennteoh/Documents/e2e-screenshots/settings-fixed.png');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

testSettingsFix();