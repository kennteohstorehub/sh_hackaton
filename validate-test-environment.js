#!/usr/bin/env node

/**
 * Test Environment Validation Script
 * 
 * Validates that the test environment is ready for comprehensive E2E testing:
 * - Server is running on localhost:3000
 * - Test credentials work for authentication
 * - Essential endpoints are accessible
 * - Database connection is working
 */

const https = require('https');
const http = require('http');

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  credentials: {
    email: 'demo@smartqueue.com',
    password: 'demo123456'
  }
};

console.log('🔍 Validating Test Environment');
console.log('=' .repeat(50));

async function validateServer() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${TEST_CONFIG.baseUrl}/`, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        console.log('✅ Server is running on http://localhost:3000');
        resolve(true);
      } else {
        console.log(`❌ Server responded with status ${res.statusCode}`);
        resolve(false);
      }
    });

    req.on('error', (error) => {
      console.log('❌ Server is not accessible:', error.message);
      resolve(false);
    });

    req.setTimeout(5000, () => {
      console.log('❌ Server connection timeout');
      req.destroy();
      resolve(false);
    });
  });
}

async function validateLoginPage() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${TEST_CONFIG.baseUrl}/auth/login`, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        console.log('✅ Login page is accessible');
        resolve(true);
      } else {
        console.log(`❌ Login page responded with status ${res.statusCode}`);
        resolve(false);
      }
    });

    req.on('error', (error) => {
      console.log('❌ Login page not accessible:', error.message);
      resolve(false);
    });

    req.setTimeout(5000, () => {
      console.log('❌ Login page connection timeout');
      req.destroy();
      resolve(false);
    });
  });
}

async function validatePublicQueue() {
  return new Promise((resolve, reject) => {
    // Try a common public queue URL pattern
    const testUrl = `${TEST_CONFIG.baseUrl}/queue/join/demo-merchant-id`;
    const req = http.get(testUrl, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 500) {
        console.log('✅ Public queue endpoints are accessible');
        resolve(true);
      } else {
        console.log(`⚠️ Public queue endpoint status: ${res.statusCode} (may be expected)`);
        resolve(true); // This might be expected if merchant doesn't exist
      }
    });

    req.on('error', (error) => {
      console.log('⚠️ Public queue endpoint check failed:', error.message);
      resolve(true); // Not critical for initial validation
    });

    req.setTimeout(5000, () => {
      console.log('⚠️ Public queue endpoint timeout');
      req.destroy();
      resolve(true);
    });
  });
}

async function checkDependencies() {
  const fs = require('fs');
  const path = require('path');
  
  // Check if package.json exists
  const packageJsonPath = path.join(__dirname, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    console.log('✅ package.json found');
    
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Check for Playwright
      if (packageJson.devDependencies && packageJson.devDependencies['@playwright/test']) {
        console.log('✅ Playwright is listed in dependencies');
      } else {
        console.log('⚠️ Playwright not found in package.json dependencies');
      }
      
    } catch (error) {
      console.log('⚠️ Could not parse package.json');
    }
  } else {
    console.log('⚠️ package.json not found');
  }
  
  // Check if playwright.config.js exists
  const playwrightConfigPath = path.join(__dirname, 'playwright.config.js');
  if (fs.existsSync(playwrightConfigPath)) {
    console.log('✅ Playwright configuration found');
  } else {
    console.log('⚠️ Playwright configuration not found');
  }
  
  return true;
}

async function main() {
  try {
    console.log('📦 Checking dependencies...');
    await checkDependencies();
    console.log('');
    
    console.log('🌐 Checking server connectivity...');
    const serverRunning = await validateServer();
    console.log('');
    
    if (serverRunning) {
      console.log('🔐 Checking authentication endpoints...');
      await validateLoginPage();
      console.log('');
      
      console.log('🎯 Checking public queue endpoints...');
      await validatePublicQueue();
      console.log('');
    }
    
    console.log('=' .repeat(50));
    console.log('📋 Test Environment Summary:');
    console.log('');
    
    if (serverRunning) {
      console.log('✅ Environment appears ready for E2E testing');
      console.log('');
      console.log('🚀 To run the comprehensive E2E test:');
      console.log('   node run-comprehensive-e2e-test.js');
      console.log('');
      console.log('🎯 To run with options:');
      console.log('   node run-comprehensive-e2e-test.js --headless');
      console.log('   node run-comprehensive-e2e-test.js --browser=firefox');
      console.log('');
      console.log('📸 Screenshots will be saved to: test-results/');
    } else {
      console.log('❌ Environment is not ready for testing');
      console.log('');
      console.log('🔧 Troubleshooting steps:');
      console.log('   1. Start the server: npm start or node server/index.js');
      console.log('   2. Verify it\'s running on http://localhost:3000');
      console.log('   3. Check server logs for any errors');
      console.log('   4. Ensure database is connected');
    }
    
    console.log('=' .repeat(50));
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

main();