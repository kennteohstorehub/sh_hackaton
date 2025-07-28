const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Starting navigation debug test...');
    
    // Go to login
    await page.goto('http://localhost:3001/auth/login');
    console.log('Current URL:', page.url());
    
    // Try to login
    await page.fill('input[name="email"]', 'demo@storehub.com');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForLoadState('networkidle');
    console.log('After login URL:', page.url());
    
    // Check each page
    const pages = [
      { name: 'Dashboard', path: '/dashboard' },
      { name: 'Analytics', path: '/dashboard/analytics' },
      { name: 'WhatsApp', path: '/dashboard/whatsapp-setup' },
      { name: 'Settings', path: '/dashboard/settings' },
      { name: 'Help', path: '/dashboard/help' }
    ];
    
    for (const pageInfo of pages) {
      console.log(`\n--- Testing ${pageInfo.name} page ---`);
      
      // Navigate to the page
      await page.goto(`http://localhost:3001${pageInfo.path}`);
      await page.waitForLoadState('networkidle');
      console.log(`URL: ${page.url()}`);
      
      // Check if page loaded
      const title = await page.title();
      console.log(`Title: ${title}`);
      
      // Check navigation structure
      const navContainer = await page.$('.nav-container');
      console.log(`Nav container exists: ${navContainer !== null}`);
      
      // Count navigation links
      const navLinks = await page.$$('.nav a');
      console.log(`Number of nav links: ${navLinks.length}`);
      
      // Get link texts
      const linkTexts = [];
      for (const link of navLinks) {
        const text = await link.textContent();
        linkTexts.push(text.trim());
      }
      console.log(`Nav links: ${linkTexts.join(', ')}`);
      
      // Check for View Public button
      const viewPublicButton = await page.$('.btn-view-public');
      console.log(`View Public button exists: ${viewPublicButton !== null}`);
      
      // Check active link
      const activeLink = await page.$('.nav a.active');
      if (activeLink) {
        const activeText = await activeLink.textContent();
        console.log(`Active link: ${activeText.trim()}`);
      }
      
      // Check for errors
      const errorElements = await page.$$('text=Error');
      if (errorElements.length > 0) {
        console.log('⚠️  Error elements found on page!');
      }
    }
    
    // Test clicking navigation
    console.log('\n--- Testing navigation clicks ---');
    await page.goto('http://localhost:3001/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Try clicking Analytics
    const analyticsLink = await page.$('.nav a:has-text("Analytics")');
    if (analyticsLink) {
      console.log('Clicking Analytics link...');
      await analyticsLink.click();
      await page.waitForLoadState('networkidle');
      console.log('New URL:', page.url());
    } else {
      console.log('❌ Analytics link not found!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Keep browser open for inspection
    console.log('\nTest complete. Browser will stay open for 10 seconds...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
})();