const puppeteer = require('puppeteer');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('StoreHub Queue Management System E2E Test', function() {
  this.timeout(60000); // Increased timeout for comprehensive tests

  let merchantBrowser, customerBrowser;
  let merchantPage, customerPage;
  const screenshotDir = path.join(__dirname, 'screenshots', 'queue-management');
  
  // Ensure screenshot directory exists
  before(async function() {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  // Landing Page Test
  describe('Landing Page', function() {
    before(async function() {
      merchantBrowser = await puppeteer.launch({ headless: false });
      merchantPage = await merchantBrowser.newPage();
      await merchantPage.goto('http://localhost:3000');
    });

    it('should load landing page correctly', async function() {
      await merchantPage.screenshot({ path: path.join(screenshotDir, '01-landing-page.png') });
      
      // Check for key elements
      const loginButton = await merchantPage.$('a[href*="/login"]');
      const registerButton = await merchantPage.$('a[href*="/register"]');
      
      expect(loginButton).to.exist;
      expect(registerButton).to.exist;
    });

    after(async function() {
      await merchantPage.close();
    });
  });

  // Merchant Dashboard Test
  describe('Merchant Dashboard', function() {
    before(async function() {
      merchantPage = await merchantBrowser.newPage();
      await merchantPage.goto('http://demo.lvh.me:3000/login');
      
      // Login process
      await merchantPage.type('input[name="email"]', 'demo@storehub.com');
      await merchantPage.type('input[name="password"]', 'demo123');
      await merchantPage.click('button[type="submit"]');
      
      // Wait for dashboard to load
      await merchantPage.waitForSelector('.dashboard-container', { timeout: 10000 });
    });

    it('should load merchant dashboard with queue controls', async function() {
      await merchantPage.screenshot({ path: path.join(screenshotDir, '02-merchant-dashboard.png') });
      
      // Check for queue start/stop controls
      const queueStartButton = await merchantPage.$('button[data-testid="start-queue"]');
      const queueStopButton = await merchantPage.$('button[data-testid="stop-queue"]');
      
      expect(queueStartButton).to.exist;
      expect(queueStopButton).to.exist;
    });

    // Ensure queue is started
    it('should start queue if not already active', async function() {
      const queueStartButton = await merchantPage.$('button[data-testid="start-queue"]');
      if (queueStartButton) {
        await queueStartButton.click();
        await merchantPage.waitForTimeout(2000); // Wait for queue to start
      }
      
      await merchantPage.screenshot({ path: path.join(screenshotDir, '03-queue-started.png') });
    });
  });

  // Customer Queue Flow
  describe('Customer Queue Journey', function() {
    before(async function() {
      customerBrowser = await puppeteer.launch({ headless: false });
      customerPage = await customerBrowser.newPage();
      
      // Navigate to public queue page
      await customerPage.goto('http://demo.lvh.me:3000/queue');
    });

    it('should allow customer to join queue', async function() {
      // Fill customer details
      await customerPage.type('input[name="name"]', 'Test Customer');
      await customerPage.type('input[name="phone"]', '+60123456789');
      
      await customerPage.click('button[type="submit"]');
      
      // Wait for queue position
      await customerPage.waitForSelector('.queue-position', { timeout: 10000 });
      
      await customerPage.screenshot({ path: path.join(screenshotDir, '04-customer-queue-joined.png') });
      
      // Verify queue position is displayed
      const queuePositionElement = await customerPage.$('.queue-position');
      expect(queuePositionElement).to.exist;
    });

    it('should handle merchant calling customer', async function() {
      // Switch back to merchant page and simulate calling customer
      await merchantPage.click('button[data-testid="call-next-customer"]');
      
      // Check for notification on customer side
      await customerPage.waitForSelector('.customer-called-notification', { timeout: 10000 });
      
      await customerPage.screenshot({ path: path.join(screenshotDir, '05-customer-called.png') });
    });

    it('should allow customer to acknowledge and be seated', async function() {
      // Customer acknowledges and confirms seated
      await customerPage.click('button[data-testid="confirm-seated"]');
      
      // Wait for status change
      await customerPage.waitForSelector('.customer-seated-status', { timeout: 10000 });
      
      await customerPage.screenshot({ path: path.join(screenshotDir, '06-customer-seated.png') });
      
      // Verify seated status
      const seatedStatusElement = await customerPage.$('.customer-seated-status');
      expect(seatedStatusElement).to.exist;
    });
  });

  // Cleanup after all tests
  after(async function() {
    if (merchantBrowser) await merchantBrowser.close();
    if (customerBrowser) await customerBrowser.close();
  });
});