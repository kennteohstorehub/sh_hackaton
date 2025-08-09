const puppeteer = require('puppeteer');

async function testLogin() {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable request/response logging
    page.on('response', response => {
      if (response.url().includes('/auth/login') && response.request().method() === 'POST') {
        console.log('Login POST response:', response.status(), response.url());
      }
    });
    
    console.log('1. Navigating to merchant login page...');
    await page.goto('http://chickenrice.lvh.me:3000/auth/merchant-login', {
      waitUntil: 'networkidle0'
    });
    
    // Fill in login form
    console.log('2. Filling in login form...');
    await page.type('#email', 'kfc@demo.com');
    await page.type('#password', 'password123');
    
    // Submit form and wait for navigation or error
    console.log('3. Submitting login form...');
    const [response] = await Promise.all([
      page.waitForResponse(response => 
        response.url().includes('/auth/login') && 
        response.request().method() === 'POST',
        { timeout: 10000 }
      ),
      page.click('button[type="submit"]')
    ]);
    
    console.log('4. Response status:', response.status());
    
    // Wait a bit for redirect
    await new Promise(r => setTimeout(r, 2000));
    
    // Check result
    const currentUrl = page.url();
    console.log('5. Current URL after login:', currentUrl);
    
    // Check for any messages
    const messages = await page.evaluate(() => {
      const errorAlert = document.querySelector('.alert-error');
      const successAlert = document.querySelector('.alert-success');
      return {
        error: errorAlert ? errorAlert.textContent.trim() : null,
        success: successAlert ? successAlert.textContent.trim() : null
      };
    });
    
    console.log('6. Messages:', messages);
    
    // Check page content
    const pageContent = await page.evaluate(() => {
      return {
        title: document.title,
        h1: document.querySelector('h1')?.textContent,
        h2: document.querySelector('h2')?.textContent,
        hasForm: !!document.querySelector('form[action="/auth/login"]'),
        hasDashboard: document.body.textContent.includes('Dashboard')
      };
    });
    
    console.log('7. Page content:', pageContent);
    
    // Keep browser open for inspection
    console.log('\n⚠️  Browser will stay open for 10 seconds for inspection...');
    await new Promise(r => setTimeout(r, 10000));
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

testLogin();