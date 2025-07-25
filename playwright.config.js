const { defineConfig, devices } = require('@playwright/test');
const testConfig = require('./tests/e2e/test-config');

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : testConfig.execution.retries,
  workers: process.env.CI ? 1 : testConfig.execution.workers,
  reporter: testConfig.execution.reporter,
  
  use: {
    // Base URL for your application
    baseURL: testConfig.baseURL,
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: testConfig.browser.screenshot ? 'only-on-failure' : 'off',
    
    // Video on failure
    video: testConfig.browser.video,
    
    // Timeouts
    navigationTimeout: testConfig.timeouts.navigation,
    actionTimeout: testConfig.timeouts.default,
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        headless: testConfig.browser.headless 
      },
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        headless: testConfig.browser.headless 
      },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        headless: testConfig.browser.headless 
      },
    },
    // Mobile testing
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        headless: testConfig.browser.headless 
      },
    },
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        headless: testConfig.browser.headless 
      },
    },
  ],

  // Run your local server before starting the tests
  webServer: {
    command: 'npm start',
    port: 3838,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});