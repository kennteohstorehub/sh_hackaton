const { test, expect } = require('@playwright/test');
const { chromium } = require('playwright');

test.describe('StoreHub Merchant Registration Flow', () => {
  let browser, context, page;

  test.beforeAll(async () => {
    browser = await chromium.launch();
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('Successful merchant registration', async () => {
    // Navigate to registration page
    await page.goto('http://localhost:3000/auth/register');

    // Fill out registration form
    await page.fill('input[name="businessName"]', 'BurgerLab Test');
    await page.fill('input[name="email"]', 'burgerlab@test.com');
    await page.fill('input[name="phone"]', '+60123456789');
    await page.fill('input[name="password"]', 'TestPass123!');
    await page.fill('input[name="confirmPassword"]', 'TestPass123!');
    await page.fill('input[name="subdomain"]', 'burgerlabtest');
    await page.selectOption('select[name="businessType"]', 'restaurant');
    await page.check('input[name="agreeToTerms"]');

    // Submit registration
    await page.click('button[type="submit"]');

    // Verify successful registration
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=Welcome')).toBeVisible();
  });

  test('Duplicate email registration prevention', async () => {
    await page.goto('http://localhost:3000/auth/register');

    // Use same email as previous test
    await page.fill('input[name="businessName"]', 'Duplicate BurgerLab');
    await page.fill('input[name="email"]', 'burgerlab@test.com');
    await page.fill('input[name="phone"]', '+60123456780');
    await page.fill('input[name="password"]', 'TestPass123!');
    await page.fill('input[name="confirmPassword"]', 'TestPass123!');
    await page.fill('input[name="subdomain"]', 'duplicateburgerlab');
    await page.selectOption('select[name="businessType"]', 'restaurant');
    await page.check('input[name="agreeToTerms"]');

    // Submit registration
    await page.click('button[type="submit"]');

    // Verify error message
    await expect(page.locator('text=An account with this email already exists')).toBeVisible();
  });

  test('Login after registration', async () => {
    await page.goto('http://localhost:3000/auth/merchant-login');

    // Login with previously registered credentials
    await page.fill('input[name="email"]', 'burgerlab@test.com');
    await page.fill('input[name="password"]', 'TestPass123!');
    
    await page.click('button[type="submit"]');

    // Verify dashboard access
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=Welcome back')).toBeVisible();
  });
});