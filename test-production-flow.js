const puppeteer = require('puppeteer');

// Toggle between local and production
const isProduction = false;
const BASE_URL = isProduction ? 'https://queuemanagement.onrender.com' : 'http://localhost:3000';

// Test account details
const testMerchant = {
  fullName: 'Test Restaurant Owner',
  email: `testrest${Date.now()}@example.com`,
  phone: '+60123456789',
  businessName: 'Test Restaurant ' + Date.now(),
  subdomain: 'testrest' + Date.now(),
  password: 'TestPass123!',
  businessType: 'restaurant'
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testRegistrationAndLogin() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

    console.log('🔍 Testing Production Registration and Login Flow\n');
    console.log('Base URL:', BASE_URL);
    console.log('Test Email:', testMerchant.email);
    console.log('Test Subdomain:', testMerchant.subdomain);
    console.log('=' .repeat(50));

    // Step 1: Test if registration page is accessible
    console.log('\n📝 Step 1: Checking registration page...');
    const registerUrl = `${BASE_URL}/register`;
    
    const response = await page.goto(registerUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    if (response.status() === 404) {
      console.log('❌ Registration page not found (404)');
      console.log('   The app is not running properly on Render');
      return false;
    }

    console.log('✅ Registration page loaded (Status:', response.status() + ')');

    // Check if registration form exists
    const hasForm = await page.evaluate(() => {
      return document.querySelector('form') !== null;
    });

    if (!hasForm) {
      console.log('❌ No registration form found on page');
      console.log('   Page content:', await page.content().substring(0, 500));
      return false;
    }

    console.log('✅ Registration form found');

    // Step 2: Fill and submit registration form
    console.log('\n📝 Step 2: Filling registration form...');
    
    // Fill in the form fields
    await page.type('input[name="fullName"]', testMerchant.fullName);
    await page.type('input[name="email"]', testMerchant.email);
    await page.type('input[name="phone"]', testMerchant.phone);
    await page.type('input[name="businessName"]', testMerchant.businessName);
    await page.type('input[name="subdomain"]', testMerchant.subdomain);
    await page.type('input[name="password"]', testMerchant.password);
    await page.type('input[name="confirmPassword"]', testMerchant.password);
    
    // Select business type if dropdown exists
    const hasBusinessType = await page.evaluate(() => {
      return document.querySelector('select[name="businessType"]') !== null;
    });
    
    if (hasBusinessType) {
      await page.select('select[name="businessType"]', testMerchant.businessType);
    }

    // Check terms checkbox
    const hasTerms = await page.evaluate(() => {
      return document.querySelector('input[name="agreeToTerms"]') !== null;
    });
    
    if (hasTerms) {
      await page.click('input[name="agreeToTerms"]');
    }

    console.log('✅ Form filled');

    // Submit the form
    console.log('\n📝 Step 3: Submitting registration...');
    await page.click('button[type="submit"]');
    
    // Wait for navigation or error
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    
    // Check if registration was successful
    const currentUrl = page.url();
    const pageContent = await page.content();
    
    if (currentUrl.includes('success') || pageContent.includes('successful')) {
      console.log('✅ Registration successful!');
      console.log('   Redirect URL:', currentUrl);
    } else if (pageContent.includes('already exists')) {
      console.log('⚠️  Email already registered');
      return false;
    } else {
      console.log('❌ Registration may have failed');
      console.log('   Current URL:', currentUrl);
      
      // Check for error messages
      const errors = await page.evaluate(() => {
        const errorElements = document.querySelectorAll('.error, .alert-danger, [class*="error"]');
        return Array.from(errorElements).map(el => el.textContent.trim());
      });
      
      if (errors.length > 0) {
        console.log('   Errors found:', errors);
        return false;
      }
    }

    // Step 4: Test login with new account
    console.log('\n🔐 Step 4: Testing login with new account...');
    
    // Navigate to login page using path-based routing
    const loginUrl = `${BASE_URL}/t/${testMerchant.subdomain}/auth/login`;
    console.log('   Login URL:', loginUrl);
    
    const loginResponse = await page.goto(loginUrl, {
      waitUntil: 'networkidle2'
    });

    if (loginResponse.status() === 404) {
      console.log('❌ Login page not found (404)');
      return false;
    }

    console.log('✅ Login page loaded');

    // Fill login form
    await page.type('input[name="email"], input[type="email"]', testMerchant.email);
    await page.type('input[name="password"], input[type="password"]', testMerchant.password);
    
    // Submit login
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    
    const afterLoginUrl = page.url();
    const afterLoginContent = await page.content();
    
    if (afterLoginUrl.includes('dashboard') || afterLoginContent.includes('Dashboard')) {
      console.log('✅ Login successful!');
      console.log('   Dashboard URL:', afterLoginUrl);
      return true;
    } else {
      console.log('❌ Login failed');
      console.log('   Current URL:', afterLoginUrl);
      
      // Check for login errors
      const loginErrors = await page.evaluate(() => {
        const errorElements = document.querySelectorAll('.error, .alert-danger, [class*="error"]');
        return Array.from(errorElements).map(el => el.textContent.trim());
      });
      
      if (loginErrors.length > 0) {
        console.log('   Login errors:', loginErrors);
      }
      
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  } finally {
    await browser.close();
  }
}

async function testQueueFlow() {
  console.log('\n' + '=' .repeat(50));
  console.log('🎯 Testing Queue Management Flow');
  console.log('=' .repeat(50));
  
  // This would contain the queue testing logic
  // Only called if login succeeds
  console.log('✅ Would test queue creation, customer joining, and seating');
}

// Run the tests
async function runTests() {
  const loginSuccess = await testRegistrationAndLogin();
  
  if (loginSuccess) {
    console.log('\n✅ Registration and login successful!');
    console.log('Proceeding with queue testing...');
    await testQueueFlow();
  } else {
    console.log('\n❌ Registration/Login failed - skipping queue tests');
    console.log('\n⚠️  The Render deployment is not working correctly.');
    console.log('The Node.js app is not running or routes are not accessible.');
  }
}

runTests().catch(console.error);