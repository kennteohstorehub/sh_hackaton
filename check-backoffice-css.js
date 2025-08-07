const { chromium } = require('@playwright/test');

async function checkCSS() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext().then(c => c.newPage());
  
  try {
    // Navigate to login page
    await page.goto('http://localhost:3000/backoffice/auth/login');
    
    // Get all stylesheets
    const stylesheets = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(link => ({
        href: link.href,
        loaded: link.sheet !== null
      }));
    });
    
    console.log('Stylesheets loaded:');
    stylesheets.forEach(sheet => {
      console.log(`  ${sheet.loaded ? '✓' : '✗'} ${sheet.href}`);
    });
    
    // Check if CSS variables are applied
    const cssVars = await page.evaluate(() => {
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);
      return {
        primaryOrange: computedStyle.getPropertyValue('--sh-primary-orange'),
        baseWhite: computedStyle.getPropertyValue('--sh-base-white'),
        fontPrimary: computedStyle.getPropertyValue('--sh-font-primary'),
        // Check old variables too
        oldPrimaryOrange: computedStyle.getPropertyValue('--primary-orange'),
        oldFontFamily: computedStyle.getPropertyValue('--sh-font-family')
      };
    });
    
    console.log('\nCSS Variables:');
    console.log('  --sh-primary-orange:', cssVars.primaryOrange || 'NOT SET');
    console.log('  --sh-base-white:', cssVars.baseWhite || 'NOT SET');
    console.log('  --sh-font-primary:', cssVars.fontPrimary || 'NOT SET');
    console.log('  Old --primary-orange:', cssVars.oldPrimaryOrange || 'NOT SET');
    console.log('  Old --sh-font-family:', cssVars.oldFontFamily || 'NOT SET');
    
    // Check body styles
    const bodyStyles = await page.evaluate(() => {
      const body = document.body;
      const computed = getComputedStyle(body);
      return {
        fontFamily: computed.fontFamily,
        backgroundColor: computed.backgroundColor,
        color: computed.color
      };
    });
    
    console.log('\nBody Styles:');
    console.log('  Font Family:', bodyStyles.fontFamily);
    console.log('  Background:', bodyStyles.backgroundColor);
    console.log('  Text Color:', bodyStyles.color);
    
    // Check for any buttons
    const buttonStyles = await page.evaluate(() => {
      const button = document.querySelector('button[type="submit"]');
      if (!button) return null;
      const computed = getComputedStyle(button);
      return {
        backgroundColor: computed.backgroundColor,
        color: computed.color,
        borderRadius: computed.borderRadius,
        fontFamily: computed.fontFamily
      };
    });
    
    if (buttonStyles) {
      console.log('\nSubmit Button Styles:');
      console.log('  Background:', buttonStyles.backgroundColor);
      console.log('  Color:', buttonStyles.color);
      console.log('  Border Radius:', buttonStyles.borderRadius);
      console.log('  Font Family:', buttonStyles.fontFamily);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

checkCSS();