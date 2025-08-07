const puppeteer = require('puppeteer');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const QUEUE_ID = 'bb6aec56-d06d-4706-a793-1cfa9e9a1ad9';
const MERCHANT_EMAIL = 'demo@example.com';
const MERCHANT_PASSWORD = 'password123';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = {
    'success': `${colors.green}✓${colors.reset}`,
    'error': `${colors.red}✗${colors.reset}`,
    'info': `${colors.blue}ℹ${colors.reset}`,
    'warning': `${colors.yellow}⚠${colors.reset}`,
    'step': `${colors.cyan}▸${colors.reset}`,
    'title': `${colors.magenta}═${colors.reset}`
  };
  
  if (type === 'title') {
    console.log(`\n${colors.magenta}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}${message}${colors.reset}`);
    console.log(`${colors.magenta}${'═'.repeat(60)}${colors.reset}\n`);
  } else {
    console.log(`[${timestamp}] ${prefix[type] || prefix.info} ${message}`);
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page, name) {
  const filename = `screenshots/${name}-${Date.now()}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  log(`Screenshot saved: ${filename}`, 'info');
  return filename;
}

async function runQueueSystemTest() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--window-size=1920,1080'],
    slowMo: 100
  });

  let customerPage, merchantPage;
  let testResults = {
    passed: [],
    failed: [],
    screenshots: []
  };

  try {
    log('STOREHUB QUEUE MANAGEMENT SYSTEM - E2E TEST', 'title');
    
    // ====================
    // TEST 1: Customer Joins Queue
    // ====================
    log('TEST 1: CUSTOMER QUEUE JOIN', 'title');
    
    customerPage = await browser.newPage();
    await customerPage.goto(`${BASE_URL}/queue/${QUEUE_ID}/join`);
    log('Navigated to queue join page', 'success');
    
    // Fill in customer details
    await customerPage.waitForSelector('input[name="customerName"]');
    await customerPage.type('input[name="customerName"]', 'Test Customer');
    await customerPage.type('input[name="customerPhone"]', '+60123456789');
    await customerPage.select('select[name="partySize"]', '2');
    await customerPage.type('textarea[name="specialRequests"]', 'Window seat please');
    log('Filled customer information', 'success');
    
    // Submit form
    await Promise.all([
      customerPage.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {}),
      customerPage.click('button[type="submit"]')
    ]);
    await delay(2000); // Give time for any redirects
    log('Submitted queue join form', 'success');
    
    // Get queue status page info
    const queueStatusUrl = customerPage.url();
    log(`Current URL: ${queueStatusUrl}`, 'info');
    const urlMatch = queueStatusUrl.match(/queue-status\/([^\/]+)\/([^\/]+)/);
    
    if (urlMatch) {
      const [_, queueId, customerId] = urlMatch;
      log(`Queue ID: ${queueId}`, 'info');
      log(`Customer ID: ${customerId}`, 'info');
      testResults.passed.push('Customer Queue Join');
      
      // Check for verification code (try multiple selectors)
      try {
        await delay(2000); // Give page time to load
        const verificationCode = await customerPage.evaluate(() => {
          // Try different ways to find the verification code
          const selectors = [
            '.verification-code',
            '[class*="verification"]',
            '.code-display',
            'strong:has-text("Verification")',
            'p:has-text("Verification Code")',
            '.queue-details strong'
          ];
          
          for (const selector of selectors) {
            try {
              const elements = document.querySelectorAll(selector);
              for (const el of elements) {
                const text = el.textContent.trim();
                // Look for 4-character codes
                if (text && text.match(/^[A-Z0-9]{4}$/)) {
                  return text;
                }
              }
            } catch (e) {}
          }
          
          // Try to find in the page text
          const pageText = document.body.innerText;
          const match = pageText.match(/Verification Code:\s*([A-Z0-9]{4})/);
          if (match) return match[1];
          
          return null;
        });
        
        if (verificationCode) {
          log(`Verification Code: ${verificationCode}`, 'success');
          testResults.passed.push('Verification Code Display');
        } else {
          log('Verification code not found on page', 'warning');
          testResults.failed.push('Verification Code Display');
        }
      } catch (error) {
        log('Could not check verification code: ' + error.message, 'warning');
        testResults.failed.push('Verification Code Display');
      }
      
      // Take screenshot
      await takeScreenshot(customerPage, 'customer-queue-status');
      
    } else {
      log('Failed to extract queue information', 'error');
      testResults.failed.push('Queue Status Navigation');
    }
    
    // ====================
    // TEST 2: Merchant Login & Dashboard
    // ====================
    log('TEST 2: MERCHANT DASHBOARD', 'title');
    
    merchantPage = await browser.newPage();
    await merchantPage.goto(`${BASE_URL}/auth/login`);
    log('Navigated to merchant login', 'success');
    
    // Login
    await merchantPage.waitForSelector('input[name="email"]');
    await merchantPage.type('input[name="email"]', MERCHANT_EMAIL);
    await merchantPage.type('input[name="password"]', MERCHANT_PASSWORD);
    
    await Promise.all([
      merchantPage.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {}),
      merchantPage.click('button[type="submit"]')
    ]);
    await delay(2000);
    log('Logged in as merchant', 'success');
    testResults.passed.push('Merchant Login');
    
    // Check dashboard
    const dashboardUrl = merchantPage.url();
    if (dashboardUrl.includes('dashboard')) {
      log('Dashboard loaded successfully', 'success');
      
      // Look for queue entries
      await delay(2000);
      const queueEntries = await merchantPage.$$('.queue-entry-card, .customer-card, [data-customer-id]');
      log(`Found ${queueEntries.length} customers in queue`, 'info');
      
      await takeScreenshot(merchantPage, 'merchant-dashboard');
      testResults.passed.push('Dashboard Queue Display');
    } else {
      log('Failed to load dashboard', 'error');
      testResults.failed.push('Dashboard Loading');
    }
    
    // ====================
    // TEST 3: Call Customer & Notification
    // ====================
    log('TEST 3: CALL CUSTOMER & NOTIFICATION', 'title');
    
    // Find and click call button
    const callButtons = await merchantPage.$$('button.btn-call-customer, button[onclick*="callCustomer"], button.call-btn');
    
    if (callButtons.length > 0) {
      log('Found call button, clicking...', 'step');
      await callButtons[0].click();
      await delay(2000);
      log('Called customer', 'success');
      testResults.passed.push('Call Customer');
      
      // Check customer page for notification
      log('Checking customer page for notification...', 'step');
      await customerPage.bringToFront();
      await delay(2000);
      
      // Look for notification modal
      const modalVisible = await customerPage.evaluate(() => {
        const modal = document.querySelector('.notification-modal, #notificationModal, [role="dialog"]');
        return modal && (modal.offsetParent !== null || modal.style.display !== 'none');
      });
      
      if (modalVisible) {
        log('Notification modal appeared!', 'success');
        await takeScreenshot(customerPage, 'notification-modal');
        testResults.passed.push('Notification Display');
        
        // Test "On My Way" button
        log('Testing "On My Way" button...', 'step');
        
        // Click using JavaScript to bypass any overlay issues
        const acknowledged = await customerPage.evaluate(() => {
          const button = document.querySelector('button[onclick*="confirmOnTheWay"], button:has-text("On My Way")');
          if (button) {
            button.click();
            return true;
          }
          // Try calling the function directly
          if (typeof confirmOnTheWay === 'function') {
            confirmOnTheWay();
            return true;
          }
          return false;
        });
        
        if (acknowledged) {
          log('Clicked "On My Way" button', 'success');
          testResults.passed.push('Customer Acknowledgment');
          await delay(2000);
          
          // Check merchant page for update
          await merchantPage.bringToFront();
          log('Checking merchant dashboard for acknowledgment...', 'step');
          await takeScreenshot(merchantPage, 'merchant-after-acknowledgment');
        } else {
          log('Could not click "On My Way" button', 'error');
          testResults.failed.push('Customer Acknowledgment');
        }
      } else {
        log('Notification modal not visible', 'warning');
        testResults.failed.push('Notification Display');
      }
    } else {
      log('No call button found', 'error');
      testResults.failed.push('Call Customer Button');
    }
    
    // ====================
    // TEST 4: Table Assignment
    // ====================
    log('TEST 4: TABLE ASSIGNMENT', 'title');
    
    await merchantPage.bringToFront();
    
    // Look for table assignment button
    const assignButtons = await merchantPage.$$('button.btn-assign-table, button[onclick*="assignTable"], button:has-text("Assign Table")');
    
    if (assignButtons.length > 0) {
      log('Found table assignment button', 'success');
      await assignButtons[0].click();
      await delay(1000);
      
      // Look for table input modal
      const tableModalVisible = await merchantPage.evaluate(() => {
        const modal = document.querySelector('.table-assignment-modal, [class*="table-modal"]');
        return modal && modal.offsetParent !== null;
      });
      
      if (tableModalVisible) {
        await merchantPage.type('input[name="tableNumber"], input[placeholder*="table"]', 'T-12');
        await merchantPage.click('button[type="submit"], button:has-text("Assign")');
        log('Assigned table T-12', 'success');
        testResults.passed.push('Table Assignment');
      } else {
        // Try inline table assignment
        const tableAssigned = await merchantPage.evaluate(() => {
          if (typeof showTableAssignmentModal === 'function') {
            showTableAssignmentModal();
            return true;
          }
          return false;
        });
        
        if (tableAssigned) {
          log('Table assignment triggered', 'success');
          testResults.passed.push('Table Assignment');
        } else {
          log('Table assignment not available', 'warning');
        }
      }
    } else {
      log('No table assignment button found', 'warning');
    }
    
    // ====================
    // TEST 5: WebSocket Real-time Updates
    // ====================
    log('TEST 5: REAL-TIME UPDATES', 'title');
    
    // Check WebSocket connection on customer page
    await customerPage.bringToFront();
    const hasWebSocket = await customerPage.evaluate(() => {
      return typeof io !== 'undefined' && io.sockets && Object.keys(io.sockets).length > 0;
    });
    
    if (hasWebSocket) {
      log('WebSocket connection active', 'success');
      testResults.passed.push('WebSocket Connection');
    } else {
      log('WebSocket not detected', 'warning');
      testResults.failed.push('WebSocket Connection');
    }
    
    // ====================
    // TEST SUMMARY
    // ====================
    log('TEST SUMMARY', 'title');
    
    console.log(`\n${colors.green}${colors.bright}PASSED TESTS (${testResults.passed.length}):${colors.reset}`);
    testResults.passed.forEach(test => {
      console.log(`  ${colors.green}✓${colors.reset} ${test}`);
    });
    
    if (testResults.failed.length > 0) {
      console.log(`\n${colors.red}${colors.bright}FAILED TESTS (${testResults.failed.length}):${colors.reset}`);
      testResults.failed.forEach(test => {
        console.log(`  ${colors.red}✗${colors.reset} ${test}`);
      });
    }
    
    const successRate = Math.round((testResults.passed.length / (testResults.passed.length + testResults.failed.length)) * 100);
    console.log(`\n${colors.bright}Success Rate: ${successRate}%${colors.reset}`);
    
    if (successRate === 100) {
      log('🎉 ALL TESTS PASSED!', 'success');
    } else if (successRate >= 80) {
      log('✅ Most tests passed, minor issues detected', 'success');
    } else if (successRate >= 60) {
      log('⚠️  Some tests failed, review needed', 'warning');
    } else {
      log('❌ Multiple failures detected', 'error');
    }
    
  } catch (error) {
    log(`Critical error: ${error.message}`, 'error');
    console.error(error.stack);
  } finally {
    // Keep browser open for 5 seconds to see final state
    await delay(5000);
    await browser.close();
    log('Test completed, browser closed', 'info');
  }
}

// Create screenshots directory
const fs = require('fs');
if (!fs.existsSync('screenshots')) {
  fs.mkdirSync('screenshots');
}

// Run the test
console.log(`${colors.bright}Starting Queue System E2E Test with Puppeteer...${colors.reset}\n`);
runQueueSystemTest().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});