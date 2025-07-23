const { chromium } = require('playwright');

async function debugLogin() {
  console.log('🔍 Debugging login process...\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    devtools: false 
  });
  
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  // Log all network requests
  page.on('request', request => {
    if (request.url().includes('/auth/login') && request.method() === 'POST') {
      console.log('📤 Login POST request:', {
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData()
      });
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/auth/login') && response.request().method() === 'POST') {
      console.log('📥 Login POST response:', {
        status: response.status(),
        url: response.url()
      });
    }
  });
  
  try {
    // Go to login page
    console.log('1️⃣ Navigating to login page...');
    await page.goto('https://queuemanagement-vtc2.onrender.com/auth/login');
    
    // Wait for form
    await page.waitForSelector('form', { timeout: 10000 });
    console.log('✅ Login form found\n');
    
    // Check CSRF token
    console.log('2️⃣ Checking for CSRF token...');
    const csrfToken = await page.locator('input[name="_csrf"]').getAttribute('value').catch(() => null);
    if (csrfToken) {
      console.log(`✅ CSRF token found: ${csrfToken.substring(0, 10)}...`);
    } else {
      console.log('⚠️  No CSRF token found');
    }
    
    // Fill form
    console.log('\n3️⃣ Filling login form...');
    await page.fill('input[name="email"]', 'demo@smartqueue.com');
    await page.fill('input[name="password"]', 'demo123456');
    console.log('✅ Form filled\n');
    
    // Submit and wait
    console.log('4️⃣ Submitting form...');
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/auth/login') && resp.request().method() === 'POST'),
      page.click('button[type="submit"]')
    ]);
    
    console.log(`Response status: ${response.status()}`);
    
    // Wait a bit for redirect
    await page.waitForTimeout(3000);
    
    console.log(`\n5️⃣ Final URL: ${page.url()}`);
    
    if (page.url().includes('dashboard')) {
      console.log('✅ Login successful!\n');
      
      // Get page content
      const title = await page.title();
      console.log(`Dashboard title: ${title}`);
      
      const heading = await page.locator('h1').first().textContent();
      console.log(`Dashboard heading: ${heading}`);
    } else {
      console.log('❌ Login failed\n');
      
      // Check for errors
      const errorElement = await page.locator('.alert-danger, .error, .alert').first();
      if (await errorElement.count() > 0) {
        const errorText = await errorElement.textContent();
        console.log(`Error message: ${errorText.trim()}`);
      }
      
      // Take screenshot
      await page.screenshot({ path: 'login-debug-fail.png', fullPage: true });
      console.log('📸 Screenshot saved as login-debug-fail.png');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugLogin().catch(console.error);