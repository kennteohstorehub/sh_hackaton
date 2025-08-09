const { test, expect } = require('@playwright/test');
const { chromium } = require('playwright');

test.describe('StoreHub Queue Management E2E', () => {
  let browser, context, page, merchantPage, customerPage;

  test.beforeAll(async () => {
    browser = await chromium.launch();
    context = await browser.newContext();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('Merchant creates and manages a queue', async () => {
    merchantPage = await context.newPage();
    
    // Login as merchant
    await merchantPage.goto('http://burgerlabtest.localhost:3000/auth/merchant-login');
    await merchantPage.fill('input[name="email"]', 'burgerlab@test.com');
    await merchantPage.fill('input[name="password"]', 'TestPass123!');
    await merchantPage.click('button[type="submit"]');

    // Navigate to Queue Management
    await merchantPage.click('a[href="/queue-management"]');

    // Create a new queue
    await merchantPage.click('button#create-queue');
    await merchantPage.fill('input[name="queueName"]', 'Lunch Time Queue');
    await merchantPage.fill('input[name="maxCapacity"]', '50');
    await merchantPage.click('button#save-queue');

    // Verify queue creation
    await expect(merchantPage.locator('text=Lunch Time Queue')).toBeVisible();
    await expect(merchantPage.locator('text=Queue created successfully')).toBeVisible();
  });

  test('Customer joins queue', async () => {
    customerPage = await context.newPage();

    // Navigate to queue page
    await customerPage.goto('http://burgerlabtest.localhost:3000/queue');

    // Enter customer details
    await customerPage.fill('input[name="name"]', 'John Doe');
    await customerPage.fill('input[name="phone"]', '+60123456789');
    await customerPage.click('button#join-queue');

    // Verify queue joining
    await expect(customerPage.locator('text=You are number 1 in the queue')).toBeVisible();
  });

  test('Merchant serves customer', async () => {
    // Switch back to merchant view
    await merchantPage.click('button#next-customer');

    // Verify customer served
    await expect(merchantPage.locator('text=Customer served')).toBeVisible();
    await expect(customerPage.locator('text=You have been served')).toBeVisible();
  });
});