const puppeteer = require('puppeteer');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('StoreHub Queue Management System Comprehensive E2E Test', function() {
  this.timeout(120000); // Extended timeout for comprehensive testing

  const TEST_CONFIG = {
    baseUrl: 'http://chickenrice.lvh.me:3000',
    mainDomain: 'http://localhost:3000',
    credentials: {
      email: 'admin@demo.local',
      password: 'Password123!',
      tenantSlug: 'chickenrice'
    },
    testCustomer: {
      name: 'Test Customer',
      phone: '+60123456789',
      partySize: 2
    }
  };

  const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'comprehensive-merchant-queue');
  const LOG_FILE = path.join(__dirname, 'test-results.log');

  let browser, page, testResults = [];

  // Utility functions
  const logResult = (testName, status, details = '') => {
    const result = { testName, status, details, timestamp: new Date().toISOString() };
    testResults.push(result);
    fs.appendFileSync(LOG_FILE, JSON.stringify(result) + '\n');
    console.log(`[${status}] ${testName}: ${details}`);
  };

  const takeScreenshot = async (name) => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`) });
  };

  before(async function() {
    // Prepare logging and screenshot directories
    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    fs.writeFileSync(LOG_FILE, ''); // Clear previous log
    
    browser = await puppeteer.launch({ 
      headless: false,
      defaultViewport: { width: 1280, height: 800 }
    });
    page = await browser.newPage();
  });

  describe('Landing Page Test', function() {
    it('should load landing page correctly', async function() {
      try {
        await page.goto(TEST_CONFIG.mainDomain);
        await page.waitForSelector('body');
        await takeScreenshot('01-landing-page');
        
        const loginButton = await page.$('a[href*="/login"]');
        const registerButton = await page.$('a[href*="/register"]');
        
        expect(loginButton).to.exist;
        expect(registerButton).to.exist;
        
        logResult('Landing Page Load', 'PASS', 'Landing page loaded with login and register buttons');
      } catch (error) {
        logResult('Landing Page Load', 'FAIL', error.message);
        throw error;
      }
    });
  });

  describe('Merchant Dashboard Access', function() {
    it('should login to merchant dashboard', async function() {
      try {
        await page.goto(`${TEST_CONFIG.baseUrl}/login`);
        await page.type('input[name="email"]', TEST_CONFIG.credentials.email);
        await page.type('input[name="password"]', TEST_CONFIG.credentials.password);
        await page.click('button[type="submit"]');
        
        await page.waitForSelector('.dashboard-container', { timeout: 10000 });
        await takeScreenshot('02-merchant-dashboard');
        
        const dashboardTitle = await page.$eval('.dashboard-title', el => el.textContent);
        expect(dashboardTitle).to.include(TEST_CONFIG.credentials.tenantSlug);
        
        logResult('Merchant Login', 'PASS', 'Successfully logged into merchant dashboard');
      } catch (error) {
        logResult('Merchant Login', 'FAIL', error.message);
        throw error;
      }
    });
  });

  describe('Queue Management Flow', function() {
    it('should start queue and create new queue entry', async function() {
      try {
        // Ensure queue is started
        const queueStartButton = await page.$('button[data-testid="start-queue"]');
        if (queueStartButton) {
          await queueStartButton.click();
          await page.waitForTimeout(2000);
        }
        
        // Navigate to queue management
        await page.click('a[href*="/queue-management"]');
        await page.waitForSelector('.queue-management-container');
        
        // Create new queue entry
        await page.type('input[name="customerName"]', TEST_CONFIG.testCustomer.name);
        await page.type('input[name="customerPhone"]', TEST_CONFIG.testCustomer.phone);
        await page.select('select[name="partySize"]', TEST_CONFIG.testCustomer.partySize.toString());
        
        await page.click('button[type="submit"]');
        await page.waitForSelector('.queue-entry');
        
        await takeScreenshot('03-queue-entry-created');
        logResult('Queue Entry', 'PASS', 'Created new queue entry successfully');
      } catch (error) {
        logResult('Queue Entry', 'FAIL', error.message);
        throw error;
      }
    });

    it('should call and seat customer', async function() {
      try {
        // Call customer
        await page.click('button[data-testid="call-next-customer"]');
        await page.waitForSelector('.customer-called-status');
        await takeScreenshot('04-customer-called');
        
        // Seat customer
        await page.click('button[data-testid="confirm-seated"]');
        await page.waitForSelector('.customer-seated-status');
        await takeScreenshot('05-customer-seated');
        
        logResult('Customer Flow', 'PASS', 'Successfully called and seated customer');
      } catch (error) {
        logResult('Customer Flow', 'FAIL', error.message);
        throw error;
      }
    });
  });

  describe('Additional Validations', function() {
    it('should persist session across page refresh', async function() {
      try {
        await page.reload({ waitUntil: 'networkidle0' });
        const dashboardPresent = await page.$('.dashboard-container');
        
        expect(dashboardPresent).to.exist;
        logResult('Session Persistence', 'PASS', 'Session maintained after page refresh');
      } catch (error) {
        logResult('Session Persistence', 'FAIL', error.message);
        throw error;
      }
    });

    it('should logout successfully', async function() {
      try {
        await page.click('button[data-testid="logout"]');
        await page.waitForNavigation();
        
        // Verify redirect to landing page
        const currentUrl = page.url();
        expect(currentUrl).to.include(TEST_CONFIG.mainDomain);
        
        await takeScreenshot('06-logout-complete');
        logResult('Logout', 'PASS', 'Successfully logged out and redirected');
      } catch (error) {
        logResult('Logout', 'FAIL', error.message);
        throw error;
      }
    });
  });

  after(async function() {
    // Generate comprehensive test report
    const reportPath = path.join(__dirname, 'comprehensive-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      results: testResults,
      summary: {
        total: testResults.length,
        passed: testResults.filter(r => r.status === 'PASS').length,
        failed: testResults.filter(r => r.status === 'FAIL').length
      }
    }, null, 2));

    if (browser) await browser.close();
  });
});