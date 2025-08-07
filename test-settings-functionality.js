const puppeteer = require('puppeteer');

async function testSettingsFunctionality() {
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: { width: 1280, height: 720 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to login
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:3838/auth/login');
    
    // Login with demo merchant
    console.log('2. Logging in with demo merchant...');
    await page.type('#email', 'demo@example.com');
    await page.type('#password', 'Demo123!@#');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForNavigation();
    console.log('3. Successfully logged in!');
    
    // Navigate to settings
    console.log('4. Navigating to settings page...');
    await page.goto('http://localhost:3838/dashboard/settings');
    await page.waitForSelector('#restaurantForm', { timeout: 5000 });
    
    // Test restaurant information form
    console.log('5. Testing restaurant information form...');
    
    // Clear and fill restaurant name
    const restaurantNameField = await page.$('#restaurantName');
    await restaurantNameField.click({ clickCount: 3 });
    await restaurantNameField.type('Test Restaurant Updated');
    
    // Clear and fill phone
    const phoneField = await page.$('#restaurantPhone');
    await phoneField.click({ clickCount: 3 });
    await phoneField.type('+1234567890');
    
    // Clear and fill address
    const addressField = await page.$('#restaurantAddress');
    await addressField.click({ clickCount: 3 });
    await addressField.type('123 Test Street, Test City, TC 12345');
    
    // Test business hours toggle
    console.log('6. Testing business hours functionality...');
    
    // Toggle Monday closed
    const mondayClosed = await page.$('#monday-closed');
    if (mondayClosed) {
      await mondayClosed.click();
      console.log('   - Toggled Monday closed status');
    }
    
    // Update Tuesday hours
    const tuesdayStart = await page.$('input[name="businessHours[tuesday][start]"]');
    if (tuesdayStart) {
      await tuesdayStart.click({ clickCount: 3 });
      await tuesdayStart.type('08:00');
      console.log('   - Updated Tuesday start time');
    }
    
    // Save restaurant form
    console.log('7. Saving restaurant information...');
    const saveButton = await page.$('#restaurantForm button[type="submit"]');
    await saveButton.click();
    
    // Wait for save to complete
    await page.waitForFunction(
      (selector) => {
        const btn = document.querySelector(selector);
        return btn && btn.textContent.includes('Save Restaurant Information');
      },
      { timeout: 10000 },
      '#restaurantForm button[type="submit"]'
    );
    
    // Check for success message
    const successMessage = await page.$eval('#successMessage', el => ({
      visible: el.style.display !== 'none',
      text: el.textContent
    }));
    
    if (successMessage.visible) {
      console.log('✅ SUCCESS:', successMessage.text);
    } else {
      // Check for error message
      const errorMessage = await page.$eval('#errorMessage', el => ({
        visible: el.style.display !== 'none',
        text: el.textContent
      }));
      
      if (errorMessage.visible) {
        console.log('❌ ERROR:', errorMessage.text);
      }
    }
    
    // Test queue settings
    console.log('\n8. Testing queue settings form...');
    const maxCapacityField = await page.$('#maxCapacity');
    if (maxCapacityField) {
      await maxCapacityField.click({ clickCount: 3 });
      await maxCapacityField.type('75');
      console.log('   - Updated max capacity to 75');
    }
    
    const avgServiceTimeField = await page.$('#avgServiceTime');
    if (avgServiceTimeField) {
      await avgServiceTimeField.click({ clickCount: 3 });
      await avgServiceTimeField.type('20');
      console.log('   - Updated average service time to 20 minutes');
    }
    
    // Save queue settings
    const queueSaveButton = await page.$('#queueSettingsForm button[type="submit"]');
    if (queueSaveButton) {
      console.log('9. Saving queue settings...');
      await queueSaveButton.click();
      
      // Wait for save to complete
      await page.waitForFunction(
        (selector) => {
          const btn = document.querySelector(selector);
          return btn && btn.textContent.includes('Save Queue Settings');
        },
        { timeout: 10000 },
        '#queueSettingsForm button[type="submit"]'
      );
      
      console.log('✅ Queue settings saved!');
    }
    
    // Reload page to verify persistence
    console.log('\n10. Reloading page to verify data persistence...');
    await page.reload();
    await page.waitForSelector('#restaurantForm', { timeout: 5000 });
    
    // Check if values persisted
    const savedName = await page.$eval('#restaurantName', el => el.value);
    const savedPhone = await page.$eval('#restaurantPhone', el => el.value);
    const savedAddress = await page.$eval('#restaurantAddress', el => el.value);
    
    console.log('\nSaved values:');
    console.log('- Restaurant Name:', savedName);
    console.log('- Phone:', savedPhone);
    console.log('- Address:', savedAddress);
    
    // Check business hours
    const mondayClosedChecked = await page.$eval('#monday-closed', el => el.checked);
    console.log('- Monday closed:', mondayClosedChecked);
    
    console.log('\n✅ Settings page functionality test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    console.log('\nPress Ctrl+C to close the browser...');
    // Keep browser open for manual inspection
    await new Promise(() => {});
  }
}

// Run the test
testSettingsFunctionality();