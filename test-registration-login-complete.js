const puppeteer = require('puppeteer');

async function testRegistrationAndLogin() {
  const testData = {
    fullName: `Test User ${Date.now()}`,
    email: `test-${Date.now()}@example.com`,
    phone: '1234567890',
    businessName: `Test Business ${Date.now()}`,
    subdomain: `test${Date.now()}`.toLowerCase().substring(0, 20),
    password: 'TestPassword123!',
    businessType: 'restaurant'
  };

  console.log('════════════════════════════════════════════════════════════');
  console.log('   COMPLETE REGISTRATION AND LOGIN FLOW TEST');
  console.log('════════════════════════════════════════════════════════════');
  console.log('');
  console.log('🚀 Starting Complete Registration and Login Test...');
  console.log('');
  console.log('📋 Test Data:');
  console.log(`   📧 Email: ${testData.email}`);
  console.log(`   🏢 Business: ${testData.businessName}`);
  console.log(`   🌐 Subdomain: ${testData.subdomain}`);
  console.log('');

  let browser;
  try {
    // Launch browser
    console.log('🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: false, // Set to false to see what's happening
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 800 }
    });
    const page = await browser.newPage();

    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Browser console error:', msg.text());
      }
    });

    // Step 1: Navigate to public registration page
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: REGISTRATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 Navigating to registration page...');
    const registrationUrl = 'http://localhost:3000/register';
    await page.goto(registrationUrl, { waitUntil: 'networkidle2' });
    console.log(`   ✅ Loaded: ${registrationUrl}`);
    await page.screenshot({ path: 'test-1-registration-page.png' });
    console.log('   📸 Screenshot: test-1-registration-page.png');

    // Check if we're on the registration page
    const pageTitle = await page.title();
    console.log(`   📄 Page title: ${pageTitle}`);

    // Step 2: Fill registration form
    console.log('');
    console.log('✍️  Filling registration form...');
    
    // Wait for form fields and fill them
    await page.waitForSelector('input[name="fullName"]', { timeout: 5000 });
    await page.type('input[name="fullName"]', testData.fullName);
    console.log('   ✓ Filled: Full Name');
    
    await page.type('input[name="email"]', testData.email);
    console.log('   ✓ Filled: Email');
    
    await page.type('input[name="phone"]', testData.phone);
    console.log('   ✓ Filled: Phone');
    
    await page.type('input[name="businessName"]', testData.businessName);
    console.log('   ✓ Filled: Business Name');
    
    await page.type('input[name="subdomain"]', testData.subdomain);
    console.log('   ✓ Filled: Subdomain');
    
    // Select business type if dropdown exists
    const businessTypeExists = await page.$('select[name="businessType"]') !== null;
    if (businessTypeExists) {
      await page.select('select[name="businessType"]', testData.businessType);
      console.log('   ✓ Selected: Business Type');
    }
    
    await page.type('input[name="password"]', testData.password);
    console.log('   ✓ Filled: Password');
    
    await page.type('input[name="confirmPassword"]', testData.password);
    console.log('   ✓ Filled: Confirm Password');
    
    // Check the terms checkbox
    const termsCheckbox = await page.$('input[name="agreeToTerms"]');
    if (termsCheckbox) {
      await page.click('input[name="agreeToTerms"]');
      console.log('   ✓ Checked: Terms Agreement');
    }
    
    await page.screenshot({ path: 'test-2-registration-filled.png' });
    console.log('   📸 Screenshot: test-2-registration-filled.png');

    // Step 3: Submit registration
    console.log('');
    console.log('🚀 Submitting registration form...');
    
    // Find and click submit button
    const submitButton = await page.$('button[type="submit"]');
    if (submitButton) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        submitButton.click()
      ]);
    } else {
      // Try form submit
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        page.evaluate(() => document.querySelector('form').submit())
      ]);
    }
    
    // Check where we ended up
    const afterRegUrl = page.url();
    const afterRegTitle = await page.title();
    console.log(`   📍 Redirected to: ${afterRegUrl}`);
    console.log(`   📄 Page title: ${afterRegTitle}`);
    await page.screenshot({ path: 'test-3-after-registration.png' });
    console.log('   📸 Screenshot: test-3-after-registration.png');

    // Check if we're on a success page
    const pageContent = await page.content();
    const hasSuccess = pageContent.includes('success') || pageContent.includes('Success') || 
                       pageContent.includes('successful') || pageContent.includes('Successful');
    
    if (hasSuccess) {
      console.log('   ✅ Registration appears successful!');
      
      // Look for login URL
      const loginLinkElement = await page.$('a[href*="login"]');
      if (loginLinkElement) {
        const loginUrl = await page.evaluate(el => el.href, loginLinkElement);
        console.log(`   🔗 Found login link: ${loginUrl}`);
      }
    } else {
      console.log('   ⚠️  Success message not found, checking for errors...');
      const hasError = pageContent.includes('error') || pageContent.includes('Error');
      if (hasError) {
        console.log('   ❌ Registration may have failed - error detected');
      }
    }

    // Step 4: Navigate to login page
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: LOGIN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Try to find the login URL from the success page
    let loginUrl = `http://localhost:3000/t/${testData.subdomain}/auth/login`;
    
    // Check if there's a login link on the page
    const loginLink = await page.$('a[href*="login"]');
    if (loginLink) {
      loginUrl = await page.evaluate(el => el.href, loginLink);
      console.log(`📝 Clicking login link: ${loginUrl}`);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        loginLink.click()
      ]);
    } else {
      console.log(`📝 Navigating to login URL: ${loginUrl}`);
      await page.goto(loginUrl, { waitUntil: 'networkidle2' });
    }
    
    const loginPageUrl = page.url();
    console.log(`   📍 Current URL: ${loginPageUrl}`);
    await page.screenshot({ path: 'test-4-login-page.png' });
    console.log('   📸 Screenshot: test-4-login-page.png');

    // Step 5: Fill login form
    console.log('');
    console.log('✍️  Filling login form...');
    
    // Wait for login form
    try {
      await page.waitForSelector('input[name="email"]', { timeout: 5000 });
      await page.type('input[name="email"]', testData.email);
      console.log('   ✓ Filled: Email');
      
      await page.type('input[name="password"]', testData.password);
      console.log('   ✓ Filled: Password');
      
      await page.screenshot({ path: 'test-5-login-filled.png' });
      console.log('   📸 Screenshot: test-5-login-filled.png');
    } catch (e) {
      console.log('   ❌ Could not find login form fields');
      console.log(`   Error: ${e.message}`);
    }

    // Step 6: Submit login
    console.log('');
    console.log('🚀 Submitting login form...');
    
    try {
      const loginButton = await page.$('button[type="submit"]');
      if (loginButton) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
          loginButton.click()
        ]);
      } else {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
          page.evaluate(() => document.querySelector('form').submit())
        ]);
      }
      
      const afterLoginUrl = page.url();
      const afterLoginTitle = await page.title();
      console.log(`   📍 Redirected to: ${afterLoginUrl}`);
      console.log(`   📄 Page title: ${afterLoginTitle}`);
      await page.screenshot({ path: 'test-6-after-login.png' });
      console.log('   📸 Screenshot: test-6-after-login.png');
      
      // Check if we reached the dashboard
      if (afterLoginUrl.includes('dashboard')) {
        console.log('   ✅ Successfully logged in and reached dashboard!');
      } else {
        console.log('   ⚠️  Did not reach dashboard after login');
        
        // Check for error messages
        const loginPageContent = await page.content();
        if (loginPageContent.includes('Invalid') || loginPageContent.includes('error')) {
          console.log('   ❌ Login failed - error message detected');
        }
      }
    } catch (e) {
      console.log('   ❌ Error during login submission');
      console.log(`   Error: ${e.message}`);
    }

    // Step 7: Final verification
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const finalUrl = page.url();
    const finalTitle = await page.title();
    
    console.log('📊 Final State:');
    console.log(`   📍 URL: ${finalUrl}`);
    console.log(`   📄 Title: ${finalTitle}`);
    
    if (finalUrl.includes('dashboard')) {
      console.log('');
      console.log('✅ TEST PASSED: User successfully registered and logged in!');
    } else {
      console.log('');
      console.log('❌ TEST FAILED: User could not complete the full flow');
      console.log('');
      console.log('🔍 Debugging Information:');
      console.log(`   - Registration URL: http://localhost:3000/register`);
      console.log(`   - Expected login URL: http://localhost:3000/t/${testData.subdomain}/auth/login`);
      console.log(`   - Test credentials: ${testData.email} / ${testData.password}`);
    }

  } catch (error) {
    console.log('');
    console.log('❌ Test Error:', error.message);
    console.log('Stack:', error.stack);
    
    // Take error screenshot if page exists
    if (browser) {
      const pages = await browser.pages();
      if (pages.length > 0) {
        await pages[0].screenshot({ path: 'test-error.png' });
        console.log('📸 Error screenshot: test-error.png');
      }
    }
  } finally {
    // Close browser
    if (browser) {
      console.log('');
      console.log('🔚 Closing browser...');
      await browser.close();
    }
    console.log('✅ Test complete!');
  }
}

// Run the test
testRegistrationAndLogin().catch(console.error);