const puppeteer = require('puppeteer');

async function testLoginDetailed() {
  console.log('Testing login with detailed error checking...');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    devtools: true
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Enable console logging
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', error => console.log('Page error:', error.message));

    // Navigate to login page
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:3000/auth/login');
    
    // Fill in login form
    console.log('2. Filling login form...');
    await page.type('#email', 'merchant@demo.com');
    await page.type('#password', 'password123');
    
    // Listen for network responses
    page.on('response', response => {
      if (response.url().includes('/auth/login') && response.request().method() === 'POST') {
        console.log('Login response status:', response.status());
      }
    });
    
    // Submit form and wait for navigation
    console.log('3. Submitting form...');
    const [response] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => null),
      page.click('button[type="submit"]')
    ]);
    
    // Check result
    const currentUrl = page.url();
    console.log('4. Navigation complete. Current URL:', currentUrl);
    
    // Check for any error messages on the page
    const pageContent = await page.evaluate(() => {
      const errorDiv = document.querySelector('.error-message');
      const alertDiv = document.querySelector('.alert-danger');
      const messageDiv = document.querySelector('.message.error');
      
      return {
        errorMessage: errorDiv ? errorDiv.textContent.trim() : null,
        alertMessage: alertDiv ? alertDiv.textContent.trim() : null,
        messageError: messageDiv ? messageDiv.textContent.trim() : null,
        pageTitle: document.title,
        bodyText: document.body.innerText.substring(0, 500)
      };
    });
    
    console.log('5. Page analysis:');
    console.log('   - Title:', pageContent.pageTitle);
    console.log('   - Error message:', pageContent.errorMessage);
    console.log('   - Alert message:', pageContent.alertMessage);
    console.log('   - Message error:', pageContent.messageError);
    
    if (currentUrl.includes('/dashboard')) {
      console.log('✅ Login successful!');
    } else {
      console.log('❌ Login failed');
      console.log('\nPage content preview:');
      console.log(pageContent.bodyText);
    }
    
    // Take screenshot
    await page.screenshot({ path: 'login-detailed-result.png', fullPage: true });
    console.log('\n📸 Screenshot saved as login-detailed-result.png');
    
    console.log('\nKeeping browser open for 10 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await browser.close();
  }
}

testLoginDetailed();