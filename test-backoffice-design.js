const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testBackofficeDesign() {
  console.log('🚀 Starting backoffice design test...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1440, height: 900 });
    
    // Navigate to login page
    console.log('📍 Navigating to login page...');
    await page.goto('http://localhost:3000/backoffice/login', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Take screenshot of login page
    await page.screenshot({ 
      path: 'backoffice-login-screenshot.png',
      fullPage: true 
    });
    console.log('📸 Login page screenshot saved');
    
    // Wait a bit to avoid rate limiting
    await page.waitForTimeout(2000);
    
    // Check if new CSS is loaded
    const cssLoaded = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.some(link => link.href.includes('storehub-backoffice-redesign.css'));
    });
    
    console.log(`✅ New CSS file loaded: ${cssLoaded}`);
    
    // Check design system variables
    const designSystemCheck = await page.evaluate(() => {
      const computedStyle = getComputedStyle(document.documentElement);
      return {
        primaryOrange: computedStyle.getPropertyValue('--sh-primary-orange'),
        baseWhite: computedStyle.getPropertyValue('--sh-base-white'),
        fontPrimary: computedStyle.getPropertyValue('--sh-font-primary'),
        hasCSSVariables: !!computedStyle.getPropertyValue('--sh-primary-orange')
      };
    });
    
    console.log('🎨 Design System Variables:', designSystemCheck);
    
    // Try to login
    console.log('🔐 Attempting login...');
    
    // Type credentials slowly to avoid rate limiting
    await page.type('input[name="email"]', 'backoffice@storehub.com', { delay: 100 });
    await page.waitForTimeout(1000);
    await page.type('input[name="password"]', 'BackOffice123!', { delay: 100 });
    await page.waitForTimeout(1000);
    
    // Click login button
    await page.click('button[type="submit"]');
    
    // Wait for navigation or error
    await page.waitForTimeout(5000);
    
    // Get current URL
    const currentUrl = page.url();
    console.log('📍 Current URL:', currentUrl);
    
    // Take screenshot of current page
    await page.screenshot({ 
      path: 'backoffice-after-login-screenshot.png',
      fullPage: true 
    });
    console.log('📸 After login screenshot saved');
    
    // If we're on the dashboard, check the design
    if (currentUrl.includes('/dashboard')) {
      console.log('✅ Successfully logged in to dashboard');
      
      // Check for sidebar
      const sidebarCheck = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return { exists: false };
        
        const computedStyle = getComputedStyle(sidebar);
        return {
          exists: true,
          background: computedStyle.backgroundColor,
          width: computedStyle.width,
          borderRight: computedStyle.borderRight
        };
      });
      
      console.log('📊 Sidebar Check:', sidebarCheck);
      
      // Check for stats cards
      const statsCardsCheck = await page.evaluate(() => {
        const statsCards = document.querySelectorAll('.stats-card');
        return {
          count: statsCards.length,
          firstCardStyle: statsCards.length > 0 ? {
            background: getComputedStyle(statsCards[0]).backgroundColor,
            borderRadius: getComputedStyle(statsCards[0]).borderRadius,
            boxShadow: getComputedStyle(statsCards[0]).boxShadow
          } : null
        };
      });
      
      console.log('📈 Stats Cards Check:', statsCardsCheck);
      
      // Check buttons
      const buttonCheck = await page.evaluate(() => {
        const primaryBtn = document.querySelector('.btn-primary');
        if (!primaryBtn) return { exists: false };
        
        const computedStyle = getComputedStyle(primaryBtn);
        return {
          exists: true,
          background: computedStyle.backgroundColor,
          color: computedStyle.color,
          borderRadius: computedStyle.borderRadius,
          height: computedStyle.height
        };
      });
      
      console.log('🔘 Button Check:', buttonCheck);
    } else {
      console.log('⚠️ Not on dashboard, current URL:', currentUrl);
    }
    
    console.log('\n📋 SUMMARY:');
    console.log('- New CSS file loaded:', cssLoaded);
    console.log('- Design system variables present:', designSystemCheck.hasCSSVariables);
    console.log('- Primary orange color:', designSystemCheck.primaryOrange || 'NOT SET');
    console.log('- Current page:', currentUrl);
    
  } catch (error) {
    console.error('❌ Error during test:', error.message);
  } finally {
    // Keep browser open for manual inspection
    console.log('\n👀 Browser left open for manual inspection. Press Ctrl+C to exit.');
    // await browser.close();
  }
}

testBackofficeDesign().catch(console.error);