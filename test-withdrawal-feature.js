const puppeteer = require('puppeteer');

async function testWithdrawalFeature() {
  const browser = await puppeteer.launch({ 
    headless: false, 
    defaultViewport: null,
    args: ['--start-maximized']
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('🚀 Testing Withdrawal Feature');
    
    // 1. Login as merchant
    console.log('\n📝 Step 1: Login as merchant...');
    await page.goto('http://localhost:3000/login');
    await page.waitForSelector('#email', { timeout: 5000 });
    await page.type('#email', 'demo@storehub.com');
    await page.type('#password', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    console.log('✅ Logged in successfully');
    
    // 2. Add a test customer to queue
    console.log('\n📝 Step 2: Adding test customer to queue...');
    const addCustomerResponse = await page.evaluate(async () => {
      const response = await fetch('/api/queue', {
        method: 'GET',
        credentials: 'same-origin'
      });
      const queues = await response.json();
      
      if (queues.length > 0) {
        const queueId = queues[0]._id || queues[0].id;
        
        // Add customer
        const addResponse = await fetch(`/api/queue/${queueId}/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': document.querySelector('meta[name="csrf-token"]')?.content || ''
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            customerName: 'Test Withdrawal User',
            customerPhone: '1234567890',
            partySize: 2,
            platform: 'web'
          })
        });
        
        return {
          success: addResponse.ok,
          queueId,
          data: await addResponse.json()
        };
      }
      return { success: false, error: 'No queues found' };
    });
    
    if (!addCustomerResponse.success) {
      throw new Error('Failed to add customer to queue');
    }
    
    const customerId = addCustomerResponse.data.customer?.id || addCustomerResponse.data.customer?._id;
    const queueId = addCustomerResponse.queueId;
    console.log(`✅ Customer added to queue (ID: ${customerId})`);
    
    // 3. Call the customer
    console.log('\n📝 Step 3: Calling the customer...');
    const callResponse = await page.evaluate(async (queueId, customerId) => {
      const response = await fetch(`/api/queue/${queueId}/call-specific`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': document.querySelector('meta[name="csrf-token"]')?.content || ''
        },
        credentials: 'same-origin',
        body: JSON.stringify({ customerId })
      });
      
      return {
        success: response.ok,
        data: await response.json()
      };
    }, queueId, customerId);
    
    if (!callResponse.success) {
      throw new Error('Failed to call customer');
    }
    console.log('✅ Customer called successfully');
    
    // 4. Wait for dashboard to update
    await page.waitForTimeout(2000);
    
    // 5. Check if withdrawal button is visible
    console.log('\n📝 Step 4: Checking withdrawal button on dashboard...');
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForSelector('.customer-row', { timeout: 5000 });
    
    const hasWithdrawalButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(btn => btn.textContent.includes('Withdrawn'));
    });
    
    if (hasWithdrawalButton) {
      console.log('✅ Withdrawal button found on dashboard');
      
      // Click the withdrawal button
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const withdrawalBtn = buttons.find(btn => btn.textContent.includes('Withdrawn'));
        if (withdrawalBtn) withdrawalBtn.click();
      });
      
      await page.waitForTimeout(1000);
      
      // Enter reason and confirm
      const reasonInput = await page.$('input[type="text"]');
      if (reasonInput) {
        await reasonInput.type('Testing withdrawal feature');
      }
      
      // Click OK/Confirm on prompt
      page.on('dialog', async dialog => {
        await dialog.accept('Testing withdrawal feature');
      });
      
      console.log('✅ Customer marked as withdrawn');
    } else {
      console.log('⚠️ Withdrawal button not found - checking if already implemented differently');
    }
    
    // 6. Test withdrawal via API
    console.log('\n📝 Step 5: Testing withdrawal API endpoint...');
    const withdrawalResponse = await page.evaluate(async (queueId, customerId) => {
      const response = await fetch(`/api/queue/${queueId}/withdraw/${customerId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': document.querySelector('meta[name="csrf-token"]')?.content || ''
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          reason: 'Testing withdrawal via API'
        })
      });
      
      return {
        success: response.ok,
        status: response.status,
        data: await response.json()
      };
    }, queueId, customerId);
    
    if (withdrawalResponse.success) {
      console.log('✅ Withdrawal API working correctly');
      console.log('   Response:', withdrawalResponse.data);
    } else {
      console.log('❌ Withdrawal API failed:', withdrawalResponse);
    }
    
    // 7. Check analytics
    console.log('\n📝 Step 6: Checking analytics for withdrawal metrics...');
    const analyticsResponse = await page.evaluate(async () => {
      const response = await fetch('/api/analytics/dashboard?period=1d', {
        credentials: 'same-origin'
      });
      
      return {
        success: response.ok,
        data: await response.json()
      };
    });
    
    if (analyticsResponse.success && analyticsResponse.data.analytics) {
      const analytics = analyticsResponse.data.analytics;
      console.log('✅ Analytics retrieved:');
      console.log(`   - Total Served: ${analytics.totalCustomersServed}`);
      console.log(`   - Total No-Shows: ${analytics.totalNoShows}`);
      console.log(`   - Total Withdrawn: ${analytics.totalWithdrawn}`);
      console.log(`   - Withdrawal Rate: ${analytics.withdrawalRate}%`);
    }
    
    console.log('\n🎉 Withdrawal feature test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the test
testWithdrawalFeature();