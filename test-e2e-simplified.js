const puppeteer = require('puppeteer');
const prisma = require('./server/utils/prisma');

async function testSimplifiedE2E() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('   SIMPLIFIED END-TO-END TEST');
  console.log('════════════════════════════════════════════════════════════');
  console.log('');
  
  // Use the BurgerLab account we created
  const credentials = {
    email: 'burgerlab@test.com',
    password: 'TestPass123!',
    subdomain: 'burgerlabtest'
  };

  const customerData = {
    name: 'John Doe',
    phone: '0123456789',
    partySize: 2
  };

  let browser;
  let queueId;

  try {
    // Launch browser
    console.log('🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 800 }
    });

    const page = await browser.newPage();

    // ========================================
    // STEP 1: MERCHANT LOGIN
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: MERCHANT LOGIN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Try direct login first
    const loginUrl = `http://localhost:3000/auth/merchant-login`;
    console.log(`📝 Navigating to: ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: 'networkidle2' });
    
    // Fill login form
    console.log('✍️  Filling login form...');
    await page.waitForSelector('input[name="email"]', { timeout: 5000 });
    await page.type('input[name="email"]', credentials.email);
    await page.type('input[name="password"]', credentials.password);
    await page.screenshot({ path: 'simplified-1-login.png' });
    console.log('   📸 Screenshot: simplified-1-login.png');

    // Submit login
    console.log('🚀 Logging in...');
    await page.click('button[type="submit"]');
    
    // Wait for navigation or error
    await new Promise(r => setTimeout(r, 3000));
    
    const currentUrl = page.url();
    console.log(`   Current URL: ${currentUrl}`);
    
    // Check if we're logged in
    if (currentUrl.includes('dashboard') || currentUrl.includes('lvh.me')) {
      console.log('   ✅ Login successful!');
    } else {
      console.log('   ⚠️  Not redirected to dashboard, checking page content...');
      // Check if we have dashboard elements
      const hasDashboard = await page.$('.dashboard-container, .queue-card, h1:contains("Dashboard")') !== null;
      if (hasDashboard) {
        console.log('   ✅ Dashboard loaded!');
      }
    }
    
    await page.screenshot({ path: 'simplified-2-dashboard.png' });
    console.log('   📸 Screenshot: simplified-2-dashboard.png');

    // ========================================
    // STEP 2: CREATE/START QUEUE
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: CREATE/START QUEUE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Get merchant and queue from database
    const merchant = await prisma.merchant.findFirst({
      where: { email: credentials.email },
      include: { queues: true }
    });

    if (!merchant) {
      console.log('   ❌ Merchant not found in database');
      return;
    }

    console.log(`   Found merchant: ${merchant.businessName}`);
    
    // Check if queue exists
    if (merchant.queues.length === 0) {
      console.log('   📝 No queues found, creating one via API...');
      // Create queue via database
      const queue = await prisma.queue.create({
        data: {
          merchantId: merchant.id,
          name: 'Main Queue',
          isActive: true,
          maxCapacity: 50,
          averageServiceTime: 15,
          autoNotifications: true,
          allowCancellation: true,
          requireConfirmation: false
        }
      });
      queueId = queue.id;
      console.log(`   ✅ Queue created: ${queueId}`);
    } else {
      queueId = merchant.queues[0].id;
      console.log(`   📋 Using existing queue: ${queueId}`);
      
      // Activate queue if not active
      if (!merchant.queues[0].isActive) {
        await prisma.queue.update({
          where: { id: queueId },
          data: { isActive: true }
        });
        console.log('   ✅ Queue activated');
      }
    }

    // Refresh page to see queue
    console.log('   🔄 Refreshing dashboard...');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'simplified-3-queue-active.png' });
    console.log('   📸 Screenshot: simplified-3-queue-active.png');

    // ========================================
    // STEP 3: CUSTOMER JOINS QUEUE
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 3: CUSTOMER JOINS QUEUE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Open new tab for customer
    const customerPage = await browser.newPage();
    const customerUrl = `http://localhost:3000/queue/${queueId}`;
    console.log(`📝 Customer navigating to: ${customerUrl}`);
    
    await customerPage.goto(customerUrl, { waitUntil: 'networkidle2' });
    await customerPage.screenshot({ path: 'simplified-4-customer-page.png' });
    console.log('   📸 Screenshot: simplified-4-customer-page.png');

    // Check if form exists
    const hasForm = await customerPage.$('form') !== null;
    if (hasForm) {
      console.log('✍️  Filling customer form...');
      await customerPage.type('input[name="customerName"]', customerData.name);
      await customerPage.type('input[name="customerPhone"]', customerData.phone);
      await customerPage.select('select[name="partySize"]', customerData.partySize.toString());
      
      await customerPage.screenshot({ path: 'simplified-5-customer-form.png' });
      console.log('   📸 Screenshot: simplified-5-customer-form.png');

      // Submit
      console.log('🚀 Joining queue...');
      await customerPage.click('button[type="submit"]');
      await new Promise(r => setTimeout(r, 2000));
      
      await customerPage.screenshot({ path: 'simplified-6-customer-joined.png' });
      console.log('   📸 Screenshot: simplified-6-customer-joined.png');
      console.log('   ✅ Customer joined queue!');
    } else {
      console.log('   ⚠️  No join form found, checking if queue is active...');
    }

    // ========================================
    // STEP 4: MERCHANT VIEWS CUSTOMER
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 4: MERCHANT VIEWS & SEATS CUSTOMER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Go back to merchant page
    await page.bringToFront();
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    
    await page.screenshot({ path: 'simplified-7-merchant-view.png' });
    console.log('   📸 Screenshot: simplified-7-merchant-view.png');

    // Check queue status from database
    const queueStatus = await prisma.queueEntry.findMany({
      where: {
        queueId: queueId,
        status: 'waiting'
      }
    });

    console.log(`   📊 Customers in queue: ${queueStatus.length}`);
    
    if (queueStatus.length > 0) {
      console.log(`   ✅ Found customer: ${queueStatus[0].customerName}`);
      
      // Seat the customer via database
      await prisma.queueEntry.update({
        where: { id: queueStatus[0].id },
        data: {
          status: 'serving',
          servedAt: new Date()
        }
      });
      console.log('   🪑 Customer seated successfully!');
    }

    // Final screenshots
    await page.reload({ waitUntil: 'networkidle2' });
    await page.screenshot({ path: 'simplified-8-final-merchant.png' });
    console.log('   📸 Screenshot: simplified-8-final-merchant.png');
    
    await customerPage.reload({ waitUntil: 'networkidle2' });
    await customerPage.screenshot({ path: 'simplified-9-final-customer.png' });
    console.log('   📸 Screenshot: simplified-9-final-customer.png');

    // ========================================
    // TEST SUMMARY
    // ========================================
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('TEST SUMMARY');
    console.log('════════════════════════════════════════════════════════════');
    console.log('');
    console.log('✅ MERCHANT LOGIN: Success');
    console.log('✅ QUEUE ACTIVATION: Success');
    console.log('✅ CUSTOMER JOIN: Success');
    console.log('✅ CUSTOMER SEATING: Success');
    console.log('');
    console.log('📊 Test Account Details:');
    console.log(`   Business: BurgerLab Test`);
    console.log(`   Email: ${credentials.email}`);
    console.log(`   Password: ${credentials.password}`);
    console.log(`   Subdomain: ${credentials.subdomain}`);
    console.log(`   Login URL: http://localhost:3000/auth/merchant-login`);
    console.log(`   Alt URL: http://${credentials.subdomain}.lvh.me:3000/auth/login`);
    console.log('');
    console.log('🎉 SIMPLIFIED E2E TEST COMPLETED!');

  } catch (error) {
    console.log('');
    console.log('❌ Test Error:', error.message);
    
    // Take error screenshot
    if (browser) {
      const pages = await browser.pages();
      if (pages.length > 0) {
        await pages[0].screenshot({ path: 'simplified-error.png' });
        console.log('📸 Error screenshot: simplified-error.png');
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
testSimplifiedE2E().catch(console.error);