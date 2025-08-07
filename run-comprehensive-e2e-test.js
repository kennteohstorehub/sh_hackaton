#!/usr/bin/env node

/**
 * Comprehensive E2E Test Runner for Queue Management System
 * 
 * This script runs the complete end-to-end test flow that includes:
 * 1. Login with test credentials (demo@smartqueue.com / demo123456)
 * 2. Dashboard verification
 * 3. Public queue view access
 * 4. Customer queue joining
 * 5. Customer seating functionality
 * 6. Real-time updates verification
 * 
 * Usage:
 *   node run-comprehensive-e2e-test.js [--headless] [--browser=chromium|firefox|webkit]
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const headless = args.includes('--headless');
const browserArg = args.find(arg => arg.startsWith('--browser='));
const browser = browserArg ? browserArg.split('=')[1] : 'chromium';

console.log('🚀 Starting Comprehensive Queue Management E2E Test');
console.log('=' .repeat(60));
console.log(`📊 Test Configuration:`);
console.log(`   Base URL: http://localhost:3000`);
console.log(`   Test Email: demo@smartqueue.com`);
console.log(`   Test Password: demo123456`);
console.log(`   Browser: ${browser}`);
console.log(`   Headless: ${headless ? 'Yes' : 'No'}`);
console.log(`   Screenshots: test-results/ directory`);
console.log('=' .repeat(60));

// Ensure test results directory exists
const testResultsDir = path.join(__dirname, 'test-results');
if (!fs.existsSync(testResultsDir)) {
  fs.mkdirSync(testResultsDir, { recursive: true });
  console.log('📁 Created test-results directory');
}

// Build Playwright command
const playwrightArgs = [
  'test',
  'tests/e2e/queue-management-complete-flow.spec.js',
  '--project', browser,
  '--reporter=list',
  '--headed'
];

// Add headless flag if specified
if (headless) {
  playwrightArgs.push('--headed=false');
}

console.log(`🧪 Running command: npx playwright ${playwrightArgs.join(' ')}`);
console.log('');

// Start the test
const testProcess = spawn('npx', ['playwright', ...playwrightArgs], {
  stdio: 'inherit',
  cwd: __dirname
});

testProcess.on('close', (code) => {
  console.log('');
  console.log('=' .repeat(60));
  
  if (code === 0) {
    console.log('✅ E2E Test completed successfully!');
    console.log('');
    console.log('📸 Screenshots saved to: test-results/');
    console.log('📋 Test Report: Check console output above');
    console.log('');
    console.log('🎯 Test Coverage:');
    console.log('   ✓ User authentication');
    console.log('   ✓ Dashboard loading and verification');
    console.log('   ✓ Public queue view access');
    console.log('   ✓ Customer queue joining process');
    console.log('   ✓ Real-time dashboard updates');
    console.log('   ✓ Customer seating functionality');
    console.log('   ✓ WebSocket connection verification');
    console.log('   ✓ Error handling and validation');
  } else {
    console.log('❌ E2E Test failed!');
    console.log('');
    console.log('🔍 Troubleshooting:');
    console.log('   1. Ensure server is running on http://localhost:3000');
    console.log('   2. Verify test credentials are configured correctly');
    console.log('   3. Check screenshots in test-results/ for visual debugging');
    console.log('   4. Review console output above for specific error details');
    console.log('');
    console.log('📸 Debug screenshots available in: test-results/');
  }
  
  console.log('=' .repeat(60));
  process.exit(code);
});

testProcess.on('error', (error) => {
  console.error('❌ Failed to start test process:', error.message);
  console.log('');
  console.log('💡 Make sure Playwright is installed:');
  console.log('   npm install @playwright/test');
  console.log('   npx playwright install');
  process.exit(1);
});