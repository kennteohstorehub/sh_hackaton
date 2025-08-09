const puppeteer = require('puppeteer');

async function testLogin() {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    console.log('1. Testing ChickenRice tenant login...');
    await page.goto('http://chickenrice.lvh.me:3000/auth/merchant-login', {
      waitUntil: 'networkidle0'
    });
    
    // Use correct credentials for chickenrice tenant
    console.log('2. Using chickenrice@demo.com (correct for this subdomain)...');
    await page.type('#email', 'chickenrice@demo.com');
    await page.type('#password', 'password123');
    
    console.log('3. Submitting login form...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]')
    ]);
    
    // Check result
    const currentUrl = page.url();
    console.log('4. Current URL after login:', currentUrl);
    
    // Check page content
    const pageContent = await page.evaluate(() => {
      return {
        title: document.title,
        hasDashboard: document.body.textContent.includes('Dashboard'),
        hasQueue: document.body.textContent.includes('Queue'),
        hasLogout: !!document.querySelector('a[href*="logout"]')
      };
    });
    
    console.log('5. Page content:', pageContent);
    
    if (currentUrl.includes('/dashboard')) {
      console.log('\n✅ SUCCESS! Logged in to dashboard');
    } else {
      console.log('\n❌ Failed - still on login page');
      
      // Check for error messages
      const errorMessage = await page.evaluate(() => {
        const alertError = document.querySelector('.alert-error');
        return alertError ? alertError.textContent.trim() : null;
      });
      
      if (errorMessage) {
        console.log('Error message:', errorMessage);
      }
    }
    
    // Keep browser open for inspection
    console.log('\n⚠️  Browser will stay open for 5 seconds...');
    await new Promise(r => setTimeout(r, 5000));
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

testLogin();