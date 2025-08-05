const { test, expect } = require('@playwright/test');
const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const path = require('path');

test.describe('StoreHub UI Screenshots', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('http://localhost:3838/auth/login');
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('.dashboard-container', { timeout: 15000 });
  });

  test.afterAll(async () => {
    await page.close();
  });
  const screenshotDir = path.join(__dirname, '../../ui-screenshots');
  
  // Ensure screenshot directory exists
  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir);
    }
  });

  test('Capture Login Page Screenshot', async ({ browser }) => {
    const loginPage = await browser.newPage();
    await page.goto('http://localhost:3838/auth/login');
    await page.waitForSelector('form');
    await loginPage.goto('http://localhost:3838/auth/login');
    await loginPage.waitForSelector('form');
    await loginPage.screenshot({ 
      path: path.join(screenshotDir, 'login-page.png'), 
      fullPage: true 
    });
    await loginPage.close();
  });

  test('Capture Dashboard Screenshot', async () => {
    await page.goto('http://localhost:3838/dashboard');
    await page.waitForSelector('.dashboard-container', { timeout: 10000 });
    await page.screenshot({ 
      path: path.join(screenshotDir, 'dashboard.png'), 
      fullPage: true 
    });
  });

  test('Capture Queue Management Screenshot', async ({ page }) => {
    await page.goto('http://localhost:3838/queue');
    await page.waitForSelector('.queue-management');
    await page.screenshot({ 
      path: path.join(screenshotDir, 'queue-management.png'), 
      fullPage: true 
    });
  });

  test('Capture Settings Page Screenshot', async ({ page }) => {
    await page.goto('http://localhost:3838/settings');
    await page.waitForSelector('.settings-container');
    await page.screenshot({ 
      path: path.join(screenshotDir, 'settings.png'), 
      fullPage: true 
    });
  });

  test('Capture Customer Queue Page Screenshot', async ({ page }) => {
    await page.goto('http://localhost:3838/customer-queue');
    await page.waitForSelector('.customer-queue');
    await page.screenshot({ 
      path: path.join(screenshotDir, 'customer-queue.png'), 
      fullPage: true 
    });
  });
});