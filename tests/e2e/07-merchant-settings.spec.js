// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Merchant Settings Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test merchant
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

  test.describe('General Settings', () => {
    test('should display merchant settings page', async ({ page }) => {
      await page.goto('/settings');
      
      // Check page structure
      await expect(page.locator('h1')).toContainText('Settings');
      await expect(page.locator('.settings-tabs')).toBeVisible();
      
      // Check tab sections
      await expect(page.locator(':text("General")')).toBeVisible();
      await expect(page.locator(':text("Business Hours")')).toBeVisible();
      await expect(page.locator(':text("Integrations")')).toBeVisible();
      await expect(page.locator(':text("Notifications")')).toBeVisible();
    });

    test('should update merchant name', async ({ page }) => {
      await page.goto('/settings');
      
      // Update name with dynamic data
      const nameInput = page.locator('input[name="merchantName"]');
      await nameInput.clear();
      await nameInput.fill(`Updated Restaurant ${Date.now()}`);
      
      // Save
      await page.click('button:has-text("Save Changes")');
      
      // Check success
      await expect(page.locator('.success-message')).toBeVisible();
      await expect(page.locator(':text("Settings updated successfully")')).toBeVisible();
    });

    test('should update contact information', async ({ page }) => {
      await page.goto('/settings');
      
      // Update contact details with dynamic data
      await page.fill('input[name="contactEmail"]', `updated_${Date.now()}@example.com`);
      await page.fill('input[name="contactPhone"]', `+601${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`);
      await page.fill('textarea[name="address"]', `${Math.floor(Math.random() * 999)} Updated Street, Test City`);
      
      // Save
      await page.click('button:has-text("Save Changes")');
      
      // Verify saved
      await page.reload();
      const emailValue = await page.locator('input[name="contactEmail"]').inputValue();
      expect(emailValue).toContain('updated_');
      expect(emailValue).toContain('@example.com');
    });

    test('should handle logo upload', async ({ page }) => {
      await page.goto('/settings');
      
      // Check logo upload section
      await expect(page.locator('.logo-upload')).toBeVisible();
      await expect(page.locator('input[type="file"]')).toBeVisible();
      await expect(page.locator(':text("Upload Logo")')).toBeVisible();
    });
  });

  test.describe('Business Hours Configuration', () => {
    test('should display business hours settings', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Business Hours")');
      
      // Check days of week
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      for (const day of days) {
        await expect(page.locator(`:text("${day}")`)).toBeVisible();
      }
      
      // Check time inputs
      await expect(page.locator('input[name*="openTime"]').first()).toBeVisible();
      await expect(page.locator('input[name*="closeTime"]').first()).toBeVisible();
    });

    test('should update business hours', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Business Hours")');
      
      // Update Monday hours
      await page.fill('input[name="monday_openTime"]', '09:00');
      await page.fill('input[name="monday_closeTime"]', '22:00');
      
      // Save
      await page.click('button:has-text("Save Business Hours")');
      
      // Check success
      await expect(page.locator('.success-message')).toBeVisible();
    });

    test('should toggle closed days', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Business Hours")');
      
      // Toggle Sunday as closed
      const sundayCheckbox = page.locator('input[name="sunday_closed"]');
      await sundayCheckbox.check();
      
      // Time inputs should be disabled
      await expect(page.locator('input[name="sunday_openTime"]')).toBeDisabled();
      await expect(page.locator('input[name="sunday_closeTime"]')).toBeDisabled();
    });

    test('should set special hours', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Business Hours")');
      
      // Add special hours
      await page.click('button:has-text("Add Special Hours")');
      
      // Fill special hours form with future date
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 3);
      const dateString = futureDate.toISOString().split('T')[0];
      
      await page.fill('input[name="specialDate"]', dateString);
      await page.fill('input[name="specialOpenTime"]', '10:00');
      await page.fill('input[name="specialCloseTime"]', '16:00');
      await page.fill('input[name="specialReason"]', 'Special Event');
      
      // Save
      await page.click('button:has-text("Add Special Hours")');
      
      // Check added
      await expect(page.locator(':text("Special Event")')).toBeVisible();
    });

    test('should add holiday closures', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Business Hours")');
      
      // Add holiday
      await page.click('button:has-text("Add Holiday")');
      
      // Fill holiday form with future date
      const nextYear = new Date().getFullYear() + 1;
      await page.fill('input[name="holidayDate"]', `${nextYear}-01-01`);
      await page.fill('input[name="holidayName"]', 'New Year\'s Day');
      
      // Save
      await page.click('button:has-text("Save Holiday")');
      
      // Check added
      await expect(page.locator(':text("New Year\'s Day")')).toBeVisible();
    });

    test('should validate business hours', async ({ page }) => {
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

  test.describe('Service Types Management', () => {
    test('should display service types', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Service Types")');
      
      // Check service types section
      await expect(page.locator('.service-types-list')).toBeVisible();
      await expect(page.locator('button:has-text("Add Service Type")')).toBeVisible();
    });

    test('should add new service type', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Service Types")');
      
      // Add service type
      await page.click('button:has-text("Add Service Type")');
      
      // Fill form with dynamic data
      await page.fill('input[name="serviceName"]', `Service Type ${Date.now()}`);
      await page.fill('input[name="estimatedDuration"]', String(Math.floor(Math.random() * 60) + 15));
      await page.fill('textarea[name="serviceDescription"]', `Test service description ${Date.now()}`);
      
      // Save
      await page.click('button:has-text("Save Service Type")');
      
      // Check added
      await expect(page.locator(':text("Service Type")')).toBeVisible();
    });

    test('should edit service type', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Service Types")');
      
      // Click edit on first service
      await page.click('.service-type-item button:has-text("Edit")').first();
      
      // Update duration with new value
      await page.fill('input[name="estimatedDuration"]', String(Math.floor(Math.random() * 45) + 15));
      
      // Save
      await page.click('button:has-text("Update")');
      
      // Check updated (look for any duration value)
      await expect(page.locator(':text("minutes")')).toBeVisible();
    });

    test('should delete service type', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Service Types")');
      
      // Count initial services
      const initialCount = await page.locator('.service-type-item').count();
      
      // Delete first service
      await page.click('.service-type-item button:has-text("Delete")').first();
      
      // Confirm deletion
      await page.click('button:has-text("Confirm Delete")');
      
      // Check count decreased
      const finalCount = await page.locator('.service-type-item').count();
      expect(finalCount).toBe(initialCount - 1);
    });
  });

  test.describe('Queue Configuration', () => {
    test('should display queue settings', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Queue Settings")');
      
      // Check queue settings
      await expect(page.locator(':text("Default Queue Capacity")')).toBeVisible();
      await expect(page.locator(':text("Auto-close when full")')).toBeVisible();
      await expect(page.locator(':text("Allow advance booking")')).toBeVisible();
    });

    test('should update queue capacity', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Queue Settings")');
      
      // Update capacity
      await page.fill('input[name="defaultCapacity"]', '50');
      
      // Save
      await page.click('button:has-text("Save Queue Settings")');
      
      // Check saved
      await expect(page.locator('.success-message')).toBeVisible();
    });

    test('should configure queue behavior', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Queue Settings")');
      
      // Toggle settings
      await page.check('input[name="autoCloseWhenFull"]');
      await page.check('input[name="allowAdvanceBooking"]');
      
      // Set advance booking hours
      await page.fill('input[name="advanceBookingHours"]', '24');
      
      // Save
      await page.click('button:has-text("Save Queue Settings")');
      
      // Verify
      await page.reload();
      await expect(page.locator('input[name="autoCloseWhenFull"]')).toBeChecked();
    });
  });

  test.describe('Integration Settings', () => {
    test('should display integration options', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Integrations")');
      
      // Check available integrations
      await expect(page.locator(':text("WhatsApp")')).toBeVisible();
      await expect(page.locator(':text("Facebook Messenger")')).toBeVisible();
      await expect(page.locator(':text("Telegram")')).toBeVisible();
      await expect(page.locator(':text("SMS")')).toBeVisible();
    });

    test('should configure WhatsApp integration', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Integrations")');
      
      // Enable WhatsApp
      await page.check('input[name="whatsappEnabled"]');
      
      // Configure settings with dynamic number
      await page.fill('input[name="whatsappNumber"]', `+601${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`);
      
      // Save
      await page.click('button:has-text("Save Integration Settings")');
      
      // Check saved
      await expect(page.locator('.success-message')).toBeVisible();
    });

    test('should configure SMS integration', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Integrations")');
      
      // Enable SMS
      await page.check('input[name="smsEnabled"]');
      
      // Add SMS gateway details
      await page.fill('input[name="smsApiKey"]', 'test-api-key');
      await page.fill('input[name="smsSenderId"]', 'QUEUE');
      
      // Save
      await page.click('button:has-text("Save Integration Settings")');
      
      // Verify
      await expect(page.locator('.success-message')).toBeVisible();
    });
  });

  test.describe('Notification Settings', () => {
    test('should display notification preferences', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Notifications")');
      
      // Check notification types
      await expect(page.locator(':text("Queue Updates")')).toBeVisible();
      await expect(page.locator(':text("Customer Feedback")')).toBeVisible();
      await expect(page.locator(':text("System Alerts")')).toBeVisible();
    });

    test('should configure email notifications', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Notifications")');
      
      // Enable email notifications
      await page.check('input[name="emailNotifications"]');
      
      // Add notification emails with dynamic data
      await page.fill('input[name="notificationEmails"]', `manager_${Date.now()}@example.com, admin_${Date.now()}@example.com`);
      
      // Save
      await page.click('button:has-text("Save Notification Settings")');
      
      // Check saved
      await expect(page.locator('.success-message')).toBeVisible();
    });

    test('should set notification thresholds', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Notifications")');
      
      // Set thresholds
      await page.fill('input[name="queueFullThreshold"]', '90');
      await page.fill('input[name="longWaitThreshold"]', '60');
      
      // Save
      await page.click('button:has-text("Save Notification Settings")');
      
      // Verify
      await expect(page.locator('.success-message')).toBeVisible();
    });
  });

  test.describe('Account Settings', () => {
    test('should display account information', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Account")');
      
      // Check account info
      await expect(page.locator(':text("Account Email")')).toBeVisible();
      await expect(page.locator(':text("Account Type")')).toBeVisible();
      await expect(page.locator(':text("Member Since")')).toBeVisible();
    });

    test('should allow password change', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Account")');
      
      // Click change password
      await page.click('button:has-text("Change Password")');
      
      // Check password form
      await expect(page.locator('input[name="currentPassword"]')).toBeVisible();
      await expect(page.locator('input[name="newPassword"]')).toBeVisible();
      await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
    });

    test('should validate password requirements', async ({ page }) => {
      await page.goto('/settings');
      await page.click(':text("Account")');
      await page.click('button:has-text("Change Password")');
      
      // Try weak password
      await page.fill('input[name="currentPassword"]', 'currentPassword123');
      await page.fill('input[name="newPassword"]', 'weak');
      await page.fill('input[name="confirmPassword"]', 'weak');
      
      // Submit
      await page.click('button:has-text("Update Password")');
      
      // Check error
      await expect(page.locator(':text("Password must be at least 8 characters")')).toBeVisible();
    });
  });

  test.describe('Settings Mobile Experience', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should have mobile-friendly settings layout', async ({ page }) => {
      await page.goto('/settings');
      
      // Check mobile layout
      await expect(page.locator('.settings-tabs')).toBeVisible();
      
      // Tabs should be scrollable or stacked
      const tabsContainer = page.locator('.settings-tabs');
      const box = await tabsContainer.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(375);
    });

    test('should have touch-friendly form elements', async ({ page }) => {
      await page.goto('/settings');
      
      // Check input sizes
      const inputs = page.locator('input[type="text"], input[type="email"]');
      const firstInput = inputs.first();
      const box = await firstInput.boundingBox();
      
      // Should have adequate height for touch
      expect(box?.height).toBeGreaterThanOrEqual(40);
    });
  });
});