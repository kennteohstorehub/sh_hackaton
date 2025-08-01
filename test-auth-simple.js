const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3838';
const screenshotsDir = path.join(__dirname, 'auth-test-screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function takeScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(screenshotsDir, `${name}-${timestamp}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`Screenshot saved: ${filename}`);
}

async function testAuthSystem() {
  console.log('=== Starting Simple Authentication Test ===\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 // Slow down for visibility
  });
  
  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    
    // Monitor console and errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[CONSOLE ERROR]: ${msg.text()}`);
      }
    });
    
    page.on('pageerror', err => {
      console.error(`[PAGE ERROR]: ${err.message}`);
    });
    
    console.log('\n1. Testing login page access (clean state)...');
    await context.clearCookies();
    
    try {
      const response = await page.goto(`${BASE_URL}/auth/login`, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      console.log(`Status: ${response.status()}`);
      console.log(`URL: ${page.url()}`);
      await takeScreenshot(page, '1-login-page');
      
      // Check page content
      const pageContent = await page.content();
      const hasLoginForm = pageContent.includes('email') && pageContent.includes('password');
      console.log(`Has login form: ${hasLoginForm}`);
      
    } catch (error) {
      console.error('Error accessing login page:', error.message);
      await takeScreenshot(page, '1-login-error');
    }
    
    console.log('\n2. Testing dashboard access without auth...');
    await context.clearCookies();
    
    try {
      const response = await page.goto(`${BASE_URL}/dashboard`, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      console.log(`Status: ${response.status()}`);
      console.log(`URL: ${page.url()}`);
      await takeScreenshot(page, '2-dashboard-noauth');
      
    } catch (error) {
      console.error('Error accessing dashboard:', error.message);
      await takeScreenshot(page, '2-dashboard-error');
    }
    
    console.log('\n3. Testing login flow...');
    await context.clearCookies();
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' });
    
    try {
      // Try to fill login form
      const emailInput = await page.locator('input[name="email"], input[type="email"]').first();
      const passwordInput = await page.locator('input[name="password"], input[type="password"]').first();
      
      if (await emailInput.isVisible() && await passwordInput.isVisible()) {
        await emailInput.fill('test@example.com');
        await passwordInput.fill('password123');
        await takeScreenshot(page, '3-login-filled');
        
        // Submit form
        await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
        await page.waitForLoadState('domcontentloaded');
        
        console.log(`After login URL: ${page.url()}`);
        await takeScreenshot(page, '3-after-login');
        
        // Check cookies
        const cookies = await context.cookies();
        console.log('Cookies:', cookies.map(c => c.name));
      } else {
        console.log('Login form not found!');
        await takeScreenshot(page, '3-no-login-form');
      }
    } catch (error) {
      console.error('Error during login:', error.message);
      await takeScreenshot(page, '3-login-process-error');
    }
    
    console.log('\n4. Testing logout...');
    // Check current page for logout link
    const logoutLink = await page.locator('a[href="/auth/logout"], button:has-text("Logout")').first();
    if (await logoutLink.isVisible()) {
      await logoutLink.click();
      await page.waitForLoadState('domcontentloaded');
      console.log(`After logout URL: ${page.url()}`);
      await takeScreenshot(page, '4-after-logout');
    } else {
      console.log('No logout link found');
      await takeScreenshot(page, '4-no-logout');
    }
    
    console.log('\n5. Checking for redirect loops...');
    // Monitor network requests
    const redirects = [];
    page.on('response', response => {
      if (response.status() >= 300 && response.status() < 400) {
        redirects.push({
          from: response.url(),
          to: response.headers()['location'],
          status: response.status()
        });
      }
    });
    
    try {
      await page.goto(`${BASE_URL}/auth/login`, { 
        waitUntil: 'domcontentloaded',
        timeout: 5000 
      });
    } catch (error) {
      console.log('Redirect loop detected!');
      console.log('Redirects:', redirects);
    }
    
  } finally {
    await browser.close();
    console.log(`\nTest complete. Screenshots saved in: ${screenshotsDir}`);
  }
}

// Run the test
testAuthSystem().catch(console.error);