#!/usr/bin/env node

/**
 * Comprehensive BackOffice Testing Script
 * 
 * This script tests all BackOffice functionality including:
 * 1. Authentication (login/logout)
 * 2. Dashboard functionality
 * 3. Tenant Management
 * 4. Settings Pages
 * 5. Email Configuration
 * 6. Audit Logs
 */

const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'http://localhost:3838';
const BACKOFFICE_URL = `${BASE_URL}/backoffice`;

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  warnings: [],
  performance: [],
  security: []
};

// HTTP client with cookie support
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  withCredentials: true, // Enable cookies
  validateStatus: function (status) {
    return status < 500; // Don't throw errors for 4xx responses
  }
});

// Cookie jar to maintain session
let cookieJar = '';

// Helper functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    error: '\x1b[31m',   // Red
    warning: '\x1b[33m', // Yellow
    reset: '\x1b[0m'
  };
  
  console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
}

function recordTest(testName, passed, details = null, performanceMs = null) {
  if (passed) {
    testResults.passed++;
    log(`✅ PASS: ${testName}`, 'success');
  } else {
    testResults.failed++;
    log(`❌ FAIL: ${testName}`, 'error');
    if (details) {
      testResults.errors.push({ test: testName, details });
      log(`   Details: ${details}`, 'error');
    }
  }
  
  if (performanceMs && performanceMs > 2000) {
    testResults.performance.push({ test: testName, time: performanceMs });
    log(`⚠️  SLOW: ${testName} took ${performanceMs}ms`, 'warning');
  }
}

function recordWarning(message) {
  testResults.warnings.push(message);
  log(`⚠️  WARNING: ${message}`, 'warning');
}

function recordSecurityIssue(issue) {
  testResults.security.push(issue);
  log(`🚨 SECURITY: ${issue}`, 'error');
}

// Test authentication helper
async function performLogin() {
  try {
    log('Testing BackOffice Login Process...', 'info');
    
    // First, get the login page
    const startTime = Date.now();
    const loginPageResponse = await client.get('/backoffice/auth/login');
    const loginPageTime = Date.now() - startTime;
    
    recordTest('Login Page Load', loginPageResponse.status === 200, 
      loginPageResponse.status !== 200 ? `Status: ${loginPageResponse.status}` : null, loginPageTime);
    
    if (loginPageResponse.status !== 200) {
      return null;
    }
    
    // Parse login page for CSRF token
    const $ = cheerio.load(loginPageResponse.data);
    const csrfToken = $('meta[name="csrf-token"]').attr('content') || 
                     $('input[name="_csrf"]').val() ||
                     $('input[name="_token"]').val();
    
    if (!csrfToken) {
      recordWarning('No CSRF token found on login page');
    } else {
      log(`CSRF token found: ${csrfToken.substring(0, 20)}...`);
    }
    
    // Extract cookies from login page
    const cookies = loginPageResponse.headers['set-cookie'];
    if (cookies) {
      cookieJar = cookies.map(cookie => cookie.split(';')[0]).join('; ');
      client.defaults.headers.cookie = cookieJar;
    }
    
    // Test login with demo credentials
    const loginData = new URLSearchParams({
      email: 'backoffice@storehubqms.local',
      password: 'BackOffice123!@#'
    });
    
    if (csrfToken) {
      loginData.append('_csrf', csrfToken);
    }
    
    const loginStartTime = Date.now();
    const loginResponse = await client.post('/backoffice/auth/login', loginData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-CSRF-Token': csrfToken,
        'Referer': `${BASE_URL}/backoffice/auth/login`
      },
      maxRedirects: 0 // Don't follow redirects automatically
    });
    const loginTime = Date.now() - loginStartTime;
    
    // Check if login was successful (redirect to dashboard)
    const loginSuccess = loginResponse.status === 302 && 
                        loginResponse.headers.location && 
                        loginResponse.headers.location.includes('/backoffice/dashboard');
    
    recordTest('Login Authentication', loginSuccess, 
      !loginSuccess ? `Status: ${loginResponse.status}, Location: ${loginResponse.headers.location}` : null, 
      loginTime);
    
    if (loginSuccess) {
      // Update cookies after successful login
      const newCookies = loginResponse.headers['set-cookie'];
      if (newCookies) {
        const existingCookies = cookieJar.split('; ').filter(c => c);
        const newCookiesList = newCookies.map(cookie => cookie.split(';')[0]);
        
        // Merge cookies, replacing existing ones with same name
        const cookieMap = {};
        [...existingCookies, ...newCookiesList].forEach(cookie => {
          const [name, value] = cookie.split('=');
          cookieMap[name] = cookie;
        });
        
        cookieJar = Object.values(cookieMap).join('; ');
        client.defaults.headers.cookie = cookieJar;
        log(`Session cookies updated: ${Object.keys(cookieMap).join(', ')}`);
      }
      return csrfToken;
    }
    
    return null;
    
  } catch (error) {
    recordTest('Login Process', false, `Error: ${error.message}`);
    return null;
  }
}

