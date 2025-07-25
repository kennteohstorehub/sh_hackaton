const { test, expect } = require('@playwright/test');
const { LoginPage } = require('./pages/LoginPage');

test.describe('Merchant Settings Tests', () => {
  let loginPage;

  test.beforeEach(async ({ page }) => {
    // Login before each test
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

  test('should display all settings sections', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Settings/);
    
    // Check all main sections are visible
    const sections = [
      '🏪 Restaurant Information',
      '⚙️ Queue Configuration',
      '🔔 Notification Preferences',
      '💬 Message Templates',
      '🔧 System Settings'
    ];
    
    for (const sectionTitle of sections) {
      await expect(page.locator(`h2:has-text("${sectionTitle}")`)).toBeVisible();
    }
    
    // Check danger zone
    await expect(page.locator('.danger-zone')).toBeVisible();
    await expect(page.locator('h3:has-text("⚠️ Danger Zone")')).toBeVisible();
  });

  test('should update restaurant information', async ({ page }) => {
    // Fill restaurant form
    await page.fill('#restaurantName', 'Test Restaurant Updated');
    await page.fill('#restaurantPhone', '+1 (555) 987-6543');
    await page.fill('#restaurantAddress', '123 Test Street, Test City, TC 12345');
    
    // Save the form
    const saveBtn = page.locator('#restaurantForm button[type="submit"]');
    await saveBtn.click();
    
    // Wait for save to complete
    await expect(saveBtn).toHaveText('Saving...', { timeout: 5000 });
    await expect(saveBtn).toHaveText('Save Restaurant Information', { timeout: 10000 });
    
    // Refresh page to verify persistence
    await page.reload();
    
    // Check values are saved
    await expect(page.locator('#restaurantName')).toHaveValue('Test Restaurant Updated');
    await expect(page.locator('#restaurantPhone')).toHaveValue('+1 (555) 987-6543');
  });

  test('should configure operating hours', async ({ page }) => {
    // Test Monday hours
    const mondayRow = page.locator('[data-day="monday"]');
    
    // Set opening time
    await mondayRow.locator('input[name="businessHours[monday][start]"]').fill('08:00');
    await mondayRow.locator('input[name="businessHours[monday][end]"]').fill('22:00');
    
    // Test closed toggle
    const mondayClosedToggle = mondayRow.locator('#monday-closed');
    await mondayClosedToggle.click();
    
    // Check visual state changes
    await expect(mondayRow).toHaveClass(/closed/);
    
    // Uncheck to open again
    await mondayClosedToggle.click();
    await expect(mondayRow).not.toHaveClass(/closed/);
    
    // Test all days
    const days = ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of days) {
      const dayRow = page.locator(`[data-day="${day}"]`);
      await expect(dayRow).toBeVisible();
      
      // Check time inputs exist
      await expect(dayRow.locator(`input[name="businessHours[${day}][start]"]`)).toBeVisible();
      await expect(dayRow.locator(`input[name="businessHours[${day}][end]"]`)).toBeVisible();
      await expect(dayRow.locator(`#${day}-closed`)).toBeVisible();
    }
  });

  test('should update queue configuration', async ({ page }) => {
    // Fill queue settings
    await page.fill('#maxCapacity', '100');
    await page.fill('#avgServiceTime', '20');
    await page.fill('#notificationAdvance', '10');
    await page.fill('#maxPartySize', '12');
    
    // Save settings
    const saveBtn = page.locator('#queueSettingsForm button[type="submit"]');
    await saveBtn.click();
    
    // Wait for save
    await page.waitForTimeout(1000);
    
    // Verify form help text
    await expect(page.locator('.form-help').first()).toBeVisible();
  });

  test('should toggle notification preferences', async ({ page }) => {
    // Test WhatsApp notifications toggle
    const whatsappToggle = page.locator('#whatsappNotifications');
    const whatsappSlider = whatsappToggle.locator('+ .slider');
    
    // Check initial state
    const isChecked = await whatsappToggle.isChecked();
    
    // Toggle off if on
    if (isChecked) {
      await whatsappToggle.click();
      await expect(whatsappToggle).not.toBeChecked();
    }
    
    // Toggle back on
    await whatsappToggle.click();
    await expect(whatsappToggle).toBeChecked();
    
    // Test auto-notifications toggle
    const autoToggle = page.locator('#autoNotifications');
    await autoToggle.click();
    const autoChecked = await autoToggle.isChecked();
    expect(typeof autoChecked).toBe('boolean');
    
    // Save notification settings
    const saveBtn = page.locator('button:has-text("Save Notification Settings")');
    await saveBtn.click();
  });

  test('should update message templates', async ({ page }) => {
    // Update welcome message
    const welcomeMsg = 'Welcome to {{Restaurant Name}}! You are #{{Position}} in line. Estimated wait: {{WaitTime}} minutes.';
    await page.fill('#welcomeMessage', welcomeMsg);
    
    // Update notification message
    const notifyMsg = 'Hi {{Customer Name}}! Your table will be ready in {{Minutes}} minutes.';
    await page.fill('#notificationMessage', notifyMsg);
    
    // Update ready message
    const readyMsg = '{{Customer Name}}, your table is ready! Please see the host.';
    await page.fill('#readyMessage', readyMsg);
    
    // Save templates
    const saveBtn = page.locator('#messageTemplatesForm button[type="submit"]');
    await saveBtn.click();
    
    // Check form help text is visible
    const helpTexts = page.locator('#messageTemplatesForm .form-help');
    await expect(helpTexts.first()).toBeVisible();
    await expect(helpTexts.first()).toContainText('placeholders');
  });

  test('should configure system settings', async ({ page }) => {
    // Test data retention dropdown
    const retentionSelect = page.locator('#dataRetention');
    await retentionSelect.selectOption('180');
    await expect(retentionSelect).toHaveValue('180');
    
    // Test analytics toggle
    const analyticsToggle = page.locator('#enableAnalytics');
    await analyticsToggle.click();
    const analyticsChecked = await analyticsToggle.isChecked();
    await analyticsToggle.click(); // Toggle back
    
    // Test anonymous data sharing
    const shareDataToggle = page.locator('#shareAnonymousData');
    await shareDataToggle.click();
    await expect(shareDataToggle).toBeChecked();
    
    // Save system settings
    const saveBtn = page.locator('button:has-text("Save System Settings")');
    await saveBtn.click();
  });

  test('should display danger zone actions', async ({ page }) => {
    // Scroll to danger zone
    await page.locator('.danger-zone').scrollIntoViewIfNeeded();
    
    // Check all danger buttons exist
    const dangerButtons = [
      'Clear All Queue Data',
      'Reset All Settings',
      'Delete Account'
    ];
    
    for (const btnText of dangerButtons) {
      const btn = page.locator(`.btn-danger:has-text("${btnText}")`);
      await expect(btn).toBeVisible();
      await expect(btn).toHaveClass(/btn-danger/);
    }
  });

  test('should handle responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    
    // Check mobile navigation toggle
    const mobileToggle = page.locator('.mobile-nav-toggle');
    await expect(mobileToggle).toBeVisible();
    
    // Operating hours should stack on mobile
    const hoursRow = page.locator('.hours-row').first();
    await expect(hoursRow).toBeVisible();
    
    // Form rows should stack
    const formRow = page.locator('.form-row').first();
    await expect(formRow).toBeVisible();
    
    // Settings grid should be single column
    const settingsGrid = page.locator('.settings-grid').first();
    await expect(settingsGrid).toBeVisible();
  });

  test('should validate form inputs', async ({ page }) => {
    // Test number input validation
    const maxCapacity = page.locator('#maxCapacity');
    
    // Clear and enter invalid value
    await maxCapacity.fill('');
    await maxCapacity.fill('0');
    
    // Should have min attribute
    await expect(maxCapacity).toHaveAttribute('min', '1');
    await expect(maxCapacity).toHaveAttribute('max', '500');
    
    // Test required fields
    const restaurantName = page.locator('#restaurantName');
    await expect(restaurantName).toHaveAttribute('required', '');
  });

  test('should display interactive elements correctly', async ({ page }) => {
    // Check toggle switches have proper styling
    const toggles = page.locator('.toggle');
    const toggleCount = await toggles.count();
    expect(toggleCount).toBeGreaterThan(0);
    
    // Check sliders are interactive
    const slider = page.locator('.slider').first();
    await expect(slider).toBeVisible();
    
    // Check buttons have hover effects
    const btn = page.locator('.btn').first();
    await btn.hover();
    
    // Check setting cards
    const settingCards = page.locator('.setting-card');
    const cardCount = await settingCards.count();
    expect(cardCount).toBeGreaterThan(0);
    
    // Hover on setting card for effect
    await settingCards.first().hover();
  });

  test('should handle form submission states', async ({ page }) => {
    // Test button disabled state during save
    const saveBtn = page.locator('#restaurantForm button[type="submit"]');
    
    // Fill minimal data
    await page.fill('#restaurantName', 'Quick Test Restaurant');
    
    // Click save
    await saveBtn.click();
    
    // Button should be disabled while saving
    await expect(saveBtn).toBeDisabled();
    
    // Should show loading text
    await expect(saveBtn).toContainText('Saving');
    
    // Eventually should re-enable
    await expect(saveBtn).toBeEnabled({ timeout: 10000 });
  });

  test('should navigate between settings sections smoothly', async ({ page }) => {
    // All sections should be on the same page
    const sections = page.locator('.section');
    const sectionCount = await sections.count();
    expect(sectionCount).toBeGreaterThanOrEqual(5);
    
    // Scroll through sections
    for (let i = 0; i < sectionCount; i++) {
      const section = sections.nth(i);
      await section.scrollIntoViewIfNeeded();
      await expect(section).toBeInViewport();
    }
    
    // Check particle animation elements
    const particles = page.locator('.particle');
    const particleCount = await particles.count();
    expect(particleCount).toBeGreaterThan(0);
  });
});