const puppeteer = require('puppeteer');

async function testLogin() {
  console.log('Testing login with CSRF fix...');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to login page
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:3000/auth/login');
    
    // Check if CSRF token is present
    const csrfToken = await page.evaluate(() => {
      const metaTag = document.querySelector('meta[name="csrf-token"]');
      const inputField = document.querySelector('input[name="_csrf"]');
      return {
        metaToken: metaTag ? metaTag.getAttribute('content') : null,
        inputToken: inputField ? inputField.value : null,
        inputPresent: !!inputField
      };
    });
    
    console.log('2. CSRF Token Status:');
    console.log('   - Meta tag token:', csrfToken.metaToken ? 'Present' : 'Missing');
    console.log('   - Input field present:', csrfToken.inputPresent);
    console.log('   - Input field token:', csrfToken.inputToken ? 'Present' : 'Missing');
    
    // Try to login
    console.log('3. Attempting login...');
    await page.type('#email', 'merchant@demo.com');
    await page.type('#password', 'password123');
    
    // Take screenshot before submit
    await page.screenshot({ path: 'login-before-submit.png' });
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for navigation or error
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check result
    const currentUrl = page.url();
    const pageTitle = await page.title();
    
    console.log('4. Result:');
    console.log('   - Current URL:', currentUrl);
    console.log('   - Page title:', pageTitle);
    
    if (currentUrl.includes('/dashboard')) {
      console.log('✅ Login successful!');
    } else if (currentUrl.includes('/auth/login')) {
      const errorMessage = await page.evaluate(() => {
        const errorDiv = document.querySelector('.error-message');
        return errorDiv ? errorDiv.textContent : null;
      });
      console.log('❌ Login failed. Error:', errorMessage || 'Unknown error');
    } else {
      console.log('⚠️ Unexpected redirect to:', currentUrl);
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'login-result.png' });
    
    console.log('\nTest complete. Browser will close in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await browser.close();
  }
}

testLogin();