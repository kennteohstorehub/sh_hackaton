const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Test configuration
const BASE_URL = 'http://localhost:3838';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

test.describe('Auth Redirect Loop Analysis', () => {
  test('captures the redirect loop between /auth/login and /dashboard', async ({ page }) => {
    console.log('\n=== REDIRECT LOOP TEST ===');
    console.log('ENV: USE_AUTH_BYPASS =', process.env.USE_AUTH_BYPASS);
    console.log('ENV: NODE_ENV =', process.env.NODE_ENV);
    
    // Clear cookies
    await page.context().clearCookies();
    
    // Enable detailed logging
    const redirects = [];
    page.on('response', response => {
      if (response.status() >= 300 && response.status() < 400) {
        const location = response.headers()['location'];
        redirects.push({
          from: response.url(),
          to: location,
          status: response.status()
        });
        console.log(`REDIRECT: ${response.url()} -> ${location}`);
      }
    });
    
    // Try to access /dashboard without authentication
    console.log('\n1. Accessing /dashboard without auth...');
    const response1 = await page.goto(`${BASE_URL}/dashboard`, { 
      waitUntil: 'commit'
    });
    
    console.log(`   Response: ${response1.status()}`);
    console.log(`   Final URL: ${page.url()}`);
    
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '1-dashboard-without-auth.png'),
      fullPage: true
    });
    
    // The issue: /auth/login redirects to /dashboard immediately
    if (page.url().includes('/auth/login')) {
      console.log('\n2. Now at login page, let\'s see what happens...');
      
      // Clear redirects
      redirects.length = 0;
      
      // Navigate to login directly
      const response2 = await page.goto(`${BASE_URL}/auth/login`, {
        waitUntil: 'commit'
      });
      
      console.log(`   Response: ${response2.status()}`);
      console.log(`   Final URL: ${page.url()}`);
      
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '2-login-page-redirect.png'),
        fullPage: true
      });
    }
    
    // Log all redirects
    console.log('\n=== REDIRECT CHAIN ===');
    redirects.forEach((redirect, index) => {
      console.log(`${index + 1}. ${redirect.from} -> ${redirect.to}`);
    });
    
    // Save redirect data
    fs.writeFileSync(
      path.join(SCREENSHOTS_DIR, 'redirect-chain.json'),
      JSON.stringify(redirects, null, 2)
    );
    
    // The problem is clear: In non-production, auth-redirect.js is used
    // which makes /auth/login redirect to /dashboard
    // But /dashboard requires auth, so it redirects back to /auth/login
    console.log('\n=== ANALYSIS ===');
    console.log('The redirect loop is caused by:');
    console.log('1. NODE_ENV is not "production", so auth-redirect.js is used');
    console.log('2. auth-redirect.js makes /auth/login redirect to /dashboard');
    console.log('3. But USE_AUTH_BYPASS=false, so real auth is required');
    console.log('4. /dashboard requires auth and redirects to /auth/login');
    console.log('5. This creates an infinite loop');
  });
  
  test('shows the problematic route configuration', async ({ page }) => {
    console.log('\n=== ROUTE CONFIGURATION ISSUE ===');
    
    // Check the actual route behavior
    const routes = [
      '/auth/login',
      '/dashboard',
      '/'
    ];
    
    for (const route of routes) {
      console.log(`\nTesting ${route}:`);
      
      await page.context().clearCookies();
      const response = await page.goto(`${BASE_URL}${route}`, {
        waitUntil: 'commit'
      });
      
      console.log(`  Status: ${response.status()}`);
      console.log(`  Final URL: ${page.url()}`);
      
      // Check if it's the auth-redirect behavior
      if (route === '/auth/login' && page.url().includes('/dashboard')) {
        console.log(`  ⚠️  AUTH-REDIRECT ACTIVE: Login redirects to dashboard!`);
      }
    }
  });
  
  test('demonstrates the fix needed', async ({ page }) => {
    console.log('\n=== FIX NEEDED ===');
    console.log('The issue is in server/index.js lines 289-293:');
    console.log('');
    console.log('if (process.env.NODE_ENV !== "production") {');
    console.log('  app.use("/auth", require("./routes/frontend/auth-redirect"));');
    console.log('} else {');
    console.log('  app.use("/auth", require("./routes/frontend/auth"));');
    console.log('}');
    console.log('');
    console.log('This should check USE_AUTH_BYPASS instead:');
    console.log('');
    console.log('if (process.env.USE_AUTH_BYPASS === "true") {');
    console.log('  app.use("/auth", require("./routes/frontend/auth-redirect"));');
    console.log('} else {');
    console.log('  app.use("/auth", require("./routes/frontend/auth"));');
    console.log('}');
  });
});