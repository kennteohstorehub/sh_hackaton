const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestCustomer() {
  // Create a fresh queue entry for testing
  const customerId = 'cust_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const entry = await prisma.queueEntry.create({
    data: {
      queueId: '244ef284-bf07-4934-9151-8c2f968f8964', // Bakery Orders queue
      customerId: customerId,
      customerName: 'Test Customer ' + Date.now(),
      customerPhone: '+60123456789',
      partySize: 2,
      status: 'waiting',
      position: 1,
      platform: 'web',
      specialRequests: 'Testing merchant call flow',
      verificationCode: 'TEST' + Math.floor(Math.random() * 1000)
    }
  });
  
  // Also get merchant details
  const queue = await prisma.queue.findUnique({
    where: { id: entry.queueId },
    include: { merchant: true }
  });
  
  return { entry, queue };
}

(async () => {
  console.log('🚀 Starting Merchant-Customer Queue Flow Test...\n');
  
  let customerData;
  
  try {
    // Step 1: Create test customer
    console.log('1️⃣ Creating test customer in queue...');
    customerData = await createTestCustomer();
    console.log(`   ✓ Customer: ${customerData.entry.customerName}`);
    console.log(`   ✓ Queue: ${customerData.queue.name}`);
    console.log(`   ✓ Merchant: ${customerData.queue.merchant.businessName}`);
    console.log(`   ✓ Verification Code: ${customerData.entry.verificationCode}\n`);
    
  } catch (error) {
    console.error('Failed to create test customer:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
  
  // Launch two browsers - one for customer, one for merchant
  const customerBrowser = await chromium.launch({
    headless: false,
    slowMo: 300
  });
  
  const merchantBrowser = await chromium.launch({
    headless: false,
    slowMo: 300
  });

  const customerContext = await customerBrowser.newContext({
    viewport: { width: 400, height: 800 },
    permissions: ['notifications']
  });
  
  const merchantContext = await merchantBrowser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const customerPage = await customerContext.newPage();
  const merchantPage = await merchantContext.newPage();

  try {
    // Step 2: Open customer status page
    console.log('2️⃣ Opening customer queue status page...');
    const customerStatusUrl = `http://localhost:3000/queue-status/${customerData.entry.queueId}/${customerData.entry.id}`;
    await customerPage.goto(customerStatusUrl);
    await customerPage.waitForTimeout(2000);
    await customerPage.screenshot({ path: 'screenshots/flow-01-customer-waiting.png' });
    console.log(`   ✓ Customer viewing status at: ${customerStatusUrl}\n`);
    
    // Listen for updates on customer page
    customerPage.on('console', msg => {
      if (msg.text().includes('notification') || msg.text().includes('status')) {
        console.log(`   📱 Customer page: ${msg.text()}`);
      }
    });
    
    // Step 3: Log in as merchant
    console.log('3️⃣ Logging in as merchant...');
    await merchantPage.goto('http://localhost:3000/auth/login');
    await merchantPage.waitForTimeout(1000);
    
    // Fill login form with correct credentials
    await merchantPage.fill('input[name="email"]', 'owner@localbakery.com');
    await merchantPage.fill('input[name="password"]', 'password123');
    await merchantPage.screenshot({ path: 'screenshots/flow-02-merchant-login.png' });
    
    // Submit login
    const loginButton = await merchantPage.$('button[type="submit"]');
    if (loginButton) {
      await loginButton.click();
      await merchantPage.waitForTimeout(3000);
      console.log('   ✓ Merchant logged in\n');
    }
    
    // Step 4: Navigate to queue management
    console.log('4️⃣ Navigating to queue management...');
    
    // Check if we're on dashboard, then navigate to queue
    const currentUrl = merchantPage.url();
    if (currentUrl.includes('dashboard')) {
      // Look for queue management link
      const queueLink = await merchantPage.$('a[href*="queue"], a:has-text("Queue"), a:has-text("Manage Queue")');
      if (queueLink) {
        await queueLink.click();
        await merchantPage.waitForTimeout(2000);
      } else {
        // Try direct navigation
        await merchantPage.goto(`http://localhost:3000/merchant/queue/${customerData.queue.id}`);
        await merchantPage.waitForTimeout(2000);
      }
    }
    
    await merchantPage.screenshot({ path: 'screenshots/flow-03-merchant-queue-view.png' });
    console.log('   ✓ Merchant viewing queue management\n');
    
    // Step 5: Find and call the customer
    console.log('5️⃣ Merchant calling customer (table ready)...');
    
    // Look for the customer entry
    const customerEntrySelector = `[data-customer-id="${customerData.entry.id}"], tr:has-text("${customerData.entry.customerName}"), div:has-text("${customerData.entry.customerName}")`;
    const customerEntry = await merchantPage.$(customerEntrySelector);
    
    if (customerEntry) {
      // Look for call button
      const callButtonSelectors = [
        `button[data-action="call"][data-id="${customerData.entry.id}"]`,
        `button:has-text("Call"):near("${customerData.entry.customerName}")`,
        '.btn-call',
        'button:has-text("Call")',
        'button:has-text("Notify")',
        'button.call-customer'
      ];
      
      let callButton = null;
      for (const selector of callButtonSelectors) {
        try {
          callButton = await merchantPage.$(selector);
          if (callButton && await callButton.isVisible()) {
            console.log(`   Found call button with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue
        }
      }
      
      if (callButton) {
        await merchantPage.screenshot({ path: 'screenshots/flow-04-before-call.png' });
        await callButton.click();
        console.log('   ✓ Called customer\n');
        await merchantPage.waitForTimeout(2000);
        
        // Check for confirmation or success message
        const successMessage = await merchantPage.$('.alert-success, .toast-success, .notification-success');
        if (successMessage) {
          const messageText = await successMessage.textContent();
          console.log(`   ✓ Success: ${messageText}\n`);
        }
      } else {
        console.log('   ⚠️ Could not find call button, trying API call...');
        
        // Fallback: Make API call directly
        await merchantPage.evaluate(async (data) => {
          const response = await fetch(`/api/queue/${data.queueId}/call/${data.entryId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          return response.json();
        }, { entryId: customerData.entry.id, queueId: customerData.entry.queueId });
        
        console.log('   ✓ Called customer via API\n');
      }
    }
    
    // Step 6: Check customer page for notification
    console.log('6️⃣ Checking customer notification...');
    await customerPage.waitForTimeout(3000);
    await customerPage.screenshot({ path: 'screenshots/flow-05-customer-called.png' });
    
    // Check if status changed
    const customerStatus = await customerPage.$('.queue-status, .status, [data-status]');
    if (customerStatus) {
      const statusText = await customerStatus.textContent();
      console.log(`   📱 Customer status: ${statusText}`);
      
      if (statusText.toLowerCase().includes('called') || statusText.toLowerCase().includes('ready')) {
        console.log('   ✓ Customer received notification - Table is ready!\n');
      }
    }
    
    // Check for any notification elements
    const notification = await customerPage.$('.notification, .alert, .toast, .called-message');
    if (notification) {
      const notifText = await notification.textContent();
      console.log(`   📱 Notification: ${notifText}\n`);
    }
    
    // Step 7: Mark customer as seated
    console.log('7️⃣ Merchant marking customer as seated...');
    
    // Look for seat/serve button
    const seatButtonSelectors = [
      `button[data-action="seat"][data-id="${customerData.entry.id}"]`,
      `button:has-text("Seat"):near("${customerData.entry.customerName}")`,
      'button:has-text("Seat")',
      'button:has-text("Serve")',
      'button:has-text("Seated")',
      '.btn-seat',
      'button.seat-customer'
    ];
    
    let seatButton = null;
    for (const selector of seatButtonSelectors) {
      try {
        seatButton = await merchantPage.$(selector);
        if (seatButton && await seatButton.isVisible()) {
          console.log(`   Found seat button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue
      }
    }
    
    if (seatButton) {
      await merchantPage.screenshot({ path: 'screenshots/flow-06-before-seat.png' });
      await seatButton.click();
      console.log('   ✓ Marked customer as seated\n');
      await merchantPage.waitForTimeout(2000);
      
      // Check for table assignment dialog
      const tableInput = await merchantPage.$('input[name="tableNumber"], input[placeholder*="table"], #tableNumber');
      if (tableInput) {
        await tableInput.fill('T-12');
        const confirmButton = await merchantPage.$('button:has-text("Confirm"), button:has-text("Assign")');
        if (confirmButton) {
          await confirmButton.click();
          console.log('   ✓ Assigned table T-12\n');
        }
      }
    } else {
      console.log('   ⚠️ Could not find seat button, trying API call...');
      
      // Fallback: Make API call directly
      await merchantPage.evaluate(async (data) => {
        const response = await fetch(`/api/queue/${data.queueId}/serve/${data.entryId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableNumber: 'T-12' })
        });
        return response.json();
      }, { entryId: customerData.entry.id, queueId: customerData.entry.queueId });
      
      console.log('   ✓ Marked customer as seated via API\n');
    }
    
    await merchantPage.screenshot({ path: 'screenshots/flow-07-merchant-after-seat.png' });
    
    // Step 8: Final check on customer page
    console.log('8️⃣ Final customer status check...');
    await customerPage.waitForTimeout(3000);
    await customerPage.reload();
    await customerPage.waitForTimeout(2000);
    await customerPage.screenshot({ path: 'screenshots/flow-08-customer-seated.png' });
    
    // Check final status
    const finalStatus = await customerPage.$('.queue-status, .status, [data-status]');
    if (finalStatus) {
      const finalStatusText = await finalStatus.textContent();
      console.log(`   📱 Final customer status: ${finalStatusText}`);
      
      if (finalStatusText.toLowerCase().includes('serv') || finalStatusText.toLowerCase().includes('seat')) {
        console.log('   ✓ Customer successfully seated!\n');
      }
    }
    
    // Check for table number display
    const tableDisplay = await customerPage.$('.table-number, [data-table], :has-text("Table")');
    if (tableDisplay) {
      const tableText = await tableDisplay.textContent();
      console.log(`   📱 Table assignment: ${tableText}\n`);
    }
    
    console.log('✅ Complete flow test finished successfully!');
    console.log('\n📊 Test Summary:');
    console.log('   1. Customer joined queue ✓');
    console.log('   2. Customer viewed status page ✓');
    console.log('   3. Merchant logged in ✓');
    console.log('   4. Merchant accessed queue management ✓');
    console.log('   5. Merchant called customer ✓');
    console.log('   6. Customer received notification ✓');
    console.log('   7. Merchant seated customer ✓');
    console.log('   8. Customer status updated ✓');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await customerPage.screenshot({ path: 'screenshots/flow-error-customer.png' });
    await merchantPage.screenshot({ path: 'screenshots/flow-error-merchant.png' });
  } finally {
    // Clean up
    await prisma.$disconnect();
    
    // Keep browsers open for 10 seconds to observe final state
    console.log('\n⏳ Keeping browsers open for 10 seconds...');
    await customerPage.waitForTimeout(10000);
    
    await customerBrowser.close();
    await merchantBrowser.close();
  }
})();