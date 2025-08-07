// Final test for StoreHub buttons
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    console.log('🚀 Testing StoreHub buttons in dashboard...\n');
    
    // Login
    console.log('1. Logging in...');
    await page.goto('http://localhost:3000/auth/login');
    await page.type('#email', 'demo@merchant.com');
    await page.type('#password', 'Test@1234');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // Check dashboard
    console.log('2. Checking dashboard...');
    await page.waitForTimeout(2000);
    
    // Look for action buttons
    const actionButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('.btn-storehub');
      const groups = document.querySelectorAll('.action-buttons-group');
      const debugInfo = {
        buttonCount: buttons.length,
        groupCount: groups.length,
        buttons: []
      };
      
      buttons.forEach(btn => {
        const rect = btn.getBoundingClientRect();
        const styles = window.getComputedStyle(btn);
        debugInfo.buttons.push({
          text: btn.textContent.trim(),
          visible: rect.width > 0 && rect.height > 0,
          display: styles.display,
          visibility: styles.visibility,
          opacity: styles.opacity,
          position: `${rect.left}, ${rect.top}`,
          size: `${rect.width}x${rect.height}`
        });
      });
      
      return debugInfo;
    });
    
    console.log('\n📊 Results:');
    console.log(`- Found ${actionButtons.buttonCount} StoreHub buttons`);
    console.log(`- Found ${actionButtons.groupCount} action button groups`);
    
    if (actionButtons.buttons.length > 0) {
      console.log('\n✅ Button Details:');
      actionButtons.buttons.forEach((btn, i) => {
        console.log(`  Button ${i + 1}: "${btn.text}"`);
        console.log(`    - Visible: ${btn.visible}`);
        console.log(`    - Display: ${btn.display}`);
        console.log(`    - Size: ${btn.size}`);
      });
    } else {
      console.log('\n❌ No buttons found!');
    }
    
    // Take screenshot
    await page.screenshot({ path: 'dashboard-buttons-test.png', fullPage: true });
    console.log('\n📸 Screenshot saved as dashboard-buttons-test.png');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();