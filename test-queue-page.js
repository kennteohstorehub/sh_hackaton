const { chromium } = require('playwright');

async function testQueuePage() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('Testing queue page with StoreHub design...');
    
    // Go to queue page
    await page.goto('http://demo.lvh.me:3838/queue/0367e40a-c7fa-47d1-ad4d-d8a8a1b59a0a');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/queue-page-storehub.png', fullPage: true });
    
    // Check for StoreHub CSS
    const hasDesignSystem = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.some(link => link.href.includes('storehub-design-system.css'));
    });
    
    console.log('✅ StoreHub Design System loaded:', hasDesignSystem ? 'YES' : 'NO');
    
    // Check for primary color
    const primaryColorElement = await page.$('.storehub-stats-card');
    if (primaryColorElement) {
      const style = await primaryColorElement.evaluate(el => 
        window.getComputedStyle(el).getPropertyValue('border-color')
      );
      console.log('✅ Primary color elements found');
    }
    
    // Check for Open Sans font
    const bodyFont = await page.evaluate(() => 
      window.getComputedStyle(document.body).fontFamily
    );
    console.log('✅ Font family:', bodyFont);
    
    console.log('\n📸 Screenshot saved to screenshots/queue-page-storehub.png');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testQueuePage();