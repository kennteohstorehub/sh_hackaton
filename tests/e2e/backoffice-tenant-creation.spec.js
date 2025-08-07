const { test, expect } = require('@playwright/test');
const testConfig = require('./test-config');

// BackOffice test credentials
const BACKOFFICE_CREDENTIALS = {
  email: 'backoffice@storehubqms.local',
  password: 'BackOffice123!@#'
};

test.describe('BackOffice - Tenant Creation and Management', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login to BackOffice
    await page.goto('/backoffice/auth/login');
    await page.fill('input[name="email"]', BACKOFFICE_CREDENTIALS.email);
    await page.fill('input[name="password"]', BACKOFFICE_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/backoffice\/dashboard/);
    
    // Navigate to tenants page
    await page.goto('/backoffice/tenants');
  });

  test('should display tenant management page correctly', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1, h2')).toContainText(/Tenants/);
    
    // Check for tenant list table
    await expect(page.locator('table, .table, .tenant-list')).toBeVisible();
    
    // Check for create button
    await expect(page.locator('a:has-text("Create"), button:has-text("Create"), .btn-create')).toBeVisible();
    
    // Check table headers
    await expect(page.locator('th, .table-header')).toContainText(/Name|Domain|Status|Actions/i);
  });

  test('should open create tenant form', async ({ page }) => {
    // Click create tenant button
    const createButton = page.locator('a:has-text("Create"), button:has-text("Create"), .btn-create, .btn-primary').first();
    await createButton.click();
    
    // Should navigate to create form or show modal
    await expect(page.locator('form')).toBeVisible();
    
    // Check for required form fields
    await expect(page.locator('input[name*="name"], #name')).toBeVisible();
    await expect(page.locator('input[name*="domain"], input[name*="subdomain"], #domain, #subdomain')).toBeVisible();
    await expect(page.locator('textarea[name*="description"], #description')).toBeVisible();
    
    // Check for submit button
    await expect(page.locator('button[type="submit"], .btn-submit')).toBeVisible();
  });

  test('should validate tenant creation form', async ({ page }) => {
    // Click create tenant button
    const createButton = page.locator('a:has-text("Create"), button:has-text("Create"), .btn-create, .btn-primary').first();
    await createButton.click();
    
    await expect(page.locator('form')).toBeVisible();
    
    // Try to submit form without required fields
    await page.click('button[type="submit"], .btn-submit');
    
    // Should show validation errors
    await expect(page.locator('.error, .invalid-feedback, .alert-danger, .form-error')).toBeVisible();
  });

  test('should create a new tenant successfully', async ({ page }) => {
    // Click create tenant button
    const createButton = page.locator('a:has-text("Create"), button:has-text("Create"), .btn-create, .btn-primary').first();
    await createButton.click();
    
    await expect(page.locator('form')).toBeVisible();
    
    // Generate unique tenant data
    const timestamp = Date.now();
    const tenantData = {
      name: `Test Tenant ${timestamp}`,
      domain: `test-tenant-${timestamp}`,
      description: `Test tenant created by automated tests at ${new Date().toISOString()}`
    };
    
    // Fill form fields
    await page.fill('input[name*="name"], #name', tenantData.name);
    await page.fill('input[name*="domain"], input[name*="subdomain"], #domain, #subdomain', tenantData.domain);
    
    // Fill description if field exists
    const descriptionField = page.locator('textarea[name*="description"], #description');
    if (await descriptionField.isVisible()) {
      await descriptionField.fill(tenantData.description);
    }
    
    // Submit form
    await page.click('button[type="submit"], .btn-submit');
    
    // Should redirect to tenant list or show success message
    await expect(page.locator('.alert-success, .success, .flash-success')).toBeVisible({ timeout: 10000 });
    
    // Should see the new tenant in the list
    await page.goto('/backoffice/tenants');
    await expect(page.locator('body')).toContainText(tenantData.name);
  });

  test('should prevent duplicate tenant domains', async ({ page }) => {
    // First, try to get an existing tenant domain
    const existingTenantRow = page.locator('tr').nth(1); // Skip header row
    
    if (await existingTenantRow.isVisible()) {
      const existingDomain = await existingTenantRow.locator('td').nth(1).textContent();
      
      if (existingDomain && existingDomain.trim()) {
        // Click create tenant button
        const createButton = page.locator('a:has-text("Create"), button:has-text("Create"), .btn-create, .btn-primary').first();
        await createButton.click();
        
        await expect(page.locator('form')).toBeVisible();
        
        // Try to create tenant with existing domain
        await page.fill('input[name*="name"], #name', `Duplicate Test ${Date.now()}`);
        await page.fill('input[name*="domain"], input[name*="subdomain"], #domain, #subdomain', existingDomain.trim());
        
        // Submit form
        await page.click('button[type="submit"], .btn-submit');
        
        // Should show error about duplicate domain
        await expect(page.locator('.error, .alert-danger, .flash-error')).toBeVisible();
        await expect(page.locator('body')).toContainText(/already exists|duplicate|taken/i);
      }
    }
  });

  test('should show tenant details', async ({ page }) => {
    // Look for view/details links in the tenant table
    const viewLinks = page.locator('a:has-text("View"), a:has-text("Details"), .btn-view, .btn-details');
    
    if (await viewLinks.count() > 0) {
      await viewLinks.first().click();
      
      // Should show tenant details page
      await expect(page.locator('.tenant-details, .card, .details-card')).toBeVisible();
      
      // Should show tenant information
      await expect(page.locator('body')).toContainText(/Name|Domain|Description|Status|Created/i);
    }
  });

  test('should allow editing existing tenant', async ({ page }) => {
    // Look for edit links in the tenant table
    const editLinks = page.locator('a:has-text("Edit"), .btn-edit');
    
    if (await editLinks.count() > 0) {
      await editLinks.first().click();
      
      // Should show edit form
      await expect(page.locator('form')).toBeVisible();
      
      // Form should be pre-filled
      const nameField = page.locator('input[name*="name"], #name');
      await expect(nameField).not.toHaveValue('');
      
      // Make a small change
      const currentValue = await nameField.inputValue();
      await nameField.fill(currentValue + ' (Updated)');
      
      // Submit form
      await page.click('button[type="submit"], .btn-submit');
      
      // Should show success message
      await expect(page.locator('.alert-success, .success, .flash-success')).toBeVisible({ timeout: 10000 });
    }
  });

  test('should handle tenant status changes', async ({ page }) => {
    // Look for status toggle buttons or dropdowns
    const statusControls = page.locator('.status-toggle, .btn-status, select[name*="status"]');
    
    if (await statusControls.count() > 0) {
      await statusControls.first().click();
      
      // Should show confirmation or immediate change
      // This depends on the UI implementation
      await page.waitForTimeout(1000); // Brief wait for UI update
    }
  });

  test('should paginate tenant list for large datasets', async ({ page }) => {
    // Check if pagination exists
    const pagination = page.locator('.pagination, .page-numbers, .pager');
    
    if (await pagination.isVisible()) {
      // Test pagination navigation
      const nextButton = page.locator('.pagination a:has-text("Next"), .page-next');
      
      if (await nextButton.isVisible()) {
        await nextButton.click();
        
        // Should load next page
        await expect(page.locator('table, .tenant-list')).toBeVisible();
      }
    }
  });

  test('should search/filter tenants', async ({ page }) => {
    // Look for search or filter controls
    const searchInput = page.locator('input[type="search"], input[name*="search"], .search-input');
    
    if (await searchInput.isVisible()) {
      // Enter search term
      await searchInput.fill('test');
      
      // Look for search button or auto-search
      const searchButton = page.locator('button:has-text("Search"), .btn-search');
      if (await searchButton.isVisible()) {
        await searchButton.click();
      } else {
        // Try pressing Enter for auto-search
        await searchInput.press('Enter');
      }
      
      // Wait for results
      await page.waitForTimeout(1000);
      
      // Table should still be visible (even if no results)
      await expect(page.locator('table, .tenant-list')).toBeVisible();
    }
  });

  test('should export tenant data', async ({ page }) => {
    // Look for export buttons
    const exportButton = page.locator('a:has-text("Export"), button:has-text("Export"), .btn-export');
    
    if (await exportButton.isVisible()) {
      // Start download
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      
      // Wait for download
      const download = await downloadPromise;
      
      // Verify download started
      expect(download.suggestedFilename()).toMatch(/tenants|export/i);
    }
  });

  test('should handle bulk operations', async ({ page }) => {
    // Look for checkboxes in tenant rows
    const checkboxes = page.locator('input[type="checkbox"]');
    
    if (await checkboxes.count() > 1) { // More than just select all
      // Select first tenant
      await checkboxes.nth(1).check(); // Skip "select all" checkbox
      
      // Look for bulk action buttons
      const bulkActions = page.locator('.bulk-actions, .btn-bulk');
      
      if (await bulkActions.isVisible()) {
        // Test bulk actions are available
        await expect(bulkActions).toContainText(/Delete|Status|Export/i);
      }
    }
  });

  test('should show tenant activity logs', async ({ page }) => {
    // Look for view/details links to access tenant details
    const viewLinks = page.locator('a:has-text("View"), a:has-text("Details"), .btn-view');
    
    if (await viewLinks.count() > 0) {
      await viewLinks.first().click();
      
      // Look for activity/logs section
      const activitySection = page.locator('.activity, .logs, .history, a:has-text("Activity"), a:has-text("Logs")');
      
      if (await activitySection.isVisible()) {
        if (await activitySection.first().getAttribute('href')) {
          // It's a link, click it
          await activitySection.first().click();
        }
        
        // Should show activity logs
        await expect(page.locator('.log-entry, .activity-item, table')).toBeVisible();
      }
    }
  });
});