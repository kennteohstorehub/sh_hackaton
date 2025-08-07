#!/usr/bin/env node

/**
 * BackOffice Manual Test Helper
 * 
 * This script provides interactive testing guidance and validates
 * that the BackOffice system is ready for manual verification
 */

const readline = require('readline');
const http = require('http');
const { URL } = require('url');

// Configuration
const CONFIG = {
  baseURL: 'http://admin.lvh.me:3838',
  credentials: {
    email: 'backoffice@storehubqms.local',
    password: 'BackOffice123!@#'
  }
};

// Test results tracking
let results = {
  completed: 0,
  total: 0,
  passed: 0,
  failed: 0,
  notes: []
};

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Ask user a question
 */
function question(query) {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

/**
 * Check if server is accessible
 */
async function checkServer() {
  return new Promise((resolve) => {
    const url = new URL(CONFIG.baseURL + '/backoffice/auth/login');
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      timeout: 5000
    }, (res) => {
      resolve(res.statusCode === 200);
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => resolve(false));
    req.end();
  });
}

/**
 * Interactive test function
 */
async function interactiveTest(title, description, url, instructions, expectedResults) {
  results.total++;
  
  log(`\n${'='⋅repeat(60)}`, 'blue');
  log(`🧪 TEST: ${title}`, 'bold');
  log(`📋 ${description}`, 'cyan');
  
  if (url) {
    log(`🔗 URL: ${CONFIG.baseURL}${url}`, 'blue');
  }
  
  log(`\n📝 Instructions:`, 'yellow');
  instructions.forEach((instruction, index) => {
    log(`   ${index + 1}. ${instruction}`, 'white');
  });
  
  log(`\n✅ Expected Results:`, 'green');
  expectedResults.forEach((result, index) => {
    log(`   • ${result}`, 'green');
  });
  
  log(`\n🤔 Please complete the test above...`, 'magenta');
  
  while (true) {
    const answer = await question('Did the test PASS? (y/n/s=skip/note=add note): ');
    
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      log('✅ TEST PASSED', 'green');
      results.passed++;
      results.completed++;
      break;
    } else if (answer.toLowerCase() === 'n' || answer.toLowerCase() === 'no') {
      log('❌ TEST FAILED', 'red');
      const note = await question('Please describe what went wrong: ');
      results.notes.push(`❌ ${title}: ${note}`);
      results.failed++;
      results.completed++;
      break;
    } else if (answer.toLowerCase() === 's' || answer.toLowerCase() === 'skip') {
      log('⏸️ TEST SKIPPED', 'yellow');
      results.notes.push(`⏸️ ${title}: Skipped by user`);
      break;
    } else if (answer.toLowerCase().startsWith('note')) {
      const note = answer.substring(4).trim() || await question('Enter note: ');
      results.notes.push(`📝 ${title}: ${note}`);
      log(`📝 Note added: ${note}`, 'yellow');
    } else {
      log('Please answer y/n/s or "note <your note>"', 'yellow');
    }
  }
}

/**
 * Main test suite
 */
