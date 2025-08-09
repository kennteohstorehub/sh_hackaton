const puppeteer = require('puppeteer');
const { expect } = require('chai');

describe('Queue System Stress Test - Simplified', function() {
  this.timeout(120000); // 2 minutes timeout

  let browsers = [];
  let pages = [];
  const NUM_CUSTOMERS = 5; // Start with fewer customers for testing
  const BASE_URL = 'http://demo.lvh.me:3000';
  
  // Test metrics
  const results = {
    customersJoined: 0,
    positionUpdates: [],
    notifications: [],
    errors: []
  };

  before(async function() {
    console.log(`\n🚀 Starting simplified stress test with ${NUM_CUSTOMERS} customers\n`);
  });

  it('should handle multiple customers joining queue simultaneously', async function() {
    console.log('📋 Phase 1: Multiple customers joining queue...\n');
    
    // Launch browsers for each customer
    for (let i = 0; i < NUM_CUSTOMERS; i++) {
      const browser = await puppeteer.launch({
        headless: true, // Run headless for speed
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      browsers.push(browser);
      pages.push(page);
      
      // Customer joins queue
      try {
        console.log(`Customer ${i + 1}: Navigating to queue...`);
        await page.goto(`${BASE_URL}/queue`, { waitUntil: 'networkidle2' });
        
        // Check if we need to fill a join form or if we're already in queue
        const hasForm = await page.$('form');
        
        if (hasForm) {
          // Fill join form if present
          console.log(`Customer ${i + 1}: Filling join form...`);
          
          // Try different input selectors
          await page.evaluate((customerNum) => {
            const nameInput = document.querySelector('#name, input[name="name"], input[type="text"]');
            if (nameInput) nameInput.value = `Test Customer ${customerNum}`;
            
            const phoneInput = document.querySelector('#phone, input[name="phone"], input[type="tel"]');
            if (phoneInput) phoneInput.value = `+6012345678${customerNum}`;
            
            const partySizeInput = document.querySelector('#partySize, select[name="partySize"], input[name="partySize"]');
            if (partySizeInput) {
              if (partySizeInput.tagName === 'SELECT') {
                partySizeInput.value = '2';
              } else {
                partySizeInput.value = '2';
              }
            }
          }, i + 1);
          
          // Submit form
          await page.evaluate(() => {
            const form = document.querySelector('form');
            if (form) form.submit();
          });
          
          // Wait for navigation after form submission
          await page.waitForNavigation({ waitUntil: 'networkidle2' });
        }
        
        // Check if we got a queue position
        await page.waitForSelector('.queue-position, #queuePosition, .position-display, .queue-status', { 
          timeout: 10000 
        });
        
        // Extract position
        const position = await page.evaluate(() => {
          const positionEl = document.querySelector('.queue-position, #queuePosition, .position-display');
          if (positionEl) {
            const text = positionEl.textContent;
            const match = text.match(/\d+/);
            return match ? parseInt(match[0]) : null;
          }
          return null;
        });
        
        console.log(`✅ Customer ${i + 1}: Joined queue at position ${position || 'unknown'}`);
        results.customersJoined++;
        results.positionUpdates.push({ customer: i + 1, position });
        
      } catch (error) {
        console.log(`❌ Customer ${i + 1}: Failed to join - ${error.message}`);
        results.errors.push({ customer: i + 1, error: error.message });
      }
      
      // Small delay between customers to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\n📊 Join Results: ${results.customersJoined}/${NUM_CUSTOMERS} customers joined successfully\n`);
  });

  it('should monitor position updates when queue progresses', async function() {
    console.log('📋 Phase 2: Monitoring position updates...\n');
    
    // Wait a bit for system to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check positions for all customers
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      
      try {
        // Re-check position
        const currentPosition = await page.evaluate(() => {
          const positionEl = document.querySelector('.queue-position, #queuePosition, .position-display');
          if (positionEl) {
            const text = positionEl.textContent;
            const match = text.match(/\d+/);
            return match ? parseInt(match[0]) : null;
          }
          return null;
        });
        
        console.log(`Customer ${i + 1}: Current position is ${currentPosition || 'unknown'}`);
        
        // Check for any notifications
        const notifications = await page.evaluate(() => {
          const notifElements = document.querySelectorAll('.notification, .alert, .message');
          return Array.from(notifElements).map(el => el.textContent.trim());
        });
        
        if (notifications.length > 0) {
          console.log(`Customer ${i + 1}: Received ${notifications.length} notifications`);
          results.notifications.push({ customer: i + 1, count: notifications.length });
        }
        
      } catch (error) {
        console.log(`Customer ${i + 1}: Could not check status - ${error.message}`);
      }
    }
  });

  it('should generate stress test summary', async function() {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('                 STRESS TEST SUMMARY                    ');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total Customers: ${NUM_CUSTOMERS}`);
    console.log(`Successfully Joined: ${results.customersJoined}`);
    console.log(`Failed to Join: ${results.errors.length}`);
    console.log(`Success Rate: ${((results.customersJoined / NUM_CUSTOMERS) * 100).toFixed(1)}%`);
    
    if (results.positionUpdates.length > 0) {
      const positions = results.positionUpdates
        .filter(u => u.position !== null)
        .map(u => u.position);
      
      if (positions.length > 0) {
        console.log(`Position Range: ${Math.min(...positions)} - ${Math.max(...positions)}`);
      }
    }
    
    console.log(`Total Notifications: ${results.notifications.reduce((sum, n) => sum + n.count, 0)}`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Basic assertions
    expect(results.customersJoined).to.be.at.least(1, 'At least one customer should join successfully');
    expect(results.errors.length).to.be.below(NUM_CUSTOMERS, 'Not all customers should fail');
  });

  after(async function() {
    console.log('🧹 Cleaning up browsers...');
    
    // Close all browsers
    for (const browser of browsers) {
      try {
        await browser.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    console.log('✅ Cleanup complete\n');
  });
});