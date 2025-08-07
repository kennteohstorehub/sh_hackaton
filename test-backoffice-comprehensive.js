#!/usr/bin/env node

/**
 * Comprehensive BackOffice System Test Runner
 * 
 * This script runs all BackOffice-related tests and generates a detailed report
 * covering authentication, navigation, CRUD operations, and UI/UX testing
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  baseURL: 'http://admin.lvh.me:3838',
  credentials: {
    email: 'backoffice@storehubqms.local',
    password: 'BackOffice123!@#'
  },
  timeout: 60000,
  retries: 2
};

// Test suites to run
const TEST_SUITES = [
  {
    name: 'BackOffice Authentication',
    file: 'tests/e2e/backoffice-authentication.spec.js',
    description: 'Tests login, logout, session management, and security features'
  },
  {
    name: 'BackOffice Comprehensive',
    file: 'tests/e2e/backoffice-comprehensive.spec.js',
    description: 'Tests dashboard, navigation, and all main features'
  },
  {
    name: 'BackOffice Tenant Creation',
    file: 'tests/e2e/backoffice-tenant-creation.spec.js',
    description: 'Tests tenant CRUD operations and management features'
  }
];

// Results storage
let testResults = {
  startTime: new Date(),
  endTime: null,
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  skippedTests: 0,
  suiteResults: [],
  errors: [],
  warnings: []
};

/**
 * Colors for console output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Colored console output
 */
