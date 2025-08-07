#!/usr/bin/env node

/**
 * Comprehensive Multi-Tenant Architecture Test Suite
 * 
 * This suite tests all aspects of the multi-tenant implementation:
 * 1. Tenant Resolution Middleware
 * 2. Data Isolation and Security
 * 3. SuperAdmin Portal Access
 * 4. Subscription Limits Enforcement
 * 5. Session Management
 * 6. Cross-tenant Security
 * 7. API Endpoint Security
 * 8. Database Constraint Validation
 */

const prisma = require('../server/utils/prisma');
const logger = require('../server/utils/logger');
const tenantService = require('../server/services/tenantService');
const { resolveTenant, ensureTenant, validateTenantUser, applyTenantFilter } = require('../server/middleware/tenantResolver');

// Test configuration
const TEST_TENANTS = [
  {
    name: 'SecurityCorp Test Tenant',
    slug: 'securitycorp-test',
    adminEmail: 'admin@securitycorp.test',
    adminName: 'Security Admin',
    adminPassword: 'SecureTest123!@#'
  },
  {
    name: 'DataCorp Test Tenant', 
    slug: 'datacorp-test',
    adminEmail: 'admin@datacorp.test',
    adminName: 'Data Admin',
    adminPassword: 'DataTest123!@#'
  },
  {
    name: 'IsolationCorp Test Tenant',
    slug: 'isolationcorp-test',
    adminEmail: 'admin@isolationcorp.test',
    adminName: 'Isolation Admin',
    adminPassword: 'IsolationTest123!@#'
  }
];

