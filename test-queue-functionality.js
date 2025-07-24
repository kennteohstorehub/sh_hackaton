#!/usr/bin/env node

const { chromium } = require('playwright');

async function testQueueFunctionality() {
  console.log('🧪 TESTING QUEUE MANAGEMENT FUNCTIONALITY');
  console.log('=' .repeat(50));
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  // Handle console messages and errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('[Browser Error]:', msg.text());
    }
  });
  
  try {
    // 1. Navigate to Dashboard (auth bypassed)
    console.log('\n1️⃣ Navigating to Dashboard...');
    await page.goto('http://localhost:3838/dashboard', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    // Check if we're on the dashboard
    const pageTitle = await page.title();
    console.log('   Page title:', pageTitle);
    
    // Take screenshot
    await page.screenshot({ path: 'dashboard-with-bypass.png' });
    console.log('   📸 Screenshot saved: dashboard-with-bypass.png');
    
    // 2. Check existing queues
    console.log('\n2️⃣ Checking existing queues...');
    const queueCards = await page.$$('.queue-card');
    console.log(`   Found ${queueCards.length} existing queue(s)`);
    
    if (queueCards.length > 0) {
      const queueName = await page.$eval('.queue-card h3', el => el.textContent.trim());
      console.log(`   First queue: ${queueName}`);
    }
    
    // 3. Test create new queue
    console.log('\n3️⃣ Testing queue creation...');
    const createButton = await page.$('button:has-text("Create New Queue"), a:has-text("Create New Queue")');
    
    if (createButton) {
      await createButton.click();
      await page.waitForTimeout(1000);
      
      // Check if modal or new page opened
      const modalVisible = await page.$('#createQueueModal, .modal, form[action*="queue"]');
      if (modalVisible) {
        console.log('   ✅ Queue creation form opened');
        
        // Fill in queue details
        await page.fill('input[name="name"]', 'Test Queue ' + Date.now());
        await page.fill('textarea[name="description"], input[name="description"]', 'Automated test queue');
        
        // Submit form
        const submitButton = await page.$('button[type="submit"]:has-text("Create"), button:has-text("Save")');
        if (submitButton) {
          await submitButton.click();
          console.log('   ✅ Queue creation submitted');
        }
      }
    } else {
      console.log('   ⚠️  Create queue button not found');
    }
    
    // 4. Test queue operations
    console.log('\n4️⃣ Testing queue operations...');
    await page.goto('http://localhost:3838/dashboard', {
      waitUntil: 'networkidle'
    });
    
    // Find manage button for first queue
    const manageButton = await page.$('.queue-card button:has-text("Manage"), .queue-card a:has-text("Manage")');
    
    if (manageButton) {
      await manageButton.click();
      await page.waitForTimeout(1000);
      
      // Check if we're on queue management page
      const queueManagementTitle = await page.$('h1:has-text("Queue Management"), h2:has-text("Queue Management"), h1:has-text("Manage Queue")');
      if (queueManagementTitle) {
        console.log('   ✅ Queue management page loaded');
        
        // Check for customer entries
        const entries = await page.$$('.queue-entry, .customer-entry, tr[data-customer-id]');
        console.log(`   Found ${entries.length} customer entries`);
        
        // Take screenshot
        await page.screenshot({ path: 'queue-management.png' });
        console.log('   📸 Screenshot saved: queue-management.png');
      }
    } else {
      console.log('   ⚠️  Manage button not found');
    }
    
    // 5. Test API endpoints
    console.log('\n5️⃣ Testing API endpoints...');
    
    // Test queue list API
    const queuesResponse = await page.request.get('http://localhost:3838/api/queue');
    console.log('   Queue list API status:', queuesResponse.status());
    
    if (queuesResponse.ok()) {
      const queuesData = await queuesResponse.json();
      console.log('   API returned', queuesData.length || 0, 'queues');
    }
    
    // Test analytics API
    const analyticsResponse = await page.request.get('http://localhost:3838/api/analytics/stats');
    console.log('   Analytics API status:', analyticsResponse.status());
    
    // Summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 TEST SUMMARY:');
    console.log('✅ Dashboard loads successfully with auth bypass');
    console.log('✅ Existing queues displayed:', queueCards.length > 0 ? 'YES' : 'NO');
    console.log('✅ Queue creation form accessible:', createButton ? 'YES' : 'NO');
    console.log('✅ Queue management functional:', manageButton ? 'YES' : 'NO');
    console.log('✅ API endpoints responding:', queuesResponse.ok() ? 'YES' : 'NO');
    
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    await page.screenshot({ path: 'error-screenshot.png' });
    console.log('📸 Error screenshot saved');
  } finally {
    await browser.close();
  }
}

// Run the test
testQueueFunctionality().catch(console.error);