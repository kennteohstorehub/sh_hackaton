const { chromium } = require('@playwright/test');

async function testAdminBackoffice() {
  console.log('🚀 Testing Admin BackOffice Design...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();
    
    // Navigate to ADMIN subdomain
    console.log('📍 Navigating to admin.lvh.me:3000/backoffice/auth/login...');
    await page.goto('http://admin.lvh.me:3000/backoffice/auth/login', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Take screenshot
    await page.screenshot({ 
      path: 'admin-backoffice-login.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved: admin-backoffice-login.png');
    
    // Check design elements
    const designCheck = await page.evaluate(() => {
      const computedStyle = getComputedStyle(document.documentElement);
      const bodyStyle = getComputedStyle(document.body);
      
      // Check login button
      const loginBtn = document.querySelector('.btn-auth, button[type="submit"]');
      const btnStyle = loginBtn ? getComputedStyle(loginBtn) : null;
      
      // Check header
      const header = document.querySelector('.auth-header');
      const headerStyle = header ? getComputedStyle(header) : null;
      
      return {
        cssVariables: {
          primaryOrange: computedStyle.getPropertyValue('--sh-primary-orange').trim(),
          baseWhite: computedStyle.getPropertyValue('--sh-base-white').trim(),
          fontPrimary: computedStyle.getPropertyValue('--sh-font-primary').trim()
        },
        body: {
          background: bodyStyle.backgroundColor,
          fontFamily: bodyStyle.fontFamily
        },
        loginButton: btnStyle ? {
          background: btnStyle.backgroundColor,
          color: btnStyle.color,
          borderRadius: btnStyle.borderRadius
        } : null,
        header: headerStyle ? {
          background: headerStyle.backgroundColor,
          color: headerStyle.color
        } : null
      };
    });
    
    console.log('\n🎨 Design Analysis:');
    console.log('====================');
    console.log('CSS Variables:');
    console.log(`  Primary Orange: ${designCheck.cssVariables.primaryOrange || 'NOT SET'}`);
    console.log(`  Font Family: ${designCheck.cssVariables.fontPrimary || 'NOT SET'}`);
    console.log('\nLogin Button:');
    if (designCheck.loginButton) {
      console.log(`  Background: ${designCheck.loginButton.background}`);
      console.log(`  Color: ${designCheck.loginButton.color}`);
      console.log(`  Border Radius: ${designCheck.loginButton.borderRadius}`);
    }
    console.log('\nHeader:');
    if (designCheck.header) {
      console.log(`  Background: ${designCheck.header.background}`);
      console.log(`  Color: ${designCheck.header.color}`);
    }
    
    // Try to login
    console.log('\n🔐 Attempting login...');
    await page.fill('input[name="email"]', 'backoffice@storehub.com');
    await page.fill('input[name="password"]', 'BackOffice123!');
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log('📍 Current URL:', currentUrl);
    
    if (currentUrl.includes('/dashboard')) {
      console.log('✅ Successfully logged in!');
      
      // Take dashboard screenshot
      await page.screenshot({ 
        path: 'admin-backoffice-dashboard.png',
        fullPage: true 
      });
      console.log('📸 Dashboard screenshot saved: admin-backoffice-dashboard.png');
      
      // Check dashboard design
      const dashboardCheck = await page.evaluate(() => {
        return {
          sidebar: !!document.querySelector('.sidebar'),
          statsCards: document.querySelectorAll('.stats-card').length,
          topBar: !!document.querySelector('.top-bar'),
          contentArea: !!document.querySelector('.content-area')
        };
      });
      
      console.log('\n📊 Dashboard Elements:');
      console.log(`  Sidebar: ${dashboardCheck.sidebar ? '✅' : '❌'}`);
      console.log(`  Stats Cards: ${dashboardCheck.statsCards}`);
      console.log(`  Top Bar: ${dashboardCheck.topBar ? '✅' : '❌'}`);
      console.log(`  Content Area: ${dashboardCheck.contentArea ? '✅' : '❌'}`);
    }
    
    console.log('\n✨ Test complete! Browser left open for inspection.');
    console.log('📌 Press Ctrl+C to exit.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAdminBackoffice();