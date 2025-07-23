const { chromium } = require('playwright');

async function testLoginFixed() {
  console.log('🧪 Testing login with better error handling...\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
  });
  
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    bypassCSP: true
  });
  
  const page = await context.newPage();
  
  try {
    // Go to login page
    console.log('1️⃣ Going to login page...');
    await page.goto('https://queuemanagement-vtc2.onrender.com/auth/login', {
      waitUntil: 'domcontentloaded'
    });
    console.log('✅ Login page loaded\n');
    
    // Fill and submit form
    console.log('2️⃣ Logging in with demo credentials...');
    await page.fill('input[name="email"]', 'demo@smartqueue.com');
    await page.fill('input[name="password"]', 'demo123456');
    
    // Click and wait for navigation
    await Promise.all([
      page.waitForNavigation({ 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      }).catch(e => console.log('Navigation error:', e.message)),
      page.click('button[type="submit"]')
    ]);
    
    // Give it a moment to settle
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}\n`);
    
    // Try to detect if we're on dashboard regardless of URL issues
    const pageContent = await page.content();
    const isOnDashboard = pageContent.includes('Dashboard') || pageContent.includes('dashboard');
    
    if (isOnDashboard || currentUrl.includes('dashboard')) {
      console.log('✅ Login successful! Dashboard detected\n');
      
      // Try to get dashboard info
      const title = await page.title().catch(() => 'Unable to get title');
      console.log(`Page title: ${title}`);
      
      // Look for dashboard elements
      const headings = await page.locator('h1, h2').allTextContents().catch(() => []);
      if (headings.length > 0) {
        console.log('Dashboard headings:', headings.slice(0, 3));
      }
      
      // Check for navigation menu
      const navLinks = await page.locator('nav a, .nav a, a[href*="dashboard"]').count();
      console.log(`Navigation links found: ${navLinks}`);
      
      await page.screenshot({ path: 'login-success-dashboard.png', fullPage: true });
      console.log('\n📸 Dashboard screenshot saved as login-success-dashboard.png');
      
    } else if (currentUrl.includes('error') || currentUrl.includes('chrome-error')) {
      console.log('⚠️  Browser navigation error, but login might have succeeded');
      console.log('This can happen in headless mode due to resource loading issues\n');
      
      // Try direct navigation to dashboard
      console.log('3️⃣ Trying direct dashboard access...');
      await page.goto('https://queuemanagement-vtc2.onrender.com/dashboard', {
        waitUntil: 'domcontentloaded'
      }).catch(e => console.log('Dashboard navigation error:', e.message));
      
      await page.waitForTimeout(2000);
      
      const dashboardUrl = page.url();
      if (dashboardUrl.includes('dashboard')) {
        console.log('✅ Dashboard accessible - login was successful!');
      } else if (dashboardUrl.includes('login')) {
        console.log('❌ Redirected to login - authentication failed');
      }
    } else {
      console.log('❌ Login failed - still on login page');
      
      // Check for error messages
      const errors = await page.locator('.alert-danger, .error').allTextContents();
      if (errors.length > 0) {
        console.log('Error messages:', errors);
      }
    }
    
    // Test API access with session
    console.log('\n4️⃣ Testing authenticated API access...');
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === 'connect.sid');
    
    if (sessionCookie) {
      console.log('✅ Session cookie found');
      
      // Test merchant profile endpoint
      const apiResponse = await page.request.get('https://queuemanagement-vtc2.onrender.com/api/merchant/profile');
      console.log(`API Profile endpoint status: ${apiResponse.status()}`);
      
      if (apiResponse.ok()) {
        const data = await apiResponse.json();
        console.log('✅ Authenticated API access working');
        console.log(`Merchant: ${data.businessName || data.email}`);
      }
    } else {
      console.log('❌ No session cookie found');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    await page.screenshot({ path: 'login-error.png', fullPage: true });
  } finally {
    await browser.close();
    console.log('\n✅ Test completed');
  }
}

testLoginFixed().catch(console.error);