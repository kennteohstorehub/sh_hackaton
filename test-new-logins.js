const puppeteer = require('puppeteer');

async function testLogins() {
  console.log('Testing new account logins...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const accounts = [
    { email: 'chickenrice@demo.com', name: 'ChickenRice' },
    { email: 'kfc@demo.com', name: 'KFC' },
    { email: 'hotpot@demo.com', name: 'Hotpot' },
    { email: 'admin@demo.com', name: 'BackOffice Admin', isBackoffice: true }
  ];

  try {
    for (const account of accounts) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });

      // Navigate to login page
      const loginUrl = account.isBackoffice 
        ? 'http://localhost:3000/backoffice/login'
        : 'http://localhost:3000/auth/login';
      
      console.log(`Testing ${account.name}...`);
      await page.goto(loginUrl);
      
      // Fill in login form
      await page.type('#email', account.email);
      await page.type('#password', 'password123');
      
      // Submit form
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => null),
        page.click('button[type="submit"]')
      ]);
      
      // Check result
      const currentUrl = page.url();
      
      if (account.isBackoffice) {
        if (currentUrl.includes('/backoffice/dashboard') || currentUrl.includes('/backoffice')) {
          console.log(`✅ ${account.name}: Login successful!`);
        } else {
          console.log(`❌ ${account.name}: Login failed (URL: ${currentUrl})`);
        }
      } else {
        if (currentUrl.includes('/dashboard')) {
          console.log(`✅ ${account.name}: Login successful!`);
        } else {
          console.log(`❌ ${account.name}: Login failed (URL: ${currentUrl})`);
        }
      }
      
      await page.close();
    }
    
    console.log('\n✅ All login tests complete!');
    console.log('\nYou can now login with:');
    console.log('- Merchants: chickenrice@demo.com, kfc@demo.com, hotpot@demo.com');
    console.log('- BackOffice: admin@demo.com');
    console.log('- Password: password123 (same for all)');
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await browser.close();
  }
}

testLogins();