async function runManualTests() {
  log('🚀 BackOffice System - Interactive Manual Testing', 'bold');
  log('='⋅repeat(60), 'blue');
  
  // Check server first
  log('\n🔍 Checking server availability...', 'yellow');
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    log('❌ Server is not accessible at ' + CONFIG.baseURL, 'red');
    log('Please ensure the server is running with: npm start or ./quick-start.sh', 'yellow');
    rl.close();
    return;
  }
  
  log('✅ Server is running and accessible', 'green');
  
  // Display credentials
  log('\n🔐 Test Credentials:', 'magenta');
  log(`📧 Email: ${CONFIG.credentials.email}`, 'cyan');
  log(`🔑 Password: ${CONFIG.credentials.password}`, 'cyan');
  
  await question('\nPress Enter to start testing...');
  
  // Test 1: Login Page
  await interactiveTest(
    'Login Page Display',
    'Verify the login page loads correctly with all required elements',
    '/backoffice/auth/login',
    [
      'Open the URL in your browser',
      'Check that the page loads without errors',
      'Verify the page title contains "BackOffice"',
      'Look for email and password input fields',
      'Check for a submit button'
    ],
    [
      'Page loads successfully',
      'Title shows "BackOffice Login"',
      'Email field is present and required',
      'Password field is present and required',
      'Submit button is visible',
      'Page has professional styling'
    ]
  );
  
  // Test 2: Authentication
  await interactiveTest(
    'Login Authentication',
    'Test the login process with valid credentials',
    '/backoffice/auth/login',
    [
      'Enter the test email address',
      'Enter the test password',
      'Click the login button',
      'Observe the result'
    ],
    [
      'Successful login redirects to dashboard',
      'Success message appears',
      'Navigation menu becomes visible',
      'User information appears in header'
    ]
  );
  
  // Test 3: Dashboard
  await interactiveTest(
    'Dashboard Display',
    'Verify the dashboard shows correctly after login',
    '/backoffice/dashboard',
    [
      'After logging in, check the dashboard page',
      'Look for system statistics or overview cards',
      'Check the navigation menu',
      'Verify user information in header'
    ],
    [
      'Dashboard loads with modern UI',
      'Navigation menu is present',
      'System statistics are displayed',
      'User email/name appears in header',
      'Page is responsive and well-styled'
    ]
  );
  
  // Test 4: Tenant Management
  await interactiveTest(
    'Tenant Management',
    'Test tenant listing and creation functionality',
    '/backoffice/tenants',
    [
      'Click on "Tenants" in the navigation menu',
      'Verify the tenant list displays',
      'Look for a "Create" or "Add Tenant" button',
      'Click the create button',
      'Check if a form appears'
    ],
    [
      'Tenant list page loads',
      'Table/list shows existing tenants',
      'Create button is visible and functional',
      'Create form has required fields (name, domain)',
      'Form includes proper validation'
    ]
  );
  
  // Test 5: Tenant Creation
  await interactiveTest(
    'Create New Tenant',
    'Test creating a new tenant with the form',
    '/backoffice/tenants',
    [
      'Go to tenant creation form',
      'Fill in tenant name: "Test Tenant ' + Date.now() + '"',
      'Fill in domain: "test-tenant-' + Date.now() + '"',
      'Add a description if field exists',
      'Submit the form'
    ],
    [
      'Form validates required fields',
      'Successful submission shows success message',
      'New tenant appears in the tenant list',
      'Form redirects to list or shows confirmation'
    ]
  );
  
  // Test 6: Merchant Management
  await interactiveTest(
    'Merchant Management',
    'Verify merchant listing and details functionality',
    '/backoffice/merchants',
    [
      'Click on "Merchants" in navigation',
      'Check if merchant list displays',
      'Look for merchant information columns',
      'If merchants exist, click on one to view details'
    ],
    [
      'Merchant list page loads',
      'Table shows merchant information',
      'Columns include name, email, phone, status',
      'Detail view works if merchants exist',
      'Search/filter options are available'
    ]
  );
  
  // Test 7: Audit Logs
  await interactiveTest(
    'Audit Logs',
    'Check audit logging functionality',
    '/backoffice/audit-logs',
    [
      'Navigate to "Audit Logs" section',
      'Look for recent login activity',
      'Check if your login appears in the logs',
      'Look for other system activities'
    ],
    [
      'Audit logs page loads',
      'Recent LOGIN activity is visible',
      'Your email appears in login logs',
      'Timestamps and IP addresses are shown',
      'Logs are properly formatted'
    ]
  );
  
  // Test 8: Settings
  await interactiveTest(
    'Settings Management',
    'Test system settings functionality',
    '/backoffice/settings',
    [
      'Go to "Settings" page',
      'Check for configuration options',
      'Look for system-wide settings',
      'Try making a small change if safe'
    ],
    [
      'Settings page loads',
      'Configuration options are displayed',
      'Form allows updates',
      'Changes can be saved',
      'Settings persist after page reload'
    ]
  );
  
  // Test 9: Navigation
  await interactiveTest(
    'Navigation Consistency',
    'Test navigation between all sections',
    null,
    [
      'Visit each main section: Dashboard, Tenants, Merchants, Audit Logs, Settings',
      'Use both navigation menu and direct URLs',
      'Check that breadcrumbs/titles update correctly',
      'Verify no 404 errors occur'
    ],
    [
      'All navigation links work',
      'Page titles update correctly',
      'No broken links or 404 errors',
      'Navigation menu highlights current page',
      'Back button works properly'
    ]
  );
  
  // Test 10: Logout
  await interactiveTest(
    'Logout Functionality',
    'Test the logout process and session cleanup',
    null,
    [
      'Find the logout link/button (usually in header)',
      'Click logout',
      'Verify redirection to login page',
      'Try accessing a protected page directly'
    ],
    [
      'Logout redirects to login page',
      'Session is properly cleared',
      'Protected pages redirect to login',
      'No user information remains visible'
    ]
  );
  
  // Test 11: Security
  await interactiveTest(
    'Security Features',
    'Test security measures and error handling',
    null,
    [
      'Try accessing /backoffice/dashboard without logging in',
      'Test with invalid login credentials',
      'Check for CSRF tokens in forms',
      'Look for security headers in browser dev tools'
    ],
    [
      'Protected routes require authentication',
      'Invalid credentials show error messages',
      'Forms include CSRF protection',
      'Appropriate security headers are present'
    ]
  );
  
  // Test 12: Responsive Design
  await interactiveTest(
    'Responsive Design',
    'Test mobile and desktop compatibility',
    null,
    [
      'Test on desktop (large screen)',
      'Test on mobile (resize browser or use dev tools)',
      'Check navigation on mobile',
      'Verify forms work on touch devices'
    ],
    [
      'Desktop layout is clean and organized',
      'Mobile layout adapts properly',
      'Navigation works on mobile',
      'Forms are touch-friendly',
      'Text is readable at all sizes'
    ]
  );
  
  // Generate final report
  await generateFinalReport();
}

