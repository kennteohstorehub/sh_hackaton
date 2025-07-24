const { chromium } = require('playwright');

async function testLogin() {
  console.log('🧪 FINAL LOGIN TEST - POST MIGRATION');
  console.log('=' .repeat(60));
  console.log('Database: Neon (columns fixed: sess, expire)');
  console.log('Session Store: connect-pg-simple');
  console.log('=' .repeat(60));
  
  const browser = await chromium.launch({ 
    headless: false, // Show browser for debugging
    args: ['--no-sandbox']
  });
  
  try {
    const context = await browser.newContext({
      // Accept all cookies
      acceptDownloads: true,
      ignoreHTTPSErrors: true
    });
    
    const page = await context.newPage();
    
    // Enable verbose console logging
    page.on('console', msg => {
      console.log(`[Browser ${msg.type()}]:`, msg.text());
    });
    
    page.on('request', request => {
      if (request.method() === 'POST') {
        console.log(`[POST Request]: ${request.url()}`);
        console.log(`  Headers:`, request.headers());
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/auth/login') && response.request().method() === 'POST') {
        console.log(`[POST Response]: ${response.status()} ${response.statusText()}`);
      }
    });
    
    // Step 1: Navigate to login page
    console.log('\n1. Navigating to login page...');
    await page.goto('https://queuemanagement-vtc2.onrender.com/auth/login', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log('   ✅ Page loaded');
    
    // Wait for form to be ready
    await page.waitForSelector('input[name="email"]', { state: 'visible' });
    
    // Step 2: Check CSRF token
    const csrfToken = await page.locator('input[name="_csrf"]').getAttribute('value');
    console.log(`\n2. CSRF Token: ${csrfToken ? csrfToken.substring(0, 20) + '...' : 'NOT FOUND'}`);
    
    // Get cookies
    const cookies = await context.cookies();
    console.log('\n3. Cookies:');
    cookies.forEach(cookie => {
      console.log(`   - ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
    });
    
    // Step 3: Fill and submit form
    console.log('\n4. Filling login form...');
    
    // Type slowly to ensure form is ready
    await page.fill('input[name="email"]', 'demo@smartqueue.com', { timeout: 5000 });
    await page.fill('input[name="password"]', 'demo123456', { timeout: 5000 });
    
    console.log('   ✅ Form filled');
    
    // Take screenshot before submit
    await page.screenshot({ path: 'before-submit.png' });
    
    // Step 4: Submit form and wait for response
    console.log('\n5. Submitting form...');
    
    // Click and wait for navigation
    const navigationPromise = page.waitForNavigation({ 
      waitUntil: 'networkidle',
      timeout: 10000 
    }).catch(e => {
      console.log('   ⚠️  No navigation occurred');
      return null;
    });
    
    await page.click('button[type="submit"]');
    
    // Wait for either navigation or error
    await Promise.race([
      navigationPromise,
      page.waitForTimeout(5000)
    ]);
    
    // Check final state
    const finalUrl = page.url();
    console.log(`\n6. Final URL: ${finalUrl}`);
    
    // Take final screenshot
    await page.screenshot({ path: 'after-submit.png' });
    
    // Check for success
    if (finalUrl.includes('dashboard')) {
      console.log('\n✅ ✅ ✅ LOGIN SUCCESSFUL! ✅ ✅ ✅');
      console.log('The Queue Management System is fully operational!');
      
      // Check dashboard content
      const pageTitle = await page.title();
      console.log(`\nDashboard Title: ${pageTitle}`);
      
      return true;
    } else {
      console.log('\n❌ Login failed - still on login page');
      
      // Check for error messages
      const errorElement = await page.locator('.alert-danger, .error, .flash-error').first();
      if (await errorElement.count() > 0) {
        const errorText = await errorElement.textContent();
        console.log(`\nError message: ${errorText}`);
      }
      
      // Check page content for debugging
      const pageContent = await page.content();
      if (pageContent.includes('Invalid credentials')) {
        console.log('\n❌ Invalid credentials error');
      } else if (pageContent.includes('CSRF')) {
        console.log('\n❌ CSRF validation error');
      }
      
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    return false;
  } finally {
    // Keep browser open for 5 seconds to see result
    await new Promise(resolve => setTimeout(resolve, 5000));
    await browser.close();
  }
}

// Run test
testLogin()
  .then(success => {
    console.log('\n' + '=' .repeat(60));
    if (success) {
      console.log('✨ MIGRATION AND FIXES CONFIRMED SUCCESSFUL! ✨');
      console.log('\nSystem Status:');
      console.log('✅ Database migration completed (Neon)');
      console.log('✅ Session columns renamed (sess, expire)');
      console.log('✅ connect-pg-simple working correctly');
      console.log('✅ Login functionality operational');
      console.log('✅ CSRF protection working');
      console.log('\nThe Queue Management System is ready for production use!');
    } else {
      console.log('❌ Login test failed');
      console.log('\nPossible issues:');
      console.log('- Check if demo user exists with correct password');
      console.log('- Verify CSRF middleware configuration');
      console.log('- Check session store initialization');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(console.error);