#!/usr/bin/env node

/**
 * StoreHub Queue Management System - Authentication Performance Testing
 * 
 * This script runs comprehensive performance tests on the authentication system
 * to identify bottlenecks and optimization opportunities.
 * 
 * Test Scenarios:
 * 1. Single user baseline performance
 * 2. Concurrent login stress testing (10, 50, 100 users)
 * 3. Session creation/lookup overhead
 * 4. Database query performance
 * 5. Memory usage patterns
 */

const autocannon = require('autocannon');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3838';
const RESULTS_DIR = path.join(__dirname, 'performance-results');
const TEST_USERS = [];

// Test user credentials
const TEST_USER_BASE = {
  email: 'perftest@example.com',
  password: 'TestPassword123!',
  businessName: 'Performance Test Business',
  phone: '+1234567890',
  businessType: 'restaurant'
};

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Colors for console output
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

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Helper to get CSRF token
async function getCSRFToken() {
  try {
    const response = await axios.get(`${BASE_URL}/auth/login`, {
      withCredentials: true,
      headers: {
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    
    // Extract CSRF token from HTML
    const csrfMatch = response.data.match(/name="_csrf"\s+value="([^"]+)"/);
    if (csrfMatch) {
      return {
        token: csrfMatch[1],
        cookie: response.headers['set-cookie']
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to get CSRF token:', error.message);
    return null;
  }
}

// Create test users
async function createTestUsers(count) {
  log(`\\nCreating ${count} test users...`, 'cyan');
  
  for (let i = 0; i < count; i++) {
    const user = {
      email: `perftest${i}@example.com`,
      password: 'TestPassword123!',
      businessName: `Performance Test Business ${i}`,
      phone: `+123456789${i}`,
      businessType: 'restaurant'
    };
    
    try {
      const csrf = await getCSRFToken();
      if (!csrf) {
        log(`Failed to get CSRF token for user ${i}`, 'red');
        continue;
      }
      
      await axios.post(`${BASE_URL}/auth/register`, {
        ...user,
        _csrf: csrf.token
      }, {
        headers: {
          'Cookie': csrf.cookie,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 400
      });
      
      TEST_USERS.push(user);
    } catch (error) {
      if (error.response?.status === 302) {
        TEST_USERS.push(user); // Registration successful (redirect)
      } else {
        log(`Failed to create user ${i}: ${error.message}`, 'yellow');
      }
    }
  }
  
  log(`Created ${TEST_USERS.length} test users`, 'green');
}

// Performance test configurations
const testScenarios = [
  {
    name: 'Single User Baseline',
    connections: 1,
    duration: 10,
    amount: 10,
    description: 'Baseline performance with single user sequential requests'
  },
  {
    name: 'Light Load (10 concurrent)',
    connections: 10,
    duration: 30,
    description: 'Light concurrent load to test basic scaling'
  },
  {
    name: 'Medium Load (50 concurrent)',
    connections: 50,
    duration: 30,
    description: 'Medium concurrent load typical for busy periods'
  },
  {
    name: 'Heavy Load (100 concurrent)',
    connections: 100,
    duration: 30,
    description: 'Heavy concurrent load to identify bottlenecks'
  },
  {
    name: 'Spike Test',
    connections: 200,
    duration: 10,
    description: 'Sudden spike to test system resilience'
  }
];

// Run autocannon test
async function runLoadTest(scenario, endpoint, method = 'POST', setupRequest) {
  log(`\\n${'='.repeat(60)}`, 'bright');
  log(`Running: ${scenario.name}`, 'bright');
  log(scenario.description, 'cyan');
  log('='.repeat(60), 'bright');
  
  const startMemory = process.memoryUsage();
  const startTime = performance.now();
  
  return new Promise((resolve) => {
    const instance = autocannon({
      url: `${BASE_URL}${endpoint}`,
      connections: scenario.connections,
      duration: scenario.duration,
      amount: scenario.amount,
      method: method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      setupRequest: setupRequest,
      // Request timeout
      timeout: 10,
      // Pipeline requests
      pipelining: 1
    }, (err, result) => {
      if (err) {
        log(`Test failed: ${err.message}`, 'red');
        resolve(null);
        return;
      }
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      // Calculate memory delta
      const memoryDelta = {
        heapUsed: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,
        external: (endMemory.external - startMemory.external) / 1024 / 1024,
        rss: (endMemory.rss - startMemory.rss) / 1024 / 1024
      };
      
      // Enhanced results
      const enhancedResult = {
        ...result,
        scenario: scenario.name,
        testDuration: (endTime - startTime) / 1000,
        memoryDelta,
        timestamp: new Date().toISOString()
      };
      
      // Display results
      displayResults(enhancedResult);
      
      // Save results
      saveResults(scenario.name, enhancedResult);
      
      resolve(enhancedResult);
    });
    
    // Show progress
    autocannon.track(instance, {
      renderProgressBar: true,
      renderResultsTable: false
    });
  });
}

// Display test results
function displayResults(result) {
  log(`\\nResults:`, 'green');
  log(`├─ Requests: ${result.requests.total} total, ${result.requests.sent} sent`, 'cyan');
  log(`├─ Throughput: ${result.throughput.average} req/sec (avg)`, 'cyan');
  log(`├─ Latency (avg): ${result.latency.mean}ms`, 'cyan');
  log(`├─ Latency (p50): ${result.latency.p50}ms`, 'cyan');
  log(`├─ Latency (p95): ${result.latency.p95}ms`, 'cyan');
  log(`├─ Latency (p99): ${result.latency.p99}ms`, 'cyan');
  log(`├─ Errors: ${result.errors} (${((result.errors / result.requests.total) * 100).toFixed(2)}%)`, result.errors > 0 ? 'red' : 'green');
  log(`├─ Timeouts: ${result.timeouts}`, result.timeouts > 0 ? 'yellow' : 'green');
  log(`└─ Memory Delta: +${result.memoryDelta.heapUsed.toFixed(2)}MB heap, +${result.memoryDelta.rss.toFixed(2)}MB RSS`, 'magenta');
}

// Save results to file
function saveResults(testName, results) {
  const filename = `${testName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`;
  const filepath = path.join(RESULTS_DIR, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
  log(`\\nResults saved to: ${filepath}`, 'green');
}

// Test login endpoint
async function testLogin() {
  log('\\n### TESTING LOGIN ENDPOINT ###', 'bright');
  
  for (const scenario of testScenarios) {
    if (TEST_USERS.length === 0) {
      log('No test users available, skipping login tests', 'yellow');
      break;
    }
    
    let userIndex = 0;
    
    await runLoadTest(scenario, '/auth/login', 'POST', async (req, cb) => {
      try {
        // Get CSRF token for this request
        const csrf = await getCSRFToken();
        if (!csrf) {
          cb(new Error('Failed to get CSRF token'));
          return;
        }
        
        // Rotate through test users
        const user = TEST_USERS[userIndex % TEST_USERS.length];
        userIndex++;
        
        // Setup request with form data
        const formData = `email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(user.password)}&_csrf=${encodeURIComponent(csrf.token)}`;
        
        req.headers = {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': csrf.cookie,
          'Content-Length': Buffer.byteLength(formData)
        };
        
        req.body = formData;
        
        cb();
      } catch (error) {
        cb(error);
      }
    });
    
    // Cool down between tests
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// Test session lookup performance
async function testSessionLookup() {
  log('\\n### TESTING SESSION LOOKUP (Dashboard Access) ###', 'bright');
  
  // First, login to get a valid session
  try {
    const csrf = await getCSRFToken();
    if (!csrf || TEST_USERS.length === 0) {
      log('Cannot test session lookup without valid session', 'yellow');
      return;
    }
    
    // Login with first test user
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_USERS[0].email,
      password: TEST_USERS[0].password,
      _csrf: csrf.token
    }, {
      headers: {
        'Cookie': csrf.cookie,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      maxRedirects: 0,
      validateStatus: (status) => status === 302
    });
    
    const sessionCookie = loginResponse.headers['set-cookie'];
    
    // Test dashboard access with valid session
    const dashboardScenarios = testScenarios.slice(0, 3); // Use only first 3 scenarios
    
    for (const scenario of dashboardScenarios) {
      await runLoadTest(scenario, '/dashboard', 'GET', (req, cb) => {
        req.headers = {
          'Cookie': sessionCookie
        };
        cb();
      });
      
      // Cool down
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch (error) {
    log(`Session lookup test failed: ${error.message}`, 'red');
  }
}

// Test registration endpoint
async function testRegistration() {
  log('\\n### TESTING REGISTRATION ENDPOINT ###', 'bright');
  
  const registrationScenarios = testScenarios.slice(0, 2); // Only light load for registration
  
  for (const scenario of registrationScenarios) {
    let userIndex = 1000; // Start from high number to avoid conflicts
    
    await runLoadTest(scenario, '/auth/register', 'POST', async (req, cb) => {
      try {
        const csrf = await getCSRFToken();
        if (!csrf) {
          cb(new Error('Failed to get CSRF token'));
          return;
        }
        
        const newUser = {
          email: `perftest-reg-${Date.now()}-${userIndex++}@example.com`,
          password: 'TestPassword123!',
          businessName: `Perf Test Business ${userIndex}`,
          phone: `+1234567${userIndex}`,
          businessType: 'restaurant',
          _csrf: csrf.token
        };
        
        const formData = Object.entries(newUser)
          .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
          .join('&');
        
        req.headers = {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': csrf.cookie,
          'Content-Length': Buffer.byteLength(formData)
        };
        
        req.body = formData;
        
        cb();
      } catch (error) {
        cb(error);
      }
    });
    
    // Cool down
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// Analyze and generate report
function generateReport(allResults) {
  log('\\n### PERFORMANCE ANALYSIS REPORT ###', 'bright');
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: allResults.length,
      avgLatency: {},
      throughput: {},
      errors: {},
      recommendations: []
    },
    details: allResults
  };
  
  // Analyze results
  allResults.forEach(result => {
    if (!result) return;
    
    report.summary.avgLatency[result.scenario] = result.latency.mean;
    report.summary.throughput[result.scenario] = result.throughput.average;
    report.summary.errors[result.scenario] = result.errors;
  });
  
  // Generate recommendations
  const recommendations = [];
  
  // Check for high latency
  const highLatencyTests = allResults.filter(r => r && r.latency.p95 > 500);
  if (highLatencyTests.length > 0) {
    recommendations.push({
      severity: 'HIGH',
      issue: 'High latency detected',
      details: `${highLatencyTests.length} tests showed p95 latency > 500ms`,
      suggestions: [
        'Implement connection pooling for database',
        'Add Redis for session caching',
        'Optimize bcrypt rounds (currently 10)',
        'Index database queries on email field'
      ]
    });
  }
  
  // Check for errors
  const errorTests = allResults.filter(r => r && r.errors > 0);
  if (errorTests.length > 0) {
    recommendations.push({
      severity: 'MEDIUM',
      issue: 'Errors under load',
      details: `${errorTests.length} tests had errors`,
      suggestions: [
        'Increase connection pool size',
        'Implement request queuing',
        'Add circuit breaker pattern',
        'Review rate limiting configuration'
      ]
    });
  }
  
  // Check memory usage
  const highMemoryTests = allResults.filter(r => r && r.memoryDelta.heapUsed > 50);
  if (highMemoryTests.length > 0) {
    recommendations.push({
      severity: 'MEDIUM',
      issue: 'High memory consumption',
      details: `Memory increased by >50MB in ${highMemoryTests.length} tests`,
      suggestions: [
        'Investigate memory leaks in session handling',
        'Implement session cleanup',
        'Review object pooling strategies',
        'Consider memory-efficient data structures'
      ]
    });
  }
  
  report.summary.recommendations = recommendations;
  
  // Display recommendations
  log('\\n## RECOMMENDATIONS ##', 'yellow');
  recommendations.forEach((rec, index) => {
    log(`\\n${index + 1}. [${rec.severity}] ${rec.issue}`, rec.severity === 'HIGH' ? 'red' : 'yellow');
    log(`   Details: ${rec.details}`, 'cyan');
    log('   Suggestions:', 'green');
    rec.suggestions.forEach(suggestion => {
      log(`   - ${suggestion}`, 'green');
    });
  });
  
  // Save full report
  const reportPath = path.join(RESULTS_DIR, `full-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`\\nFull report saved to: ${reportPath}`, 'green');
  
  return report;
}

// Main test runner
async function main() {
  log('StoreHub Queue Management - Authentication Performance Testing', 'bright');
  log('='.repeat(60), 'bright');
  
  const allResults = [];
  
  try {
    // Check if server is running
    try {
      await axios.get(`${BASE_URL}/api/health`);
      log('✓ Server is running', 'green');
    } catch (error) {
      log('✗ Server is not running. Please start the server first.', 'red');
      process.exit(1);
    }
    
    // Create test users
    await createTestUsers(10);
    
    // Run tests
    const loginResults = await testLogin();
    if (loginResults) allResults.push(...loginResults);
    
    await testSessionLookup();
    
    await testRegistration();
    
    // Generate report
    generateReport(allResults.filter(r => r !== null));
    
    log('\\n✓ All tests completed!', 'green');
    
  } catch (error) {
    log(`\\nTest suite failed: ${error.message}`, 'red');
    console.error(error);
  }
}

// Check if autocannon is installed
try {
  require.resolve('autocannon');
} catch (e) {
  log('autocannon is not installed. Installing...', 'yellow');
  const { execSync } = require('child_process');
  execSync('npm install autocannon', { stdio: 'inherit' });
}

// Run tests
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runLoadTest, testScenarios };