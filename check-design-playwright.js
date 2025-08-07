const { chromium } = require('playwright');

async function checkDesign() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('🔍 Checking StoreHub Design System Implementation...\n');
  
  try {
    // Navigate to the site
    await page.goto('http://demo.lvh.me:3000', { waitUntil: 'networkidle' });
    
    console.log('📄 Current Page:', page.url());
    
    // Take screenshots for analysis
    await page.screenshot({ path: 'screenshots/current-login.png', fullPage: true });
    
    // Check what CSS files are loaded
    const cssFiles = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.map(link => link.href);
    });
    
    console.log('\n📋 CSS Files Loaded:');
    cssFiles.forEach(file => console.log('  -', file));
    
    // Check primary colors being used
    const primaryColor = await page.evaluate(() => {
      const button = document.querySelector('.btn-primary, button[type="submit"]');
      if (button) {
        return window.getComputedStyle(button).backgroundColor;
      }
      return null;
    });
    
    console.log('\n🎨 Primary Button Color:', primaryColor);
    
    // Check font family
    const fontFamily = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontFamily;
    });
    
    console.log('🔤 Font Family:', fontFamily);
    
    // Check if design system CSS is loaded
    const hasDesignSystem = cssFiles.some(file => file.includes('storehub-design-system.css'));
    console.log('\n✅ StoreHub Design System CSS:', hasDesignSystem ? 'Loaded' : 'NOT LOADED');
    
    // Check form styling
    const formStyling = await page.evaluate(() => {
      const input = document.querySelector('input[type="email"], input[type="text"]');
      if (input) {
        const styles = window.getComputedStyle(input);
        return {
          height: styles.height,
          borderRadius: styles.borderRadius,
          borderColor: styles.borderColor,
          fontSize: styles.fontSize
        };
      }
      return null;
    });
    
    console.log('\n📝 Form Input Styling:', formStyling);
    
    // Check which login page is being used
    const pageContent = await page.content();
    const isNewDesign = pageContent.includes('storehub-design-system') || 
                       pageContent.includes('StoreHub Design System');
    
    console.log('\n🚀 Using New Design System:', isNewDesign ? 'YES' : 'NO');
    
    // Navigate to different routes to check their templates
    console.log('\n📍 Checking Routes:');
    
    // Check merchant login
    console.log('\nMerchant Login (/auth/login):');
    const loginResponse = await page.goto('http://demo.lvh.me:3000/auth/login', { waitUntil: 'networkidle' });
    console.log('  Status:', loginResponse.status());
    await page.screenshot({ path: 'screenshots/merchant-login.png', fullPage: true });
    
    // Check backoffice login
    console.log('\nBackoffice Login (/backoffice/auth/login):');
    try {
      const backofficeResponse = await page.goto('http://admin.lvh.me:3000/backoffice/auth/login', { waitUntil: 'networkidle' });
      console.log('  Status:', backofficeResponse.status());
      await page.screenshot({ path: 'screenshots/backoffice-login.png', fullPage: true });
    } catch (e) {
      console.log('  Error accessing backoffice:', e.message);
    }
    
    // Check which EJS template is being rendered
    const viewSource = await page.evaluate(() => {
      // Look for comments or specific elements that indicate which template
      const comments = Array.from(document.childNodes)
        .filter(node => node.nodeType === 8) // Comment nodes
        .map(node => node.textContent);
      
      return {
        hasStoreHubHeader: !!document.querySelector('.storehub-header'),
        hasOldHeader: !!document.querySelector('.common-header'),
        bodyClasses: document.body.className,
        comments: comments
      };
    });
    
    console.log('\n🔍 Template Analysis:', viewSource);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

checkDesign();