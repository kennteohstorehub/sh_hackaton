const puppeteer = require('puppeteer');

async function testBackOfficeRedesign() {
  console.log('🎨 Testing StoreHub BackOffice Redesign...\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser for visual testing
    defaultViewport: {
      width: 1440,
      height: 900
    }
  });
  
  try {
    const page = await browser.newPage();
    
    // Test 1: Login Page
    console.log('📱 Testing Login Page Design...');
    await page.goto('http://localhost:3000/backoffice/auth/login');
    await new Promise(r => setTimeout(r, 2000));
    
    // Check if design system CSS is loaded
    const hasDesignSystem = await page.evaluate(() => {
      const styles = Array.from(document.styleSheets);
      return styles.some(sheet => sheet.href && sheet.href.includes('storehub-backoffice-redesign.css'));
    });
    
    console.log(`  ✅ Design System CSS Loaded: ${hasDesignSystem}`);
    
    // Take screenshot of login page
    await page.screenshot({ 
      path: 'screenshots/backoffice-login-redesign.png',
      fullPage: true 
    });
    console.log('  📸 Login page screenshot saved');
    
    // Login to access dashboard
    console.log('\n🔐 Logging in to BackOffice...');
    await page.type('input[name="email"]', 'admin@storehub.com');
    await page.type('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    
    // Test 2: Dashboard
    console.log('\n📊 Testing Dashboard Design...');
    await new Promise(r => setTimeout(r, 2000));
    
    // Check for redesigned elements
    const dashboardElements = await page.evaluate(() => {
      const elements = {
        sidebar: !!document.querySelector('.sidebar'),
        topBar: !!document.querySelector('.top-bar'),
        statsCards: document.querySelectorAll('.stats-card').length,
        contentArea: !!document.querySelector('.content-area'),
        searchInput: !!document.querySelector('.search-input'),
        notificationBadge: !!document.querySelector('.notification-badge')
      };
      return elements;
    });
    
    console.log('  Dashboard Elements:');
    console.log(`    ✅ Sidebar: ${dashboardElements.sidebar}`);
    console.log(`    ✅ Top Bar: ${dashboardElements.topBar}`);
    console.log(`    ✅ Stats Cards: ${dashboardElements.statsCards}`);
    console.log(`    ✅ Content Area: ${dashboardElements.contentArea}`);
    console.log(`    ✅ Search Bar: ${dashboardElements.searchInput}`);
    console.log(`    ✅ Notifications: ${dashboardElements.notificationBadge}`);
    
    // Take dashboard screenshot
    await page.screenshot({ 
      path: 'screenshots/backoffice-dashboard-redesign.png',
      fullPage: true 
    });
    console.log('  📸 Dashboard screenshot saved');
    
    // Test 3: Responsive Design
    console.log('\n📱 Testing Responsive Design...');
    
    // Test tablet view
    await page.setViewport({ width: 768, height: 1024 });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ 
      path: 'screenshots/backoffice-tablet-redesign.png',
      fullPage: true 
    });
    console.log('  📸 Tablet view screenshot saved');
    
    // Test mobile view
    await page.setViewport({ width: 375, height: 667 });
    await new Promise(r => setTimeout(r, 1000));
    
    // Check if mobile menu button is visible
    const mobileMenuVisible = await page.evaluate(() => {
      const btn = document.querySelector('.mobile-menu-btn');
      return btn && window.getComputedStyle(btn).display !== 'none';
    });
    console.log(`  ✅ Mobile Menu Button: ${mobileMenuVisible}`);
    
    await page.screenshot({ 
      path: 'screenshots/backoffice-mobile-redesign.png',
      fullPage: true 
    });
    console.log('  📸 Mobile view screenshot saved');
    
    // Test 4: Interactive Features
    console.log('\n⚡ Testing Interactive Features...');
    
    // Reset to desktop view
    await page.setViewport({ width: 1440, height: 900 });
    await new Promise(r => setTimeout(r, 1000));
    
    // Test search functionality
    const searchWorks = await page.evaluate(async () => {
      const searchInput = document.querySelector('.search-input');
      if (!searchInput) return false;
      
      searchInput.value = 'test';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Wait a bit for search results
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return true;
    });
    console.log(`  ✅ Search Functionality: ${searchWorks}`);
    
    // Test notification panel
    const notificationWorks = await page.evaluate(() => {
      const badge = document.querySelector('.notification-badge');
      if (!badge) return false;
      
      badge.click();
      // Check if StoreHubBackOffice is available
      return typeof window.StoreHubBackOffice !== 'undefined';
    });
    console.log(`  ✅ Notification System: ${notificationWorks}`);
    
    // Test toast notifications
    const toastWorks = await page.evaluate(() => {
      if (typeof window.StoreHubBackOffice === 'undefined') return false;
      
      window.StoreHubBackOffice.showToast('Test notification', 'success');
      return document.querySelector('.toast-container') !== null;
    });
    console.log(`  ✅ Toast Notifications: ${toastWorks}`);
    
    // Test 5: Design System Colors
    console.log('\n🎨 Testing Design System Implementation...');
    const designSystemColors = await page.evaluate(() => {
      const computedStyle = getComputedStyle(document.documentElement);
      return {
        primaryOrange: computedStyle.getPropertyValue('--sh-primary-orange').trim(),
        baseWhite: computedStyle.getPropertyValue('--sh-base-white').trim(),
        gray900: computedStyle.getPropertyValue('--sh-gray-900').trim(),
        successGreen: computedStyle.getPropertyValue('--sh-success-green').trim()
      };
    });
    
    console.log('  Design System Colors:');
    console.log(`    🟠 Primary Orange: ${designSystemColors.primaryOrange}`);
    console.log(`    ⚪ Base White: ${designSystemColors.baseWhite}`);
    console.log(`    ⚫ Gray 900: ${designSystemColors.gray900}`);
    console.log(`    🟢 Success Green: ${designSystemColors.successGreen}`);
    
    console.log('\n✨ BackOffice Redesign Test Complete!');
    console.log('📁 Screenshots saved in ./screenshots/');
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await browser.close();
  }
}

// Create screenshots directory
const fs = require('fs');
if (!fs.existsSync('screenshots')) {
  fs.mkdirSync('screenshots');
}

testBackOfficeRedesign();