const puppeteer = require('puppeteer');

async function testDashboardLayout() {
  console.log('Testing BackOffice Dashboard Layout...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: {
      width: 1440,
      height: 900
    }
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to dashboard (will redirect to login)
    console.log('Navigating to dashboard...');
    await page.goto('http://admin.lvh.me:3000/backoffice/dashboard');
    
    // Check if redirected to login
    const currentURL = page.url();
    console.log('Current URL:', currentURL);
    
    if (currentURL.includes('/auth/login')) {
      console.log('Redirected to login - logging in...');
      
      // Login
      await page.type('input[name="email"]', 'admin@storehub.com');
      await page.type('input[name="password"]', 'admin123');
      await page.click('button[type="submit"]');
      
      // Wait for navigation
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
    }
    
    // Check dashboard HTML structure
    console.log('\nChecking dashboard structure...');
    
    const layoutElements = await page.evaluate(() => {
      return {
        hasAdminLayout: !!document.querySelector('.admin-layout'),
        hasSidebar: !!document.querySelector('.sidebar'),
        hasTopBar: !!document.querySelector('.top-bar'),
        hasContentArea: !!document.querySelector('.content-area'),
        hasStatsCards: document.querySelectorAll('.stats-card').length,
        hasDashboardGrid: !!document.querySelector('.dashboard-grid'),
        hasSearchInput: !!document.querySelector('.search-input'),
        hasNotificationBadge: !!document.querySelector('.notification-badge'),
        
        // Check CSS files loaded
        cssFiles: Array.from(document.styleSheets).map(sheet => sheet.href).filter(href => href),
        
        // Get body HTML snippet
        bodyClasses: document.body.className,
        firstChildTag: document.body.firstElementChild ? document.body.firstElementChild.tagName : null,
        firstChildClass: document.body.firstElementChild ? document.body.firstElementChild.className : null
      };
    });
    
    console.log('\nLayout Elements Found:');
    console.log('- Admin Layout:', layoutElements.hasAdminLayout);
    console.log('- Sidebar:', layoutElements.hasSidebar);
    console.log('- Top Bar:', layoutElements.hasTopBar);
    console.log('- Content Area:', layoutElements.hasContentArea);
    console.log('- Stats Cards:', layoutElements.hasStatsCards);
    console.log('- Dashboard Grid:', layoutElements.hasDashboardGrid);
    console.log('- Search Input:', layoutElements.hasSearchInput);
    console.log('- Notification Badge:', layoutElements.hasNotificationBadge);
    
    console.log('\nCSS Files Loaded:');
    layoutElements.cssFiles.forEach(file => {
      if (file.includes('storehub')) {
        console.log('✓', file.split('/').pop());
      }
    });
    
    console.log('\nBody Structure:');
    console.log('- Body Classes:', layoutElements.bodyClasses || '(none)');
    console.log('- First Child Tag:', layoutElements.firstChildTag);
    console.log('- First Child Class:', layoutElements.firstChildClass);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/dashboard-layout-check.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved: dashboard-layout-check.png');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testDashboardLayout();