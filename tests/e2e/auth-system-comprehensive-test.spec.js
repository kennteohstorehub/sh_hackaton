const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Test configuration
const BASE_URL = 'http://localhost:3838';
const SCREENSHOTS_DIR = path.join(__dirname, 'auth-screenshots');
const TRACES_DIR = path.join(__dirname, 'auth-traces');

// Ensure directories exist
[SCREENSHOTS_DIR, TRACES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

test.describe('Authentication System Comprehensive Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Clear all cookies and storage
    await page.goto(BASE_URL);
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('Issue #1: Redirect Loop Analysis', async ({ page }) => {
    console.log('\n=== ISSUE #1: REDIRECT LOOP ANALYSIS ===');
    console.log('Problem: Infinite redirect loop between /auth/login and /dashboard');
    console.log('Root Cause: NODE_ENV !== "production" triggers auth-redirect.js which redirects /auth/login to /dashboard');
    console.log('But USE_AUTH_BYPASS=false means real auth is required, so /dashboard redirects back to /auth/login');
    
    const redirects = [];
    const requestTimings = [];
    
    // Monitor redirects
    page.on('response', response => {
      if (response.status() >= 300 && response.status() < 400) {
        const location = response.headers()['location'];
        redirects.push({
          from: response.url(),
          to: location,
          status: response.status(),
          timestamp: Date.now()
        });
      }
    });
    
    // Monitor request timings
    page.on('request', request => {
      requestTimings.push({
        url: request.url(),
        method: request.method(),
        timestamp: Date.now()
      });
    });
    
    try {
      // Attempt to navigate to dashboard
      await page.goto(`${BASE_URL}/dashboard`, { 
        waitUntil: 'commit',
        timeout: 5000
      });
    } catch (error) {
      console.log('Navigation failed due to redirect loop (expected)');
    }
    
    // Take screenshot of the current state
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'issue1-redirect-loop.png'),
      fullPage: true
    });
    
    // Analyze redirect pattern
    console.log('\nRedirect Chain:');
    redirects.slice(0, 10).forEach((r, i) => {
      console.log(`${i + 1}. ${r.from} -> ${r.to}`);
    });
    
    // Save detailed analysis
    fs.writeFileSync(
      path.join(TRACES_DIR, 'issue1-redirect-analysis.json'),
      JSON.stringify({ redirects, requestTimings }, null, 2)
    );
    
    // Verify redirect loop exists
    expect(redirects.length).toBeGreaterThan(5);
    const hasLoop = redirects.some((r, i) => 
      redirects.slice(i + 1).some(r2 => r2.from === r.from)
    );
    expect(hasLoop).toBe(true);
  });

  test('Issue #2: Session Management Problems', async ({ page }) => {
    console.log('\n=== ISSUE #2: SESSION MANAGEMENT ANALYSIS ===');
    console.log('Problem: Sessions may not persist properly between requests');
    
    const sessionAnalysis = {
      cookies: [],
      sessionIds: [],
      csrfTokens: []
    };
    
    // Step 1: Initial page load
    await page.goto(BASE_URL);
    let cookies = await page.context().cookies();
    sessionAnalysis.cookies.push({ stage: 'initial', cookies: [...cookies] });
    
    const sessionCookie1 = cookies.find(c => c.name === 'qms_session');
    const csrfCookie1 = cookies.find(c => c.name === 'csrf-token');
    
    console.log('\n1. Initial Load:');
    console.log(`   Session ID: ${sessionCookie1?.value?.substring(0, 20)}...`);
    console.log(`   CSRF Token: ${csrfCookie1?.value?.substring(0, 20)}...`);
    
    // Step 2: Try to access protected route
    try {
      await page.goto(`${BASE_URL}/dashboard`, { 
        waitUntil: 'commit',
        timeout: 3000 
      });
    } catch (e) {
      console.log('   Dashboard access failed (redirect loop)');
    }
    
    cookies = await page.context().cookies();
    sessionAnalysis.cookies.push({ stage: 'after_dashboard_attempt', cookies: [...cookies] });
    
    const sessionCookie2 = cookies.find(c => c.name === 'qms_session');
    const csrfCookie2 = cookies.find(c => c.name === 'csrf-token');
    
    console.log('\n2. After Dashboard Attempt:');
    console.log(`   Session ID: ${sessionCookie2?.value?.substring(0, 20)}...`);
    console.log(`   CSRF Token: ${csrfCookie2?.value?.substring(0, 20)}...`);
    console.log(`   Session Changed: ${sessionCookie1?.value !== sessionCookie2?.value}`);
    
    // Step 3: Check session persistence
    await page.goto(BASE_URL);
    cookies = await page.context().cookies();
    const sessionCookie3 = cookies.find(c => c.name === 'qms_session');
    
    console.log('\n3. Return to Home:');
    console.log(`   Session Persisted: ${sessionCookie2?.value === sessionCookie3?.value}`);
    
    // Take screenshot
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'issue2-session-state.png')
    });
    
    // Save analysis
    fs.writeFileSync(
      path.join(TRACES_DIR, 'issue2-session-analysis.json'),
      JSON.stringify(sessionAnalysis, null, 2)
    );
  });

  test('Issue #3: Login Form Functionality', async ({ page }) => {
    console.log('\n=== ISSUE #3: LOGIN FORM TESTING ===');
    console.log('Problem: Cannot test login form due to redirect to dashboard');
    
    // Since /auth/login redirects to /dashboard, we need to test the actual endpoint
    console.log('\n1. Testing login POST endpoint directly:');
    
    // Get CSRF token first
    await page.goto(BASE_URL);
    const cookies = await page.context().cookies();
    const csrfToken = cookies.find(c => c.name === 'csrf-token')?.value;
    
    // Test login endpoint
    const loginResponse = await page.request.post(`${BASE_URL}/auth/login`, {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      data: {
        email: 'demo@storehub.com',
        password: 'password123',
        _csrf: csrfToken
      }
    });
    
    console.log(`   Login Response Status: ${loginResponse.status()}`);
    console.log(`   Response URL: ${loginResponse.url()}`);
    
    // Check if we can access the actual login form
    console.log('\n2. Attempting to bypass redirect and see login form:');
    
    // Try to intercept the redirect
    await page.route('**/*', route => {
      const request = route.request();
      if (request.url().includes('/auth/login') && request.method() === 'GET') {
        console.log(`   Intercepted: ${request.url()}`);
      }
      route.continue();
    });
    
    try {
      await page.goto(`${BASE_URL}/auth/login`, {
        waitUntil: 'domcontentloaded',
        timeout: 3000
      });
    } catch (e) {
      console.log('   Login page access failed');
    }
    
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'issue3-login-form.png'),
      fullPage: true
    });
  });

  test('Issue #4: CSRF Token Implementation', async ({ page }) => {
    console.log('\n=== ISSUE #4: CSRF TOKEN TESTING ===');
    
    // Load home page to get CSRF token
    await page.goto(BASE_URL);
    
    // Check CSRF token in various locations
    const csrfData = await page.evaluate(() => {
      return {
        metaTag: document.querySelector('meta[name="csrf-token"]')?.content,
        cookieString: document.cookie,
        forms: Array.from(document.querySelectorAll('form')).map(form => ({
          action: form.action,
          csrfInput: form.querySelector('input[name="_csrf"]')?.value,
          csrfData: form.dataset.csrf
        }))
      };
    });
    
    console.log('\nCSRF Token Locations:');
    console.log(`   Meta Tag: ${csrfData.metaTag ? 'Present' : 'Missing'}`);
    console.log(`   Cookie: ${csrfData.cookieString.includes('csrf-token') ? 'Present' : 'Missing'}`);
    console.log(`   Forms Found: ${csrfData.forms.length}`);
    
    // Get CSRF from cookies
    const cookies = await page.context().cookies();
    const csrfCookie = cookies.find(c => c.name === 'csrf-token');
    
    console.log(`\nCSRF Cookie Details:`);
    console.log(`   Value: ${csrfCookie?.value?.substring(0, 20)}...`);
    console.log(`   SameSite: ${csrfCookie?.sameSite}`);
    console.log(`   HttpOnly: ${csrfCookie?.httpOnly}`);
    console.log(`   Secure: ${csrfCookie?.secure}`);
    
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'issue4-csrf-tokens.png')
    });
  });

  test('Issue #5: Protected Route Access Control', async ({ page }) => {
    console.log('\n=== ISSUE #5: ACCESS CONTROL TESTING ===');
    
    const protectedRoutes = [
      '/dashboard',
      '/dashboard/settings',
      '/dashboard/analytics',
      '/api/queues',
      '/api/queue-entries'
    ];
    
    console.log('\nTesting protected routes without authentication:');
    
    for (const route of protectedRoutes) {
      const response = await page.request.get(`${BASE_URL}${route}`, {
        failOnStatusCode: false
      });
      
      const isApi = route.startsWith('/api/');
      const expectedStatus = isApi ? 401 : 302;
      const actualStatus = response.status();
      
      console.log(`   ${route}: ${actualStatus} ${actualStatus === expectedStatus ? '✓' : '✗'}`);
      
      if (actualStatus === 302) {
        const location = response.headers()['location'];
        console.log(`     Redirects to: ${location}`);
      }
    }
  });

  test('Issue #6: Logout Functionality', async ({ page }) => {
    console.log('\n=== ISSUE #6: LOGOUT TESTING ===');
    
    // Get initial session
    await page.goto(BASE_URL);
    const initialCookies = await page.context().cookies();
    const initialSession = initialCookies.find(c => c.name === 'qms_session');
    
    console.log(`\n1. Initial Session: ${initialSession?.value?.substring(0, 20)}...`);
    
    // Perform logout
    await page.goto(`${BASE_URL}/auth/logout`);
    
    // Check session after logout
    const afterLogoutCookies = await page.context().cookies();
    const afterLogoutSession = afterLogoutCookies.find(c => c.name === 'qms_session');
    
    console.log(`2. After Logout Session: ${afterLogoutSession?.value?.substring(0, 20) || 'NONE'}`);
    console.log(`3. Redirected to: ${page.url()}`);
    
    // Verify logout worked
    expect(page.url()).toBe(`${BASE_URL}/`);
    
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'issue6-after-logout.png')
    });
  });

  test('Issue #7: Concurrent Session Handling', async ({ browser }) => {
    console.log('\n=== ISSUE #7: CONCURRENT SESSIONS ===');
    
    // Create multiple browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Navigate both to get sessions
    await page1.goto(BASE_URL);
    await page2.goto(BASE_URL);
    
    const cookies1 = await context1.cookies();
    const cookies2 = await context2.cookies();
    
    const session1 = cookies1.find(c => c.name === 'qms_session');
    const session2 = cookies2.find(c => c.name === 'qms_session');
    
    console.log(`\nSession 1: ${session1?.value?.substring(0, 20)}...`);
    console.log(`Session 2: ${session2?.value?.substring(0, 20)}...`);
    console.log(`Different Sessions: ${session1?.value !== session2?.value}`);
    
    // Clean up
    await context1.close();
    await context2.close();
  });

  test('Summary: Root Cause Analysis', async ({ page }) => {
    console.log('\n=== ROOT CAUSE ANALYSIS ===');
    console.log('\nThe redirect loop is caused by a configuration mismatch:');
    console.log('\n1. In server/index.js (lines 289-293):');
    console.log('   - When NODE_ENV !== "production", auth-redirect.js is used');
    console.log('   - auth-redirect.js makes /auth/login redirect to /dashboard');
    console.log('\n2. But USE_AUTH_BYPASS=false means:');
    console.log('   - Real authentication is required');
    console.log('   - /dashboard uses requireAuth middleware');
    console.log('   - Without valid session, it redirects to /auth/login');
    console.log('\n3. This creates an infinite loop:');
    console.log('   /dashboard -> /auth/login -> /dashboard -> /auth/login...');
    
    console.log('\n=== SOLUTION ===');
    console.log('\nThe route selection should be based on USE_AUTH_BYPASS, not NODE_ENV:');
    console.log('\nif (process.env.USE_AUTH_BYPASS === "true") {');
    console.log('  app.use("/auth", require("./routes/frontend/auth-redirect"));');
    console.log('} else {');
    console.log('  app.use("/auth", require("./routes/frontend/auth"));');
    console.log('}');
    
    // Create a visual summary
    await page.goto(BASE_URL);
    await page.setContent(`
      <html>
        <head>
          <title>Auth System Issues Summary</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .issue { background: #f0f0f0; padding: 15px; margin: 10px 0; border-left: 4px solid #ff0000; }
            .solution { background: #e8f5e9; padding: 15px; margin: 10px 0; border-left: 4px solid #4caf50; }
            h1 { color: #333; }
            h2 { color: #666; }
            code { background: #f5f5f5; padding: 2px 5px; font-family: monospace; }
          </style>
        </head>
        <body>
          <h1>Authentication System Issues</h1>
          
          <div class="issue">
            <h2>Issue #1: Redirect Loop</h2>
            <p><strong>Problem:</strong> Infinite loop between /auth/login and /dashboard</p>
            <p><strong>Cause:</strong> NODE_ENV check loads auth-redirect.js which conflicts with USE_AUTH_BYPASS=false</p>
          </div>
          
          <div class="issue">
            <h2>Issue #2: Configuration Mismatch</h2>
            <p><strong>Current:</strong> <code>if (process.env.NODE_ENV !== 'production')</code></p>
            <p><strong>Should be:</strong> <code>if (process.env.USE_AUTH_BYPASS === 'true')</code></p>
          </div>
          
          <div class="solution">
            <h2>Solution</h2>
            <p>Update server/index.js lines 289-293 to check USE_AUTH_BYPASS instead of NODE_ENV</p>
            <p>This will ensure auth routes match the authentication middleware behavior</p>
          </div>
          
          <div class="issue">
            <h2>Current State</h2>
            <p><strong>NODE_ENV:</strong> ${process.env.NODE_ENV || 'Not set (defaults to development)'}</p>
            <p><strong>USE_AUTH_BYPASS:</strong> ${process.env.USE_AUTH_BYPASS || 'false'}</p>
            <p><strong>Result:</strong> Auth redirect active but real auth required = Loop</p>
          </div>
        </body>
      </html>
    `);
    
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'auth-issues-summary.png'),
      fullPage: true
    });
  });
});

console.log('\n=== TEST SETUP COMPLETE ===');
console.log(`Screenshots will be saved to: ${SCREENSHOTS_DIR}`);
console.log(`Traces will be saved to: ${TRACES_DIR}`);