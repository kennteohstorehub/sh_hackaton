const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to demo tenant...');
    await page.goto('http://demo.lvh.me:3838/auth/login');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    console.log('Page URL:', page.url());
    console.log('Page title:', await page.title());
    
    // Check if we have the email field
    const emailField = await page.locator('input[name="email"]').isVisible();
    console.log('Email field visible:', emailField);
    
    if (!emailField) {
      console.log('Email field not found, checking page content...');
      const bodyText = await page.locator('body').textContent();
      console.log('Page content snippet:', bodyText.substring(0, 200));
      throw new Error('Login form not found');
    }
    
    console.log('Logging in...');
    await page.fill('input[name="email"]', 'demo@storehub.com');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');
    
    console.log('Waiting for navigation...');
    try {
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      console.log('Successfully navigated to dashboard');
    } catch (e) {
      console.log('Navigation failed, current URL:', page.url());
      // Check for error messages
      const errorMsg = await page.locator('.alert-danger').textContent().catch(() => null);
      if (errorMsg) {
        console.log('Login error:', errorMsg);
      }
    }
    
    console.log('Checking tenant name display...');
    
    // Check if tenant badge exists
    const tenantBadge = await page.locator('.tenant-badge').first();
    const badgeVisible = await tenantBadge.isVisible();
    console.log('Tenant badge visible:', badgeVisible);
    
    if (badgeVisible) {
      // Try to get the tenant name with a shorter timeout
      try {
        const tenantNameElement = page.locator('.tenant-badge .tenant-name').first();
        await tenantNameElement.waitFor({ state: 'visible', timeout: 5000 });
        const tenantName = await tenantNameElement.textContent();
        console.log('Tenant name displayed:', tenantName);
        
        // Check if it's showing the tenant name (not business name)
        if (tenantName && !tenantName.includes('Test Restaurant') && !tenantName.includes('1754365123132')) {
          console.log('✅ SUCCESS: Tenant name is displayed correctly:', tenantName);
        } else {
          console.log('❌ FAIL: Still showing business name:', tenantName);
        }
      } catch (e) {
        console.log('Could not find tenant name element, checking badge content...');
        const badgeContent = await tenantBadge.textContent();
        console.log('Badge content:', badgeContent);
        
        // Extract and verify the tenant name from badge content
        if (badgeContent.includes('Demo Restaurant')) {
          console.log('✅ SUCCESS: Tenant name "Demo Restaurant" is displayed correctly in the badge!');
        } else if (badgeContent.includes('Test Restaurant') || badgeContent.includes('1754365123132')) {
          console.log('❌ FAIL: Still showing business name in badge');
        }
      }
    }
    
    // Also check the banner
    const tenantBanner = await page.locator('.tenant-context-banner');
    const bannerVisible = await tenantBanner.isVisible();
    console.log('Tenant banner visible:', bannerVisible);
    
    if (bannerVisible) {
      const bannerName = await tenantBanner.locator('h3').first().textContent();
      console.log('Banner tenant name:', bannerName);
    }
    
    // Take a screenshot
    await page.screenshot({ path: 'tenant-name-test.png', fullPage: true });
    console.log('Screenshot saved as tenant-name-test.png');
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'tenant-name-test-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();