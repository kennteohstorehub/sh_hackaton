const { test, expect } = require('@playwright/test');
const { LoginPage } = require('./pages/LoginPage');
const { generateTestData } = require('./test-config');

test.describe('Comprehensive Merchant Settings Tests', () => {
  let loginPage, page;

  test.beforeEach(async ({ browser }) => {
    // Launch a new page for each test
    page = await browser.newPage();
    loginPage = new LoginPage(page);
    
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    
    if (!testEmail || !testPassword) {
      test.skip('Test credentials not configured');
      return;
    }
    
    await loginPage.goto();
    await loginPage.login(testEmail, testPassword);
    await page.waitForURL('**/dashboard');
    
    // Navigate to settings
    await page.locator('nav a[href="/dashboard/settings"]').click();
    await page.waitForURL('**/dashboard/settings');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Validate restaurant information save with complete data', async () => {
    // Generate unique test data
    const testRestaurant = {
      name: `Test Restaurant ${generateTestData.uniqueString()}`,
      phone: generateTestData.phoneNumber(),
      address: `${generateTestData.streetAddress()}, Test City, TC 12345`
    };

    // Fill restaurant form
    await page.fill('#restaurantName', testRestaurant.name);
    await page.fill('#restaurantPhone', testRestaurant.phone);
    await page.fill('#restaurantAddress', testRestaurant.address);
    
    // Save the form
    const saveBtn = page.locator('#restaurantForm button[type="submit"]');
    await saveBtn.click();
    
    // Wait for save to complete
    await expect(saveBtn).toHaveText('Saving...', { timeout: 5000 });
    await expect(saveBtn).toHaveText('Save Restaurant Information', { timeout: 10000 });
    
    // Verify success message
    const successMessage = page.locator('#successMessage');
    await expect(successMessage).toBeVisible();
    await expect(successMessage).toContainText('Business information saved successfully');
    
    // Refresh page to verify persistence
    await page.reload();
    
    // Check values are saved
    await expect(page.locator('#restaurantName')).toHaveValue(testRestaurant.name);
    await expect(page.locator('#restaurantPhone')).toHaveValue(testRestaurant.phone);
    await expect(page.locator('#restaurantAddress')).toHaveValue(testRestaurant.address);
  });

  test('Validate business hours configuration with complex scenarios', async () => {
    const testDays = [
      { day: 'monday', start: '07:00', end: '21:00' },
      { day: 'tuesday', start: '09:00', end: '19:00' },
      { day: 'wednesday', closed: true },
      { day: 'thursday', start: '10:00', end: '22:00' },
      { day: 'friday', start: '08:00', end: '23:00' },
      { day: 'saturday', start: '10:00', end: '20:00' },
      { day: 'sunday', closed: true }
    ];

    for (const dayConfig of testDays) {
      const dayRow = page.locator(`[data-day="${dayConfig.day}"]`);
      const closedToggle = dayRow.locator(`#${dayConfig.day}-closed`);
      const startInput = dayRow.locator(`input[name="businessHours[${dayConfig.day}][start]"]`);
      const endInput = dayRow.locator(`input[name="businessHours[${dayConfig.day}][end]"]`);

      if (dayConfig.closed) {
        await closedToggle.click();
        await expect(dayRow).toHaveClass(/closed/);
      } else {
        // Ensure the day is not closed
        if (await closedToggle.isChecked()) {
          await closedToggle.click();
        }

        // Set start and end times
        await startInput.fill(dayConfig.start);
        await endInput.fill(dayConfig.end);

        // Verify inputs are correctly set
        await expect(startInput).toHaveValue(dayConfig.start);
        await expect(endInput).toHaveValue(dayConfig.end);
      }
    }

    // Save restaurant form to persist changes
    const saveBtn = page.locator('#restaurantForm button[type="submit"]');
    await saveBtn.click();
    await expect(saveBtn).toHaveText('Save Restaurant Information', { timeout: 10000 });
  });

  test('Comprehensive queue configuration validation', async () => {
    const queueSettings = {
      maxCapacity: 120,
      avgServiceTime: 25,
      notificationAdvance: 15,
      maxPartySize: 10
    };

    // Fill queue settings with varied inputs
    await page.fill('#maxCapacity', queueSettings.maxCapacity.toString());
    await page.fill('#avgServiceTime', queueSettings.avgServiceTime.toString());
    
    // Save queue settings
    const saveBtn = page.locator('#queueSettingsForm button[type="submit"]');
    await saveBtn.click();
    
    // Wait for save and verify success message
    await expect(saveBtn).toHaveText('Saving...', { timeout: 5000 });
    await expect(saveBtn).toHaveText('Save Queue Settings', { timeout: 10000 });
    
    // Verify form help text still visible
    await expect(page.locator('.form-help').first()).toBeVisible();
    
    // Validate input constraints
    const maxCapacityInput = page.locator('#maxCapacity');
    await maxCapacityInput.fill('0');
    await expect(maxCapacityInput).toHaveAttribute('min', '1');
    await expect(maxCapacityInput).toHaveAttribute('max', '500');
  });

  test('Error handling and validation for settings', async () => {
    // Test restaurant name validation
    const restaurantNameInput = page.locator('#restaurantName');
    await restaurantNameInput.fill('');
    
    const saveBtn = page.locator('#restaurantForm button[type="submit"]');
    await saveBtn.click();
    
    // Check for required field validation
    await expect(restaurantNameInput).toHaveAttribute('required', '');
    
    // Verify error message appears
    const errorMessage = page.locator('#errorMessage');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Error');
  });

  test('Test responsiveness and mobile view', async () => {
    // Test various viewport sizes
    const viewports = [
      { width: 375, height: 812 },   // iPhone X
      { width: 768, height: 1024 },  // iPad
      { width: 1024, height: 768 },  // Small desktop
      { width: 1440, height: 900 }   // Large desktop
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      
      // Check form row layout
      const formRows = page.locator('.form-row');
      const formRowCount = await formRows.count();
      
      if (viewport.width < 768) {
        // Mobile view - form rows should stack
        for (let i = 0; i < formRowCount; i++) {
          const row = formRows.nth(i);
          await expect(row).toHaveCSS('grid-template-columns', '1fr');
        }
      } else {
        // Desktop view - form rows should be side by side
        for (let i = 0; i < formRowCount; i++) {
          const row = formRows.nth(i);
          await expect(row).toHaveCSS('grid-template-columns', '1fr 1fr');
        }
      }
      
      // Check mobile navigation
      const mobileNavToggle = page.locator('.mobile-nav-toggle');
      viewport.width < 768 
        ? await expect(mobileNavToggle).toBeVisible()
        : await expect(mobileNavToggle).not.toBeVisible();
    }
  });

  test('Advanced settings locking mechanism', async () => {
    // Simulate an active queue to test settings locking
    const settingsLockedBanner = page.locator('#settings-locked-banner');
    await page.evaluate(() => {
      // Simulate active queue state
      document.getElementById('settings-locked-banner').style.display = 'flex';
      document.getElementById('active-queue-name').textContent = 'Test Queue';
    });

    // Check all settings sections are locked
    const lockedSections = page.locator('.section.locked');
    await expect(lockedSections).toHaveCount(5);  // All 5 settings sections

    // Verify form inputs are disabled
    const formInputs = page.locator('input, select, textarea, button[type="submit"]');
    for (let i = 0; i < await formInputs.count(); i++) {
      await expect(formInputs.nth(i)).toBeDisabled();
    }

    // Check lock banner details
    await expect(settingsLockedBanner).toBeVisible();
    await expect(settingsLockedBanner).toContainText('Configuration Locked');
    await expect(settingsLockedBanner).toContainText('Test Queue');
  });

  test('Message template placeholder verification', async () => {
    const testTemplates = [
      {
        selector: '#welcomeMessage',
        placeholders: ['{{Restaurant Name}}', '{{Position}}', '{{WaitTime}}']
      },
      {
        selector: '#notificationMessage',
        placeholders: ['{{Customer Name}}', '{{Minutes}}']
      },
      {
        selector: '#readyMessage',
        placeholders: ['{{Customer Name}}', '{{Restaurant Name}}']
      }
    ];

    for (const template of testTemplates) {
      const messageInput = page.locator(template.selector);
      
      // Fill with placeholders
      const templateText = template.placeholders.join(' ');
      await messageInput.fill(templateText);
      
      // Verify placeholders are preserved
      for (const placeholder of template.placeholders) {
        await expect(messageInput).toHaveValue(expect.stringContaining(placeholder));
      }
    }

    // Save message templates
    const saveBtn = page.locator('#messageTemplatesForm button[type="submit"]');
    await saveBtn.click();
    await expect(saveBtn).toHaveText('Save Message Templates', { timeout: 10000 });
  });
});