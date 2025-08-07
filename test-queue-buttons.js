const { chromium } = require('playwright');

async function testQueueButtons() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('Testing queue start/stop buttons...');
    
    // Login as demo merchant
    await page.goto('http://demo.lvh.me:3838/auth/login');
    await page.waitForLoadState('networkidle');
    
    // Clear and fill email
    const emailInput = await page.locator('input[name="email"]');
    await emailInput.click();
    await emailInput.clear();
    await emailInput.type('admin@demo.local');
    
    // Clear and fill password
    const passwordInput = await page.locator('input[name="password"]');
    await passwordInput.click();
    await passwordInput.clear();
    await passwordInput.type('Demo123!@#');
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Wait for navigation or error
    await page.waitForLoadState('networkidle');
    
    // Check for error messages
    const errorMessage = await page.$('.alert-danger, .error-message');
    if (errorMessage) {
      const errorText = await errorMessage.textContent();
      console.log('❌ Login error:', errorText);
    }
    
    // Check where we are
    const currentUrl = page.url();
    console.log('Current URL after login:', currentUrl);
    
    if (currentUrl.includes('dashboard')) {
      console.log('✅ Logged in successfully');
    } else {
      console.log('⚠️ Not on dashboard. Attempting direct navigation...');
      
      // Try direct navigation with cookie/session
      const response = await page.goto('http://demo.lvh.me:3838/dashboard');
      console.log('Navigation response status:', response.status());
      
      await page.waitForLoadState('networkidle');
      
      const dashboardUrl = page.url();
      console.log('Dashboard URL:', dashboardUrl);
      
      if (!dashboardUrl.includes('dashboard')) {
        console.log('❌ Failed to reach dashboard, likely authentication issue');
        return;
      }
    }
    
    // Take screenshot of dashboard to see the buttons
    await page.screenshot({ path: 'screenshots/dashboard-with-buttons.png', fullPage: true });
    
    // Check if stop/start queue button exists
    const stopButton = await page.$('button:has-text("Stop Queue")');
    const startButton = await page.$('button:has-text("Start Queue")');
    
    if (stopButton) {
      console.log('✅ Stop Queue button found');
      
      // Get button properties
      const buttonClass = await stopButton.getAttribute('class');
      console.log('Button class:', buttonClass);
      
      // Check if it has the proper onclick handler
      const onclickHandler = await stopButton.getAttribute('onclick');
      console.log('Onclick handler:', onclickHandler);
    } else if (startButton) {
      console.log('✅ Start Queue button found (queue is currently stopped)');
      
      // Get button properties
      const buttonClass = await startButton.getAttribute('class');
      console.log('Button class:', buttonClass);
      
      // Check if it has the proper onclick handler
      const onclickHandler = await startButton.getAttribute('onclick');
      console.log('Onclick handler:', onclickHandler);
    } else {
      console.log('❌ Neither Stop nor Start Queue button found');
    }
    
    // Check for queue management section
    const queueSection = await page.$('.queue-section');
    if (queueSection) {
      console.log('✅ Queue management section found');
    }
    
    console.log('\n📸 Screenshot saved to screenshots/dashboard-with-buttons.png');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testQueueButtons();