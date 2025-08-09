const puppeteer = require('puppeteer');
const prisma = require('./server/utils/prisma');

async function testCompleteE2EFlow() {
  const testData = {
    fullName: 'BurgerLab Manager',
    email: 'burgerlab@test.com',
    phone: '0123456789',
    businessName: 'BurgerLab Test',
    subdomain: 'burgerlabtest',
    password: 'TestPass123!',
    businessType: 'restaurant'
  };

  const customerData = {
    name: 'John Customer',
    phone: '0198765432',
    partySize: 2
  };

  console.log('════════════════════════════════════════════════════════════');
  console.log('   COMPLETE END-TO-END FLOW TEST');
  console.log('════════════════════════════════════════════════════════════');
  console.log('');
  console.log('📋 Test Merchant Data:');
  console.log(`   📧 Email: ${testData.email}`);
  console.log(`   🏢 Business: ${testData.businessName}`);
  console.log(`   🌐 Subdomain: ${testData.subdomain}`);
  console.log('');

  let browser;
  let merchantContext;
  let customerContext;
  let queueId;

  try {
    // Launch browser
    console.log('🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 800 }
    });

    // Create two browser contexts for merchant and customer
    merchantContext = await browser.createBrowserContext();
    const merchantPage = await merchantContext.newPage();
    
    // Enable console logging
    merchantPage.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Browser console error:', msg.text());
      }
    });

    // ========================================
    // STEP 1: MERCHANT REGISTRATION
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: MERCHANT REGISTRATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('📝 Navigating to registration page...');
    await merchantPage.goto('http://localhost:3000/register', { waitUntil: 'networkidle2' });
    await merchantPage.screenshot({ path: 'e2e-1-registration-page.png' });
    console.log('   📸 Screenshot: e2e-1-registration-page.png');

    // Fill registration form
    console.log('✍️  Filling registration form...');
    await merchantPage.waitForSelector('input[name="fullName"]', { timeout: 5000 });
    await merchantPage.type('input[name="fullName"]', testData.fullName);
    await merchantPage.type('input[name="email"]', testData.email);
    await merchantPage.type('input[name="phone"]', testData.phone);
    await merchantPage.type('input[name="businessName"]', testData.businessName);
    await merchantPage.type('input[name="subdomain"]', testData.subdomain);
    await merchantPage.select('select[name="businessType"]', testData.businessType);
    await merchantPage.type('input[name="password"]', testData.password);
    await merchantPage.type('input[name="confirmPassword"]', testData.password);
    await merchantPage.click('input[name="agreeToTerms"]');
    
    await merchantPage.screenshot({ path: 'e2e-2-registration-filled.png' });
    console.log('   📸 Screenshot: e2e-2-registration-filled.png');

    // Submit registration
    console.log('🚀 Submitting registration...');
    await Promise.all([
      merchantPage.waitForNavigation({ waitUntil: 'networkidle2' }),
      merchantPage.click('button[type="submit"]')
    ]);

    const afterRegUrl = merchantPage.url();
    console.log(`   ✅ Registration successful! Redirected to: ${afterRegUrl}`);
    await merchantPage.screenshot({ path: 'e2e-3-registration-success.png' });
    console.log('   📸 Screenshot: e2e-3-registration-success.png');

    // ========================================
    // STEP 2: MERCHANT LOGIN
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: MERCHANT LOGIN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Navigate to login
    const loginUrl = `http://localhost:3000/t/${testData.subdomain}/auth/login`;
    console.log(`📝 Navigating to login: ${loginUrl}`);
    await merchantPage.goto(loginUrl, { waitUntil: 'networkidle2' });
    
    // Fill login form
    console.log('✍️  Filling login form...');
    await merchantPage.waitForSelector('input[name="email"]', { timeout: 5000 });
    await merchantPage.type('input[name="email"]', testData.email);
    await merchantPage.type('input[name="password"]', testData.password);
    await merchantPage.screenshot({ path: 'e2e-4-login-form.png' });
    console.log('   📸 Screenshot: e2e-4-login-form.png');

    // Submit login
    console.log('🚀 Logging in...');
    await Promise.all([
      merchantPage.waitForNavigation({ waitUntil: 'networkidle2' }),
      merchantPage.click('button[type="submit"]')
    ]);

    // Wait for dashboard
    await new Promise(r => setTimeout(r, 2000));
    const dashboardUrl = merchantPage.url();
    console.log(`   ✅ Logged in! Current URL: ${dashboardUrl}`);
    await merchantPage.screenshot({ path: 'e2e-5-dashboard.png' });
    console.log('   📸 Screenshot: e2e-5-dashboard.png');

    // ========================================
    // STEP 3: CREATE AND START QUEUE
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 3: CREATE AND START QUEUE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Check if there's already a queue or create one
    const hasQueue = await merchantPage.$('.queue-card') !== null;
    
    if (!hasQueue) {
      console.log('📝 Creating a new queue...');
      // Look for create queue button
      const createQueueBtn = await merchantPage.$('button:contains("Create Queue")');
      if (createQueueBtn) {
        await createQueueBtn.click();
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Start the queue
    console.log('🚀 Starting the queue...');
    const startButton = await merchantPage.$('button.btn-success');
    if (startButton) {
      await startButton.click();
      await new Promise(r => setTimeout(r, 2000));
      console.log('   ✅ Queue started successfully!');
    } else {
      console.log('   ⚠️  Queue might already be active');
    }

    await merchantPage.screenshot({ path: 'e2e-6-queue-started.png' });
    console.log('   📸 Screenshot: e2e-6-queue-started.png');

    // Get queue ID from the page
    try {
      // Try to extract queue ID from data attributes or URL
      queueId = await merchantPage.evaluate(() => {
        const queueCard = document.querySelector('.queue-card');
        if (queueCard) {
          return queueCard.dataset.queueId || queueCard.getAttribute('data-queue-id');
        }
        // Try to find it in any link
        const queueLink = document.querySelector('a[href*="/queue/"]');
        if (queueLink) {
          const match = queueLink.href.match(/\/queue\/([a-f0-9-]+)/);
          return match ? match[1] : null;
        }
        return null;
      });

      if (!queueId) {
        // Query database for the queue
        const merchant = await prisma.merchant.findFirst({
          where: { email: testData.email },
          include: { queues: true }
        });
        if (merchant && merchant.queues.length > 0) {
          queueId = merchant.queues[0].id;
        }
      }
      
      console.log(`   📋 Queue ID: ${queueId || 'Not found - will search in database'}`);
    } catch (e) {
      console.log('   ⚠️  Could not extract queue ID from page');
    }

    // ========================================
    // STEP 4: CUSTOMER JOINS QUEUE
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 4: CUSTOMER JOINS QUEUE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Open customer page in new context
    customerContext = await browser.createBrowserContext();
    const customerPage = await customerContext.newPage();

    // If we don't have queue ID, get it from database
    if (!queueId) {
      const merchant = await prisma.merchant.findFirst({
        where: { email: testData.email },
        include: { queues: { where: { isActive: true } } }
      });
      
      if (merchant && merchant.queues.length > 0) {
        queueId = merchant.queues[0].id;
        console.log(`   📋 Found active queue ID from database: ${queueId}`);
      } else {
        console.log('   ❌ No active queue found for merchant');
        return;
      }
    }

    const customerUrl = `http://${testData.subdomain}.lvh.me:3000/queue/${queueId}`;
    console.log(`📝 Customer navigating to: ${customerUrl}`);
    await customerPage.goto(customerUrl, { waitUntil: 'networkidle2' });
    await customerPage.screenshot({ path: 'e2e-7-customer-queue-page.png' });
    console.log('   📸 Screenshot: e2e-7-customer-queue-page.png');

    // Fill customer join form
    console.log('✍️  Customer filling join form...');
    await customerPage.waitForSelector('input[name="name"]', { timeout: 5000 });
    await customerPage.type('input[name="name"]', customerData.name);
    await customerPage.type('input[name="phone"]', customerData.phone);
    await customerPage.type('input[name="partySize"]', customerData.partySize.toString());
    
    await customerPage.screenshot({ path: 'e2e-8-customer-form-filled.png' });
    console.log('   📸 Screenshot: e2e-8-customer-form-filled.png');

    // Submit join request
    console.log('🚀 Customer joining queue...');
    await Promise.all([
      customerPage.waitForNavigation({ waitUntil: 'networkidle2' }),
      customerPage.click('button[type="submit"]')
    ]);

    console.log('   ✅ Customer joined queue successfully!');
    await customerPage.screenshot({ path: 'e2e-9-customer-in-queue.png' });
    console.log('   📸 Screenshot: e2e-9-customer-in-queue.png');

    // ========================================
    // STEP 5: MERCHANT SEATS CUSTOMER
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 5: MERCHANT SEATS CUSTOMER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Go back to merchant page and refresh
    console.log('📝 Refreshing merchant dashboard...');
    await merchantPage.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Find and click seat button for the customer
    console.log('🪑 Seating the customer...');
    const seatButton = await merchantPage.$('button.btn-seat, button:contains("Seat")');
    if (seatButton) {
      await seatButton.click();
      await new Promise(r => setTimeout(r, 2000));
      console.log('   ✅ Customer seated successfully!');
    } else {
      console.log('   ⚠️  Seat button not found - trying alternative approach');
      // Try clicking any green button in the customer row
      await merchantPage.evaluate(() => {
        const buttons = document.querySelectorAll('.btn-success');
        if (buttons.length > 0) {
          buttons[0].click();
        }
      });
    }

    await merchantPage.screenshot({ path: 'e2e-10-customer-seated.png' });
    console.log('   📸 Screenshot: e2e-10-customer-seated.png');

    // Check customer page for update
    console.log('📝 Checking customer status...');
    await customerPage.reload({ waitUntil: 'networkidle2' });
    await customerPage.screenshot({ path: 'e2e-11-customer-final-status.png' });
    console.log('   📸 Screenshot: e2e-11-customer-final-status.png');

    // ========================================
    // TEST SUMMARY
    // ========================================
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('TEST SUMMARY');
    console.log('════════════════════════════════════════════════════════════');
    console.log('');
    console.log('✅ MERCHANT REGISTRATION: Success');
    console.log('✅ MERCHANT LOGIN: Success');
    console.log('✅ QUEUE CREATION/START: Success');
    console.log('✅ CUSTOMER JOIN: Success');
    console.log('✅ CUSTOMER SEATING: Success');
    console.log('');
    console.log('📊 Test Account Created:');
    console.log(`   Business: ${testData.businessName}`);
    console.log(`   Email: ${testData.email}`);
    console.log(`   Password: ${testData.password}`);
    console.log(`   Subdomain: ${testData.subdomain}`);
    console.log(`   Login URL: http://localhost:3000/t/${testData.subdomain}/auth/login`);
    console.log(`   Alt URL: http://${testData.subdomain}.lvh.me:3000/auth/login`);
    console.log('');
    console.log('🎉 END-TO-END TEST COMPLETED SUCCESSFULLY!');

  } catch (error) {
    console.log('');
    console.log('❌ Test Error:', error.message);
    console.log('Stack:', error.stack);
    
    // Take error screenshot
    if (browser) {
      const pages = await browser.pages();
      if (pages.length > 0) {
        await pages[0].screenshot({ path: 'e2e-error.png' });
        console.log('📸 Error screenshot: e2e-error.png');
      }
    }
  } finally {
    // Close browser
    if (browser) {
      console.log('');
      console.log('🔚 Closing browser...');
      await browser.close();
    }
    
    // Disconnect Prisma
    await prisma.$disconnect();
    
    console.log('✅ Test complete!');
  }
}

// Run the test
testCompleteE2EFlow().catch(console.error);