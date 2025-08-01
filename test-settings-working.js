const { chromium } = require('playwright');

async function testSettingsWorking() {
  console.log('🧪 Testing Settings Save Functionality...');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });
  
  try {
    const page = await browser.newPage();
    
    // Monitor network
    let apiCallMade = false;
    let apiResponse = null;
    
    page.on('response', async response => {
      if (response.url().includes('/api/merchant/profile') && response.request().method() === 'PUT') {
        apiCallMade = true;
        apiResponse = response;
        console.log('\n✅ API Call Captured!');
        console.log('Status:', response.status());
        try {
          const body = await response.json();
          console.log('Response:', JSON.stringify(body, null, 2));
        } catch (e) {
          console.log('Response Text:', await response.text());
        }
      }
    });
    
    // Login
    console.log('1️⃣ Logging in...');
    await page.goto('http://localhost:3838/auth/login');
    await page.fill('input[name="email"]', 'demo@smartqueue.com');
    await page.fill('input[name="password"]', 'demo123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');
    
    // Go to settings
    console.log('2️⃣ Going to settings...');
    await page.goto('http://localhost:3838/dashboard/settings');
    await page.waitForLoadState('networkidle');
    
    // Edit fields
    console.log('3️⃣ Editing fields...');
    await page.fill('#restaurantName', 'Test Restaurant Updated');
    await page.fill('#restaurantPhone', '+60123456799');
    
    // Click the specific submit button
    console.log('4️⃣ Clicking submit button...');
    await page.click('#restaurantForm button:has-text("Save Restaurant Information")');
    
    // Wait for response
    console.log('5️⃣ Waiting for API response...');
    await page.waitForTimeout(3000);
    
    if (apiCallMade) {
      console.log('\n🎉 SUCCESS: API call was made!');
      if (apiResponse && apiResponse.status() === 200) {
        console.log('✅ Settings saved successfully!');
        
        // Verify the change persisted
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const newName = await page.inputValue('#restaurantName');
        const newPhone = await page.inputValue('#restaurantPhone');
        
        console.log('\n📝 Values after reload:');
        console.log('Name:', newName);
        console.log('Phone:', newPhone);
        
        if (newName === 'Test Restaurant Updated') {
          console.log('✅ Changes persisted!');
        }
      }
    } else {
      console.log('\n❌ FAILURE: No API call was made');
      console.log('The form submission may have JavaScript errors.');
      
      // Check for alerts
      const alerts = await page.locator('.alert').all();
      for (const alert of alerts) {
        console.log('Alert:', await alert.textContent());
      }
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: '/Users/kennteoh/Documents/e2e-screenshots/settings-test-result.png',
      fullPage: true 
    });
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await browser.close();
  }
}

testSettingsWorking();