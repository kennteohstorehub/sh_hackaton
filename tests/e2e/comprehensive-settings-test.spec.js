// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Comprehensive Settings Configuration Test', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    
    if (!testEmail || !testPassword) {
      test.skip('Test credentials not configured');
      return;
    }
    
    await page.goto('/login');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test.describe('Restaurant Information Settings', () => {
    test('should update and validate all restaurant details', async ({ page }) => {
      await page.goto('/settings');
      
      // Generate unique test data
      const timestamp = Date.now();
      const testName = `Test Restaurant ${timestamp}`;
      const testPhone = `+601${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
      const testAddress = `${timestamp} Test Street, Test City, Test State 12345`;
      
      // Update restaurant name
      const nameInput = page.locator('input[name="merchantName"]');
      await nameInput.clear();
      await nameInput.fill(testName);
      
      // Update phone number
      const phoneInput = page.locator('input[name="contactPhone"]');
      await phoneInput.clear();
      await phoneInput.fill(testPhone);
      
      // Update full address
      const addressInput = page.locator('textarea[name="address"]');
      await addressInput.clear();
      await addressInput.fill(testAddress);
      
      // Save changes
      await page.click('button:has-text("Save Changes")');
      
      // Verify success message
      await expect(page.locator('.success-message')).toBeVisible();
      
      // Reload and verify saved data
      await page.reload();
      
      // Check saved name
      const savedName = await page.locator('input[name="merchantName"]').inputValue();
      expect(savedName).toBe(testName);
      
      // Check saved phone
      const savedPhone = await page.locator('input[name="contactPhone"]').inputValue();
      expect(savedPhone).toBe(testPhone);
      
      // Check saved address
      const savedAddress = await page.locator('textarea[name="address"]').inputValue();
      expect(savedAddress).toBe(testAddress);
    });

    test('should validate input constraints for restaurant details', async ({ page }) => {
      await page.goto('/settings');
      
      // Invalid phone number
      const phoneInput = page.locator('input[name="contactPhone"]');
      await phoneInput.fill('invalid-phone');
      
      // Save changes
      await page.click('button:has-text("Save Changes")');
      
      // Check for validation error
      await expect(page.locator(':text("Invalid phone number format")')).toBeVisible();
    });
  });

  test.describe('Comprehensive Business Hours Testing', () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    test('should update business hours for all days', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Business Hours")');
      
      // Update hours for each day
      for (const day of days) {
        const dayLower = day.toLowerCase();
        
        // Skip if already marked as closed
        const closedCheckbox = page.locator(`input[name="${dayLower}_closed"]`);
        if (!(await closedCheckbox.isChecked())) {
          // Open time input
          const openTimeInput = page.locator(`input[name="${dayLower}_openTime"]`);
          await openTimeInput.fill('08:00');
          
          // Close time input
          const closeTimeInput = page.locator(`input[name="${dayLower}_closeTime"]`);
          await closeTimeInput.fill('22:00');
        }
      }
      
      // Save business hours
      await page.click('button:has-text("Save Business Hours")');
      
      // Check success message
      await expect(page.locator('.success-message')).toBeVisible();
    });

    test('should handle edge cases in business hours', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Business Hours")');
      
      // Test 24-hour operation (e.g., Sunday)
      const sundayOpenTime = page.locator('input[name="sunday_openTime"]');
      const sundayCloseTime = page.locator('input[name="sunday_closeTime"]');
      
      await sundayOpenTime.fill('00:00');
      await sundayCloseTime.fill('23:59');
      
      // Save business hours
      await page.click('button:has-text("Save Business Hours")');
      
      // Check success message
      await expect(page.locator('.success-message')).toBeVisible();
      
      // Test closing specific days
      const saturdayClosedCheckbox = page.locator('input[name="saturday_closed"]');
      await saturdayClosedCheckbox.check();
      
      // Save business hours
      await page.click('button:has-text("Save Business Hours")');
      
      // Verify time inputs are disabled for closed day
      await expect(page.locator('input[name="saturday_openTime"]')).toBeDisabled();
      await expect(page.locator('input[name="saturday_closeTime"]')).toBeDisabled();
    });

    test('should validate business hours input', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Business Hours")');
      
      // Try invalid hours (close before open)
      await page.fill('input[name="monday_openTime"]', '22:00');
      await page.fill('input[name="monday_closeTime"]', '09:00');
      
      // Save
      await page.click('button:has-text("Save Business Hours")');
      
      // Check error
      await expect(page.locator(':text("Close time must be after open time")')).toBeVisible();
    });
  });

  test.describe('Queue Settings Configuration', () => {
    test('should configure comprehensive queue settings', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Queue Settings")');
      
      // Update default queue capacity
      await page.fill('input[name="defaultCapacity"]', '75');
      
      // Configure queue behavior
      await page.check('input[name="autoCloseWhenFull"]');
      await page.check('input[name="allowAdvanceBooking"]');
      
      // Set advance booking hours
      await page.fill('input[name="advanceBookingHours"]', '48');
      
      // Set party size limits
      await page.fill('input[name="minPartySize"]', '1');
      await page.fill('input[name="maxPartySize"]', '10');
      
      // Save queue settings
      await page.click('button:has-text("Save Queue Settings")');
      
      // Check success
      await expect(page.locator('.success-message')).toBeVisible();
      
      // Verify settings persisted
      await page.reload();
      
      // Check settings
      const capacityInput = page.locator('input[name="defaultCapacity"]');
      expect(await capacityInput.inputValue()).toBe('75');
      
      const autoCloseCheckbox = page.locator('input[name="autoCloseWhenFull"]');
      expect(await autoCloseCheckbox.isChecked()).toBe(true);
    });

    test('should handle queue settings error conditions', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Queue Settings")');
      
      // Try invalid capacity
      await page.fill('input[name="defaultCapacity"]', '-10');
      
      // Save
      await page.click('button:has-text("Save Queue Settings")');
      
      // Check error
      await expect(page.locator(':text("Capacity must be a positive number")')).toBeVisible();
    });
  });

  test.describe('Message Templates Configuration', () => {
    test('should update and validate message templates', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Message Templates")');
      
      // Generate unique test messages
      const timestamp = Date.now();
      const welcomeMessage = `Welcome to our queue! (${timestamp})`;
      const confirmationMessage = `Your queue spot is confirmed! (${timestamp})`;
      const callMessage = `You're next in line! (${timestamp})`;
      
      // Update welcome message
      await page.fill('textarea[name="welcomeMessage"]', welcomeMessage);
      
      // Update queue confirmation message
      await page.fill('textarea[name="confirmationMessage"]', confirmationMessage);
      
      // Update call message
      await page.fill('textarea[name="callMessage"]', callMessage);
      
      // Save message templates
      await page.click('button:has-text("Save Message Templates")');
      
      // Check success
      await expect(page.locator('.success-message')).toBeVisible();
      
      // Verify saved messages
      await page.reload();
      
      const savedWelcomeMessage = await page.locator('textarea[name="welcomeMessage"]').inputValue();
      const savedConfirmationMessage = await page.locator('textarea[name="confirmationMessage"]').inputValue();
      const savedCallMessage = await page.locator('textarea[name="callMessage"]').inputValue();
      
      expect(savedWelcomeMessage).toBe(welcomeMessage);
      expect(savedConfirmationMessage).toBe(confirmationMessage);
      expect(savedCallMessage).toBe(callMessage);
    });

    test('should validate message template placeholders', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Message Templates")');
      
      // Test valid placeholders
      const welcomeMessage = 'Welcome, {CUSTOMER_NAME}! Your queue number is {QUEUE_NUMBER}.';
      await page.fill('textarea[name="welcomeMessage"]', welcomeMessage);
      
      // Save message templates
      await page.click('button:has-text("Save Message Templates")');
      
      // Check success
      await expect(page.locator('.success-message')).toBeVisible();
      
      // Try invalid placeholder
      const invalidMessage = 'Welcome, {INVALID_PLACEHOLDER}!';
      await page.fill('textarea[name="welcomeMessage"]', invalidMessage);
      
      // Save
      await page.click('button:has-text("Save Message Templates")');
      
      // Check warning about unknown placeholder
      await expect(page.locator(':text("Unknown placeholder used")')).toBeVisible();
    });
  });

  test.describe('Settings Integration and Error Handling', () => {
    test('should handle partial settings updates', async ({ page }) => {
      await page.goto('/settings');
      
      // Update only some settings
      await page.fill('input[name="merchantName"]', `Partial Update ${Date.now()}`);
      
      // Simulate network interruption
      await page.route('**/save-settings', route => route.abort('failed'));
      
      // Try to save
      await page.click('button:has-text("Save Changes")');
      
      // Check error handling
      await expect(page.locator(':text("Network error. Please try again.")')).toBeVisible();
    });

    test('should lock settings during active queue', async ({ page }) => {
      // This test assumes there's a mechanism to check if queue is active
      await page.goto('/settings');
      
      // Simulate active queue
      await page.evaluate(() => {
        // Mock method to simulate active queue
        window.isQueueActive = () => true;
      });
      
      // Try to change critical settings
      const capacityInput = page.locator('input[name="defaultCapacity"]');
      
      // Check if input is disabled
      await expect(capacityInput).toBeDisabled();
      
      // Check for informative message
      await expect(page.locator(':text("Settings locked during active queue")')).toBeVisible();
    });
  });
});