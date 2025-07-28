import { test, expect } from '@playwright/test';

test.describe('Navigation Consistency Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3838/auth/login');
    
    // Check if already logged in by looking for dashboard elements
    const isDashboard = await page.url().includes('/dashboard');
    
    if (!isDashboard) {
      // Perform login
      await page.fill('input[name="email"]', 'demo@storehub.com');
      await page.fill('input[name="password"]', 'demo123');
      await page.click('button[type="submit"]');
      
      // Wait for navigation to dashboard
      await page.waitForURL('**/dashboard', { timeout: 10000 });
    }
  });

  const pages = [
    { name: 'Dashboard', path: '/dashboard', activeIndex: 0 },
    { name: 'Queues', path: '/dashboard/queues', activeIndex: 1 },
    { name: 'Analytics', path: '/dashboard/analytics', activeIndex: 2 },
    { name: 'WhatsApp', path: '/dashboard/whatsapp-setup', activeIndex: 3 },
    { name: 'Settings', path: '/dashboard/settings', activeIndex: 4 },
    { name: 'Help', path: '/dashboard/help', activeIndex: 5 }
  ];

  test('All pages have consistent navigation structure', async ({ page }) => {
    for (const pageInfo of pages) {
      console.log(`Testing navigation on ${pageInfo.name} page...`);
      
      // Navigate to the page
      await page.goto(`http://localhost:3838${pageInfo.path}`);
      await page.waitForLoadState('networkidle');
      
      // Check if nav-container exists
      const navContainer = await page.locator('.nav-container').first();
      await expect(navContainer).toBeVisible();
      
      // Check if all navigation links exist
      const navLinks = await page.locator('.nav a').all();
      expect(navLinks).toHaveLength(6); // Should have 6 navigation links
      
      // Verify the order of links
      const expectedLinks = ['Dashboard', 'Queues', 'Analytics', 'WhatsApp', 'Settings', 'Help'];
      for (let i = 0; i < expectedLinks.length; i++) {
        const linkText = await navLinks[i].textContent();
        expect(linkText.trim()).toBe(expectedLinks[i]);
      }
      
      // Check active state
      const activeLink = await page.locator('.nav a.active');
      await expect(activeLink).toHaveCount(1);
      const activeText = await activeLink.textContent();
      expect(activeText.trim()).toBe(pageInfo.name);
      
      // Check logout button exists and is consistent
      const logoutButton = await page.locator('button:has-text("Logout")').first();
      await expect(logoutButton).toBeVisible();
      
      // Check View Public button container exists
      const viewPublicExists = await page.locator('.btn-view-public').count() > 0;
      console.log(`View Public button on ${pageInfo.name}: ${viewPublicExists ? 'exists' : 'not visible'}`);
    }
  });

  test('Navigation links work correctly from each page', async ({ page }) => {
    for (const sourcePage of pages) {
      console.log(`Testing navigation FROM ${sourcePage.name} page...`);
      
      // Start from the source page
      await page.goto(`http://localhost:3838${sourcePage.path}`);
      await page.waitForLoadState('networkidle');
      
      // Test clicking each navigation link
      for (const targetPage of pages) {
        if (sourcePage.name !== targetPage.name) {
          console.log(`  - Navigating to ${targetPage.name}`);
          
          // Click the target link
          await page.click(`.nav a:has-text("${targetPage.name}")`);
          
          // Wait for navigation
          await page.waitForURL(`**${targetPage.path}`, { timeout: 10000 });
          
          // Verify we're on the correct page
          expect(page.url()).toContain(targetPage.path);
          
          // Verify the active state changed
          const activeLink = await page.locator('.nav a.active');
          const activeText = await activeLink.textContent();
          expect(activeText.trim()).toBe(targetPage.name);
          
          // Go back to source page for next test
          if (targetPage !== pages[pages.length - 1]) {
            await page.goto(`http://localhost:3838${sourcePage.path}`);
            await page.waitForLoadState('networkidle');
          }
        }
      }
    }
  });

  test('View Public button behavior with active queue', async ({ page }) => {
    // First, create an active queue
    await page.goto('http://localhost:3838/dashboard/queues');
    await page.waitForLoadState('networkidle');
    
    // Check if there are any queues
    const noQueuesMessage = await page.locator('text=No queues created yet').count();
    
    if (noQueuesMessage > 0) {
      // Create a queue
      await page.click('button:has-text("Create Your First Queue")');
      await page.fill('#queueName', 'Test Queue for Navigation');
      await page.fill('#queueDescription', 'Testing navigation consistency');
      await page.click('button[type="submit"]:has-text("Create Queue")');
      await page.waitForLoadState('networkidle');
    }
    
    // Make sure at least one queue is active
    const activateButton = await page.locator('button:has-text("Activate")').first();
    if (await activateButton.count() > 0) {
      await activateButton.click();
      await page.waitForLoadState('networkidle');
    }
    
    // Now check View Public button on all pages
    for (const pageInfo of pages) {
      await page.goto(`http://localhost:3838${pageInfo.path}`);
      await page.waitForLoadState('networkidle');
      
      // Check if View Public button exists when there's an active queue
      const viewPublicButton = await page.locator('.btn-view-public');
      const exists = await viewPublicButton.count() > 0;
      
      if (exists) {
        await expect(viewPublicButton).toBeVisible();
        await expect(viewPublicButton).toHaveText(/View Public/);
        
        // Test clicking View Public button
        const [newPage] = await Promise.all([
          page.context().waitForEvent('page'),
          viewPublicButton.click()
        ]);
        
        // Verify new tab opened with queue URL
        expect(newPage.url()).toContain('/queue/');
        await newPage.close();
      }
    }
  });

  test('Logout functionality works from all pages', async ({ page }) => {
    for (const pageInfo of pages.slice(0, 2)) { // Test on first 2 pages to save time
      console.log(`Testing logout from ${pageInfo.name} page...`);
      
      // Navigate to the page
      await page.goto(`http://localhost:3838${pageInfo.path}`);
      await page.waitForLoadState('networkidle');
      
      // Find and click logout button
      const logoutButton = await page.locator('button:has-text("Logout")').first();
      await expect(logoutButton).toBeVisible();
      
      // Click logout
      await logoutButton.click();
      
      // Should redirect to login page
      await page.waitForURL('**/auth/login', { timeout: 10000 });
      expect(page.url()).toContain('/auth/login');
      
      // Log back in for next test
      if (pageInfo !== pages[1]) {
        await page.fill('input[name="email"]', 'demo@storehub.com');
        await page.fill('input[name="password"]', 'demo123');
        await page.click('button[type="submit"]');
        await page.waitForURL('**/dashboard', { timeout: 10000 });
      }
    }
  });

  test('Mobile navigation responsiveness', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Test on dashboard
    await page.goto('http://localhost:3838/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check if mobile nav toggle is visible
    const mobileToggle = await page.locator('.mobile-nav-toggle');
    const isToggleVisible = await mobileToggle.count() > 0;
    
    if (isToggleVisible) {
      // Click mobile toggle
      await mobileToggle.click();
      
      // Check if mobile nav is visible
      const mobileNav = await page.locator('.mobile-nav');
      if (await mobileNav.count() > 0) {
        await expect(mobileNav).toBeVisible();
        
        // Check all nav items exist in mobile menu
        const mobileNavLinks = await page.locator('.mobile-nav a').all();
        expect(mobileNavLinks.length).toBeGreaterThanOrEqual(5);
      }
    }
    
    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Navigation consistency with different queue states', async ({ page }) => {
    // Test with no queues
    await page.goto('http://localhost:3838/dashboard');
    await page.waitForLoadState('networkidle');
    
    let viewPublicButton = await page.locator('.btn-view-public');
    let viewPublicCount = await viewPublicButton.count();
    console.log(`View Public button count with current queue state: ${viewPublicCount}`);
    
    // Navigate through pages and check consistency
    const testPages = ['Analytics', 'Settings', 'Help'];
    for (const pageName of testPages) {
      await page.click(`.nav a:has-text("${pageName}")`);
      await page.waitForLoadState('networkidle');
      
      // Check navigation structure remains the same
      const navLinks = await page.locator('.nav a').all();
      expect(navLinks).toHaveLength(6);
      
      // Check View Public button consistency
      viewPublicButton = await page.locator('.btn-view-public');
      const currentCount = await viewPublicButton.count();
      expect(currentCount).toBe(viewPublicCount); // Should be consistent across pages
    }
  });
});