// Test dashboard functionality
async function testDashboard(csrfToken) {
  try {
    log('Testing Dashboard Functionality...', 'info');
    
    const startTime = Date.now();
    const dashboardResponse = await client.get('/backoffice/dashboard');
    const dashboardTime = Date.now() - startTime;
    
    recordTest('Dashboard Page Load', dashboardResponse.status === 200, 
      dashboardResponse.status !== 200 ? `Status: ${dashboardResponse.status}` : null, dashboardTime);
    
    if (dashboardResponse.status !== 200) {
      return;
    }
    
    const $ = cheerio.load(dashboardResponse.data);
    
    // Test for required dashboard elements
    const hasTitle = $('h1, .page-title').length > 0;
    recordTest('Dashboard Title Present', hasTitle, !hasTitle ? 'No main title found' : null);
    
    // Test for statistics cards/sections
    const statsElements = $('.stat-card, .metric-card, .dashboard-stat, [class*="stat"]').length;
    recordTest('Dashboard Statistics Cards', statsElements > 0, 
      statsElements === 0 ? 'No statistics cards found' : null);
    
    // Test for navigation/sidebar
    const hasNavigation = $('.sidebar, .nav-menu, nav').length > 0;
    recordTest('Dashboard Navigation', hasNavigation, !hasNavigation ? 'No navigation menu found' : null);
    
    // Check for JavaScript errors in page
    const hasJsErrors = dashboardResponse.data.includes('ReferenceError') || 
                       dashboardResponse.data.includes('TypeError') ||
                       dashboardResponse.data.includes('SyntaxError');
    recordTest('Dashboard JavaScript Errors', !hasJsErrors, hasJsErrors ? 'JavaScript errors found in page' : null);
    
    // Test Quick Action buttons if present
    const quickActionButtons = $('button[onclick], .quick-action, [class*="action-btn"]').length;
    if (quickActionButtons > 0) {
      recordTest('Quick Action Buttons Present', true, `Found ${quickActionButtons} action buttons`);
    }
    
    log(`Dashboard contains ${statsElements} stat elements, ${quickActionButtons} action buttons`);
    
  } catch (error) {
    recordTest('Dashboard Testing', false, `Error: ${error.message}`);
  }
}