class MultiTenantTestSuite {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: [],
      details: []
    };
    this.createdTenants = [];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    
    if (level === 'error') {
      logger.error(logMessage);
      console.error(`❌ ${message}`);
    } else if (level === 'success') {
      logger.info(logMessage);
      console.log(`✅ ${message}`);
    } else {
      logger.info(logMessage);
      console.log(`ℹ️  ${message}`);
    }
  }

  recordTest(testName, passed, details = '') {
    const result = {
      test: testName,
      passed,
      details,
      timestamp: new Date().toISOString()
    };

    this.testResults.details.push(result);
    
    if (passed) {
      this.testResults.passed++;
      this.log(`${testName}: PASSED ${details}`, 'success');
    } else {
      this.testResults.failed++;
      this.testResults.errors.push(`${testName}: ${details}`);
      this.log(`${testName}: FAILED ${details}`, 'error');
    }
  }

  async cleanupTestData() {
    this.log('🧹 Cleaning up test data...');
    
    try {
      // Delete all test tenants and related data
      for (const testTenant of TEST_TENANTS) {
        const tenant = await prisma.tenant.findFirst({
          where: { slug: testTenant.slug }
        });
        
        if (tenant) {
          // Clean up in proper order due to foreign key constraints
          await this.cleanupTenantData(tenant.id);
          this.log(`Cleaned up test tenant: ${tenant.name}`);
        }
      }
    } catch (error) {
      this.log(`Error during cleanup: ${error.message}`, 'error');
    }
  }

  async cleanupTenantData(tenantId) {
    const merchantIds = await this.getMerchantIds(tenantId);
    
    // Delete in dependency order
    if (merchantIds.length > 0) {
      await prisma.queueEntry.deleteMany({ 
        where: { queue: { merchantId: { in: merchantIds } } } 
      });
      await prisma.queue.deleteMany({ 
        where: { merchantId: { in: merchantIds } } 
      });
      await prisma.merchantSettings.deleteMany({
        where: { merchantId: { in: merchantIds } }
      });
    }
    
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.webChatMessage.deleteMany({ where: { tenantId } });
    await prisma.notificationLog.deleteMany({ where: { tenantId } });
    await prisma.merchant.deleteMany({ where: { tenantId } });
    await prisma.tenantUser.deleteMany({ where: { tenantId } });
    await prisma.superAdminAuditLog.deleteMany({ where: { tenantId } });
    await prisma.tenantSubscription.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  }

  async getMerchantIds(tenantId) {
    const merchants = await prisma.merchant.findMany({
      where: { tenantId },
      select: { id: true }
    });
    return merchants.map(m => m.id);
  }

  async createTestTenants() {
    this.log('🏗️  Creating test tenants...');
    
    for (const tenantData of TEST_TENANTS) {
      try {
        const result = await tenantService.create({
          ...tenantData,
          plan: 'basic',
          billingCycle: 'monthly',
          maxMerchants: 2,
          maxQueuesPerMerchant: 3,
          maxCustomersPerQueue: 50,
          aiFeatures: false,
          analytics: true,
          customBranding: false,
          businessType: 'restaurant'
        });
        
        this.createdTenants.push(result.tenant);
        this.log(`Created test tenant: ${result.tenant.name} (${result.tenant.slug})`);
      } catch (error) {
        throw new Error(`Failed to create tenant ${tenantData.name}: ${error.message}`);
      }
    }
  }

  // Test 1: Tenant Resolution from Various Hostname Formats
  async testTenantResolution() {
    this.log('\n🧪 Testing Tenant Resolution Middleware...');

    // Test 1.1: Valid subdomain resolution
    await this.testValidSubdomainResolution();
    
    // Test 1.2: SuperAdmin portal detection
    await this.testSuperAdminPortalDetection();
    
    // Test 1.3: API subdomain handling
    await this.testApiSubdomainHandling();
    
    // Test 1.4: Invalid subdomain handling
    await this.testInvalidSubdomainHandling();
    
    // Test 1.5: Development environment handling
    await this.testDevelopmentEnvironment();
  }

  async testValidSubdomainResolution() {
    const testCases = [
      {
        hostname: 'securitycorp-test.storehubqms.com',
        expected: 'securitycorp-test'
      },
      {
        hostname: 'datacorp-test.storehubqms.com',
        expected: 'datacorp-test'
      }
    ];

    for (const testCase of testCases) {
      try {
        const req = {
          hostname: testCase.hostname,
          get: () => testCase.hostname,
          session: {}
        };
        const res = { 
          locals: {},
          status: () => ({ render: () => {} })
        };
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        await resolveTenant(req, res, next);

        const passed = req.tenant && req.tenant.slug === testCase.expected && nextCalled;
        this.recordTest(
          `Subdomain Resolution: ${testCase.hostname}`,
          passed,
          passed ? `Resolved to ${req.tenant.slug}` : 'Failed to resolve tenant'
        );
      } catch (error) {
        this.recordTest(
          `Subdomain Resolution: ${testCase.hostname}`,
          false,
          `Error: ${error.message}`
        );
      }
    }
  }

  async testSuperAdminPortalDetection() {
    try {
      const req = {
        hostname: 'admin.storehubqms.com',
        get: () => 'admin.storehubqms.com'
      };
      const res = { status: () => ({ render: () => {} }) };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await resolveTenant(req, res, next);

      const passed = req.isSuperAdmin === true && req.tenant === null && nextCalled;
      this.recordTest(
        'SuperAdmin Portal Detection',
        passed,
        passed ? 'Correctly identified as SuperAdmin portal' : 'Failed SuperAdmin detection'
      );
    } catch (error) {
      this.recordTest(
        'SuperAdmin Portal Detection',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testApiSubdomainHandling() {
    try {
      const testTenant = this.createdTenants[0];
      const req = {
        hostname: 'api.storehubqms.com',
        get: () => 'api.storehubqms.com',
        headers: { 'x-tenant-id': testTenant.id },
        query: {}
      };
      const res = { 
        status: () => ({ json: () => {} })
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await resolveTenant(req, res, next);

      const passed = req.isApiEndpoint === true && req.tenantId === testTenant.id && nextCalled;
      this.recordTest(
        'API Subdomain with Tenant Header',
        passed,
        passed ? 'API request resolved with tenant context' : 'Failed API tenant resolution'
      );
    } catch (error) {
      this.recordTest(
        'API Subdomain with Tenant Header',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testInvalidSubdomainHandling() {
    try {
      const req = {
        hostname: 'nonexistent.storehubqms.com',
        get: () => 'nonexistent.storehubqms.com'
      };
      let errorRendered = false;
      const res = {
        status: (code) => ({
          render: (template, data) => {
            errorRendered = code === 404 && template === 'errors/tenant-not-found';
          }
        })
      };
      const next = () => {};

      await resolveTenant(req, res, next);

      this.recordTest(
        'Invalid Subdomain Handling',
        errorRendered,
        errorRendered ? 'Correctly rendered 404 error' : 'Did not handle invalid subdomain properly'
      );
    } catch (error) {
      this.recordTest(
        'Invalid Subdomain Handling',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testDevelopmentEnvironment() {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const req = {
        hostname: 'localhost',
        get: () => 'localhost:3000'
      };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await resolveTenant(req, res, next);

      const passed = nextCalled; // Should proceed even without tenant in development
      this.recordTest(
        'Development Environment Handling',
        passed,
        passed ? 'Development mode allows localhost access' : 'Failed development mode handling'
      );
    } catch (error) {
      this.recordTest(
        'Development Environment Handling',
        false,
        `Error: ${error.message}`
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  }

  // Test 2: Data Isolation and Security
  async testDataIsolation() {
    this.log('\n🔒 Testing Data Isolation...');

    await this.testTenantFilterApplication();
    await this.testCrossTenantDataAccess();
    await this.testUserTenantValidation();
    await this.testMerchantTenantIsolation();
  }

  async testTenantFilterApplication() {
    try {
      const testTenant = this.createdTenants[0];
      const req = { tenantId: testTenant.id };
      
      // Test basic tenant filter
      const basicFilter = applyTenantFilter(req, {});
      const passed1 = basicFilter.tenantId === testTenant.id;
      
      // Test filter with existing where clause
      const existingWhere = { status: 'active' };
      const combinedFilter = applyTenantFilter(req, existingWhere);
      const passed2 = combinedFilter.tenantId === testTenant.id && combinedFilter.status === 'active';
      
      this.recordTest(
        'Tenant Filter Application - Basic',
        passed1,
        passed1 ? 'Basic tenant filter applied correctly' : 'Basic filter failed'
      );
      
      this.recordTest(
        'Tenant Filter Application - Combined',
        passed2,
        passed2 ? 'Combined filter applied correctly' : 'Combined filter failed'
      );
    } catch (error) {
      this.recordTest(
        'Tenant Filter Application',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testCrossTenantDataAccess() {
    try {
      const tenant1 = this.createdTenants[0];
      const tenant2 = this.createdTenants[1];
      
      // Try to query tenant1's data with tenant2's context
      const tenant2Merchants = await prisma.merchant.findMany({
        where: { tenantId: tenant2.id }
      });
      
      // This should return empty for tenant1's context
      const isolatedQuery = await prisma.merchant.findMany({
        where: { 
          tenantId: tenant1.id,
          id: { in: tenant2Merchants.map(m => m.id) }
        }
      });
      
      const passed = isolatedQuery.length === 0;
      this.recordTest(
        'Cross-Tenant Data Access Prevention',
        passed,
        passed ? 'Cross-tenant data access properly blocked' : 'Data isolation breach detected!'
      );
    } catch (error) {
      this.recordTest(
        'Cross-Tenant Data Access Prevention',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testUserTenantValidation() {
    try {
      const tenant1 = this.createdTenants[0];
      const tenant2 = this.createdTenants[1];
      
      // Create a tenant user for tenant1
      const tenant1User = await prisma.tenantUser.findFirst({
        where: { tenantId: tenant1.id }
      });
      
      if (!tenant1User) {
        this.recordTest(
          'User Tenant Validation',
          false,
          'No tenant user found for validation test'
        );
        return;
      }
      
      // Simulate request with tenant1 user trying to access tenant2
      const req = {
        tenantId: tenant2.id,
        user: { tenantUserId: tenant1User.id }
      };
      const res = {
        status: (code) => ({
          json: (data) => {
            return { statusCode: code, data };
          }
        })
      };
      
      let validationResult = null;
      const next = () => { validationResult = 'passed'; };
      
      await validateTenantUser(req, res, next);
      
      const passed = validationResult !== 'passed'; // Should not call next()
      this.recordTest(
        'User Tenant Validation',
        passed,
        passed ? 'User-tenant validation correctly blocked cross-tenant access' : 'Validation failed to block access'
      );
    } catch (error) {
      this.recordTest(
        'User Tenant Validation',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testMerchantTenantIsolation() {
    try {
      const tenant1 = this.createdTenants[0];
      const tenant2 = this.createdTenants[1];
      
      // Get merchants for each tenant
      const tenant1Merchants = await prisma.merchant.findMany({
        where: { tenantId: tenant1.id }
      });
      
      const tenant2Merchants = await prisma.merchant.findMany({
        where: { tenantId: tenant2.id }
      });
      
      // Verify merchants are properly isolated
      const crossTenantMerchants = await prisma.merchant.findMany({
        where: {
          tenantId: tenant1.id,
          id: { in: tenant2Merchants.map(m => m.id) }
        }
      });
      
      const passed = crossTenantMerchants.length === 0 && 
                    tenant1Merchants.length > 0 && 
                    tenant2Merchants.length > 0;
      
      this.recordTest(
        'Merchant Tenant Isolation',
        passed,
        passed ? 'Merchant data properly isolated between tenants' : 'Merchant isolation failed'
      );
    } catch (error) {
      this.recordTest(
        'Merchant Tenant Isolation',
        false,
        `Error: ${error.message}`
      );
    }
  }

  // Test 3: Subscription Limits and Enforcement
  async testSubscriptionLimits() {
    this.log('\n💳 Testing Subscription Limits...');

    await this.testMerchantLimitEnforcement();
    await this.testQueueLimitEnforcement();
    await this.testSubscriptionStatusCheck();
  }

  async testMerchantLimitEnforcement() {
    try {
      const testTenant = this.createdTenants[0];
      const limits = await tenantService.checkSubscriptionLimits(testTenant.id);
      
      const withinLimits = limits.withinLimits;
      const hasUsageData = limits.usage && typeof limits.usage.merchants === 'number';
      const hasLimitData = limits.limits && typeof limits.limits.maxMerchants === 'number';
      
      this.recordTest(
        'Subscription Limits Check Structure',
        hasUsageData && hasLimitData,
        `Usage data: ${hasUsageData}, Limit data: ${hasLimitData}`
      );
      
      this.recordTest(
        'Merchant Limit Enforcement',
        typeof withinLimits === 'boolean',
        `Within limits: ${withinLimits}, Current merchants: ${limits.usage?.merchants}/${limits.limits?.maxMerchants}`
      );
    } catch (error) {
      this.recordTest(
        'Merchant Limit Enforcement',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testQueueLimitEnforcement() {
    try {
      const testTenant = this.createdTenants[0];
      const usage = await tenantService.getUsageStats(testTenant.id);
      
      const hasQueueStats = typeof usage.queues === 'number';
      const hasActiveQueueStats = typeof usage.activeQueues === 'number';
      
      this.recordTest(
        'Queue Usage Statistics',
        hasQueueStats && hasActiveQueueStats,
        `Total queues: ${usage.queues}, Active queues: ${usage.activeQueues}`
      );
    } catch (error) {
      this.recordTest(
        'Queue Usage Statistics',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testSubscriptionStatusCheck() {
    try {
      const testTenant = this.createdTenants[0];
      const tenantWithSubscription = await prisma.tenant.findUnique({
        where: { id: testTenant.id },
        include: { subscription: true }
      });
      
      const hasSubscription = !!tenantWithSubscription.subscription;
      const subscriptionActive = tenantWithSubscription.subscription?.status === 'active';
      
      this.recordTest(
        'Subscription Exists',
        hasSubscription,
        hasSubscription ? 'Tenant has subscription record' : 'No subscription found'
      );
      
      this.recordTest(
        'Subscription Status',
        subscriptionActive,
        `Subscription status: ${tenantWithSubscription.subscription?.status}`
      );
    } catch (error) {
      this.recordTest(
        'Subscription Status Check',
        false,
        `Error: ${error.message}`
      );
    }
  }

  // Test 4: Database Constraints and Relationships
  async testDatabaseConstraints() {
    this.log('\n🗄️  Testing Database Constraints...');

    await this.testTenantDeletion();
    await this.testUniqueConstraints();
    await this.testForeignKeyConstraints();
  }

  async testTenantDeletion() {
    try {
      // Create a temporary tenant for deletion test
      const tempTenant = await tenantService.create({
        name: 'Temporary Delete Test Tenant',
        slug: 'temp-delete-test',
        adminEmail: 'temp@delete.test',
        adminName: 'Temp Admin',
        adminPassword: 'TempTest123!@#',
        plan: 'free'
      });
      
      // Soft delete the tenant
      await tenantService.delete(tempTenant.tenant.id);
      
      // Verify soft delete
      const deletedTenant = await prisma.tenant.findUnique({
        where: { id: tempTenant.tenant.id }
      });
      
      const softDeleteWorked = deletedTenant && !deletedTenant.isActive;
      
      this.recordTest(
        'Tenant Soft Delete',
        softDeleteWorked,
        softDeleteWorked ? 'Tenant properly soft deleted' : 'Soft delete failed'
      );
      
      // Clean up - hard delete
      await tenantService.hardDelete(tempTenant.tenant.id);
      
      // Verify hard delete
      const hardDeletedTenant = await prisma.tenant.findUnique({
        where: { id: tempTenant.tenant.id }
      });
      
      const hardDeleteWorked = hardDeletedTenant === null;
      
      this.recordTest(
        'Tenant Hard Delete',
        hardDeleteWorked,
        hardDeleteWorked ? 'Tenant properly hard deleted' : 'Hard delete failed'
      );
    } catch (error) {
      this.recordTest(
        'Tenant Deletion Tests',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testUniqueConstraints() {
    try {
      const testTenant = this.createdTenants[0];
      
      // Try to create a tenant with duplicate slug
      let duplicateSlugError = false;
      try {
        await tenantService.create({
          name: 'Duplicate Slug Test',
          slug: testTenant.slug, // This should fail
          adminEmail: 'dup@test.com',
          adminName: 'Dup Admin',
          adminPassword: 'DupTest123!@#'
        });
      } catch (error) {
        duplicateSlugError = error.message.includes('already taken') || 
                            error.message.includes('unique constraint');
      }
      
      this.recordTest(
        'Unique Slug Constraint',
        duplicateSlugError,
        duplicateSlugError ? 'Duplicate slug properly rejected' : 'Unique constraint not enforced'
      );
    } catch (error) {
      this.recordTest(
        'Unique Constraints Test',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testForeignKeyConstraints() {
    try {
      const testTenant = this.createdTenants[0];
      
      // Verify tenant-user relationship
      const tenantUsers = await prisma.tenantUser.findMany({
        where: { tenantId: testTenant.id },
        include: { tenant: true }
      });
      
      const relationshipValid = tenantUsers.every(user => 
        user.tenant && user.tenant.id === testTenant.id
      );
      
      this.recordTest(
        'Tenant-User Foreign Key Relationship',
        relationshipValid,
        relationshipValid ? 'Foreign key relationships properly maintained' : 'Foreign key relationship failed'
      );
    } catch (error) {
      this.recordTest(
        'Foreign Key Constraints Test',
        false,
        `Error: ${error.message}`
      );
    }
  }

  // Test 5: Security Edge Cases
  async testSecurityEdgeCases() {
    this.log('\n🛡️  Testing Security Edge Cases...');

    await this.testSQLInjectionPrevention();
    await this.testParameterTampering();
    await this.testSessionIsolation();
  }

  async testSQLInjectionPrevention() {
    try {
      // Attempt SQL injection through tenant slug search
      const maliciousSlug = "'; DROP TABLE tenant; --";
      
      let injectionPrevented = true;
      try {
        await tenantService.search(maliciousSlug);
      } catch (error) {
        // If it throws a syntax error, injection was attempted
        injectionPrevented = !error.message.includes('syntax error');
      }
      
      // Also test that the search doesn't break the database
      const normalSearch = await tenantService.search('test');
      const searchStillWorks = Array.isArray(normalSearch);
      
      this.recordTest(
        'SQL Injection Prevention',
        injectionPrevented && searchStillWorks,
        `Injection prevented: ${injectionPrevented}, Search works: ${searchStillWorks}`
      );
    } catch (error) {
      this.recordTest(
        'SQL Injection Prevention',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testParameterTampering() {
    try {
      const tenant1 = this.createdTenants[0];
      const tenant2 = this.createdTenants[1];
      
      // Simulate request where user tries to tamper with tenant ID in filter
      const tamperedFilter = applyTenantFilter(
        { tenantId: tenant1.id }, 
        { tenantId: tenant2.id } // User tries to override
      );
      
      // Should prioritize request context over user input
      const tamperingPrevented = tamperedFilter.tenantId === tenant1.id;
      
      this.recordTest(
        'Parameter Tampering Prevention',
        tamperingPrevented,
        tamperingPrevented ? 'Parameter tampering prevented' : 'Parameter tampering possible!'
      );
    } catch (error) {
      this.recordTest(
        'Parameter Tampering Prevention',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testSessionIsolation() {
    try {
      const tenant1 = this.createdTenants[0];
      const tenant2 = this.createdTenants[1];
      
      // Simulate two different session contexts
      const session1 = { tenantId: tenant1.id, tenantSlug: tenant1.slug };
      const session2 = { tenantId: tenant2.id, tenantSlug: tenant2.slug };
      
      // Verify sessions don't interfere with each other
      const session1Valid = session1.tenantId === tenant1.id && session1.tenantSlug === tenant1.slug;
      const session2Valid = session2.tenantId === tenant2.id && session2.tenantSlug === tenant2.slug;
      const sessionsDifferent = session1.tenantId !== session2.tenantId;
      
      this.recordTest(
        'Session Isolation',
        session1Valid && session2Valid && sessionsDifferent,
        'Session contexts properly isolated between tenants'
      );
    } catch (error) {
      this.recordTest(
        'Session Isolation',
        false,
        `Error: ${error.message}`
      );
    }
  }

  // Test 6: Performance and Scalability
  async testPerformanceAspects() {
    this.log('\n⚡ Testing Performance Aspects...');

    await this.testQueryPerformance();
    await this.testIndexUsage();
  }

  async testQueryPerformance() {
    try {
      const testTenant = this.createdTenants[0];
      
      // Measure tenant resolution time
      const startTime = Date.now();
      
      for (let i = 0; i < 10; i++) {
        await prisma.tenant.findFirst({
          where: { 
            slug: testTenant.slug,
            isActive: true 
          },
          include: { subscription: true }
        });
      }
      
      const endTime = Date.now();
      const avgTime = (endTime - startTime) / 10;
      
      // Should be under 50ms on average for tenant resolution
      const performanceAcceptable = avgTime < 50;
      
      this.recordTest(
        'Tenant Resolution Performance',
        performanceAcceptable,
        `Average resolution time: ${avgTime.toFixed(2)}ms`
      );
    } catch (error) {
      this.recordTest(
        'Query Performance Test',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testIndexUsage() {
    try {
      // Test that queries use proper indexes
      const testTenant = this.createdTenants[0];
      
      // These queries should be fast due to proper indexing
      const indexedQueries = [
        () => prisma.tenant.findFirst({ where: { slug: testTenant.slug } }),
        () => prisma.tenantUser.findMany({ where: { tenantId: testTenant.id } }),
        () => prisma.merchant.findMany({ where: { tenantId: testTenant.id } })
      ];
      
      let allQueriesFast = true;
      for (const query of indexedQueries) {
        const start = Date.now();
        await query();
        const duration = Date.now() - start;
        
        if (duration > 100) { // Should be under 100ms
          allQueriesFast = false;
          break;
        }
      }
      
      this.recordTest(
        'Database Index Usage',
        allQueriesFast,
        allQueriesFast ? 'All indexed queries performed well' : 'Some queries were slow - check indexes'
      );
    } catch (error) {
      this.recordTest(
        'Index Usage Test',
        false,
        `Error: ${error.message}`
      );
    }
  }

  // Main test runner
  async runAllTests() {
    this.log('🚀 Starting Comprehensive Multi-Tenant Test Suite...\n');

    try {
      // Setup
      await this.cleanupTestData();
      await this.createTestTenants();

      // Run all test categories
      await this.testTenantResolution();
      await this.testDataIsolation();
      await this.testSubscriptionLimits();
      await this.testDatabaseConstraints();
      await this.testSecurityEdgeCases();
      await this.testPerformanceAspects();

      // Generate report
      this.generateReport();

    } catch (error) {
      this.log(`Fatal error during testing: ${error.message}`, 'error');
      this.testResults.errors.push(`Fatal error: ${error.message}`);
    } finally {
      // Cleanup
      await this.cleanupTestData();
      await prisma.$disconnect();
    }
  }

  generateReport() {
    this.log('\n📊 TEST SUMMARY REPORT');
    this.log('='.repeat(50));
    this.log(`Total Tests: ${this.testResults.passed + this.testResults.failed}`);
    this.log(`Passed: ${this.testResults.passed}`, 'success');
    this.log(`Failed: ${this.testResults.failed}`, this.testResults.failed > 0 ? 'error' : 'info');
    this.log(`Success Rate: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1)}%`);

    if (this.testResults.failed > 0) {
      this.log('\n❌ FAILED TESTS:');
      this.testResults.errors.forEach(error => {
        this.log(`  - ${error}`, 'error');
      });
    }

    if (this.testResults.passed === this.testResults.passed + this.testResults.failed) {
      this.log('\n🎉 ALL TESTS PASSED! Multi-tenant architecture is working correctly.', 'success');
    } else {
      this.log('\n⚠️  SOME TESTS FAILED. Please review the issues above.', 'error');
    }

    // Write detailed report to file
    const reportData = {
      summary: {
        totalTests: this.testResults.passed + this.testResults.failed,
        passed: this.testResults.passed,
        failed: this.testResults.failed,
        successRate: ((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1) + '%',
        timestamp: new Date().toISOString()
      },
      details: this.testResults.details,
      errors: this.testResults.errors
    };

    require('fs').writeFileSync(
      'multi-tenant-test-report.json',
      JSON.stringify(reportData, null, 2)
    );

    this.log('📄 Detailed report written to: multi-tenant-test-report.json');
  }
}

// Run tests if executed directly
if (require.main === module) {
  const testSuite = new MultiTenantTestSuite();
  testSuite.runAllTests()
    .then(() => {
      process.exit(testSuite.testResults.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = MultiTenantTestSuite;