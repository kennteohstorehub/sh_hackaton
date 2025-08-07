const puppeteer = require('puppeteer');
const fs = require('fs');

async function testFullDashboardFlow() {
  console.log('🎨 Testing Full BackOffice Dashboard Flow...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: {
      width: 1440,
      height: 900
    }
  });
  
  try {
    const page = await browser.newPage();
    
    // Step 1: Go to login page
    console.log('📱 Step 1: Navigating to login page...');
    await page.goto('http://admin.lvh.me:3000/backoffice/auth/login');
    await new Promise(r => setTimeout(r, 1000));
    
    // Step 2: Login
    console.log('🔐 Step 2: Logging in...');
    await page.type('input[name="email"]', 'admin@storehub.com');
    await page.type('input[name="password"]', 'admin123');
    
    // Take pre-login screenshot
    await page.screenshot({ 
      path: 'screenshots/before-login.png',
      fullPage: true 
    });
    
    // Click login button
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    console.log('⏳ Waiting for navigation after login...');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    
    // Step 3: Check where we ended up
    const currentURL = page.url();
    console.log('📍 Current URL after login:', currentURL);
    
    // Step 4: Analyze the page structure
    console.log('\n🔍 Step 4: Analyzing page structure...');
    
    const pageAnalysis = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;
      return {
        url: window.location.href,
        title: document.title,
        
        // Check for layout elements
        hasAdminLayout: html.includes('admin-layout'),
        hasSidebar: html.includes('sidebar'),
        hasTopBar: html.includes('top-bar'),
        hasContentArea: html.includes('content-area'),
        
        // Count actual elements
        sidebarCount: document.querySelectorAll('.sidebar').length,
        topBarCount: document.querySelectorAll('.top-bar').length,
        statsCardCount: document.querySelectorAll('.stats-card').length,
        dashboardGridCount: document.querySelectorAll('.dashboard-grid').length,
        
        // Check for specific content
        hasDashboardContent: html.includes('Dashboard') || html.includes('dashboard'),
        hasSystemStats: html.includes('System Health') || html.includes('Tenants'),
        
        // Get body structure
        bodyFirstChild: document.body.firstElementChild ? {
          tag: document.body.firstElementChild.tagName,
          class: document.body.firstElementChild.className,
          id: document.body.firstElementChild.id
        } : null,
        
        // Check CSS files
        cssFiles: Array.from(document.styleSheets)
          .map(sheet => sheet.href)
          .filter(href => href && href.includes('storehub'))
          .map(href => href.split('/').pop()),
        
        // Get first 1000 chars of body HTML
        bodyHtmlSnippet: document.body.innerHTML.substring(0, 1000)
      };
    });
    
    console.log('\n📊 Page Analysis Results:');
    console.log('URL:', pageAnalysis.url);
    console.log('Title:', pageAnalysis.title);
    
    console.log('\nLayout Detection (in HTML):');
    console.log('- admin-layout:', pageAnalysis.hasAdminLayout);
    console.log('- sidebar:', pageAnalysis.hasSidebar);
    console.log('- top-bar:', pageAnalysis.hasTopBar);
    console.log('- content-area:', pageAnalysis.hasContentArea);
    
    console.log('\nActual Element Counts:');
    console.log('- Sidebar elements:', pageAnalysis.sidebarCount);
    console.log('- Top bar elements:', pageAnalysis.topBarCount);
    console.log('- Stats cards:', pageAnalysis.statsCardCount);
    console.log('- Dashboard grids:', pageAnalysis.dashboardGridCount);
    
    console.log('\nContent Detection:');
    console.log('- Has dashboard content:', pageAnalysis.hasDashboardContent);
    console.log('- Has system stats:', pageAnalysis.hasSystemStats);
    
    console.log('\nBody Structure:');
    if (pageAnalysis.bodyFirstChild) {
      console.log('- First child tag:', pageAnalysis.bodyFirstChild.tag);
      console.log('- First child class:', pageAnalysis.bodyFirstChild.class || '(none)');
      console.log('- First child id:', pageAnalysis.bodyFirstChild.id || '(none)');
    }
    
    console.log('\nCSS Files Loaded:');
    pageAnalysis.cssFiles.forEach(file => console.log('- ', file));
    
    // Save full HTML for inspection
    const fullHTML = await page.content();
    fs.writeFileSync('dashboard-full.html', fullHTML);
    console.log('\n📄 Full HTML saved to dashboard-full.html');
    
    // Save body snippet
    fs.writeFileSync('dashboard-body-snippet.html', pageAnalysis.bodyHtmlSnippet);
    console.log('📄 Body snippet saved to dashboard-body-snippet.html');
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'screenshots/dashboard-final.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved: dashboard-final.png');
    
    // Step 5: Try to force navigate to dashboard if not there
    if (!currentURL.includes('/dashboard')) {
      console.log('\n🔄 Step 5: Force navigating to dashboard...');
      await page.goto('http://admin.lvh.me:3000/backoffice/dashboard');
      await new Promise(r => setTimeout(r, 2000));
      
      const newURL = page.url();
      console.log('New URL:', newURL);
      
      if (newURL.includes('/dashboard')) {
        await page.screenshot({ 
          path: 'screenshots/dashboard-forced.png',
          fullPage: true 
        });
        console.log('📸 Forced navigation screenshot saved');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n✅ Test complete. Browser will close in 5 seconds...');
    await new Promise(r => setTimeout(r, 5000));
    await browser.close();
  }
}

testFullDashboardFlow();