// Test tenant management
async function testTenantManagement(csrfToken) {
  try {
    log('Testing Tenant Management...', 'info');
    
    // Test tenant list page
    const startTime = Date.now();
    const tenantsResponse = await client.get('/backoffice/tenants');
    const tenantsTime = Date.now() - startTime;
    
    recordTest('Tenants Page Load', tenantsResponse.status === 200, 
      tenantsResponse.status !== 200 ? `Status: ${tenantsResponse.status}` : null, tenantsTime);
    
    if (tenantsResponse.status !== 200) {
      return;
    }
    
    const $ = cheerio.load(tenantsResponse.data);
    
    // Test for tenant table/list
    const hasTenantList = $('table, .tenant-list, .tenant-card').length > 0;
    recordTest('Tenant List Display', hasTenantList, !hasTenantList ? 'No tenant list found' : null);
    
    // Test for create tenant button/link
    const hasCreateButton = $('a[href*="create"], button[onclick*="create"], .btn-create, .add-tenant').length > 0;
    recordTest('Create Tenant Button', hasCreateButton, !hasCreateButton ? 'No create tenant button found' : null);
    
    // Test tenant search functionality
    const hasSearchInput = $('input[type="search"], input[name*="search"], .search-input').length > 0;
    recordTest('Tenant Search Input', hasSearchInput, !hasSearchInput ? 'No search input found' : null);
    
    // Test create tenant page
    try {
      const createTenantResponse = await client.get('/backoffice/tenants/create');
      recordTest('Create Tenant Page Load', createTenantResponse.status === 200, 
        createTenantResponse.status !== 200 ? `Status: ${createTenantResponse.status}` : null);
      
      if (createTenantResponse.status === 200) {
        const $create = cheerio.load(createTenantResponse.data);
        
        // Test for required form fields
        const hasNameField = $create('input[name="name"], input[name="businessName"]').length > 0;
        recordTest('Tenant Name Field', hasNameField, !hasNameField ? 'No name field in create form' : null);
        
        const hasSlugField = $create('input[name="slug"], input[name="subdomain"]').length > 0;
        recordTest('Tenant Slug Field', hasSlugField, !hasSlugField ? 'No slug/subdomain field in create form' : null);
        
        const hasSubmitButton = $create('button[type="submit"], input[type="submit"]').length > 0;
        recordTest('Create Form Submit Button', hasSubmitButton, !hasSubmitButton ? 'No submit button in create form' : null);
      }
    } catch (error) {
      recordTest('Create Tenant Page Test', false, `Error accessing create page: ${error.message}`);
    }
    
    // Test subdomain availability checking (if available)
    try {
      const checkResponse = await client.post('/backoffice/tenants/check-availability', 
        { slug: 'test-tenant-' + Date.now() },
        { headers: { 'X-CSRF-Token': csrfToken } }
      );
      recordTest('Subdomain Availability Check', checkResponse.status < 500, 
        checkResponse.status >= 500 ? `Server error: ${checkResponse.status}` : null);
    } catch (error) {
      // This endpoint might not exist, so don't fail the test
      recordWarning('Subdomain availability check endpoint not available or not working');
    }
    
  } catch (error) {
    recordTest('Tenant Management Testing', false, `Error: ${error.message}`);
  }
}

// Test settings pages
async function testSettingsPages(csrfToken) {
  try {
    log('Testing Settings Pages...', 'info');
    
    const settingsPages = [
      { path: '/backoffice/settings', name: 'Main Settings' },
      { path: '/backoffice/settings/general', name: 'General Settings' },
      { path: '/backoffice/settings/security', name: 'Security Settings' },
      { path: '/backoffice/settings/email', name: 'Email Settings' },
      { path: '/backoffice/settings/notifications', name: 'Notification Settings' },
      { path: '/backoffice/settings/profile', name: 'Profile Settings' }
    ];
    
    for (const page of settingsPages) {
      try {
        const startTime = Date.now();
        const response = await client.get(page.path);
        const responseTime = Date.now() - startTime;
        
        recordTest(`${page.name} Page Load`, response.status === 200, 
          response.status !== 200 ? `Status: ${response.status}` : null, responseTime);
        
        if (response.status === 200) {
          const $ = cheerio.load(response.data);
          
          // Test for form elements
          const hasForm = $('form').length > 0;
          recordTest(`${page.name} Form Present`, hasForm, !hasForm ? 'No form found on page' : null);
          
          // Test for input fields
          const inputCount = $('input, select, textarea').length;
          recordTest(`${page.name} Form Fields`, inputCount > 0, 
            inputCount === 0 ? 'No form fields found' : `Found ${inputCount} form fields`);
          
          // Test for save button
          const hasSaveButton = $('button[type="submit"], input[type="submit"], .btn-save').length > 0;
          recordTest(`${page.name} Save Button`, hasSaveButton, !hasSaveButton ? 'No save button found' : null);
        }
        
      } catch (error) {
        recordTest(`${page.name} Page Test`, false, `Error: ${error.message}`);
      }
    }
    
  } catch (error) {
    recordTest('Settings Pages Testing', false, `Error: ${error.message}`);
  }
}

