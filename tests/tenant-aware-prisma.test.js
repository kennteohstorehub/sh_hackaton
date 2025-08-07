#!/usr/bin/env node

/**
 * TenantAwarePrisma Wrapper Test Suite
 * 
 * Tests the tenant-aware Prisma wrapper for:
 * 1. Automatic tenant filtering on all queries
 * 2. Prevention of cross-tenant data access
 * 3. Proper handling of nested relations
 * 4. Error handling for missing tenant context
 */

const prisma = require('../server/utils/prisma');
const logger = require('../server/utils/logger');
const tenantService = require('../server/services/tenantService');

class TenantAwarePrismaWrapper {
  constructor(tenantId) {
    this.tenantId = tenantId;
    this.prisma = prisma;
  }

  // Automatically apply tenant filter to queries
  applyTenantFilter(args = {}) {
    if (!this.tenantId) {
      throw new Error('Tenant context required for database operations');
    }

    const where = args.where || {};
    
    // Apply tenant filter
    return {
      ...args,
      where: {
        ...where,
        tenantId: this.tenantId
      }
    };
  }

  // Override Prisma methods to add tenant filtering
  merchant = {
    findMany: (args) => this.prisma.merchant.findMany(this.applyTenantFilter(args)),
    findUnique: (args) => this.prisma.merchant.findUnique(this.applyTenantFilter(args)),
    findFirst: (args) => this.prisma.merchant.findFirst(this.applyTenantFilter(args)),
    create: (args) => {
      const data = { ...args.data, tenantId: this.tenantId };
      return this.prisma.merchant.create({ ...args, data });
    },
    update: (args) => this.prisma.merchant.update(this.applyTenantFilter(args)),
    delete: (args) => this.prisma.merchant.delete(this.applyTenantFilter(args)),
    count: (args) => this.prisma.merchant.count(this.applyTenantFilter(args))
  };

  tenantUser = {
    findMany: (args) => this.prisma.tenantUser.findMany(this.applyTenantFilter(args)),
    findUnique: (args) => this.prisma.tenantUser.findUnique(this.applyTenantFilter(args)),
    findFirst: (args) => this.prisma.tenantUser.findFirst(this.applyTenantFilter(args)),
    create: (args) => {
      const data = { ...args.data, tenantId: this.tenantId };
      return this.prisma.tenantUser.create({ ...args, data });
    },
    update: (args) => this.prisma.tenantUser.update(this.applyTenantFilter(args)),
    delete: (args) => this.prisma.tenantUser.delete(this.applyTenantFilter(args)),
    count: (args) => this.prisma.tenantUser.count(this.applyTenantFilter(args))
  };

  webChatMessage = {
    findMany: (args) => this.prisma.webChatMessage.findMany(this.applyTenantFilter(args)),
    findUnique: (args) => this.prisma.webChatMessage.findUnique(this.applyTenantFilter(args)),
    findFirst: (args) => this.prisma.webChatMessage.findFirst(this.applyTenantFilter(args)),
    create: (args) => {
      const data = { ...args.data, tenantId: this.tenantId };
      return this.prisma.webChatMessage.create({ ...args, data });
    },
    update: (args) => this.prisma.webChatMessage.update(this.applyTenantFilter(args)),
    delete: (args) => this.prisma.webChatMessage.delete(this.applyTenantFilter(args)),
    count: (args) => this.prisma.webChatMessage.count(this.applyTenantFilter(args))
  };

  notificationLog = {
    findMany: (args) => this.prisma.notificationLog.findMany(this.applyTenantFilter(args)),
    findUnique: (args) => this.prisma.notificationLog.findUnique(this.applyTenantFilter(args)),
    findFirst: (args) => this.prisma.notificationLog.findFirst(this.applyTenantFilter(args)),
    create: (args) => {
      const data = { ...args.data, tenantId: this.tenantId };
      return this.prisma.notificationLog.create({ ...args, data });
    },
    update: (args) => this.prisma.notificationLog.update(this.applyTenantFilter(args)),
    delete: (args) => this.prisma.notificationLog.delete(this.applyTenantFilter(args)),
    count: (args) => this.prisma.notificationLog.count(this.applyTenantFilter(args))
  };

  auditLog = {
    findMany: (args) => this.prisma.auditLog.findMany(this.applyTenantFilter(args)),
    findUnique: (args) => this.prisma.auditLog.findUnique(this.applyTenantFilter(args)),
    findFirst: (args) => this.prisma.auditLog.findFirst(this.applyTenantFilter(args)),
    create: (args) => {
      const data = { ...args.data, tenantId: this.tenantId };
      return this.prisma.auditLog.create({ ...args, data });
    },
    update: (args) => this.prisma.auditLog.update(this.applyTenantFilter(args)),
    delete: (args) => this.prisma.auditLog.delete(this.applyTenantFilter(args)),
    count: (args) => this.prisma.auditLog.count(this.applyTenantFilter(args))
  };

