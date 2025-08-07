const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function testBackofficeDesign() {
  console.log('🚀 Starting backoffice design test with Playwright...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Slow down actions to avoid rate limiting
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();
    
    // Navigate to login page
    console.log('📍 Navigating to login page...');
    await page.goto('http://localhost:3000/backoffice/login', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Take screenshot of login page
    await page.screenshot({ 
      path: 'backoffice-login-screenshot.png',
      fullPage: true 
    });
    console.log('📸 Login page screenshot saved');
    
    // Wait to avoid rate limiting
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
      const bodyStyle = getComputedStyle(document.body);
      return {
        primaryOrange: computedStyle.getPropertyValue('--sh-primary-orange').trim(),
        baseWhite: computedStyle.getPropertyValue('--sh-base-white').trim(),
        fontPrimary: computedStyle.getPropertyValue('--sh-font-primary').trim(),
        bodyBackground: bodyStyle.backgroundColor,
        bodyFont: bodyStyle.fontFamily,
        hasCSSVariables: !!computedStyle.getPropertyValue('--sh-primary-orange')
      };
    });
    
    console.log('🎨 Design System Variables:', JSON.stringify(designSystemCheck, null, 2));
    
    // Check login form styling
    const loginFormCheck = await page.evaluate(() => {
      const form = document.querySelector('form');
      const button = document.querySelector('button[type="submit"]');
      const inputs = document.querySelectorAll('input');
      
      return {
        formExists: !!form,
        buttonStyle: button ? {
          background: getComputedStyle(button).backgroundColor,
          color: getComputedStyle(button).color,
          borderRadius: getComputedStyle(button).borderRadius,
          padding: getComputedStyle(button).padding
        } : null,
        inputCount: inputs.length
      };
    });
    
    console.log('📝 Login Form Check:', JSON.stringify(loginFormCheck, null, 2));
    
    // Try to login
    console.log('🔐 Attempting login...');
    
    // Fill credentials slowly
    await page.fill('input[name="email"]', 'backoffice@storehub.com');
    await page.waitForTimeout(1000);
    await page.fill('input[name="password"]', 'BackOffice123!');
    await page.waitForTimeout(1000);
    
    // Click login button
    await page.click('button[type="submit"]');
    
    // Wait for navigation
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
      
      // Check for new design elements
      const dashboardCheck = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        const statsCards = document.querySelectorAll('.stats-card');
        const contentArea = document.querySelector('.content-area');
        const topBar = document.querySelector('.top-bar');
        
        const results = {
          sidebar: null,
          statsCards: null,
          contentArea: null,
          topBar: null
        };
        
        if (sidebar) {
          const sidebarStyle = getComputedStyle(sidebar);
          results.sidebar = {
            exists: true,
            background: sidebarStyle.backgroundColor,
            width: sidebarStyle.width,
            borderRight: sidebarStyle.borderRight,
            boxShadow: sidebarStyle.boxShadow
          };
        }
        
        if (statsCards.length > 0) {
          const cardStyle = getComputedStyle(statsCards[0]);
          results.statsCards = {
            count: statsCards.length,
            firstCard: {
              background: cardStyle.backgroundColor,
              borderRadius: cardStyle.borderRadius,
              boxShadow: cardStyle.boxShadow,
              padding: cardStyle.padding
            }
          };
        }
        
        if (contentArea) {
          const contentStyle = getComputedStyle(contentArea);
          results.contentArea = {
            exists: true,
            padding: contentStyle.padding,
            maxWidth: contentStyle.maxWidth
          };
        }
        
        if (topBar) {
          const topBarStyle = getComputedStyle(topBar);
          results.topBar = {
            exists: true,
            height: topBarStyle.height,
            background: topBarStyle.backgroundColor,
            borderBottom: topBarStyle.borderBottom
          };
        }
        
        return results;
      });
      
      console.log('📊 Dashboard Design Check:', JSON.stringify(dashboardCheck, null, 2));
      
      // Check primary button styling
      const buttonCheck = await page.evaluate(() => {
        const primaryBtn = document.querySelector('.btn-primary');
        if (!primaryBtn) return { exists: false };
        
        const computedStyle = getComputedStyle(primaryBtn);
        return {
          exists: true,
          background: computedStyle.backgroundColor,
          color: computedStyle.color,
          borderRadius: computedStyle.borderRadius,
          height: computedStyle.height,
          minWidth: computedStyle.minWidth,
          boxShadow: computedStyle.boxShadow
        };
      });
      
      console.log('🔘 Primary Button Check:', JSON.stringify(buttonCheck, null, 2));
    } else if (currentUrl.includes('login')) {
      console.log('⚠️ Still on login page - checking for error messages');
      
      const errorCheck = await page.evaluate(() => {
        const alerts = document.querySelectorAll('.alert, .error');
        return Array.from(alerts).map(alert => ({
          text: alert.textContent.trim(),
          className: alert.className
        }));
      });
      
      if (errorCheck.length > 0) {
        console.log('❌ Error messages found:', errorCheck);
      }
    }
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 DESIGN VERIFICATION SUMMARY:');
    console.log('='.repeat(60));
    console.log(`✅ New CSS file loaded: ${cssLoaded ? 'YES' : 'NO'}`);
    console.log(`✅ CSS Variables present: ${designSystemCheck.hasCSSVariables ? 'YES' : 'NO'}`);
    console.log(`✅ Primary Orange: ${designSystemCheck.primaryOrange || 'NOT FOUND'}`);
    console.log(`✅ Font Family: ${designSystemCheck.fontPrimary || 'NOT FOUND'}`);
    console.log(`✅ Login successful: ${currentUrl.includes('/dashboard') ? 'YES' : 'NO'}`);
    console.log('='.repeat(60));
    
    if (cssLoaded && designSystemCheck.hasCSSVariables) {
      console.log('✨ The new StoreHub Design System appears to be active!');
    } else {
      console.log('⚠️ The design system may not be fully loaded. Please check:');
      console.log('  1. Clear browser cache');
      console.log('  2. Ensure CSS file path is correct');
      console.log('  3. Check for any CSS conflicts');
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error.message);
  } finally {
    // Keep browser open for inspection
    console.log('\n👀 Browser left open for manual inspection. Press Ctrl+C to exit.');
  }
}

testBackofficeDesign().catch(console.error);