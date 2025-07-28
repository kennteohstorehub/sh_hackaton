const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Starting simple navigation test...');
    
    // Go directly to dashboard (auth bypass should work)
    await page.goto('http://localhost:3838/dashboard');
    await page.waitForLoadState('networkidle');
    console.log('Dashboard URL:', page.url());
    
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
    
    // Test each link
    for (const linkText of linkTexts) {
      console.log(`\n--- Testing ${linkText} link ---`);
      
      // Click the link
      await page.click(`.nav a:has-text("${linkText}")`);
      await page.waitForLoadState('networkidle');
      
      console.log(`URL after clicking ${linkText}: ${page.url()}`);
      
      // Check if navigation is still consistent
      const newNavLinks = await page.$$('.nav a');
      console.log(`Nav links after navigation: ${newNavLinks.length}`);
      
      // Check active state
      const activeLink = await page.$('.nav a.active');
      if (activeLink) {
        const activeText = await activeLink.textContent();
        console.log(`Active link: ${activeText.trim()}`);
      }
    }
    
    // Check View Public button
    console.log('\n--- Checking View Public button ---');
    const viewPublicButton = await page.$('.btn-view-public');
    console.log(`View Public button exists: ${viewPublicButton !== null}`);
    
    if (viewPublicButton) {
      const buttonText = await viewPublicButton.textContent();
      console.log(`View Public button text: ${buttonText.trim()}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    console.log('\nTest complete. Browser will stay open for 10 seconds...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
})();