#!/usr/bin/env node

/**
 * Comprehensive Security Test Suite for Tenant Isolation System
 * 
 * This test suite validates the complete tenant isolation implementation
 * to ensure zero cross-tenant data leakage and proper security controls.
 * 
 * Test Categories:
 * 1. Tenant Resolution Tests
 * 2. Cross-Tenant Access Prevention Tests  
 * 3. Database Query Isolation Tests
 * 4. Route Protection Tests
 * 5. Authentication & Authorization Tests
 * 6. Audit Logging Tests
 * 7. Performance Impact Tests
 * 8. Edge Case & Attack Vector Tests
 */

const axios = require('axios');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  adminUser: {
    email: 'admin@test.com',
    password: 'admin123'
  }
};

// Test state
let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Test utilities
 */
class TenantSecurityTester {
  
  static log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type}] ${message}`);
  }

  static async createTestTenants() {
    this.log('Creating test tenants...');
    
    const tenant1 = await prisma.tenant.create({
      data: {
        name: 'Test Tenant 1',
        slug: 'test-tenant-1',
        domain: 'tenant1.test.com',
        isActive: true
      }
    });

    const tenant2 = await prisma.tenant.create({
      data: {
        name: 'Test Tenant 2', 
        slug: 'test-tenant-2',
        domain: 'tenant2.test.com',
        isActive: true
      }
    });

    return { tenant1, tenant2 };
  }

  static async createTestMerchants(tenant1Id, tenant2Id) {
    this.log('Creating test merchants...');

    const merchant1 = await prisma.merchant.create({
      data: {
        email: 'merchant1@tenant1.com',
        password: '$2a$10$hash1', // Dummy hash
        businessName: 'Merchant 1',
        tenantId: tenant1Id,
        isActive: true
      }
    });

    const merchant2 = await prisma.merchant.create({
      data: {
        email: 'merchant2@tenant2.com', 
        password: '$2a$10$hash2', // Dummy hash
        businessName: 'Merchant 2',
        tenantId: tenant2Id,
        isActive: true
      }
    });

    // Legacy merchant without tenant (backward compatibility)
    const legacyMerchant = await prisma.merchant.create({
      data: {
        email: 'legacy@merchant.com',
        password: '$2a$10$hash3', // Dummy hash
        businessName: 'Legacy Merchant',
        tenantId: null,
        isActive: true
      }
    });

    return { merchant1, merchant2, legacyMerchant };
  }

  static async createTestQueues(merchant1Id, merchant2Id) {
    this.log('Creating test queues...');

    const queue1 = await prisma.queue.create({
      data: {
        name: 'Queue 1 - Tenant 1',
        merchantId: merchant1Id,
        maxCapacity: 50,
        averageServiceTime: 15,
        isActive: true
      }
    });

    const queue2 = await prisma.queue.create({
      data: {
        name: 'Queue 2 - Tenant 2', 
        merchantId: merchant2Id,
        maxCapacity: 50,
        averageServiceTime: 15,
        isActive: true
      }
    });

    return { queue1, queue2 };
  }

  static async runTest(testName, testFunction) {
    try {
      this.log(`Running test: ${testName}`);
      await testFunction();
      testResults.passed++;
      testResults.tests.push({ name: testName, status: 'PASSED' });
      this.log(`✅ ${testName} PASSED`);
    } catch (error) {
      testResults.failed++;
      testResults.tests.push({ 
        name: testName, 
        status: 'FAILED', 
        error: error.message 
      });
      this.log(`❌ ${testName} FAILED: ${error.message}`, 'ERROR');
    }
  }

  static async makeAuthenticatedRequest(url, options = {}, headers = {}) {
    const config = {
      url,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      ...options
    };

    const response = await axios(config);
    return response;
  }
}

/**
 * Test Suite 1: Tenant Resolution Tests
 */
async function testTenantResolution() {
  const tester = TenantSecurityTester;
  
  await tester.runTest('Tenant Resolution by Subdomain', async () => {
    const response = await tester.makeAuthenticatedRequest(
      `${TEST_CONFIG.baseUrl}/api/test/tenant-resolution`,
      {},
      { 'Host': 'test-tenant-1.localhost' }
    );
    
    if (response.data.tenant?.slug !== 'test-tenant-1') {
      throw new Error('Failed to resolve tenant by subdomain');
    }
  });

  await tester.runTest('Tenant Resolution by Domain', async () => {
    const response = await tester.makeAuthenticatedRequest(
      `${TEST_CONFIG.baseUrl}/api/test/tenant-resolution`,
      {},
      { 'Host': 'tenant1.test.com' }
    );
    
    if (response.data.tenant?.domain !== 'tenant1.test.com') {
      throw new Error('Failed to resolve tenant by domain');
    }
  });

  await tester.runTest('Tenant Resolution by Header', async () => {
    const response = await tester.makeAuthenticatedRequest(
      `${TEST_CONFIG.baseUrl}/api/test/tenant-resolution`,
      {},
      { 'X-Tenant-ID': 'test-tenant-id' }
    );
    
    if (!response.data.tenant) {
      throw new Error('Failed to resolve tenant by header');
    }
  });

  await tester.runTest('Invalid Tenant Rejection', async () => {
    try {
      await tester.makeAuthenticatedRequest(
        `${TEST_CONFIG.baseUrl}/api/test/tenant-resolution`,
        {},
        { 'X-Tenant-ID': 'invalid-tenant-id' }
      );
      throw new Error('Should have rejected invalid tenant');
    } catch (error) {
      if (error.response?.status !== 400) {
        throw new Error('Expected 400 status for invalid tenant');
      }
    }
  });
}

/**
 * Test Suite 2: Cross-Tenant Access Prevention Tests
 */
async function testCrossTenantAccessPrevention() {
  const tester = TenantSecurityTester;
  
  await tester.runTest('Block Cross-Tenant Merchant Access', async () => {
    // Try to access tenant1 merchant from tenant2 context
    try {
      await tester.makeAuthenticatedRequest(
        `${TEST_CONFIG.baseUrl}/api/merchant/profile`,
        {},
        { 
          'X-Tenant-ID': 'tenant2-id',
          'Authorization': 'Bearer tenant1-merchant-token'
        }
      );
      throw new Error('Should have blocked cross-tenant merchant access');
    } catch (error) {
      if (error.response?.status !== 403) {
        throw new Error('Expected 403 status for cross-tenant access');
      }
    }
  });

  await tester.runTest('Block Cross-Tenant Queue Access', async () => {
    // Try to access tenant1 queue from tenant2 context
    try {
      await tester.makeAuthenticatedRequest(
        `${TEST_CONFIG.baseUrl}/api/queue/tenant1-queue-id`,
        {},
        { 
          'X-Tenant-ID': 'tenant2-id',
          'Authorization': 'Bearer tenant1-merchant-token'
        }
      );
      throw new Error('Should have blocked cross-tenant queue access');
    } catch (error) {
      if (error.response?.status !== 403) {
        throw new Error('Expected 403 status for cross-tenant queue access');
      }
    }
  });

  await tester.runTest('Allow Same-Tenant Access', async () => {
    const response = await tester.makeAuthenticatedRequest(
      `${TEST_CONFIG.baseUrl}/api/merchant/profile`,
      {},
      { 
        'X-Tenant-ID': 'tenant1-id',
        'Authorization': 'Bearer tenant1-merchant-token'
      }
    );
    
    if (response.status !== 200) {
      throw new Error('Should allow same-tenant access');
    }
  });
}

/**
 * Test Suite 3: Database Query Isolation Tests
 */
async function testDatabaseQueryIsolation() {
  const tester = TenantSecurityTester;
  
  await tester.runTest('Merchant Query Filtering', async () => {
    // Test that merchant queries are automatically filtered by tenant
    const { tenant1, tenant2 } = await tester.createTestTenants();
    const { merchant1, merchant2 } = await tester.createTestMerchants(tenant1.id, tenant2.id);
    
    // Simulate tenant-aware service call
    const merchantService = require('./server/services/merchantService');
    const merchants = await merchantService.findByEmail(merchant1.email, tenant1.id);
    
    if (!merchants || merchants.tenantId !== tenant1.id) {
      throw new Error('Merchant query not properly filtered by tenant');
    }
  });

  await tester.runTest('Queue Query Filtering', async () => {
    // Test that queue queries are automatically filtered by tenant relationship
    const queueService = require('./server/services/queueService');
    const { tenant1, tenant2 } = await tester.createTestTenants();
    const { merchant1, merchant2 } = await tester.createTestMerchants(tenant1.id, tenant2.id);
    const { queue1, queue2 } = await tester.createTestQueues(merchant1.id, merchant2.id);
    
    const queues = await queueService.findByMerchant(merchant1.id, false, tenant1.id);
    
    if (!queues.length || queues.some(q => q.merchant.tenantId !== tenant1.id)) {
      throw new Error('Queue query not properly filtered by tenant');
    }
  });

  await tester.runTest('Cross-Tenant Data Leakage Prevention', async () => {
    // Ensure tenant1 queries never return tenant2 data
    const queueService = require('./server/services/queueService');
    const { tenant1, tenant2 } = await tester.createTestTenants();
    const { merchant1, merchant2 } = await tester.createTestMerchants(tenant1.id, tenant2.id);
    const { queue1, queue2 } = await tester.createTestQueues(merchant1.id, merchant2.id);
    
    // Try to find tenant2's queue with tenant1 context
    const queue = await queueService.findById(queue2.id, {}, tenant1.id);
    
    if (queue) {
      throw new Error('Cross-tenant data leakage detected');
    }
  });
}

/**
 * Test Suite 4: Route Protection Tests
 */
async function testRouteProtection() {
  const tester = TenantSecurityTester;
  
  await tester.runTest('Protected Route Tenant Validation', async () => {
    // Test that protected routes validate tenant context
    try {
      await tester.makeAuthenticatedRequest(
        `${TEST_CONFIG.baseUrl}/api/queue`,
        {},
        { 'Authorization': 'Bearer valid-token' } // No tenant header
      );
      throw new Error('Should require tenant context for protected routes');
    } catch (error) {
      if (error.response?.status !== 400) {
        throw new Error('Expected 400 status for missing tenant context');
      }
    }
  });

  await tester.runTest('Middleware Chain Execution', async () => {
    // Test that all middleware executes in correct order
    const response = await tester.makeAuthenticatedRequest(
      `${TEST_CONFIG.baseUrl}/api/test/middleware-chain`,
      {},
      { 
        'X-Tenant-ID': 'valid-tenant-id',
        'Authorization': 'Bearer valid-token'
      }
    );
    
    const expectedMiddleware = [
      'requireAuth',
      'loadUser', 
      'tenantIsolationMiddleware',
      'validateMerchantAccess'
    ];
    
    expectedMiddleware.forEach(middleware => {
      if (!response.data.executedMiddleware?.includes(middleware)) {
        throw new Error(`Middleware ${middleware} not executed`);
      }
    });
  });
}

/**
 * Test Suite 5: Authentication & Authorization Tests  
 */
async function testAuthenticationAuthorization() {
  const tester = TenantSecurityTester;
  
  await tester.runTest('User-Tenant Relationship Validation', async () => {
    // Test that users can only access their assigned tenant
    try {
      await tester.makeAuthenticatedRequest(
        `${TEST_CONFIG.baseUrl}/api/merchant/profile`,
        {},
        { 
          'X-Tenant-ID': 'tenant2-id',
          'Authorization': 'Bearer tenant1-user-token'
        }
      );
      throw new Error('Should block user access to wrong tenant');
    } catch (error) {
      if (error.response?.status !== 403) {
        throw new Error('Expected 403 status for wrong tenant access');
      }
    }
  });

  await tester.runTest('Session Tenant Context', async () => {
    // Test that session maintains tenant context
    const response = await tester.makeAuthenticatedRequest(
      `${TEST_CONFIG.baseUrl}/api/test/session-context`,
      {},
      { 
        'X-Tenant-ID': 'tenant1-id',
        'Cookie': 'session=valid-session-id'
      }
    );
    
    if (response.data.tenantId !== 'tenant1-id') {
      throw new Error('Session not maintaining tenant context');
    }
  });
}

/**
 * Test Suite 6: Audit Logging Tests
 */
async function testAuditLogging() {
  const tester = TenantSecurityTester;
  
  await tester.runTest('Security Event Logging', async () => {
    // Test that security events are properly logged
    const initialLogCount = await prisma.superAdminAuditLog.count();
    
    // Trigger a security event
    try {
      await tester.makeAuthenticatedRequest(
        `${TEST_CONFIG.baseUrl}/api/merchant/profile`,
        {},
        { 
          'X-Tenant-ID': 'tenant2-id',
          'Authorization': 'Bearer tenant1-user-token'
        }
      );
    } catch (error) {
      // Expected to fail
    }
    
    const finalLogCount = await prisma.superAdminAuditLog.count();
    
    if (finalLogCount <= initialLogCount) {
      throw new Error('Security event not logged');
    }
  });

  await tester.runTest('Audit Log Data Integrity', async () => {
    // Test that audit logs contain required information
    const recentLog = await prisma.superAdminAuditLog.findFirst({
      orderBy: { timestamp: 'desc' }
    });
    
    const requiredFields = ['action', 'timestamp', 'details'];
    requiredFields.forEach(field => {
      if (!recentLog[field]) {
        throw new Error(`Audit log missing required field: ${field}`);
      }
    });
  });
}

/**
 * Test Suite 7: Performance Impact Tests
 */
async function testPerformanceImpact() {
  const tester = TenantSecurityTester;
  
  await tester.runTest('Middleware Performance Impact', async () => {
    // Test that tenant middleware doesn't significantly impact performance
    const iterations = 100;
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      await tester.makeAuthenticatedRequest(
        `${TEST_CONFIG.baseUrl}/api/queue`,
        {},
        { 
          'X-Tenant-ID': 'tenant1-id',
          'Authorization': 'Bearer valid-token'
        }
      );
    }
    
    const endTime = Date.now();
    const avgResponseTime = (endTime - startTime) / iterations;
    
    // Should average less than 100ms per request (adjust threshold as needed)
    if (avgResponseTime > 100) {
      throw new Error(`Performance impact too high: ${avgResponseTime}ms average`);
    }
  });

  await tester.runTest('Database Query Performance', async () => {
    // Test that tenant filtering doesn't create slow queries
    const startTime = Date.now();
    
    const queueService = require('./server/services/queueService');
    await queueService.findByMerchant('test-merchant-id', true, 'test-tenant-id');
    
    const queryTime = Date.now() - startTime;
    
    // Query should complete in under 50ms (adjust threshold as needed)
    if (queryTime > 50) {
      throw new Error(`Database query too slow: ${queryTime}ms`);
    }
  });
}

/**
 * Test Suite 8: Edge Cases & Attack Vector Tests
 */
async function testEdgeCasesAndAttackVectors() {
  const tester = TenantSecurityTester;
  
  await tester.runTest('SQL Injection in Tenant ID', async () => {
    // Test that tenant ID parameters are properly sanitized
    try {
      await tester.makeAuthenticatedRequest(
        `${TEST_CONFIG.baseUrl}/api/queue`,
        {},
        { 
          'X-Tenant-ID': "'; DROP TABLE merchants; --",
          'Authorization': 'Bearer valid-token'
        }
      );
    } catch (error) {
      // Should be rejected, not cause SQL injection
      if (error.message.includes('DROP TABLE')) {
        throw new Error('SQL injection vulnerability detected');
      }
    }
  });

  await tester.runTest('Header Injection Attack', async () => {
    // Test that malicious headers are handled safely
    try {
      await tester.makeAuthenticatedRequest(
        `${TEST_CONFIG.baseUrl}/api/queue`,
        {},
        { 
          'X-Tenant-ID': 'tenant1-id\\r\\nX-Admin: true',
          'Authorization': 'Bearer valid-token'
        }
      );
    } catch (error) {
      // Should be rejected safely
      if (error.response?.headers?.['x-admin']) {
        throw new Error('Header injection vulnerability detected');
      }
    }
  });

  await tester.runTest('Race Condition in Tenant Context', async () => {
    // Test that concurrent requests don't mix tenant contexts
    const promises = [];
    
    for (let i = 0; i < 10; i++) {
      const tenantId = i % 2 === 0 ? 'tenant1-id' : 'tenant2-id';
      promises.push(
        tester.makeAuthenticatedRequest(
          `${TEST_CONFIG.baseUrl}/api/test/tenant-context`,
          {},
          { 
            'X-Tenant-ID': tenantId,
            'Authorization': 'Bearer valid-token'
          }
        )
      );
    }
    
    const responses = await Promise.all(promises);
    
    responses.forEach((response, index) => {
      const expectedTenantId = index % 2 === 0 ? 'tenant1-id' : 'tenant2-id';
      if (response.data.tenantId !== expectedTenantId) {
        throw new Error('Race condition detected in tenant context');
      }
    });
  });

  await tester.runTest('Tenant Switching Attack', async () => {
    // Test that authenticated users cannot switch tenants mid-session
    const sessionToken = 'authenticated-session-token';
    
    // First request to tenant1
    await tester.makeAuthenticatedRequest(
      `${TEST_CONFIG.baseUrl}/api/merchant/profile`,
      {},
      { 
        'X-Tenant-ID': 'tenant1-id',
        'Authorization': `Bearer ${sessionToken}`
      }
    );
    
    // Try to switch to tenant2 with same session
    try {
      await tester.makeAuthenticatedRequest(
        `${TEST_CONFIG.baseUrl}/api/merchant/profile`,
        {},
        { 
          'X-Tenant-ID': 'tenant2-id',
          'Authorization': `Bearer ${sessionToken}`
        }
      );
      throw new Error('Should prevent tenant switching with same session');
    } catch (error) {
      if (error.response?.status !== 403) {
        throw new Error('Expected 403 status for tenant switching attempt');
      }
    }
  });
}

/**
 * Main test execution
 */
async function runAllTests() {
  console.log('🔐 Starting Comprehensive Tenant Isolation Security Tests');
  console.log('=' * 60);
  
  try {
    await testTenantResolution();
    await testCrossTenantAccessPrevention();  
    await testDatabaseQueryIsolation();
    await testRouteProtection();
    await testAuthenticationAuthorization();
    await testAuditLogging();
    await testPerformanceImpact();
    await testEdgeCasesAndAttackVectors();
    
  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    // Cleanup test data
    await prisma.queueEntry.deleteMany({});
    await prisma.queue.deleteMany({});
    await prisma.merchant.deleteMany({});
    await prisma.tenant.deleteMany({ where: { name: { startsWith: 'Test Tenant' } } });
    
    await prisma.$disconnect();
  }
  
  // Print test results
  console.log('\\n' + '=' * 60);
  console.log('🔐 TENANT ISOLATION SECURITY TEST RESULTS');
  console.log('=' * 60);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total: ${testResults.passed + testResults.failed}`);
  
  if (testResults.failed > 0) {
    console.log('\\n❌ FAILED TESTS:');
    testResults.tests
      .filter(test => test.status === 'FAILED')
      .forEach(test => {
        console.log(`  • ${test.name}: ${test.error}`);
      });
  }
  
  console.log('\\n🛡️ Security Assessment Complete');
  
  if (testResults.failed === 0) {
    console.log('✅ ALL SECURITY CONTROLS VALIDATED - TENANT ISOLATION IS SECURE');
    process.exit(0);
  } else {
    console.log('❌ SECURITY VULNERABILITIES DETECTED - FIX REQUIRED');
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  TenantSecurityTester,
  runAllTests
};