function colorLog(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Check if server is running
 */
async function checkServer() {
  colorLog('\n🔍 Checking server status...', 'yellow');
  
  try {
    const response = await fetch(`${TEST_CONFIG.baseURL}/backoffice/auth/login`);
    if (response.status === 200) {
      colorLog('✅ Server is running and accessible', 'green');
      return true;
    } else {
      colorLog(`❌ Server returned status: ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    colorLog(`❌ Server check failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Run a single test suite
 */
async function runTestSuite(suite) {
  colorLog(`\n🧪 Running: ${suite.name}`, 'cyan');
  colorLog(`📄 ${suite.description}`, 'blue');
  
  const startTime = Date.now();
  let result = {
    name: suite.name,
    file: suite.file,
    startTime: new Date(),
    endTime: null,
    duration: 0,
    status: 'running',
    passed: 0,
    failed: 0,
    skipped: 0,
    output: '',
    errors: []
  };

  try {
    // Run Playwright test
    const command = `npx playwright test "${suite.file}" --reporter=json`;
    const output = execSync(command, { 
      encoding: 'utf8',
      timeout: TEST_CONFIG.timeout 
    });
    
    // Parse JSON output if possible
    try {
      const jsonOutput = JSON.parse(output);
      result.passed = jsonOutput.stats?.passed || 0;
      result.failed = jsonOutput.stats?.failed || 0;
      result.skipped = jsonOutput.stats?.skipped || 0;
      result.status = result.failed > 0 ? 'failed' : 'passed';
    } catch (parseError) {
      // Fallback parsing
      result.output = output;
      result.status = output.includes('failed') ? 'failed' : 'passed';
    }
    
    colorLog(`✅ ${suite.name} completed`, 'green');
    
  } catch (error) {
    result.status = 'failed';
    result.errors.push(error.message);
    result.output = error.stdout || error.message;
    
    colorLog(`❌ ${suite.name} failed: ${error.message}`, 'red');
  }
  
  result.endTime = new Date();
  result.duration = Date.now() - startTime;
  
  return result;
}

/**
 * Manual test verification
 */
async function runManualTests() {
  colorLog('\n🔍 Manual Test Verification', 'magenta');
  colorLog('Please verify the following manually:', 'yellow');
  
  const manualTests = [
    {
      test: 'Login Page Access',
      url: `${TEST_CONFIG.baseURL}/backoffice/auth/login`,
      check: 'Page loads with login form'
    },
    {
      test: 'Dashboard Access (after login)',
      url: `${TEST_CONFIG.baseURL}/backoffice/dashboard`,
      check: 'Modern UI dashboard with navigation'
    },
    {
      test: 'Tenants Page',
      url: `${TEST_CONFIG.baseURL}/backoffice/tenants`,
      check: 'Tenant list with create/edit functionality'
    },
    {
      test: 'Merchants Page',
      url: `${TEST_CONFIG.baseURL}/backoffice/merchants`,
      check: 'Merchant list and details'
    },
    {
      test: 'Audit Logs',
      url: `${TEST_CONFIG.baseURL}/backoffice/audit-logs`,
      check: 'Activity logs with filtering'
    },
    {
      test: 'Settings Page',
      url: `${TEST_CONFIG.baseURL}/backoffice/settings`,
      check: 'System configuration options'
    }
  ];

  for (const test of manualTests) {
    colorLog(`\n📋 ${test.test}`, 'cyan');
    colorLog(`🔗 URL: ${test.url}`, 'blue');
    colorLog(`✓ Check: ${test.check}`, 'yellow');
  }
  
  colorLog('\n🔐 Test Login Credentials:', 'magenta');
  colorLog(`📧 Email: ${TEST_CONFIG.credentials.email}`, 'blue');
  colorLog(`🔑 Password: ${TEST_CONFIG.credentials.password}`, 'blue');
}

/**
 * Generate comprehensive test report
 */
function generateReport() {
  colorLog('\n📊 Generating Test Report...', 'cyan');
  
  testResults.endTime = new Date();
  testResults.totalDuration = testResults.endTime - testResults.startTime;
  
  // Calculate totals
  testResults.suiteResults.forEach(suite => {
    testResults.totalTests += (suite.passed + suite.failed + suite.skipped);
    testResults.passedTests += suite.passed;
    testResults.failedTests += suite.failed;
    testResults.skippedTests += suite.skipped;
  });
  
  const report = {
    title: 'BackOffice System - Comprehensive Test Report',
    timestamp: new Date().toISOString(),
    summary: {
      totalSuites: testResults.suiteResults.length,
      totalTests: testResults.totalTests,
      passed: testResults.passedTests,
      failed: testResults.failedTests,
      skipped: testResults.skippedTests,
      successRate: testResults.totalTests > 0 
        ? Math.round((testResults.passedTests / testResults.totalTests) * 100) 
        : 0,
      duration: testResults.totalDuration
    },
    configuration: {
      baseURL: TEST_CONFIG.baseURL,
      timeout: TEST_CONFIG.timeout,
      retries: TEST_CONFIG.retries
    },
    testSuites: testResults.suiteResults,
    manualVerification: [
      {
        category: 'Authentication',
        items: [
          'Login form displays correctly with CSRF protection',
          'Valid credentials redirect to dashboard with success message',
          'Invalid credentials show appropriate error messages',
          'Session maintains across page reloads and navigation',
          'Logout clears session and redirects to login'
        ]
      },
      {
        category: 'Navigation',
        items: [
          'All navigation links work without 404 errors',
          'Dashboard displays modern UI with system statistics',
          'Breadcrumbs and page titles are correct',
          'Responsive design works on mobile and desktop'
        ]
      },
      {
        category: 'Tenant Management',
        items: [
          'Tenant list displays with pagination and search',
          'Create tenant form validates required fields',
          'New tenant creation works end-to-end',
          'Edit tenant functionality preserves data',
          'Tenant status changes are reflected immediately'
        ]
      },
      {
        category: 'Merchant Management',
        items: [
          'Merchant list shows all active merchants',
          'Merchant details page displays complete information',
          'Merchant search and filtering work correctly'
        ]
      },
      {
        category: 'Audit Logs',
        items: [
          'All user actions are logged with timestamps',
          'Login/logout activities are recorded',
          'Audit log filtering and search work',
          'Log entries show user, action, and IP address'
        ]
      },
      {
        category: 'Settings',
        items: [
          'Settings page loads with current configuration',
          'System settings can be updated',
          'Changes are persisted across sessions'
        ]
      }
    ],
    recommendations: [],
    criticalIssues: []
  };
  
  // Add recommendations based on results
  if (testResults.failedTests > 0) {
    report.recommendations.push('Review failed tests and fix underlying issues');
  }
  
  if (testResults.successRate < 90) {
    report.recommendations.push('Improve test stability - success rate is below 90%');
  }
  
  // Save report to file
  const reportPath = path.join(__dirname, 'backoffice-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Display summary
  colorLog('\n📈 TEST SUMMARY', 'bright');
  colorLog('═'.repeat(50), 'blue');
  colorLog(`Total Suites: ${report.summary.totalSuites}`, 'cyan');
  colorLog(`Total Tests: ${report.summary.totalTests}`, 'cyan');
  colorLog(`Passed: ${report.summary.passed}`, 'green');
  colorLog(`Failed: ${report.summary.failed}`, report.summary.failed > 0 ? 'red' : 'green');
  colorLog(`Skipped: ${report.summary.skipped}`, 'yellow');
  colorLog(`Success Rate: ${report.summary.successRate}%`, 
    report.summary.successRate >= 90 ? 'green' : 'yellow');
  colorLog(`Duration: ${Math.round(report.summary.duration / 1000)}s`, 'cyan');
  colorLog('═'.repeat(50), 'blue');
  
  // Show suite details
  colorLog('\n📋 SUITE RESULTS', 'bright');
  testResults.suiteResults.forEach(suite => {
    const status = suite.status === 'passed' ? '✅' : suite.status === 'failed' ? '❌' : '⏸️';
    const color = suite.status === 'passed' ? 'green' : suite.status === 'failed' ? 'red' : 'yellow';
    
    colorLog(`${status} ${suite.name} (${Math.round(suite.duration / 1000)}s)`, color);
    if (suite.passed > 0) colorLog(`   ✓ ${suite.passed} passed`, 'green');
    if (suite.failed > 0) colorLog(`   ✗ ${suite.failed} failed`, 'red');
    if (suite.skipped > 0) colorLog(`   ⏸ ${suite.skipped} skipped`, 'yellow');
  });
  
  colorLog(`\n📄 Full report saved to: ${reportPath}`, 'blue');
  
  return report;
}

/**
 * Main execution function
 */
async function main() {
  colorLog('🚀 BackOffice System - Comprehensive Test Suite', 'bright');
  colorLog('=' .repeat(60), 'blue');
  
  // Check server availability
  const serverRunning = await checkServer();
  if (!serverRunning) {
    colorLog('\n❌ Server is not accessible. Please ensure the server is running on port 3838', 'red');
    colorLog('Run: npm start or ./quick-start.sh', 'yellow');
    process.exit(1);
  }
  
  // Run automated tests
  colorLog('\n🤖 Running Automated Tests...', 'bright');
  
  for (const suite of TEST_SUITES) {
    const result = await runTestSuite(suite);
    testResults.suiteResults.push(result);
  }
  
  // Run manual verification
  await runManualTests();
  
  // Generate report
  const report = generateReport();
  
  // Exit with appropriate code
  const exitCode = testResults.failedTests > 0 ? 1 : 0;
  
  if (exitCode === 0) {
    colorLog('\n🎉 All tests completed successfully!', 'green');
  } else {
    colorLog('\n⚠️  Some tests failed. Please review the report.', 'yellow');
  }
  
  colorLog('\n📝 Next Steps:', 'cyan');
  colorLog('1. Review the generated test report', 'blue');
  colorLog('2. Manually verify the items listed above', 'blue');
  colorLog('3. Fix any identified issues', 'blue');
  colorLog('4. Re-run tests to verify fixes', 'blue');
  
  process.exit(exitCode);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    colorLog(`\n💥 Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  runTestSuite,
  generateReport,
  checkServer,
  TEST_CONFIG
};