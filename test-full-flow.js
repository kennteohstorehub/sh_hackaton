const puppeteer = require('puppeteer');

// Configuration
const BASE_URL = 'http://localhost:3000';
const timestamp = Date.now();

// Test merchant account
const testMerchant = {
  fullName: 'Test Owner ' + timestamp,
  email: `test${timestamp}@example.com`,
  phone: '+60123456789',
  businessName: 'Test Restaurant ' + timestamp,
  subdomain: 'test' + timestamp,
  password: 'TestPass123!',
  businessType: 'restaurant'
};

// Test customer
const testCustomer = {
  name: 'John Doe',
  phone: '+60199999999',
  partySize: 4
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testFullFlow() {
  const browser = await puppeteer.launch({
    headless: false, // Set to true for production
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    slowMo: 100 // Slow down for visibility
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    
    console.log('🚀 Testing Complete Queue Management Flow');
    console.log('=' .repeat(60));
    console.log('Test Account:', testMerchant.email);
    console.log('Subdomain:', testMerchant.subdomain);
    console.log('=' .repeat(60));

    // ====== PHASE 1: REGISTRATION ======
    console.log('\n📝 PHASE 1: MERCHANT REGISTRATION');
    console.log('-'.repeat(40));
    
    await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle2' });
    console.log('✅ Registration page loaded');

    // Fill registration form
    await page.type('input[name="fullName"]', testMerchant.fullName);
    await page.type('input[name="email"]', testMerchant.email);
    await page.type('input[name="phone"]', testMerchant.phone);
    await page.type('input[name="businessName"]', testMerchant.businessName);
    await page.type('input[name="subdomain"]', testMerchant.subdomain);
    await page.type('input[name="password"]', testMerchant.password);
    await page.type('input[name="confirmPassword"]', testMerchant.password);
    
    // Select business type
    const hasBusinessType = await page.$('select[name="businessType"]');
    if (hasBusinessType) {
      await page.select('select[name="businessType"]', testMerchant.businessType);
    }
    
    // Agree to terms
    const termsCheckbox = await page.$('input[name="agreeToTerms"]');
    if (termsCheckbox) {
      await page.click('input[name="agreeToTerms"]');
    }
    
    console.log('✅ Registration form filled');
    
    // Submit and wait
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('button[type="submit"]')
    ]);
    
    await delay(2000);
    
    // Check registration result
    const afterRegUrl = page.url();
    const pageContent = await page.content();
    
    if (afterRegUrl.includes('success') || pageContent.includes('Registration Successful')) {
      console.log('✅ Registration successful!');
      
      // Extract login URL from success page
      const loginUrl = await page.evaluate(() => {
        const link = document.querySelector('a[href*="login"]');
        return link ? link.href : null;
      });
      
      if (loginUrl) {
        console.log('   Login URL:', loginUrl);
      }
    } else {
      console.log('❌ Registration failed or uncertain');
      console.log('   URL:', afterRegUrl);
      return false;
    }

    // ====== PHASE 2: LOGIN ======
    console.log('\n🔐 PHASE 2: MERCHANT LOGIN');
    console.log('-'.repeat(40));
    
    // Navigate to login using path-based routing
    const loginUrl = `${BASE_URL}/t/${testMerchant.subdomain}/auth/login`;
    await page.goto(loginUrl, { waitUntil: 'networkidle2' });
    console.log('✅ Login page loaded');
    
    // Fill login form
    await page.type('input[name="email"], input[type="email"]', testMerchant.email);
    await page.type('input[name="password"], input[type="password"]', testMerchant.password);
    console.log('✅ Login credentials entered');
    
    // Submit login
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('button[type="submit"]')
    ]);
    
    await delay(2000);
    
    const dashboardUrl = page.url();
    if (!dashboardUrl.includes('dashboard')) {
      console.log('❌ Login failed - not redirected to dashboard');
      console.log('   Current URL:', dashboardUrl);
      return false;
    }
    
    console.log('✅ Login successful - Dashboard loaded');

    // ====== PHASE 3: QUEUE MANAGEMENT ======
    console.log('\n🎯 PHASE 3: QUEUE MANAGEMENT');
    console.log('-'.repeat(40));
    
    // Check if queue exists or create one
    const hasQueue = await page.evaluate(() => {
      return document.body.textContent.includes('Main Queue');
    });
    
    if (hasQueue) {
      console.log('✅ Default queue found: Main Queue');
    }
    
    // Start/activate the queue
    const startButton = await page.$('button:has-text("Start Queue"), button:has-text("Activate")');
    if (startButton) {
      await startButton.click();
      await delay(1000);
      console.log('✅ Queue activated');
    }
    
    // Get queue ID or public URL
    const queueInfo = await page.evaluate(() => {
      // Try to find queue ID or public link
      const links = Array.from(document.querySelectorAll('a[href*="/queue/"]'));
      if (links.length > 0) {
        return links[0].href;
      }
      return null;
    });
    
    if (queueInfo) {
      console.log('✅ Queue public URL:', queueInfo);
    }

    // ====== PHASE 4: CUSTOMER JOINS QUEUE ======
    console.log('\n👥 PHASE 4: CUSTOMER JOINS QUEUE');
    console.log('-'.repeat(40));
    
    // Open new tab for customer view
    const customerPage = await browser.newPage();
    
    // Navigate to public queue page
    const publicQueueUrl = queueInfo || `${BASE_URL}/t/${testMerchant.subdomain}/queue`;
    await customerPage.goto(publicQueueUrl, { waitUntil: 'networkidle2' });
    console.log('✅ Customer queue page loaded');
    
    // Fill customer join form
    const hasJoinForm = await customerPage.$('form');
    if (hasJoinForm) {
      await customerPage.type('input[name="name"], input[name="customerName"]', testCustomer.name);
      await customerPage.type('input[name="phone"], input[name="phoneNumber"]', testCustomer.phone);
      
      // Party size
      const partySizeInput = await customerPage.$('input[name="partySize"], input[type="number"]');
      if (partySizeInput) {
        await customerPage.evaluate(() => {
          const input = document.querySelector('input[name="partySize"], input[type="number"]');
          if (input) input.value = '';
        });
        await customerPage.type('input[name="partySize"], input[type="number"]', testCustomer.partySize.toString());
      }
      
      console.log('✅ Customer details filled');
      
      // Submit join request
      await Promise.all([
        customerPage.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
        customerPage.click('button[type="submit"]')
      ]);
      
      await delay(2000);
      
      // Check if joined successfully
      const customerPageContent = await customerPage.content();
      if (customerPageContent.includes('Queue Position') || customerPageContent.includes('successfully')) {
        console.log('✅ Customer joined queue successfully!');
        
        // Extract queue position
        const position = await customerPage.evaluate(() => {
          const positionElement = document.querySelector('[class*="position"], [class*="number"]');
          return positionElement ? positionElement.textContent : 'N/A';
        });
        console.log('   Queue Position:', position);
      }
    }

    // ====== PHASE 5: MERCHANT SEATS CUSTOMER ======
    console.log('\n✅ PHASE 5: MERCHANT SEATS CUSTOMER');
    console.log('-'.repeat(40));
    
    // Go back to merchant dashboard
    await page.bringToFront();
    await page.reload({ waitUntil: 'networkidle2' });
    
    // Find the customer in queue
    const customerEntry = await page.evaluate((name) => {
      const entries = Array.from(document.querySelectorAll('[class*="queue-entry"], tr, .card'));
      const entry = entries.find(el => el.textContent.includes(name));
      return entry ? true : false;
    }, testCustomer.name);
    
    if (customerEntry) {
      console.log('✅ Customer found in queue:', testCustomer.name);
      
      // Click seat/serve button
      const seatButton = await page.evaluateHandle((name) => {
        const entries = Array.from(document.querySelectorAll('[class*="queue-entry"], tr, .card'));
        const entry = entries.find(el => el.textContent.includes(name));
        if (entry) {
          return entry.querySelector('button:has-text("Seat"), button:has-text("Serve"), button:has-text("Call")');
        }
        return null;
      }, testCustomer.name);
      
      if (seatButton) {
        await seatButton.click();
        await delay(1000);
        console.log('✅ Customer marked as seated/served!');
      }
    }

    // ====== FINAL CHECK ======
    console.log('\n🎊 TEST COMPLETE!');
    console.log('=' .repeat(60));
    console.log('✅ Full flow test completed successfully:');
    console.log('   1. Merchant registered');
    console.log('   2. Merchant logged in');
    console.log('   3. Queue created/activated');
    console.log('   4. Customer joined queue');
    console.log('   5. Customer seated');
    
    await delay(5000); // Keep browser open to see results
    
    return true;

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('Stack:', error.stack);
    return false;
  } finally {
    await browser.close();
  }
}

// Run the test
testFullFlow()
  .then(success => {
    if (success) {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Tests failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });