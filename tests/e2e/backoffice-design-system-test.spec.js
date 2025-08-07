const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('Backoffice Login and Design System Check', async ({ page, context }) => {
  // Screenshot directory
  const screenshotDir = path.join(__dirname, '..', '..', 'test-results', 'backoffice-design');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // Increase timeout
  test.setTimeout(120000);  // 2 minutes

  // Detailed logging function
  const logDiagnostics = async (message) => {
    console.log(`[DIAGNOSTIC] ${message}`);
    fs.appendFileSync(
      path.join(screenshotDir, 'diagnostic.log'), 
      `${new Date().toISOString()}: ${message}\n`
    );
  };

  // Intercept and manage network requests
  await context.route('**/*', route => {
    const url = route.request().url();
    
    // Log request details
    logDiagnostics(`Network Request: ${url}`);
    
    // Continue or abort based on rules
    if (
      url.includes('.css') || 
      url.includes('.js') || 
      url.includes('/backoffice/') || 
      url.includes('localhost')
    ) {
      route.continue();
    } else {
      route.abort('failed');
    }
  });

  try {
    logDiagnostics('Starting backoffice design system test');

    // Configure error handling
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logDiagnostics(`Browser Console Error: ${msg.text()}`);
      }
    });

    page.on('pageerror', error => {
      logDiagnostics(`Page Error: ${error.message}`);
    });

    // Set additional headers to mitigate rate limiting
    await context.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'X-Forwarded-For': `127.0.0.${Math.floor(Math.random() * 255)}`
    });

    // 1. Navigate to login page with retry logic
    let loginAttempts = 0;
    const maxLoginAttempts = 3;

    while (loginAttempts < maxLoginAttempts) {
      try {
        logDiagnostics(`Login Attempt ${loginAttempts + 1}`);
        
        await page.goto('http://localhost:3000/backoffice/login', { 
          waitUntil: 'networkidle',
          timeout: 30000
        });
        break;
      } catch (navError) {
        loginAttempts++;
        logDiagnostics(`Navigation Error: ${navError.message}`);
        
        if (loginAttempts >= maxLoginAttempts) {
          throw navError;
        }
        
        // Wait before retry
        await page.waitForTimeout(5000);
      }
    }
    
    // Take login page screenshot
    await page.screenshot({ 
      path: path.join(screenshotDir, 'login-page.png'),
      fullPage: true 
    });

    // 2. Login with retry
    loginAttempts = 0;
    while (loginAttempts < maxLoginAttempts) {
      try {
        await page.fill('input[type="email"]', 'backoffice@storehub.com');
        await page.fill('input[type="password"]', 'BackOffice123!');
        
        await Promise.all([
          page.click('button[type="submit"]'),
          page.waitForNavigation({ 
            waitUntil: 'networkidle',
            timeout: 30000 
          })
        ]);
        break;
      } catch (loginError) {
        loginAttempts++;
        logDiagnostics(`Login Error: ${loginError.message}`);
        
        if (loginAttempts >= maxLoginAttempts) {
          throw loginError;
        }
        
        // Wait before retry
        await page.waitForTimeout(5000);
      }
    }

    // Additional wait for dashboard to stabilize
    await page.waitForSelector('body', { timeout: 30000 });

    // Take dashboard screenshot
    await page.screenshot({ 
      path: path.join(screenshotDir, 'dashboard-page.png'),
      fullPage: true 
    });

    // 3. Design System Checks
    const designSystemCheck = await page.evaluate(() => {
      const diagnosticInfo = {
        url: window.location.href,
        documentClasses: document.documentElement.className,
        bodyClasses: document.body.className,
        cssVariables: {
          primaryColor: getComputedStyle(document.documentElement).getPropertyValue('--primary-color'),
          secondaryColor: getComputedStyle(document.documentElement).getPropertyValue('--secondary-color')
        },
        storehubElements: {
          dashboard: [
            '.storehub-dashboard', 
            '.backoffice-dashboard', 
            '#dashboard', 
            '.dashboard'
          ].some(selector => document.querySelector(selector)),
          sidebar: [
            '.storehub-sidebar', 
            '.backoffice-sidebar', 
            '#sidebar', 
            '.sidebar'
          ].some(selector => document.querySelector(selector)),
          cards: [
            '.storehub-card', 
            '.card', 
            '.modern-card', 
            '.dashboard-card'
          ].reduce((total, selector) => total + document.querySelectorAll(selector).length, 0),
          modernButtons: [
            '.modern-button', 
            '.storehub-button', 
            '.btn-modern'
          ].reduce((total, selector) => total + document.querySelectorAll(selector).length, 0),
          modernDesignClasses: {
            designSystem: [
              'storehub-design-system', 
              'modern-backoffice'
            ].some(cls => document.body.classList.contains(cls)),
            modernDesign: [
              'modern-design', 
              'storehub-design'
            ].some(cls => document.body.classList.contains(cls))
          }
        }
      };

      return JSON.parse(JSON.stringify(diagnosticInfo));
    });

    // Log findings
    logDiagnostics(`Design System Check:\n${JSON.stringify(designSystemCheck, null, 2)}`);

    // Assertions
    const assertions = {
      dashboard: designSystemCheck.storehubElements.dashboard,
      sidebar: designSystemCheck.storehubElements.sidebar,
      cards: designSystemCheck.storehubElements.cards,
      designSystem: designSystemCheck.storehubElements.modernDesignClasses.designSystem,
      modernDesign: designSystemCheck.storehubElements.modernDesignClasses.modernDesign,
      primaryColor: designSystemCheck.cssVariables.primaryColor.trim().toLowerCase()
    };

    logDiagnostics(`Assertions:\n${JSON.stringify(assertions, null, 2)}`);

    // More flexible assertions
    if (!assertions.dashboard && !assertions.sidebar) {
      throw new Error('No dashboard or sidebar found');
    }

    expect(assertions.cards).toBeGreaterThan(0);

    // Verify primary color with multiple acceptable formats
    const primaryColorValidation = 
      assertions.primaryColor === '#fa8c16' || 
      assertions.primaryColor === 'rgb(250, 140, 22)' ||
      assertions.primaryColor === 'rgba(250, 140, 22, 1)';

    if (!primaryColorValidation) {
      throw new Error(`Primary color should be orange, got: ${assertions.primaryColor}`);
    }

    logDiagnostics('Design system test completed successfully');

  } catch (error) {
    // Log any unexpected errors
    logDiagnostics(`Test Failed with Error: ${error.message}`);
    console.error('Test Failed with Error:', error);
    
    // Take error screenshot
    await page.screenshot({ 
      path: path.join(screenshotDir, 'error-page.png'),
      fullPage: true 
    });

    throw error;
  }
});