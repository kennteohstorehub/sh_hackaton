const puppeteer = require('puppeteer');

async function testLogin() {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', err => console.error('Page error:', err));
    
    console.log('1. Navigating to merchant login page...');
    await page.goto('http://chickenrice.lvh.me:3000/auth/merchant-login', {
      waitUntil: 'networkidle0'
    });
    
    // Check for CSRF token in the form
    const csrfToken = await page.evaluate(() => {
      const csrfInput = document.querySelector('input[name="_csrf"]');
      return csrfInput ? csrfInput.value : null;
    });
    
    console.log('2. CSRF token found:', csrfToken ? 'Yes' : 'No');
    if (csrfToken) {
      console.log('   Token value:', csrfToken.substring(0, 20) + '...');
    }
    
    // Check cookies
    const cookies = await page.cookies();
    const csrfCookie = cookies.find(c => c.name === 'csrf-token');
    const sessionCookie = cookies.find(c => c.name === 'qms_session');
    
    console.log('3. Cookies:');
    console.log('   - CSRF cookie:', csrfCookie ? 'Present' : 'Missing');
    console.log('   - Session cookie:', sessionCookie ? 'Present' : 'Missing');
    
    // Fill in login form
    console.log('4. Filling in login form...');
    await page.type('#email', 'kfc@demo.com');
    await page.type('#password', 'password123');
    
    // Submit form
    console.log('5. Submitting login form...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]')
    ]);
    
    // Check result
    const currentUrl = page.url();
    console.log('6. Current URL after login:', currentUrl);
    
    // Check for error messages
    const errorMessage = await page.evaluate(() => {
      const alertError = document.querySelector('.alert-error');
      return alertError ? alertError.textContent.trim() : null;
    });
    
    if (errorMessage) {
      console.log('7. Error message found:', errorMessage);
    } else {
      console.log('7. Login successful! Redirected to:', currentUrl);
      
      // Check if we're on the dashboard
      const pageTitle = await page.title();
      console.log('   Page title:', pageTitle);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

testLogin();