/**
 * Generate final test report
 */
async function generateFinalReport() {
  log(`\n${'='⋅repeat(60)}`, 'blue');
  log('📊 FINAL TEST REPORT', 'bold');
  log(`${'='⋅repeat(60)}`, 'blue');
  
  const successRate = results.total > 0 ? Math.round((results.passed / results.completed) * 100) : 0;
  
  log(`\n📈 Summary:`, 'cyan');
  log(`   Total Tests: ${results.total}`, 'white');
  log(`   Completed: ${results.completed}`, 'white');
  log(`   Passed: ${results.passed}`, 'green');
  log(`   Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`   Success Rate: ${successRate}%`, successRate >= 90 ? 'green' : successRate >= 75 ? 'yellow' : 'red');
  
  if (results.notes.length > 0) {
    log(`\n📝 Notes and Issues:`, 'yellow');
    results.notes.forEach(note => {
      log(`   ${note}`, 'white');
    });
  }
  
  // Overall assessment
  log(`\n🎯 Overall Assessment:`, 'magenta');
  
  if (successRate >= 90) {
    log('   ✅ EXCELLENT - BackOffice system is working very well', 'green');
  } else if (successRate >= 75) {
    log('   ⚠️  GOOD - System is functional with minor issues', 'yellow');
  } else if (successRate >= 50) {
    log('   ⚠️  NEEDS WORK - Several issues need to be addressed', 'yellow');
  } else {
    log('   ❌ CRITICAL - Major issues prevent proper functionality', 'red');
  }
  
  // Recommendations
  log(`\n💡 Recommendations:`, 'cyan');
  
  if (results.failed > 0) {
    log('   • Address failed tests before production deployment', 'yellow');
  }
  
  if (results.completed < results.total) {
    log('   • Complete all tests for comprehensive coverage', 'yellow');
  }
  
  log('   • Perform load testing with multiple concurrent users', 'blue');
  log('   • Set up automated monitoring for production environment', 'blue');
  log('   • Document any configuration requirements for deployment', 'blue');
  
  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    testResults: {
      total: results.total,
      completed: results.completed,
      passed: results.passed,
      failed: results.failed,
      successRate: successRate
    },
    notes: results.notes,
    configuration: CONFIG,
    recommendation: successRate >= 75 ? 'APPROVED FOR DEPLOYMENT' : 'REQUIRES FIXES BEFORE DEPLOYMENT'
  };
  
  const fs = require('fs');
  fs.writeFileSync('backoffice-manual-test-results.json', JSON.stringify(report, null, 2));
  
  log(`\n📄 Detailed report saved to: backoffice-manual-test-results.json`, 'blue');
  log(`\n🎉 Testing complete! Thank you for your thorough testing.`, 'green');
  
  rl.close();
}

// Start the interactive testing
runManualTests().catch(error => {
  log(`\n💥 Error: ${error.message}`, 'red');
  console.error(error);
  rl.close();
  process.exit(1);
});