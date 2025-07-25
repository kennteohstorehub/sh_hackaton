// Test configuration that uses environment variables
require('dotenv').config({ path: __dirname + '/.env' });

module.exports = {
  // Base configuration
  baseURL: process.env.BASE_URL || 'http://localhost:3838',
  
  // Test credentials
  testUser: {
    email: process.env.TEST_USER_EMAIL,
    password: process.env.TEST_USER_PASSWORD
  },
  
  // Invalid credentials for negative testing
  invalidUser: {
    email: process.env.TEST_INVALID_EMAIL || `invalid_${Date.now()}@test.com`,
    password: process.env.TEST_INVALID_PASSWORD || 'wrongpassword123'
  },
  
  // Test merchant details
  merchant: {
    name: process.env.TEST_MERCHANT_NAME,
    phone: process.env.TEST_MERCHANT_PHONE
  },
  
  // WhatsApp configuration
  whatsapp: {
    number: process.env.TEST_WHATSAPP_NUMBER
  },
  
  // Timeouts
  timeouts: {
    default: parseInt(process.env.TEST_TIMEOUT) || 30000,
    navigation: parseInt(process.env.TEST_NAVIGATION_TIMEOUT) || 10000
  },
  
  // Browser configuration
  browser: {
    name: process.env.TEST_BROWSER || 'chromium',
    headless: process.env.TEST_HEADLESS !== 'false',
    screenshot: process.env.TEST_SCREENSHOT_ON_FAILURE !== 'false',
    video: process.env.TEST_VIDEO || 'retain-on-failure'
  },
  
  // Test execution configuration
  execution: {
    workers: parseInt(process.env.TEST_WORKERS) || 1,
    retries: parseInt(process.env.TEST_RETRIES) || 1,
    reporter: process.env.TEST_REPORTER || 'list'
  },
  
  // Helper functions for generating test data
  generateTestData: {
    // Generate a random phone number
    phoneNumber: () => `+601${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
    
    // Generate a random email
    email: () => `test_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`,
    
    // Generate a random name
    name: () => `Test User ${Date.now()}`,
    
    // Generate a random business name
    businessName: () => `Test Business ${Date.now()}`,
    
    // Generate a random queue number
    queueNumber: () => `A${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    
    // Generate a random party size
    partySize: () => Math.floor(Math.random() * 6) + 1,
    
    // Generate a future date
    futureDate: (daysAhead = 30) => {
      const date = new Date();
      date.setDate(date.getDate() + daysAhead);
      return date.toISOString().split('T')[0];
    },
    
    // Generate a timestamp suffix
    timestamp: () => Date.now(),
    
    // Generate a random string
    randomString: (length = 8) => Math.random().toString(36).substring(2, 2 + length)
  }
};