  // For models that access via merchant relationship
  queue = {
    findMany: (args) => {
      const merchantFilter = this.tenantId ? {
        merchant: { tenantId: this.tenantId }
      } : {};
      
      return this.prisma.queue.findMany({
        ...args,
        where: {
          ...args?.where,
          ...merchantFilter
        }
      });
    },
    findUnique: (args) => {
      const merchantFilter = this.tenantId ? {
        merchant: { tenantId: this.tenantId }
      } : {};
      
      return this.prisma.queue.findUnique({
        ...args,
        where: {
          ...args?.where,
          ...merchantFilter
        }
      });
    },
    findFirst: (args) => {
      const merchantFilter = this.tenantId ? {
        merchant: { tenantId: this.tenantId }
      } : {};
      
      return this.prisma.queue.findFirst({
        ...args,
        where: {
          ...args?.where,
          ...merchantFilter
        }
      });
    },
    count: (args) => {
      const merchantFilter = this.tenantId ? {
        merchant: { tenantId: this.tenantId }
      } : {};
      
      return this.prisma.queue.count({
        ...args,
        where: {
          ...args?.where,
          ...merchantFilter
        }
      });
    }
  };
}

class TenantAwarePrismaTestSuite {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: [],
      details: []
    };
    this.testTenants = [];
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

  async setupTestData() {
    this.log('🏗️  Setting up test data...');

    // Create test tenants
    const tenant1Data = {
      name: 'Prisma Test Tenant 1',
      slug: 'prisma-test-1',
      adminEmail: 'admin1@prismatest.com',
      adminName: 'Prisma Admin 1',
      adminPassword: 'PrismaTest123!@#',
      plan: 'basic'
    };

    const tenant2Data = {
      name: 'Prisma Test Tenant 2',
      slug: 'prisma-test-2',
      adminEmail: 'admin2@prismatest.com',
      adminName: 'Prisma Admin 2',
      adminPassword: 'PrismaTest123!@#',
      plan: 'basic'
    };

    try {
      const result1 = await tenantService.create(tenant1Data);
      const result2 = await tenantService.create(tenant2Data);
      
      this.testTenants = [result1.tenant, result2.tenant];
      this.log(`Created test tenants: ${this.testTenants.map(t => t.name).join(', ')}`);
    } catch (error) {
      throw new Error(`Failed to create test tenants: ${error.message}`);
    }
  }

  async cleanupTestData() {
    this.log('🧹 Cleaning up test data...');

    try {
      for (const tenant of this.testTenants) {
        // Get merchant IDs first
        const merchants = await prisma.merchant.findMany({
          where: { tenantId: tenant.id },
          select: { id: true }
        });
        const merchantIds = merchants.map(m => m.id);

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

        await prisma.auditLog.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.webChatMessage.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.notificationLog.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.merchant.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.tenantUser.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.tenantSubscription.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.tenant.delete({ where: { id: tenant.id } });
      }
    } catch (error) {
      this.log(`Error during cleanup: ${error.message}`, 'error');
    }
  }

  async testTenantFilterApplication() {
    this.log('\n🔍 Testing Tenant Filter Application...');

    const tenant1 = this.testTenants[0];
    const tenant2 = this.testTenants[1];

    // Create wrapper instances
    const tenant1Prisma = new TenantAwarePrismaWrapper(tenant1.id);
    const tenant2Prisma = new TenantAwarePrismaWrapper(tenant2.id);

    try {
      // Test merchant queries with tenant filtering
      const tenant1Merchants = await tenant1Prisma.merchant.findMany();
      const tenant2Merchants = await tenant2Prisma.merchant.findMany();

      // Verify that each tenant only sees their own merchants
      const tenant1OnlyOwnMerchants = tenant1Merchants.every(m => m.tenantId === tenant1.id);
      const tenant2OnlyOwnMerchants = tenant2Merchants.every(m => m.tenantId === tenant2.id);

      this.recordTest(
        'Merchant Tenant Filtering - Tenant 1',
        tenant1OnlyOwnMerchants,
        `Found ${tenant1Merchants.length} merchants, all belong to tenant 1`
      );

      this.recordTest(
        'Merchant Tenant Filtering - Tenant 2',
        tenant2OnlyOwnMerchants,
        `Found ${tenant2Merchants.length} merchants, all belong to tenant 2`
      );

      // Test cross-tenant isolation
      const crossTenantCheck = tenant1Merchants.some(m => 
        tenant2Merchants.some(m2 => m.id === m2.id)
      );

      this.recordTest(
        'Cross-Tenant Merchant Isolation',
        !crossTenantCheck,
        crossTenantCheck ? 'SECURITY ISSUE: Found shared merchants between tenants!' : 'No shared merchants found'
      );

    } catch (error) {
      this.recordTest(
        'Tenant Filter Application',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testTenantUserFiltering() {
    this.log('\n👥 Testing Tenant User Filtering...');

    const tenant1 = this.testTenants[0];
    const tenant2 = this.testTenants[1];

    const tenant1Prisma = new TenantAwarePrismaWrapper(tenant1.id);
    const tenant2Prisma = new TenantAwarePrismaWrapper(tenant2.id);

    try {
      // Query tenant users
      const tenant1Users = await tenant1Prisma.tenantUser.findMany();
      const tenant2Users = await tenant2Prisma.tenantUser.findMany();

      // Verify proper filtering
      const tenant1Filtered = tenant1Users.every(u => u.tenantId === tenant1.id);
      const tenant2Filtered = tenant2Users.every(u => u.tenantId === tenant2.id);

      this.recordTest(
        'Tenant User Filtering - Tenant 1',
        tenant1Filtered,
        `Found ${tenant1Users.length} users for tenant 1`
      );

      this.recordTest(
        'Tenant User Filtering - Tenant 2',
        tenant2Filtered,
        `Found ${tenant2Users.length} users for tenant 2`
      );

      // Test user isolation
      const userCrossTenantCheck = tenant1Users.some(u => 
        tenant2Users.some(u2 => u.id === u2.id)
      );

      this.recordTest(
        'Tenant User Isolation',
        !userCrossTenantCheck,
        userCrossTenantCheck ? 'SECURITY ISSUE: Found shared users between tenants!' : 'User isolation maintained'
      );

    } catch (error) {
      this.recordTest(
        'Tenant User Filtering',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testMissingTenantContext() {
    this.log('\n⚠️  Testing Missing Tenant Context Handling...');

    try {
      // Create wrapper without tenant context
      const noTenantPrisma = new TenantAwarePrismaWrapper(null);

      let errorThrown = false;
      let errorMessage = '';

      try {
        await noTenantPrisma.merchant.findMany();
      } catch (error) {
        errorThrown = true;
        errorMessage = error.message;
      }

      const correctErrorHandling = errorThrown && errorMessage.includes('Tenant context required');

      this.recordTest(
        'Missing Tenant Context Error Handling',
        correctErrorHandling,
        correctErrorHandling ? 'Properly rejected query without tenant context' : 'Should have thrown error for missing tenant context'
      );

    } catch (error) {
      this.recordTest(
        'Missing Tenant Context Handling',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testNestedRelationFiltering() {
    this.log('\n🔗 Testing Nested Relation Filtering...');

    const tenant1 = this.testTenants[0];
    const tenant1Prisma = new TenantAwarePrismaWrapper(tenant1.id);

    try {
      // Test queue queries that need to filter through merchant relationship
      const tenant1Queues = await tenant1Prisma.queue.findMany({
        include: {
          merchant: true
        }
      });

      // Verify all queues belong to merchants of the correct tenant
      const allQueuesCorrectTenant = tenant1Queues.every(q => 
        q.merchant && q.merchant.tenantId === tenant1.id
      );

      this.recordTest(
        'Nested Relation Filtering - Queues via Merchant',
        allQueuesCorrectTenant,
        `Found ${tenant1Queues.length} queues, all belong to tenant 1 merchants`
      );

      // Test queue count
      const queueCount = await tenant1Prisma.queue.count();
      const validCount = typeof queueCount === 'number' && queueCount >= 0;

      this.recordTest(
        'Nested Relation Count Query',
        validCount,
        `Queue count: ${queueCount}`
      );

    } catch (error) {
      this.recordTest(
        'Nested Relation Filtering',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testCreateOperations() {
    this.log('\n➕ Testing Create Operations with Tenant Context...');

    const tenant1 = this.testTenants[0];
    const tenant1Prisma = new TenantAwarePrismaWrapper(tenant1.id);

    try {
      // Create a tenant user
      const newUser = await tenant1Prisma.tenantUser.create({
        data: {
          email: 'testuser@example.com',
          password: 'hashedpassword123',
          fullName: 'Test User',
          role: 'user'
        }
      });

      // Verify tenant ID was automatically set
      const tenantIdSetCorrectly = newUser.tenantId === tenant1.id;

      this.recordTest(
        'Create Operation - Automatic Tenant ID Setting',
        tenantIdSetCorrectly,
        tenantIdSetCorrectly ? `User created with correct tenant ID: ${newUser.tenantId}` : 'Tenant ID not set correctly'
      );

      // Clean up test user
      await prisma.tenantUser.delete({ where: { id: newUser.id } });

    } catch (error) {
      this.recordTest(
        'Create Operations',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testUpdateAndDeleteOperations() {
    this.log('\n✏️  Testing Update and Delete Operations...');

    const tenant1 = this.testTenants[0];
    const tenant2 = this.testTenants[1];

    const tenant1Prisma = new TenantAwarePrismaWrapper(tenant1.id);
    const tenant2Prisma = new TenantAwarePrismaWrapper(tenant2.id);

    try {
      // Create test users for both tenants
      const tenant1User = await prisma.tenantUser.create({
        data: {
          tenantId: tenant1.id,
          email: 'update-test1@example.com',
          password: 'hashedpassword123',
          fullName: 'Update Test User 1',
          role: 'user'
        }
      });

      const tenant2User = await prisma.tenantUser.create({
        data: {
          tenantId: tenant2.id,
          email: 'update-test2@example.com',
          password: 'hashedpassword123',
          fullName: 'Update Test User 2',
          role: 'user'
        }
      });

      // Try to update tenant2 user using tenant1 context
      let crossTenantUpdatePrevented = false;
      try {
        await tenant1Prisma.tenantUser.update({
          where: { id: tenant2User.id },
          data: { fullName: 'Hacked Name' }
        });
      } catch (error) {
        crossTenantUpdatePrevented = true;
      }

      this.recordTest(
        'Cross-Tenant Update Prevention',
        crossTenantUpdatePrevented,
        crossTenantUpdatePrevented ? 'Cross-tenant update properly blocked' : 'SECURITY ISSUE: Cross-tenant update allowed!'
      );

      // Try to delete tenant2 user using tenant1 context
      let crossTenantDeletePrevented = false;
      try {
        await tenant1Prisma.tenantUser.delete({
          where: { id: tenant2User.id }
        });
      } catch (error) {
        crossTenantDeletePrevented = true;
      }

      this.recordTest(
        'Cross-Tenant Delete Prevention',
        crossTenantDeletePrevented,
        crossTenantDeletePrevented ? 'Cross-tenant delete properly blocked' : 'SECURITY ISSUE: Cross-tenant delete allowed!'
      );

      // Clean up test users
      await prisma.tenantUser.delete({ where: { id: tenant1User.id } });
      await prisma.tenantUser.delete({ where: { id: tenant2User.id } });

    } catch (error) {
      this.recordTest(
        'Update and Delete Operations',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async testComplexQueries() {
    this.log('\n🔍 Testing Complex Queries with Multiple Filters...');

    const tenant1 = this.testTenants[0];
    const tenant1Prisma = new TenantAwarePrismaWrapper(tenant1.id);

    try {
      // Test complex merchant query with additional filters
      const activeMerchants = await tenant1Prisma.merchant.findMany({
        where: {
          isActive: true,
          businessType: 'restaurant'
        },
        include: {
          queues: {
            where: {
              isActive: true
            }
          }
        }
      });

      // Verify all merchants belong to correct tenant
      const allCorrectTenant = activeMerchants.every(m => m.tenantId === tenant1.id);
      
      // Verify additional filters were applied
      const allActive = activeMerchants.every(m => m.isActive === true);
      const allRestaurant = activeMerchants.every(m => m.businessType === 'restaurant');

      this.recordTest(
        'Complex Query - Tenant Filter',
        allCorrectTenant,
        `All ${activeMerchants.length} merchants belong to correct tenant`
      );

      this.recordTest(
        'Complex Query - Additional Filters',
        allActive && allRestaurant,
        `All merchants are active restaurants as filtered`
      );

    } catch (error) {
      this.recordTest(
        'Complex Queries',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async runAllTests() {
    this.log('🚀 Starting TenantAwarePrisma Test Suite...\n');

    try {
      // Setup
      await this.setupTestData();

      // Run tests
      await this.testTenantFilterApplication();
      await this.testTenantUserFiltering();
      await this.testMissingTenantContext();
      await this.testNestedRelationFiltering();
      await this.testCreateOperations();
      await this.testUpdateAndDeleteOperations();
      await this.testComplexQueries();

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
    this.log('\n📊 TENANT-AWARE PRISMA TEST REPORT');
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

    const reportData = {
      component: 'TenantAwarePrisma',
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
      'tenant-aware-prisma-test-report.json',
      JSON.stringify(reportData, null, 2)
    );

    this.log('📄 Detailed report written to: tenant-aware-prisma-test-report.json');
  }
}

// Run tests if executed directly
if (require.main === module) {
  const testSuite = new TenantAwarePrismaTestSuite();
  testSuite.runAllTests()
    .then(() => {
      process.exit(testSuite.testResults.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { TenantAwarePrismaWrapper, TenantAwarePrismaTestSuite };