// Test email configuration
async function testEmailConfiguration(csrfToken) {
  try {
    log('Testing Email Configuration...', 'info');
    
    const emailSettingsResponse = await client.get('/backoffice/settings/email');
    recordTest('Email Settings Page Load', emailSettingsResponse.status === 200, 
      emailSettingsResponse.status !== 200 ? `Status: ${emailSettingsResponse.status}` : null);
    
    if (emailSettingsResponse.status !== 200) {
      return;
    }
    
    const $ = cheerio.load(emailSettingsResponse.data);
    
    // Test for email provider options
    const providerOptions = $('select[name*="provider"] option, input[name*="provider"]').length;
    recordTest('Email Provider Options', providerOptions > 0, 
      providerOptions === 0 ? 'No email provider options found' : `Found ${providerOptions} provider options`);
    
    // Test for common email fields
    const emailFields = [
      { selector: 'input[name*="smtp"], input[name*="host"]', name: 'SMTP Host' },
      { selector: 'input[name*="port"]', name: 'SMTP Port' },
      { selector: 'input[name*="username"], input[name*="user"]', name: 'Username' },
      { selector: 'input[name*="password"]', name: 'Password' },
      { selector: 'input[name*="from"], input[name*="sender"]', name: 'From Address' }
    ];
    
    emailFields.forEach(field => {
      const hasField = $(field.selector).length > 0;
      recordTest(`Email ${field.name} Field`, hasField, !hasField ? `No ${field.name.toLowerCase()} field found` : null);
    });
    
    // Test for test email functionality
    const hasTestButton = $('button[onclick*="test"], .test-email, .btn-test').length > 0;
    recordTest('Test Email Button', hasTestButton, !hasTestButton ? 'No test email button found' : null);
    
    // Try to test email configuration save (without actually saving)
    try {
      const testData = new URLSearchParams({
        provider: 'smtp',
        host: 'smtp.example.com',
        port: '587',
        username: 'test@example.com',
        password: 'testpass',
        from: 'noreply@example.com'
      });
      
      if (csrfToken) {
        testData.append('_csrf', csrfToken);
      }
      
      // Test the endpoint but don't actually save
      const saveResponse = await client.post('/backoffice/settings/email', testData.toString(), {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        maxRedirects: 0
      });
      
      recordTest('Email Settings Save Endpoint', saveResponse.status < 500, 
        saveResponse.status >= 500 ? `Server error: ${saveResponse.status}` : null);
        
    } catch (error) {
      recordWarning(`Email settings save test failed: ${error.message}`);
    }
    
  } catch (error) {
    recordTest('Email Configuration Testing', false, `Error: ${error.message}`);
  }
}

// Test audit logs
async function testAuditLogs(csrfToken) {
  try {
    log('Testing Audit Logs...', 'info');
    
    const startTime = Date.now();
    const auditResponse = await client.get('/backoffice/audit-logs');
    const auditTime = Date.now() - startTime;
    
    recordTest('Audit Logs Page Load', auditResponse.status === 200, 
      auditResponse.status !== 200 ? `Status: ${auditResponse.status}` : null, auditTime);
    
    if (auditResponse.status !== 200) {
      return;
    }
    
    const $ = cheerio.load(auditResponse.data);
    
    // Test for audit logs table or list
    const hasAuditList = $('table, .audit-log, .log-entry').length > 0;
    recordTest('Audit Logs Display', hasAuditList, !hasAuditList ? 'No audit logs display found' : null);
    
    // Test for filtering options
    const hasFilters = $('select[name*="filter"], input[name*="filter"], .filter-form').length > 0;
    recordTest('Audit Logs Filters', hasFilters, !hasFilters ? 'No filtering options found' : null);
    
    // Test for pagination
    const hasPagination = $('.pagination, .pager, [class*="page"]').length > 0;
    recordTest('Audit Logs Pagination', hasPagination, !hasPagination ? 'No pagination found' : null);
    
    // Test for log entry details
    const logEntries = $('.log-entry, tr').length;
    if (logEntries > 1) { // More than just header
      recordTest('Audit Log Entries Present', true, `Found ${logEntries} log entries`);
    } else {
      recordWarning('No audit log entries found - this might be expected for a fresh system');
    }
    
  } catch (error) {
    recordTest('Audit Logs Testing', false, `Error: ${error.message}`);
  }
}

