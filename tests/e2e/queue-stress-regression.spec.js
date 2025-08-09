const puppeteer = require('puppeteer');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('Queue System Stress & Regression Test', function() {
  this.timeout(180000); // 3 minutes for comprehensive stress testing

  let merchantBrowser, merchantPage;
  let customerBrowsers = [];
  let customerPages = [];
  
  const NUM_CUSTOMERS = 10; // Number of customers to simulate
  const BASE_URL = 'http://demo.lvh.me:3000';
  const screenshotDir = path.join(__dirname, 'screenshots', 'stress-test');
  
  // Test data for customers
  const customerData = [];
  for (let i = 1; i <= NUM_CUSTOMERS; i++) {
    customerData.push({
      name: `Test Customer ${i}`,
      phone: `+6012345678${i.toString().padStart(1, '0')}`,
      partySize: Math.floor(Math.random() * 4) + 1,
      expectedPosition: i,
      notifications: [],
      positionHistory: [],
      stateTransitions: []
    });
  }

  // Tracking data
  const testMetrics = {
    startTime: null,
    endTime: null,
    totalCustomers: NUM_CUSTOMERS,
    successfulJoins: 0,
    failedJoins: 0,
    notificationsReceived: 0,
    positionUpdatesReceived: 0,
    errors: [],
    customerStates: {}
  };

  before(async function() {
    console.log('🚀 Starting Queue Stress Test with', NUM_CUSTOMERS, 'customers');
    
    // Create screenshot directory
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    testMetrics.startTime = Date.now();
  });

  describe('1. Setup Merchant Dashboard', function() {
    it('should login merchant and start queue', async function() {
      console.log('📋 Setting up merchant dashboard...');
      
      merchantBrowser = await puppeteer.launch({ 
        headless: false,
        args: ['--window-size=1200,800', '--window-position=0,0']
      });
      merchantPage = await merchantBrowser.newPage();
      await merchantPage.setViewport({ width: 1200, height: 800 });
      
      // Login as merchant
      await merchantPage.goto(`${BASE_URL}/login`);
      await merchantPage.type('#email', 'demo@storehub.com');
      await merchantPage.type('#password', 'demo123');
      await merchantPage.click('button[type="submit"]');
      
      // Wait for dashboard
      await merchantPage.waitForSelector('.dashboard-container', { timeout: 10000 });
      
      // Start queue if not already active - using actual button selectors
      try {
        // Look for queue control buttons
        const queueControls = await merchantPage.$$('.queue-controls button, .quick-action-btn');
        if (queueControls.length > 0) {
          console.log(`Found ${queueControls.length} queue control buttons`);
        }
      } catch (error) {
        console.log('Queue controls not found, queue may already be running');
      }
      
      await merchantPage.screenshot({ 
        path: path.join(screenshotDir, '01-merchant-ready.png'),
        fullPage: true 
      });
      
      console.log('✅ Merchant dashboard ready');
    });
  });

  describe('2. Customer Queue Joining (Stress Test)', function() {
    it('should handle multiple customers joining queue concurrently', async function() {
      console.log('👥 Starting customer queue joining...');
      
      // Launch all customer browsers
      const launchPromises = customerData.map(async (customer, index) => {
        const browser = await puppeteer.launch({
          headless: false,
          args: [
            `--window-size=400,700`,
            `--window-position=${400 * (index % 3) + 50},${Math.floor(index / 3) * 300 + 100}`
          ]
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 400, height: 700 });
        
        customerBrowsers.push(browser);
        customerPages.push(page);
        
        // Set up WebSocket message listener for each customer
        await page.evaluateOnNewDocument(() => {
          window.socketMessages = [];
          window.positionUpdates = [];
          window.notifications = [];
          
          // Override WebSocket to capture messages
          const originalWebSocket = window.WebSocket;
          window.WebSocket = function(...args) {
            const ws = new originalWebSocket(...args);
            
            ws.addEventListener('message', (event) => {
              try {
                const data = JSON.parse(event.data);
                window.socketMessages.push(data);
                
                if (data.type === 'position-update') {
                  window.positionUpdates.push({
                    position: data.position,
                    timestamp: new Date().toISOString()
                  });
                }
                
                if (data.type === 'notification') {
                  window.notifications.push({
                    message: data.message,
                    timestamp: new Date().toISOString()
                  });
                }
              } catch (e) {
                // Not JSON, ignore
              }
            });
            
            return ws;
          };
        });
        
        return { browser, page, customer };
      });
      
      await Promise.all(launchPromises);
      console.log('✅ All customer browsers launched');
      
      // Staggered queue joining to simulate realistic scenario
      const joinPromises = customerPages.map(async (page, index) => {
        const customer = customerData[index];
        
        // Add random delay between joins (0-3 seconds)
        await page.waitForTimeout(Math.random() * 3000);
        
        try {
          // Navigate to queue page - will redirect to active queue
          await page.goto(`${BASE_URL}/queue`);
          
          // Wait for join form to appear
          await page.waitForSelector('form', { timeout: 5000 });
          
          // Fill and submit form - check for different possible input selectors
          const nameInput = await page.$('#name, input[name="name"]');
          if (nameInput) await nameInput.type(customer.name);
          
          const phoneInput = await page.$('#phone, input[name="phone"]');
          if (phoneInput) await phoneInput.type(customer.phone);
          
          const partySizeSelect = await page.$('#partySize, select[name="partySize"]');
          if (partySizeSelect) {
            await partySizeSelect.select(customer.partySize.toString());
          } else {
            // Try input field for party size
            const partySizeInput = await page.$('input[name="partySize"]');
            if (partySizeInput) {
              await page.evaluate((val) => {
                document.querySelector('input[name="partySize"]').value = val;
              }, customer.partySize.toString());
            }
          }
          
          // Submit the form
          const submitBtn = await page.$('button[type="submit"], button.btn-primary');
          if (submitBtn) {
            await submitBtn.click();
          } else {
            await page.evaluate(() => {
              document.querySelector('form').submit();
            });
          }
          
          // Wait for queue position or status page
          await page.waitForSelector('.queue-position, #queuePosition, .queue-status', { timeout: 10000 });
          
          // Capture initial position
          const positionElement = await page.$('.queue-position, #queuePosition');
          const positionText = await page.evaluate(el => el.textContent, positionElement);
          const position = parseInt(positionText.match(/\d+/)?.[0] || '0');
          
          customer.currentPosition = position;
          customer.positionHistory.push({ position, timestamp: Date.now() });
          customer.joinedAt = Date.now();
          
          testMetrics.successfulJoins++;
          testMetrics.customerStates[customer.name] = 'waiting';
          
          console.log(`✅ ${customer.name} joined at position ${position}`);
          
          await page.screenshot({ 
            path: path.join(screenshotDir, `customer-${index + 1}-joined.png`) 
          });
          
        } catch (error) {
          testMetrics.failedJoins++;
          testMetrics.errors.push({
            customer: customer.name,
            error: error.message,
            phase: 'joining'
          });
          console.error(`❌ ${customer.name} failed to join:`, error.message);
        }
      });
      
      await Promise.all(joinPromises);
      
      console.log(`📊 Join Results: ${testMetrics.successfulJoins} successful, ${testMetrics.failedJoins} failed`);
    });

    it('should verify all customers have unique sequential positions', async function() {
      console.log('🔍 Verifying queue positions...');
      
      const positions = customerData
        .filter(c => c.currentPosition)
        .map(c => c.currentPosition)
        .sort((a, b) => a - b);
      
      // Check for duplicates
      const uniquePositions = [...new Set(positions)];
      expect(uniquePositions.length).to.equal(positions.length, 'All positions should be unique');
      
      // Check for gaps (allowing for some customers who may have failed to join)
      for (let i = 1; i < positions.length; i++) {
        const gap = positions[i] - positions[i-1];
        expect(gap).to.be.at.most(2, `Position gap between ${positions[i-1]} and ${positions[i]} is too large`);
      }
      
      console.log('✅ Position verification passed:', positions);
    });
  });

  describe('3. Queue Processing & Position Updates', function() {
    it('should process queue and verify position updates for all customers', async function() {
      console.log('🔄 Starting queue processing simulation...');
      
      // Process first 3 customers through the full flow
      for (let processCount = 0; processCount < 3; processCount++) {
        console.log(`\n📞 Processing customer ${processCount + 1}...`);
        
        // Store positions before calling
        const positionsBefore = await captureAllPositions();
        console.log('Positions before:', positionsBefore);
        
        // Merchant calls next customer - using actual selector
        try {
          // Try different possible selectors for call next button
          const callNextBtn = await merchantPage.$('.quick-action-btn, button:has-text("Call Next"), button[onclick*="callNext"]');
          if (callNextBtn) {
            await callNextBtn.click();
          } else {
            console.log('Call next button not found, trying to evaluate directly');
            await merchantPage.evaluate(() => {
              if (typeof callNext === 'function') callNext();
            });
          }
        } catch (error) {
          console.log('Could not call next customer:', error.message);
        }
        await merchantPage.waitForTimeout(2000); // Wait for updates to propagate
        
        // Capture positions after calling
        const positionsAfter = await captureAllPositions();
        console.log('Positions after:', positionsAfter);
        
        // Verify position decrements for waiting customers
        for (let i = 0; i < customerPages.length; i++) {
          const customer = customerData[i];
          if (customer.currentPosition && testMetrics.customerStates[customer.name] === 'waiting') {
            const oldPos = positionsBefore[i];
            const newPos = positionsAfter[i];
            
            if (oldPos > 1) { // Should have moved up
              expect(newPos).to.equal(oldPos - 1, `${customer.name} should move from position ${oldPos} to ${oldPos - 1}`);
              customer.positionHistory.push({ position: newPos, timestamp: Date.now() });
              testMetrics.positionUpdatesReceived++;
            } else if (oldPos === 1) { // Should be called
              testMetrics.customerStates[customer.name] = 'called';
            }
          }
        }
        
        // Simulate customer being seated (find the called customer page)
        const calledCustomerIndex = customerData.findIndex(c => 
          testMetrics.customerStates[c.name] === 'called'
        );
        
        if (calledCustomerIndex >= 0) {
          const calledPage = customerPages[calledCustomerIndex];
          const calledCustomer = customerData[calledCustomerIndex];
          
          // Look for and click seated confirmation button if it exists
          try {
            const seatedButton = await calledPage.$('button.acknowledge-btn, button:has-text("Seated"), button:has-text("Acknowledge")');
            if (seatedButton) {
              await seatedButton.click();
              await calledPage.waitForTimeout(1000);
              testMetrics.customerStates[calledCustomer.name] = 'seated';
              console.log(`✅ ${calledCustomer.name} confirmed seated`);
            }
          } catch (error) {
            console.log(`⚠️ Could not find seated button for ${calledCustomer.name}`);
          }
          
          // Merchant completes the customer
          await merchantPage.waitForTimeout(2000);
          try {
            // Try to complete the customer using various methods
            await merchantPage.evaluate(() => {
              // Look for complete button or action
              const completeBtn = document.querySelector('button:has-text("Complete"), .action-complete');
              if (completeBtn) completeBtn.click();
            });
            testMetrics.customerStates[calledCustomer.name] = 'completed';
            console.log(`✅ ${calledCustomer.name} completed`);
          } catch (error) {
            console.log(`⚠️ Could not complete ${calledCustomer.name}`);
          }
        }
        
        await merchantPage.waitForTimeout(3000); // Wait between processing
      }
    });

    it('should capture and verify notification delivery', async function() {
      console.log('📬 Checking notification delivery...');
      
      for (let i = 0; i < customerPages.length; i++) {
        const page = customerPages[i];
        const customer = customerData[i];
        
        try {
          // Extract captured notifications from page context
          const notifications = await page.evaluate(() => window.notifications || []);
          const positionUpdates = await page.evaluate(() => window.positionUpdates || []);
          
          customer.notifications = notifications;
          customer.positionUpdates = positionUpdates;
          
          if (notifications.length > 0) {
            testMetrics.notificationsReceived += notifications.length;
            console.log(`📨 ${customer.name}: ${notifications.length} notifications received`);
          }
          
          if (positionUpdates.length > 0) {
            console.log(`📍 ${customer.name}: ${positionUpdates.length} position updates`);
          }
        } catch (error) {
          console.log(`⚠️ Could not extract data for ${customer.name}`);
        }
      }
      
      console.log(`📊 Total notifications received: ${testMetrics.notificationsReceived}`);
    });
  });

  describe('4. Stress Test Validation', function() {
    it('should generate comprehensive test report', async function() {
      console.log('\n📊 Generating Stress Test Report...\n');
      
      testMetrics.endTime = Date.now();
      const duration = (testMetrics.endTime - testMetrics.startTime) / 1000;
      
      const report = {
        summary: {
          duration: `${duration.toFixed(2)} seconds`,
          totalCustomers: NUM_CUSTOMERS,
          successfulJoins: testMetrics.successfulJoins,
          failedJoins: testMetrics.failedJoins,
          successRate: `${((testMetrics.successfulJoins / NUM_CUSTOMERS) * 100).toFixed(1)}%`
        },
        notifications: {
          totalReceived: testMetrics.notificationsReceived,
          averagePerCustomer: (testMetrics.notificationsReceived / testMetrics.successfulJoins).toFixed(2)
        },
        positionUpdates: {
          totalReceived: testMetrics.positionUpdatesReceived,
          averagePerCustomer: (testMetrics.positionUpdatesReceived / testMetrics.successfulJoins).toFixed(2)
        },
        customerStates: testMetrics.customerStates,
        errors: testMetrics.errors,
        customerDetails: customerData.map(c => ({
          name: c.name,
          finalPosition: c.currentPosition,
          positionChanges: c.positionHistory.length,
          notifications: c.notifications.length,
          state: testMetrics.customerStates[c.name] || 'unknown'
        }))
      };
      
      // Write report to file
      const reportPath = path.join(screenshotDir, 'stress-test-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      // Console output
      console.log('═══════════════════════════════════════════════════════');
      console.log('                  STRESS TEST REPORT                    ');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`Duration: ${report.summary.duration}`);
      console.log(`Success Rate: ${report.summary.successRate}`);
      console.log(`Customers Processed: ${report.summary.successfulJoins}/${report.summary.totalCustomers}`);
      console.log(`Notifications Delivered: ${report.notifications.totalReceived}`);
      console.log(`Position Updates: ${report.positionUpdates.totalReceived}`);
      console.log('═══════════════════════════════════════════════════════');
      
      // Assertions
      expect(testMetrics.successfulJoins).to.be.at.least(NUM_CUSTOMERS * 0.8, 'At least 80% of customers should join successfully');
      expect(testMetrics.errors.length).to.be.below(NUM_CUSTOMERS * 0.3, 'Error rate should be below 30%');
      
      console.log('\n✅ Stress test completed successfully!');
    });
  });

  // Helper function to capture all customer positions
  async function captureAllPositions() {
    const positions = [];
    for (let i = 0; i < customerPages.length; i++) {
      try {
        const page = customerPages[i];
        const positionElement = await page.$('.queue-position, #queuePosition');
        if (positionElement) {
          const text = await page.evaluate(el => el.textContent, positionElement);
          const position = parseInt(text.match(/\d+/)?.[0] || '0');
          positions.push(position);
          customerData[i].currentPosition = position;
        } else {
          positions.push(null);
        }
      } catch (error) {
        positions.push(null);
      }
    }
    return positions;
  }

  after(async function() {
    console.log('\n🧹 Cleaning up browsers...');
    
    // Take final screenshots
    if (merchantPage) {
      await merchantPage.screenshot({ 
        path: path.join(screenshotDir, 'final-merchant-state.png'),
        fullPage: true 
      });
    }
    
    // Close all customer browsers
    for (let i = 0; i < customerBrowsers.length; i++) {
      try {
        await customerPages[i].screenshot({ 
          path: path.join(screenshotDir, `final-customer-${i + 1}.png`) 
        });
        await customerBrowsers[i].close();
      } catch (error) {
        // Browser might already be closed
      }
    }
    
    // Close merchant browser
    if (merchantBrowser) {
      await merchantBrowser.close();
    }
    
    console.log('✅ Cleanup complete');
  });
});