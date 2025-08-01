const puppeteer = require('puppeteer');
const axios = require('axios');

const TEST_URL = 'http://localhost:3838';
const API_URL = 'http://localhost:3838/api';

// Test merchant data
const TEST_MERCHANT = {
  email: 'demo@storehub.com',
  password: 'demo123'
};

async function testSeatedNotification() {
  console.log('🧪 Testing Seated Notification Feature...\n');
  
  let browser;
  let customerBrowser;
  
  try {
    // 1. Start browser for merchant
    browser = await puppeteer.launch({ 
      headless: false,
      args: ['--window-size=1200,800', '--window-position=0,0']
    });
    const merchantPage = await browser.newPage();
    await merchantPage.setViewport({ width: 1200, height: 800 });
    
    // 2. Login as merchant
    console.log('📱 Logging in as merchant...');
    await merchantPage.goto(`${TEST_URL}/auth/login`);
    await merchantPage.waitForSelector('#email');
    await merchantPage.type('#email', TEST_MERCHANT.email);
    await merchantPage.type('#password', TEST_MERCHANT.password);
    await merchantPage.click('button[type="submit"]');
    await merchantPage.waitForNavigation();
    console.log('✅ Merchant logged in\n');
    
    // Get merchant cookies for API calls
    const cookies = await merchantPage.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    // 3. Get merchant ID and queue info
    const queuesResponse = await axios.get(`${API_URL}/queue`, {
      headers: { 'Cookie': cookieString }
    });
    
    const queue = queuesResponse.data.queues[0];
    if (!queue) {
      throw new Error('No queue found for merchant');
    }
    console.log(`📋 Using queue: ${queue.name} (ID: ${queue.id})\n`);
    
    // 4. Start customer browser and join queue
    customerBrowser = await puppeteer.launch({
      headless: false,
      args: ['--window-size=400,800', '--window-position=1210,0']
    });
    const customerPage = await customerBrowser.newPage();
    await customerPage.setViewport({ width: 400, height: 800 });
    
    console.log('👤 Customer joining queue...');
    await customerPage.goto(`${TEST_URL}/chat/${queue.merchantId}`);
    await customerPage.waitForTimeout(2000);
    
    // Fill join form
    const joinFormVisible = await customerPage.$('#joinForm');
    if (joinFormVisible) {
      await customerPage.type('#customerName', 'Test Customer');
      await customerPage.type('#customerPhone', '+60123456789');
      await customerPage.type('#partySize', '2');
      await customerPage.click('button[type="submit"]');
      console.log('✅ Customer joined queue\n');
    }
    
    // Wait for customer to be in queue
    await customerPage.waitForTimeout(3000);
    
    // 5. Get the queue entry from merchant dashboard
    await merchantPage.reload();
    await merchantPage.waitForTimeout(2000);
    
    // 6. Call the customer
    console.log('📢 Calling customer...');
    const callButton = await merchantPage.$('.queue-entry-card .btn-primary');
    if (callButton) {
      await callButton.click();
      console.log('✅ Customer called\n');
      await merchantPage.waitForTimeout(3000);
    }
    
    // 7. Monitor customer page for seated notification
    console.log('👀 Monitoring customer WebChat for seated notification...');
    
    // Set up console log monitoring on customer page
    customerPage.on('console', msg => {
      if (msg.text().includes('[SEATED]')) {
        console.log('🔔 Customer page:', msg.text());
      }
    });
    
    // 8. Assign table to customer
    console.log('🪑 Assigning table to customer...');
    
    // Find and click the assign table button
    const assignTableBtn = await merchantPage.$('.queue-entry-card.called button:has-text("Assign Table")');
    if (assignTableBtn) {
      await assignTableBtn.click();
      
      // Wait for modal and enter table number
      await merchantPage.waitForSelector('#tableNumberInput', { visible: true });
      await merchantPage.type('#tableNumberInput', '5');
      
      // Click confirm button
      const confirmBtn = await merchantPage.$('button:has-text("Assign Table")');
      await confirmBtn.click();
      console.log('✅ Table 5 assigned to customer\n');
    } else {
      // Try alternate selector
      const actionButtons = await merchantPage.$$eval('.queue-entry-card button', buttons => 
        buttons.map(btn => ({ text: btn.textContent, class: btn.className }))
      );
      console.log('Available buttons:', actionButtons);
    }
    
    // 9. Check if customer received seated notification
    console.log('⏳ Waiting for seated notification on customer side...');
    await customerPage.waitForTimeout(5000);
    
    // Check for seated message in chat
    const seatedMessage = await customerPage.evaluate(() => {
      const messages = document.querySelectorAll('.message-content');
      for (const msg of messages) {
        if (msg.textContent.includes('seated at table')) {
          return msg.textContent;
        }
      }
      return null;
    });
    
    if (seatedMessage) {
      console.log('✅ SEATED NOTIFICATION RECEIVED!');
      console.log(`   Message: "${seatedMessage}"\n`);
    } else {
      console.log('❌ Seated notification not found in chat\n');
    }
    
    // Check if session ended
    const connectionStatus = await customerPage.$eval('#connectionStatus', el => el.textContent);
    console.log(`📊 Connection status: ${connectionStatus}`);
    
    // Check if input is disabled
    const inputDisabled = await customerPage.$eval('#messageInput', el => el.disabled);
    console.log(`🔒 Message input disabled: ${inputDisabled}`);
    
    // Check if quick actions are hidden
    const quickActionsVisible = await customerPage.evaluate(() => {
      const qa = document.getElementById('quickActions');
      return qa ? window.getComputedStyle(qa).display !== 'none' : false;
    });
    console.log(`🎯 Quick actions visible: ${quickActionsVisible}\n`);
    
    console.log('✅ Test completed! Press Ctrl+C to close browsers.');
    
    // Keep browsers open for manual inspection
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  } finally {
    // Cleanup will happen when user presses Ctrl+C
  }
}

// Run the test
testSeatedNotification().catch(console.error);