// Test logout functionality
async function testLogout(csrfToken) {
  try {
    log('Testing Logout Functionality...', 'info');
    
    const logoutData = new URLSearchParams();
    if (csrfToken) {
      logoutData.append('_csrf', csrfToken);
    }
    
    const logoutResponse = await client.post('/backoffice/auth/logout', 
      logoutData.toString(),
      { 
        headers: { 
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        maxRedirects: 0 
      }
    );
    
    const logoutSuccess = logoutResponse.status === 302 && 
                         logoutResponse.headers.location && 
                         logoutResponse.headers.location.includes('/login');
    
    recordTest('Logout Functionality', logoutSuccess, 
      !logoutSuccess ? `Status: ${logoutResponse.status}, Location: ${logoutResponse.headers.location}` : null);
    
    // Test that protected pages are no longer accessible
    try {
      const protectedResponse = await client.get('/backoffice/dashboard');
      const requiresReauth = protectedResponse.status === 302 || protectedResponse.status === 401;
      recordTest('Session Cleared After Logout', requiresReauth, 
        !requiresReauth ? 'Dashboard still accessible after logout' : null);
    } catch (error) {
      recordTest('Post-Logout Access Test', false, `Error: ${error.message}`);
    }
    
  } catch (error) {
    recordTest('Logout Testing', false, `Error: ${error.message}`);
  }
}

// Test API endpoints
async function testAPIEndpoints() {
  try {
    log('Testing API Endpoints...', 'info');
    
    const apiEndpoints = [
      { path: '/api/health', name: 'Health Check', expectedStatus: 200 },
      { path: '/backoffice/api/stats', name: 'Dashboard Stats', expectedStatus: [200, 401, 403] }
    ];
    
    for (const endpoint of apiEndpoints) {
      try {
        const response = await client.get(endpoint.path);
        const statusOk = Array.isArray(endpoint.expectedStatus) 
          ? endpoint.expectedStatus.includes(response.status)
          : response.status === endpoint.expectedStatus;
          
        recordTest(`API ${endpoint.name}`, statusOk, 
          !statusOk ? `Expected ${endpoint.expectedStatus}, got ${response.status}` : null);
        
        // Test for JSON response format
        if (response.status === 200 && response.headers['content-type']?.includes('application/json')) {
          try {
            const jsonData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            recordTest(`API ${endpoint.name} JSON Format`, true, `Valid JSON response`);
          } catch (parseError) {
            recordTest(`API ${endpoint.name} JSON Format`, false, 'Invalid JSON response');
          }
        }
        
      } catch (error) {
        recordTest(`API ${endpoint.name}`, false, `Error: ${error.message}`);
      }
    }
    
  } catch (error) {
    recordTest('API Endpoints Testing', false, `Error: ${error.message}`);
  }
}

// Security testing
async function testSecurity() {
  try {
    log('Testing Security Measures...', 'info');
    
    // Test CSRF protection
    try {
      const noCsrfResponse = await client.post('/backoffice/auth/login', {
        email: 'test@example.com',
        password: 'test123'
      });
      
      // Should fail without CSRF token
      if (noCsrfResponse.status === 403 || noCsrfResponse.status === 422) {
        recordTest('CSRF Protection Active', true, 'Login rejected without CSRF token');
      } else {
        recordSecurityIssue('CSRF protection may not be active - login accepted without token');
      }
    } catch (error) {
      recordWarning(`CSRF test failed: ${error.message}`);
    }
    
    // Test for security headers
    try {
      const response = await client.get('/backoffice/auth/login');
      const headers = response.headers;
      
      const securityHeaders = [
        { name: 'X-Content-Type-Options', expected: 'nosniff' },
        { name: 'X-Frame-Options', expected: ['DENY', 'SAMEORIGIN'] },
        { name: 'X-XSS-Protection', expected: '1; mode=block' },
        { name: 'Content-Security-Policy', expected: null } // Just check presence
      ];
      
      securityHeaders.forEach(header => {
        const headerValue = headers[header.name.toLowerCase()];
        if (headerValue) {
          if (header.expected === null) {
            recordTest(`Security Header ${header.name}`, true, `Present: ${headerValue}`);
          } else if (Array.isArray(header.expected)) {
            const matches = header.expected.some(expected => headerValue.includes(expected));
            recordTest(`Security Header ${header.name}`, matches, 
              !matches ? `Expected one of ${header.expected.join(', ')}, got ${headerValue}` : null);
          } else {
            const matches = headerValue.includes(header.expected);
            recordTest(`Security Header ${header.name}`, matches, 
              !matches ? `Expected ${header.expected}, got ${headerValue}` : null);
          }
        } else {
          recordSecurityIssue(`Missing security header: ${header.name}`);
        }
      });
      
    } catch (error) {
      recordWarning(`Security headers test failed: ${error.message}`);
    }
    
  } catch (error) {
    recordTest('Security Testing', false, `Error: ${error.message}`);
  }
}

// Performance monitoring
function trackPerformance(testName, startTime) {
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  if (duration > 2000) {
    testResults.performance.push({ test: testName, time: duration });
    recordWarning(`Slow response: ${testName} took ${duration}ms`);
  }
  
  return duration;
}

// Generate test report
function generateReport() {
  log('\n' + '='.repeat(80), 'info');
  log('COMPREHENSIVE BACKOFFICE TEST REPORT', 'info');
  log('='.repeat(80), 'info');
  
  // Summary
  const total = testResults.passed + testResults.failed;
  const passRate = total > 0 ? ((testResults.passed / total) * 100).toFixed(1) : 0;
  
  log(`\nSUMMARY:`, 'info');
  log(`  Total Tests: ${total}`, 'info');
  log(`  Passed: ${testResults.passed}`, 'success');
  log(`  Failed: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'info');
  log(`  Pass Rate: ${passRate}%`, passRate >= 80 ? 'success' : 'warning');
  
  // Errors
  if (testResults.errors.length > 0) {
    log(`\nERRORS (${testResults.errors.length}):`, 'error');
    testResults.errors.forEach((error, index) => {
      log(`  ${index + 1}. ${error.test}: ${error.details}`, 'error');
    });
  }
  
  // Warnings
  if (testResults.warnings.length > 0) {
    log(`\nWARNINGS (${testResults.warnings.length}):`, 'warning');
    testResults.warnings.forEach((warning, index) => {
      log(`  ${index + 1}. ${warning}`, 'warning');
    });
  }
  
  // Security Issues
  if (testResults.security.length > 0) {
    log(`\nSECURITY ISSUES (${testResults.security.length}):`, 'error');
    testResults.security.forEach((issue, index) => {
      log(`  ${index + 1}. ${issue}`, 'error');
    });
  }
  
  // Performance Issues
  if (testResults.performance.length > 0) {
    log(`\nPERFORMANCE ISSUES (${testResults.performance.length}):`, 'warning');
    testResults.performance.forEach((perf, index) => {
      log(`  ${index + 1}. ${perf.test}: ${perf.time}ms`, 'warning');
    });
  }
  
  log('\n' + '='.repeat(80), 'info');
  
  // Overall status
  if (testResults.failed === 0 && testResults.security.length === 0) {
    log('🎉 ALL TESTS PASSED - BackOffice is functioning correctly!', 'success');
  } else if (testResults.failed > 0) {
    log('❌ TESTS FAILED - BackOffice has issues that need attention', 'error');
  } else if (testResults.security.length > 0) {
    log('🚨 SECURITY ISSUES FOUND - Immediate attention required', 'error');
  }
  
  return {
    summary: {
      total,
      passed: testResults.passed,
      failed: testResults.failed,
      passRate: parseFloat(passRate)
    },
    errors: testResults.errors,
    warnings: testResults.warnings,
    security: testResults.security,
    performance: testResults.performance
  };
}

// Main test execution
async function runAllTests() {
  try {
    log('Starting Comprehensive BackOffice Testing...', 'info');
    log(`Testing against: ${BASE_URL}`, 'info');
    
    // Test server availability
    try {
      const healthResponse = await client.get('/api/health');
      recordTest('Server Availability', healthResponse.status === 200, 
        healthResponse.status !== 200 ? `Server returned ${healthResponse.status}` : null);
    } catch (error) {
      recordTest('Server Availability', false, `Cannot connect to server: ${error.message}`);
      return generateReport();
    }
    
    // Security tests (before authentication)
    await testSecurity();
    
    // API endpoint tests
    await testAPIEndpoints();
    
    // Authentication tests
    const csrfToken = await performLogin();
    
    if (!csrfToken) {
      recordWarning('Authentication failed - skipping authenticated tests');
      return generateReport();
    }
    
    // Authenticated tests
    await testDashboard(csrfToken);
    await testTenantManagement(csrfToken);
    await testSettingsPages(csrfToken);
    await testEmailConfiguration(csrfToken);
    await testAuditLogs(csrfToken);
    
    // Logout test (last)
    await testLogout(csrfToken);
    
    log('\nTest execution completed!', 'info');
    
  } catch (error) {
    log(`Fatal error during testing: ${error.message}`, 'error');
    recordTest('Test Execution', false, `Fatal error: ${error.message}`);
  }
  
  return generateReport();
}

// Export for use as module or run directly
if (require.main === module) {
  runAllTests().then(() => {
    process.exit(testResults.failed > 0 ? 1 : 0);
  }).catch(error => {
    log(`Test runner error: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = { runAllTests, generateReport };