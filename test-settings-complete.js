const { chromium } = require('playwright');

async function testSettingsComplete() {
  console.log('🧪 Testing Settings Page After Fixes...');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 800
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable detailed logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Console Error:', msg.text());
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/merchant/profile') && response.request().method() === 'PUT') {
        console.log(`\n📡 API Response: ${response.status()} ${response.statusText()}`);
      }
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
    
    // Take screenshot of original state
    await page.screenshot({ 
      path: '/Users/kennteoh/Documents/e2e-screenshots/settings-before-edit.png',
      fullPage: true 
    });
    
    // Test editing restaurant name
    console.log('\n3️⃣ Testing restaurant name edit...');
    const restaurantNameInput = await page.locator('#restaurantName').first();
    const originalName = await restaurantNameInput.inputValue();
    console.log('📝 Original name:', originalName);
    
    // Clear and type new value
    await restaurantNameInput.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await restaurantNameInput.type('Updated Restaurant Name');
    console.log('✏️ New name entered: Updated Restaurant Name');
    
    // Test editing phone
    console.log('\n4️⃣ Testing phone number edit...');
    const phoneInput = await page.locator('#restaurantPhone').first();
    const originalPhone = await phoneInput.inputValue();
    console.log('📝 Original phone:', originalPhone);
    
    await phoneInput.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await phoneInput.type('+60198765432');
    console.log('✏️ New phone entered: +60198765432');
    
    // Take screenshot before submission
    await page.screenshot({ 
      path: '/Users/kennteoh/Documents/e2e-screenshots/settings-edited.png',
      fullPage: true 
    });
    
    // Submit form
    console.log('\n5️⃣ Submitting form...');
    
    // Look for the submit button within the restaurant form
    const submitButton = await page.locator('#restaurantForm button[type="submit"]').first();
    console.log('🔘 Found submit button');
    
    // Set up response listener
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/api/merchant/profile') && resp.request().method() === 'PUT',
      { timeout: 10000 }
    );
    
    await submitButton.click();
    console.log('⏳ Waiting for API response...');
    
    try {
      const response = await responsePromise;
      const status = response.status();
      console.log(`\n✅ API Response received: ${status}`);
      
      if (status === 200) {
        console.log('🎉 Form submitted successfully!');
        const responseData = await response.json();
        console.log('📊 Updated merchant data:');
        console.log('  - Business Name:', responseData.merchant?.businessName);
        console.log('  - Phone:', responseData.merchant?.phone);
        
        // Check for success message
        await page.waitForTimeout(1000);
        const alerts = await page.locator('.alert').all();
        for (const alert of alerts) {
          const text = await alert.textContent();
          console.log('💬 Alert message:', text);
        }
      } else {
        console.log('❌ Form submission failed with status:', status);
        const errorText = await response.text();
        console.log('Error response:', errorText);
      }
    } catch (error) {
      console.log('❌ API request timeout or error:', error.message);
    }
    
    // Take final screenshot
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: '/Users/kennteoh/Documents/e2e-screenshots/settings-after-save.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshots saved to Documents/e2e-screenshots/');
    
    // Reload page to verify changes persisted
    console.log('\n6️⃣ Reloading to verify persistence...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const reloadedName = await page.locator('#restaurantName').inputValue();
    const reloadedPhone = await page.locator('#restaurantPhone').inputValue();
    
    console.log('\n🔍 Values after reload:');
    console.log('  - Restaurant Name:', reloadedName);
    console.log('  - Phone:', reloadedPhone);
    
    if (reloadedName === 'Updated Restaurant Name' && reloadedPhone === '+60198765432') {
      console.log('✅ Changes persisted successfully!');
    } else {
      console.log('⚠️ Changes may not have persisted correctly');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await page.screenshot({ 
      path: '/Users/kennteoh/Documents/e2e-screenshots/settings-error.png',
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
}

testSettingsComplete();