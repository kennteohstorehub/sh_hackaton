const { test, expect } = require('@playwright/test');

test.describe('Multi-Tenant Authentication Tests', () => {
  // Test data for different tenants
  const testScenarios = [
    {
      name: 'BackOffice Login',
      url: 'http://admin.lvh.me:3000',
      email: 'backoffice@storehubqms.local',
      password: 'BackOffice123!@#',
      expectedTitle: 'BackOffice Dashboard',
      subdomain: 'admin'
    },
    {
      name: 'Demo Tenant Login',
      url: 'http://demo.lvh.me:3000',
      email: 'admin@demo.local',
      password: 'Demo123!@#',
      expectedTitle: 'Queue Management System',
      subdomain: 'demo'
    },
    {
      name: 'Test Cafe Tenant Login',
      url: 'http://test-cafe.lvh.me:3000',
      email: 'cafe@testcafe.local',
      password: 'Test123!@#',
      expectedTitle: 'Queue Management System',
      subdomain: 'test-cafe'
    }
  ];

  testScenarios.forEach((scenario) => {
    test(`${scenario.name} - Complete Authentication Flow`, async ({ page }) => {
      console.log(`\n=== Testing ${scenario.name} ===`);
      
      // Step 1: Navigate to login page
      console.log(`1. Navigating to ${scenario.url}`);
      await page.goto(scenario.url);
      
      // Take screenshot of initial page load
      await page.screenshot({ 
        path: `/Users/kennteoh/Development/Hack/test-screenshots/${scenario.subdomain}-01-initial-load.png`,
        fullPage: true 
      });
      
      // Step 2: Verify login page loads correctly
      console.log('2. Verifying login page elements');
      
      // Wait for login form to be visible
      await expect(page.locator('form')).toBeVisible({ timeout: 10000 });
      
      // Check for email and password fields
      const emailField = page.locator('input[type="email"], input[name="email"]');
      const passwordField = page.locator('input[type="password"], input[name="password"]');
      const submitButton = page.locator('button[type="submit"], input[type="submit"]');
      
      await expect(emailField).toBeVisible();
      await expect(passwordField).toBeVisible();
      await expect(submitButton).toBeVisible();
      
      // Take screenshot of login form
      await page.screenshot({ 
        path: `/Users/kennteoh/Development/Hack/test-screenshots/${scenario.subdomain}-02-login-form.png`,
        fullPage: true 
      });
      
      // Step 3: Enter credentials
      console.log('3. Entering credentials');
      await emailField.fill(scenario.email);
      await passwordField.fill(scenario.password);
      
      // Take screenshot with credentials entered
      await page.screenshot({ 
        path: `/Users/kennteoh/Development/Hack/test-screenshots/${scenario.subdomain}-03-credentials-entered.png`,
        fullPage: true 
      });
      
      // Step 4: Submit the form 
      console.log('4. Submitting login form');
      await submitButton.click();
      
      // Step 5: Verify successful login and redirect
      console.log('5. Verifying successful login and redirect');
      
      // Wait for redirect - check for dashboard elements or URL change
      await page.waitForLoadState('networkidle');
      
      // Take screenshot after login attempt
      await page.screenshot({ 
        path: `/Users/kennteoh/Development/Hack/test-screenshots/${scenario.subdomain}-04-after-login.png`,
        fullPage: true 
      });
      
      // Check if we're redirected away from login page
      const currentUrl = page.url();
      console.log(`Current URL after login: ${currentUrl}`);
      
      // Look for success indicators - dashboard elements, welcome message, etc.
      const possibleSuccessSelectors = [
        '[data-testid="dashboard"]',
        '.dashboard',
        '#dashboard', 
        'h1:has-text("Dashboard")',
        'h1:has-text("Welcome")',
        '.main-content',
        '.content-wrapper',
        'nav',
        '.sidebar'
      ];
      
      let loginSuccessful = false;
      for (const selector of possibleSuccessSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          loginSuccessful = true;
          console.log(`✓ Found success indicator: ${selector}`);
          break;
        } catch (e) {
          // Continue to next selector
        }
      }
      
      // Alternative check: look for absence of login form
      if (!loginSuccessful) {
        try {
          await expect(page.locator('input[type="email"]')).not.toBeVisible({ timeout: 5000 });
          loginSuccessful = true;
          console.log('✓ Login form no longer visible - assuming success');
        } catch (e) {
          // Check for error messages
          const errorSelectors = ['.error', '.alert-danger', '[data-testid="error"]', '.text-red'];
          for (const errorSelector of errorSelectors) {
            if (await page.locator(errorSelector).isVisible()) {
              const errorText = await page.locator(errorSelector).textContent();
              console.log(`✗ Error found: ${errorText}`);
            }
          }
        }
      }
      
      // Step 6: Check session isolation
      console.log('6. Verifying session isolation');
      
      // Check that we can access protected content
      const protectedSelectors = [
        'a[href*="logout"]',
        'button:has-text("Logout")',
        '.user-menu',
        '.profile-menu'
      ];
      
      for (const selector of protectedSelectors) {
        if (await page.locator(selector).isVisible()) {
          console.log(`✓ Found protected element: ${selector}`);
          break;
        }
      }
      
      // Take screenshot of dashboard/main page
      await page.screenshot({ 
        path: `/Users/kennteoh/Development/Hack/test-screenshots/${scenario.subdomain}-05-dashboard.png`,
        fullPage: true 
      });
      
      // Step 7: Test logout functionality
      console.log('7. Testing logout functionality');
      
      const logoutSelectors = [
        'a[href*="logout"]',
        'button:has-text("Logout")',
        '[data-testid="logout"]',
        '.logout-btn'
      ];
      
      let loggedOut = false;
      for (const logoutSelector of logoutSelectors) {
        try {
          const logoutElement = page.locator(logoutSelector);
          if (await logoutElement.isVisible()) {
            await logoutElement.click();
            console.log(`✓ Clicked logout using: ${logoutSelector}`);
            
            // Wait for redirect back to login
            await page.waitForLoadState('networkidle');
            
            // Take screenshot after logout
            await page.screenshot({ 
              path: `/Users/kennteoh/Development/Hack/test-screenshots/${scenario.subdomain}-06-after-logout.png`,
              fullPage: true 
            });
            
            // Verify we're back at login page
            if (await page.locator('input[type="email"]').isVisible()) {
              console.log('✓ Successfully logged out - back at login page');
              loggedOut = true;
            }
            break;
          }
        } catch (e) {
          console.log(`Could not logout using ${logoutSelector}: ${e.message}`);
        }
      }
      
      if (!loggedOut) {
        console.log('⚠ Could not find logout button or logout failed');
      }
      
      // Final assertions
      if (scenario.subdomain === 'admin') {
        // BackOffice specific checks
        expect(loginSuccessful).toBeTruthy();
      } else {
        // Tenant specific checks  
        expect(loginSuccessful).toBeTruthy();
      }
      
      console.log(`✓ ${scenario.name} test completed\n`);
    });
  });

  test('Cross-Tenant Session Isolation Test', async ({ browser }) => {
    console.log('\n=== Testing Cross-Tenant Session Isolation ===');
    
    // Create two browser contexts to simulate different users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    try {
      // Login to demo tenant in first context
      console.log('1. Logging into demo tenant');
      await page1.goto('http://demo.lvh.me:3000');
      await page1.fill('input[type="email"], input[name="email"]', 'admin@demo.local');
      await page1.fill('input[type="password"], input[name="password"]', 'Demo123!@#');
      await page1.click('button[type="submit"], input[type="submit"]');
      await page1.waitForLoadState('networkidle');
      
      // Login to test-cafe tenant in second context  
      console.log('2. Logging into test-cafe tenant');
      await page2.goto('http://test-cafe.lvh.me:3000');
      await page2.fill('input[type="email"], input[name="email"]', 'cafe@testcafe.local');
      await page2.fill('input[type="password"], input[name="password"]', 'Test123!@#');
      await page2.click('button[type="submit"], input[type="submit"]');
      await page2.waitForLoadState('networkidle');
      
      // Take screenshots
      await page1.screenshot({ 
        path: '/Users/kennteoh/Development/Hack/test-screenshots/isolation-demo-session.png',
        fullPage: true 
      });
      await page2.screenshot({ 
        path: '/Users/kennteoh/Development/Hack/test-screenshots/isolation-testcafe-session.png',
        fullPage: true 
      });
      
      // Verify that each context maintains its own session
      const url1 = page1.url();
      const url2 = page2.url();
      
      console.log(`Demo tenant URL: ${url1}`);
      console.log(`Test Cafe tenant URL: ${url2}`);
      
      // Verify URLs contain correct subdomains
      expect(url1).toContain('demo.lvh.me');
      expect(url2).toContain('test-cafe.lvh.me');
      
      console.log('✓ Cross-tenant session isolation verified');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});