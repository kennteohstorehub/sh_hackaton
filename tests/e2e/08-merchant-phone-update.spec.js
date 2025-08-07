// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Merchant Phone Number Update Tests', () => {
  let testMerchantEmail, testMerchantPassword;

  test.beforeAll(() => {
    testMerchantEmail = process.env.TEST_USER_EMAIL;
    testMerchantPassword = process.env.TEST_USER_PASSWORD;

    if (!testMerchantEmail || !testMerchantPassword) {
      throw new Error('Test credentials not configured');
    }
  });

  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', testMerchantEmail);
    await page.fill('input[name="password"]', testMerchantPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('should update phone number with valid Malaysian phone number', async ({ page }) => {
    await page.goto('/settings');
    
    // Update contact phone with valid Malaysian phone number
    const phoneInput = page.locator('input[name="contactPhone"]');
    const testPhoneNumber = `+60${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
    
    await phoneInput.clear();
    await phoneInput.fill(testPhoneNumber);
    
    // Save changes
    await page.click('button:has-text("Save Changes")');
    
    // Wait for success message
    await expect(page.locator('.success-message')).toBeVisible();
    
    // Reload and verify
    await page.reload();
    const savedPhoneValue = await page.locator('input[name="contactPhone"]').inputValue();
    expect(savedPhoneValue).toBe(testPhoneNumber);
  });

  test('should update phone number with different country codes', async ({ page }) => {
    const testPhoneNumbers = [
      '+60123456789',   // Malaysia
      '+65123456789',   // Singapore 
      '+44207123456',   // UK
      '+1-650-253-0000' // US with hyphen
    ];

    await page.goto('/settings');
    const phoneInput = page.locator('input[name="contactPhone"]');

    for (const phoneNumber of testPhoneNumbers) {
      await phoneInput.clear();
      await phoneInput.fill(phoneNumber);
      
      // Save changes
      await page.click('button:has-text("Save Changes")');
      
      // Wait for success message
      await expect(page.locator('.success-message')).toBeVisible();
      
      // Reload and verify
      await page.reload();
      const savedPhoneValue = await page.locator('input[name="contactPhone"]').inputValue();
      expect(savedPhoneValue).toBe(phoneNumber);
    }
  });

  test('should handle combined updates with phone number', async ({ page }) => {
    await page.goto('/settings');
    
    const testPhoneNumber = `+60${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
    const testEmail = `merchant_${Date.now()}@example.com`;
    
    // Update multiple fields simultaneously
    await page.fill('input[name="contactEmail"]', testEmail);
    await page.fill('input[name="contactPhone"]', testPhoneNumber);
    
    // Save changes
    await page.click('button:has-text("Save Changes")');
    
    // Wait for success message
    await expect(page.locator('.success-message')).toBeVisible();
    
    // Reload and verify
    await page.reload();
    const savedPhoneValue = await page.locator('input[name="contactPhone"]').inputValue();
    const savedEmailValue = await page.locator('input[name="contactEmail"]').inputValue();
    
    expect(savedPhoneValue).toBe(testPhoneNumber);
    expect(savedEmailValue).toBe(testEmail);
  });

  test('should prevent invalid phone number formats', async ({ page }) => {
    await page.goto('/settings');
    
    const invalidPhoneNumbers = [
      '123', // Too short
      'abcdefghij', // Non-numeric
      '+601', // Incomplete
      'not a phone number'
    ];

    const phoneInput = page.locator('input[name="contactPhone"]');

    for (const invalidPhone of invalidPhoneNumbers) {
      await phoneInput.clear();
      await phoneInput.fill(invalidPhone);
      
      // Save changes
      await page.click('button:has-text("Save Changes")');
      
      // Expect error message
      await expect(page.locator('.error-message')).toBeVisible();
      await expect(page.locator(':text("Invalid phone number")')).toBeVisible();
    }
  });

  test('should prevent empty phone number', async ({ page }) => {
    await page.goto('/settings');
    
    const phoneInput = page.locator('input[name="contactPhone"]');
    
    // Clear phone number
    await phoneInput.clear();
    
    // Save changes
    await page.click('button:has-text("Save Changes")');
    
    // Expect error message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator(':text("Phone number is required")')).toBeVisible();
  });
});