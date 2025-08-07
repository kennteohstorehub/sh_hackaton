const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

test.describe('Auth System Comprehensive E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear all cookies and local storage before each test
    await page.goto(BASE_URL);
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test.describe('Redirect Loop Investigation', () => {
    test('captures the infinite redirect loop between /auth/login and /dashboard', async ({ page }) => {
      console.log('Starting redirect loop test...');
      
      // Enable network request logging
      const networkLogs = [];
      page.on('response', response => {
        if (response.status() >= 300 && response.status() < 400) {
          networkLogs.push({
            url: response.url(),
            status: response.status(),
            location: response.headers()['location'],
            timestamp: new Date().toISOString()
          });
        }
      });

      // Start recording console logs
      const consoleLogs = [];
      page.on('console', msg => {
        consoleLogs.push({
          type: msg.type(),
          text: msg.text(),
          timestamp: new Date().toISOString()
        });
      });

      try {
        // Attempt to navigate to /dashboard (protected route)
        console.log('Navigating to /dashboard...');
        await page.goto(`${BASE_URL}/dashboard`, { 
          waitUntil: 'networkidle',
          timeout: 10000 // 10 second timeout
        });
      } catch (error) {
        console.log('Navigation failed (expected due to redirect loop):', error.message);
        
        // Take screenshot of the current state
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, 'redirect-loop-timeout.png'),
          fullPage: true
        });
      }

      // Log all redirects
      console.log('\n=== REDIRECT CHAIN ===');
      networkLogs.forEach((log, index) => {
        console.log(`${index + 1}. ${log.url} -> ${log.location} (${log.status})`);
      });

      // Check if we detected a redirect loop
      const redirectUrls = networkLogs.map(log => log.url);
      const hasLoop = redirectUrls.some((url, index) => 
        redirectUrls.indexOf(url) !== index
      );

      expect(hasLoop).toBe(true);
      expect(networkLogs.length).toBeGreaterThan(5); // Should have multiple redirects
      
      // Save network logs to file
      fs.writeFileSync(
        path.join(SCREENSHOTS_DIR, 'redirect-loop-network.json'),
        JSON.stringify(networkLogs, null, 2)
      );
    });

    test('demonstrates redirect behavior for each route', async ({ page }) => {
      const routes = [
        { path: '/', expectedRedirect: false, description: 'Home page' },
        { path: '/auth/login', expectedRedirect: true, description: 'Login page' },
        { path: '/auth/register', expectedRedirect: true, description: 'Register page' },
        { path: '/dashboard', expectedRedirect: true, description: 'Dashboard (protected)' },
        { path: '/dashboard/settings', expectedRedirect: true, description: 'Settings (protected)' }
      ];

      for (const route of routes) {
        console.log(`\nTesting ${route.description}: ${route.path}`);
        
        const response = await page.goto(`${BASE_URL}${route.path}`, {
          waitUntil: 'commit'
        });
        
        const finalUrl = page.url();
        const statusCode = response.status();
        
        console.log(`  Initial response: ${statusCode}`);
        console.log(`  Final URL: ${finalUrl}`);
        
        // Take screenshot
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `route-${route.path.replace(/\//g, '-')}.png`)
        });
        
        // For auth routes in non-production, they should redirect to dashboard
        if (route.path.startsWith('/auth/') && route.path !== '/auth/logout') {
          expect(finalUrl).toContain('/dashboard');
        }
      }
    });
  });

  test.describe('Session and Cookie Analysis', () => {
    test('examines session cookie behavior during redirects', async ({ page }) => {
      console.log('\n=== SESSION COOKIE ANALYSIS ===');
      
      // Monitor cookies
      const cookieChanges = [];
      
      // Navigate to home page first
      await page.goto(BASE_URL);
      let cookies = await page.context().cookies();
      console.log('Initial cookies:', cookies);
      cookieChanges.push({ stage: 'initial', cookies: [...cookies] });
      
      // Try to access dashboard
      try {
        await page.goto(`${BASE_URL}/dashboard`, { 
          waitUntil: 'commit',
          timeout: 5000 
        });
      } catch (e) {
        console.log('Dashboard navigation failed (expected)');
      }
      
      cookies = await page.context().cookies();
      console.log('\nCookies after dashboard attempt:', cookies);
      cookieChanges.push({ stage: 'after_dashboard', cookies: [...cookies] });
      
      // Try to access login
      try {
        await page.goto(`${BASE_URL}/auth/login`, { 
          waitUntil: 'commit',
          timeout: 5000 
        });
      } catch (e) {
        console.log('Login navigation failed');
      }
      
      cookies = await page.context().cookies();
      console.log('\nCookies after login attempt:', cookies);
      cookieChanges.push({ stage: 'after_login', cookies: [...cookies] });
      
      // Analyze session cookie changes
      const sessionCookies = cookieChanges.map(change => ({
        stage: change.stage,
        sessionId: change.cookies.find(c => c.name === 'connect.sid')?.value
      }));
      
      console.log('\n=== SESSION ID CHANGES ===');
      sessionCookies.forEach(sc => {
        console.log(`${sc.stage}: ${sc.sessionId || 'NO SESSION'}`);
      });
      
      // Save analysis
      fs.writeFileSync(
        path.join(SCREENSHOTS_DIR, 'session-cookie-analysis.json'),
        JSON.stringify(cookieChanges, null, 2)
      );
    });

    test('checks CSRF token handling', async ({ page }) => {
      console.log('\n=== CSRF TOKEN ANALYSIS ===');
      
      // Try to load login page
      try {
        await page.goto(`${BASE_URL}/auth/login`, { 
          waitUntil: 'networkidle',
          timeout: 5000 
        });
      } catch (e) {
        console.log('Login page load failed');
      }
      
      // Check for CSRF token in page
      const csrfToken = await page.evaluate(() => {
        // Check various possible CSRF token locations
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        const inputField = document.querySelector('input[name="_csrf"]');
        const formData = document.querySelector('form')?.dataset.csrf;
        
        return {
          metaTag: metaTag?.content,
          inputField: inputField?.value,
          formData: formData,
          cookies: document.cookie
        };
      });
      
      console.log('CSRF Token locations:', csrfToken);
      
      // Check CSRF in cookies
      const cookies = await page.context().cookies();
      const csrfCookie = cookies.find(c => c.name.includes('csrf'));
      console.log('CSRF Cookie:', csrfCookie);
      
      // Take screenshot showing form
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'csrf-token-check.png')
      });
    });
  });

  test.describe('Authentication Flow Testing', () => {
    test('attempts login with test credentials', async ({ page }) => {
      console.log('\n=== LOGIN ATTEMPT TEST ===');
      
      // Since we're in non-production with auth-redirect, login will redirect to dashboard
      // Let's test the actual auth endpoint behavior
      
      // First, let's check what happens when we POST to /auth/login
      const loginResponse = await page.request.post(`${BASE_URL}/auth/login`, {
        data: {
          email: 'demo@storehub.com',
          password: 'password123'
        }
      });
      
      console.log('Login POST response:', {
        status: loginResponse.status(),
        url: loginResponse.url(),
        headers: loginResponse.headers()
      });
      
      // Check if session was created
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(c => c.name === 'connect.sid');
      console.log('Session cookie after login:', sessionCookie);
      
      // Try to access dashboard with potential session
      const dashboardResponse = await page.goto(`${BASE_URL}/dashboard`);
      console.log('Dashboard access after login:', {
        status: dashboardResponse.status(),
        url: page.url()
      });
      
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'after-login-attempt.png')
      });
    });

    test('tests logout functionality', async ({ page }) => {
      console.log('\n=== LOGOUT TEST ===');
      
      // First navigate to get a session
      await page.goto(BASE_URL);
      
      // Get initial cookies
      let cookies = await page.context().cookies();
      const initialSession = cookies.find(c => c.name === 'connect.sid');
      console.log('Initial session:', initialSession?.value);
      
      // Perform logout
      await page.goto(`${BASE_URL}/auth/logout`);
      
      // Check cookies after logout
      cookies = await page.context().cookies();
      const afterLogoutSession = cookies.find(c => c.name === 'connect.sid');
      console.log('Session after logout:', afterLogoutSession?.value);
      
      // Verify we're redirected to home
      expect(page.url()).toBe(`${BASE_URL}/`);
      
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'after-logout.png')
      });
    });
  });

  test.describe('Edge Cases and Race Conditions', () => {
    test('tests multiple concurrent requests', async ({ browser }) => {
      console.log('\n=== CONCURRENT REQUESTS TEST ===');
      
      // Create multiple browser contexts
      const contexts = await Promise.all([
        browser.newContext(),
        browser.newContext(),
        browser.newContext()
      ]);
      
      const pages = await Promise.all(
        contexts.map(ctx => ctx.newPage())
      );
      
      // Navigate all pages to dashboard simultaneously
      const results = await Promise.allSettled(
        pages.map((page, index) => 
          page.goto(`${BASE_URL}/dashboard`, { 
            timeout: 5000,
            waitUntil: 'commit' 
          }).then(() => ({
            index,
            url: page.url(),
            success: true
          })).catch(error => ({
            index,
            error: error.message,
            success: false
          }))
        )
      );
      
      console.log('Concurrent request results:');
      results.forEach((result, index) => {
        console.log(`  Page ${index + 1}:`, result.value);
      });
      
      // Clean up
      await Promise.all(contexts.map(ctx => ctx.close()));
    });

    test('tests back button behavior', async ({ page }) => {
      console.log('\n=== BACK BUTTON TEST ===');
      
      // Navigate through several pages
      await page.goto(BASE_URL);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'back-button-1-home.png')
      });
      
      // Try to go to dashboard
      try {
        await page.goto(`${BASE_URL}/dashboard`, { 
          timeout: 3000,
          waitUntil: 'commit' 
        });
      } catch (e) {
        console.log('Dashboard navigation failed');
      }
      
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'back-button-2-after-dashboard.png')
      });
      
      // Try to go back
      if (page.url() !== BASE_URL) {
        await page.goBack();
        console.log('After back button:', page.url());
        
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, 'back-button-3-after-back.png')
        });
      }
    });
  });

  test.describe('Network Analysis', () => {
    test('captures detailed network trace of redirect loop', async ({ page }) => {
      console.log('\n=== DETAILED NETWORK TRACE ===');
      
      const requests = [];
      const responses = [];
      
      // Monitor all requests and responses
      page.on('request', request => {
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          timestamp: Date.now()
        });
      });
      
      page.on('response', response => {
        responses.push({
          url: response.url(),
          status: response.status(),
          headers: response.headers(),
          timestamp: Date.now()
        });
      });
      
      // Try to navigate to dashboard
      try {
        await page.goto(`${BASE_URL}/dashboard`, {
          timeout: 5000,
          waitUntil: 'networkidle'
        });
      } catch (error) {
        console.log('Navigation timeout (expected)');
      }
      
      // Analyze request/response pairs
      console.log(`\nTotal requests: ${requests.length}`);
      console.log(`Total responses: ${responses.length}`);
      
      // Find redirect chains
      const redirects = responses.filter(r => r.status >= 300 && r.status < 400);
      console.log(`\nRedirects found: ${redirects.length}`);
      
      redirects.slice(0, 10).forEach((redirect, index) => {
        console.log(`${index + 1}. ${redirect.url} (${redirect.status}) -> ${redirect.headers.location}`);
      });
      
      // Save detailed network trace
      fs.writeFileSync(
        path.join(SCREENSHOTS_DIR, 'network-trace.json'),
        JSON.stringify({ requests, responses }, null, 2)
      );
    });
  });
});

// Helper function to wait
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}