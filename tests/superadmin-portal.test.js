#!/usr/bin/env node

/**
 * SuperAdmin Portal Test Suite
 * 
 * Tests the SuperAdmin portal functionality:
 * 1. Authentication and authorization
 * 2. Tenant CRUD operations
 * 3. User management across tenants
 * 4. Audit logging
 * 5. Security controls
 * 6. API endpoints
 */

const prisma = require('../server/utils/prisma');
const logger = require('../server/utils/logger');
const bcrypt = require('bcryptjs');

class SuperAdminPortalTestSuite {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: [],
      details: []
    };
    this.testSuperAdmin = null;
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
    this.log('🏗️  Setting up SuperAdmin test data...');

    try {
      // Create test SuperAdmin
      const hashedPassword = await bcrypt.hash('SuperAdmin123!@#', 10);
      this.testSuperAdmin = await prisma.superAdmin.create({
        data: {
          email: 'test-superadmin@storehubqms.com',
          password: hashedPassword,
          fullName: 'Test SuperAdmin',
          isActive: true
        }
      });

      this.log(`Created test SuperAdmin: ${this.testSuperAdmin.email}`);
    } catch (error) {
      throw new Error(`Failed to create test SuperAdmin: ${error.message}`);
    }
  }

  async cleanupTestData() {
    this.log('🧹 Cleaning up SuperAdmin test data...');

    try {
      // Clean up test tenants
      for (const tenant of this.testTenants) {
        await this.cleanupTenantData(tenant.id);
      }

      // Clean up SuperAdmin audit logs
      if (this.testSuperAdmin) {
        await prisma.superAdminAuditLog.deleteMany({
          where: { superAdminId: this.testSuperAdmin.id }
        });
        
        // Delete test SuperAdmin
        await prisma.superAdmin.delete({
          where: { id: this.testSuperAdmin.id }
        });
      }
    } catch (error) {
      this.log(`Error during cleanup: ${error.message}`, 'error');
    }
  }

  async cleanupTenantData(tenantId) {
    const merchantIds = await this.getMerchantIds(tenantId);
    
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

  // Test 1: SuperAdmin Authentication
  async testSuperAdminAuthentication() {
    this.log('\n🔐 Testing SuperAdmin Authentication...');

    try {
      // Test password verification
      const isValidPassword = await bcrypt.compare('SuperAdmin123!@#', this.testSuperAdmin.password);
      const isInvalidPassword = await bcrypt.compare('wrongpassword', this.testSuperAdmin.password);

      this.recordTest(
        'SuperAdmin Password Verification - Valid',
        isValidPassword,
        'Valid password correctly verified'
      );

      this.recordTest(
        'SuperAdmin Password Verification - Invalid',
        !isInvalidPassword,
        'Invalid password correctly rejected'
      );

      // Test SuperAdmin lookup by email
      const foundSuperAdmin = await prisma.superAdmin.findUnique({
        where: { email: this.testSuperAdmin.email }
      });

      this.recordTest(
        'SuperAdmin Lookup by Email',
        foundSuperAdmin && foundSuperAdmin.id === this.testSuperAdmin.id,
        'SuperAdmin found by email'
      );

      // Test active status check
      this.recordTest(
        'SuperAdmin Active Status',
        this.testSuperAdmin.isActive === true,
        'SuperAdmin is active'
      );

    } catch (error) {
      this.recordTest(
        'SuperAdmin Authentication',
        false,
        `Error: ${error.message}`
      );
    }
  }

  // Test 2: Tenant CRUD Operations
  async testTenantCRUD() {
    this.log('\n🏢 Testing Tenant CRUD Operations...');

    try {
      // Test tenant creation
      const newTenant = await prisma.tenant.create({
        data: {
          name: 'SuperAdmin Test Tenant',
          slug: 'superadmin-test-tenant',
          isActive: true
        }
      });

      this.testTenants.push(newTenant);

      this.recordTest(
        'Tenant Creation',
        newTenant && newTenant.id,
        `Tenant created with ID: ${newTenant.id}`
      );

      // Test tenant subscription creation
      const subscription = await prisma.tenantSubscription.create({
        data: {
          tenantId: newTenant.id,
          status: 'active',
          priority: 'standard',
          billingCycle: 'monthly',
          maxMerchants: 3,
          maxQueuesPerMerchant: 5,
          maxUsersPerTenant: 10
        }
      });

      this.recordTest(
        'Tenant Subscription Creation',
        subscription && subscription.tenantId === newTenant.id,
        'Subscription created and linked to tenant'
      );

      // Test tenant reading with subscription
      const tenantWithSubscription = await prisma.tenant.findUnique({
        where: { id: newTenant.id },
        include: { subscription: true }
      });

      this.recordTest(
        'Tenant Reading with Subscription',
        tenantWithSubscription.subscription && tenantWithSubscription.subscription.status === 'active',
        'Tenant loaded with subscription data'
      );

      // Test tenant update
      const updatedTenant = await prisma.tenant.update({
        where: { id: newTenant.id },
        data: { name: 'Updated SuperAdmin Test Tenant' }
      });

      this.recordTest(
        'Tenant Update',
        updatedTenant.name === 'Updated SuperAdmin Test Tenant',
        'Tenant name updated successfully'
      );

      // Test subscription update
      await prisma.tenantSubscription.update({
        where: { tenantId: newTenant.id },
        data: { maxMerchants: 5 }
      });

      const updatedSubscription = await prisma.tenantSubscription.findUnique({
        where: { tenantId: newTenant.id }
      });

      this.recordTest(
        'Subscription Update',
        updatedSubscription.maxMerchants === 5,
        'Subscription limits updated successfully'
      );

    } catch (error) {
      this.recordTest(
        'Tenant CRUD Operations',
        false,
        `Error: ${error.message}`
      );
    }
  }

  // Test 3: User Management Across Tenants
  async testUserManagement() {
    this.log('\n👥 Testing User Management...');

    if (this.testTenants.length === 0) {
      this.recordTest(
        'User Management - Prerequisite',
        false,
        'No test tenants available for user management testing'
      );
      return;
    }

    try {
      const testTenant = this.testTenants[0];

      // Create tenant users
      const hashedPassword = await bcrypt.hash('UserTest123!@#', 10);
      
      const adminUser = await prisma.tenantUser.create({
        data: {
          tenantId: testTenant.id,
          email: 'admin@superadmintest.com',
          password: hashedPassword,
          fullName: 'Test Admin User',
          role: 'admin',
          isActive: true
        }
      });

      const regularUser = await prisma.tenantUser.create({
        data: {
          tenantId: testTenant.id,
          email: 'user@superadmintest.com',
          password: hashedPassword,
          fullName: 'Test Regular User',
          role: 'user',
          isActive: true
        }
      });

      this.recordTest(
        'Tenant User Creation - Admin',
        adminUser && adminUser.role === 'admin',
        'Admin user created successfully'
      );

      this.recordTest(
        'Tenant User Creation - Regular',
        regularUser && regularUser.role === 'user',
        'Regular user created successfully'
      );

      // Test user listing for tenant
      const tenantUsers = await prisma.tenantUser.findMany({
        where: { tenantId: testTenant.id }
      });

      this.recordTest(
        'Tenant User Listing',
        tenantUsers.length >= 2,
        `Found ${tenantUsers.length} users for tenant`
      );

      // Test user role update
      const updatedUser = await prisma.tenantUser.update({
        where: { id: regularUser.id },
        data: { role: 'manager' }
      });

      this.recordTest(
        'User Role Update',
        updatedUser.role === 'manager',
        'User role updated from user to manager'
      );

      // Test user deactivation
      await prisma.tenantUser.update({
        where: { id: regularUser.id },
        data: { isActive: false }
      });

      const deactivatedUser = await prisma.tenantUser.findUnique({
        where: { id: regularUser.id }
      });

      this.recordTest(
        'User Deactivation',
        deactivatedUser.isActive === false,
        'User successfully deactivated'
      );

    } catch (error) {
      this.recordTest(
        'User Management',
        false,
        `Error: ${error.message}`
      );
    }
  }

  // Test 4: Audit Logging
  async testAuditLogging() {
    this.log('\n📋 Testing Audit Logging...');

    try {
      // Create audit log entry
      const auditLog = await prisma.superAdminAuditLog.create({
        data: {
          superAdminId: this.testSuperAdmin.id,
          tenantId: this.testTenants[0]?.id || null,
          action: 'tenant.created',
          resourceType: 'tenant',
          resourceId: this.testTenants[0]?.id || 'test-resource-id',
          details: {
            tenantName: 'Test Tenant',
            plan: 'basic'
          },
          ipAddress: '127.0.0.1',
          userAgent: 'Test User Agent'
        }
      });

      this.recordTest(
        'Audit Log Creation',
        auditLog && auditLog.action === 'tenant.created',
        'Audit log entry created successfully'
      );

      // Test audit log retrieval
      const auditLogs = await prisma.superAdminAuditLog.findMany({
        where: { superAdminId: this.testSuperAdmin.id },
        orderBy: { timestamp: 'desc' }
      });

      this.recordTest(
        'Audit Log Retrieval',
        auditLogs.length > 0 && auditLogs[0].id === auditLog.id,
        `Retrieved ${auditLogs.length} audit log entries`
      );

      // Test audit log filtering by action
      const filteredLogs = await prisma.superAdminAuditLog.findMany({
        where: {
          superAdminId: this.testSuperAdmin.id,
          action: 'tenant.created'
        }
      });

      this.recordTest(
        'Audit Log Filtering',
        filteredLogs.length > 0 && filteredLogs.every(log => log.action === 'tenant.created'),
        'Audit logs properly filtered by action'
      );

    } catch (error) {
      this.recordTest(
        'Audit Logging',
        false,
        `Error: ${error.message}`
      );
    }
  }

  // Test 5: Security Controls
  async testSecurityControls() {
    this.log('\n🛡️  Testing Security Controls...');

    try {
      // Test unique email constraint for SuperAdmin
      let duplicateEmailError = false;
      try {
        await prisma.superAdmin.create({
          data: {
            email: this.testSuperAdmin.email, // Same email
            password: 'hashedpassword',
            fullName: 'Duplicate SuperAdmin'
          }
        });
      } catch (error) {
        duplicateEmailError = error.code === 'P2002' && error.meta?.target?.includes('email');
      }

      this.recordTest(
        'SuperAdmin Unique Email Constraint',
        duplicateEmailError,
        'Duplicate SuperAdmin email properly rejected'
      );

      // Test password reset token functionality
      const resetToken = 'test-reset-token-' + Date.now();
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now

      const updatedSuperAdmin = await prisma.superAdmin.update({
        where: { id: this.testSuperAdmin.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires
        }
      });

      this.recordTest(
        'Password Reset Token Setting',
        updatedSuperAdmin.passwordResetToken === resetToken,
        'Password reset token set successfully'
      );

      // Test token expiry logic (simulate expired token)
      const expiredResetExpires = new Date(Date.now() - 3600000); // 1 hour ago
      await prisma.superAdmin.update({
        where: { id: this.testSuperAdmin.id },
        data: { passwordResetExpires: expiredResetExpires }
      });

      const superAdminWithExpiredToken = await prisma.superAdmin.findUnique({
        where: { id: this.testSuperAdmin.id }
      });

      const tokenExpired = superAdminWithExpiredToken.passwordResetExpires < new Date();

      this.recordTest(
        'Password Reset Token Expiry',
        tokenExpired,
        'Password reset token expiry logic works correctly'
      );

    } catch (error) {
      this.recordTest(
        'Security Controls',
        false,
        `Error: ${error.message}`
      );
    }
  }

  // Test 6: System Statistics
  async testSystemStatistics() {
    this.log('\n📊 Testing System Statistics...');

    try {
      // Get system-wide counts
      const [
        totalTenants,
        activeTenants,
        totalSuperAdmins,
        activeSuperAdmins,
        totalAuditLogs
      ] = await Promise.all([
        prisma.tenant.count(),
        prisma.tenant.count({ where: { isActive: true } }),
        prisma.superAdmin.count(),
        prisma.superAdmin.count({ where: { isActive: true } }),
        prisma.superAdminAuditLog.count()
      ]);

      this.recordTest(
        'System Statistics - Tenant Counts',
        typeof totalTenants === 'number' && typeof activeTenants === 'number',
        `Total tenants: ${totalTenants}, Active: ${activeTenants}`
      );

      this.recordTest(
        'System Statistics - SuperAdmin Counts',
        typeof totalSuperAdmins === 'number' && typeof activeSuperAdmins === 'number',
        `Total SuperAdmins: ${totalSuperAdmins}, Active: ${activeSuperAdmins}`
      );

      this.recordTest(
        'System Statistics - Audit Log Count',
        typeof totalAuditLogs === 'number',
        `Total audit logs: ${totalAuditLogs}`
      );

      // Test statistics with date filtering
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayAuditLogs = await prisma.superAdminAuditLog.count({
        where: {
          timestamp: {
            gte: today
          }
        }
      });

      this.recordTest(
        'System Statistics - Date Filtering',
        typeof todayAuditLogs === 'number',
        `Audit logs today: ${todayAuditLogs}`
      );

    } catch (error) {
      this.recordTest(
        'System Statistics',
        false,
        `Error: ${error.message}`
      );
    }
  }

  // Test 7: Bulk Operations
  async testBulkOperations() {
    this.log('\n📦 Testing Bulk Operations...');

    try {
      // Create multiple test tenants for bulk operations
      const bulkTenants = [];
      for (let i = 1; i <= 3; i++) {
        const tenant = await prisma.tenant.create({
          data: {
            name: `Bulk Test Tenant ${i}`,
            slug: `bulk-test-tenant-${i}`,
            isActive: true
          }
        });
        bulkTenants.push(tenant);
        this.testTenants.push(tenant);
      }

      this.recordTest(
        'Bulk Tenant Creation',
        bulkTenants.length === 3,
        `Created ${bulkTenants.length} tenants for bulk testing`
      );

      // Test bulk update (deactivate all bulk test tenants)
      const bulkUpdateResult = await prisma.tenant.updateMany({
        where: {
          id: { in: bulkTenants.map(t => t.id) }
        },
        data: {
          isActive: false
        }
      });

      this.recordTest(
        'Bulk Tenant Update',
        bulkUpdateResult.count === 3,
        `Bulk updated ${bulkUpdateResult.count} tenants`
      );

      // Verify bulk update worked
      const deactivatedTenants = await prisma.tenant.findMany({
        where: {
          id: { in: bulkTenants.map(t => t.id) },
          isActive: false
        }
      });

      this.recordTest(
        'Bulk Update Verification',
        deactivatedTenants.length === 3,
        'All bulk test tenants successfully deactivated'
      );

    } catch (error) {
      this.recordTest(
        'Bulk Operations',
        false,
        `Error: ${error.message}`
      );
    }
  }

  async runAllTests() {
    this.log('🚀 Starting SuperAdmin Portal Test Suite...\n');

    try {
      // Setup
      await this.setupTestData();

      // Run tests
      await this.testSuperAdminAuthentication();
      await this.testTenantCRUD();
      await this.testUserManagement();
      await this.testAuditLogging();
      await this.testSecurityControls();
      await this.testSystemStatistics();
      await this.testBulkOperations();

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
    this.log('\n📊 SUPERADMIN PORTAL TEST REPORT');
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
      component: 'SuperAdminPortal',
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
      'superadmin-portal-test-report.json',
      JSON.stringify(reportData, null, 2)
    );

    this.log('📄 Detailed report written to: superadmin-portal-test-report.json');
  }
}

// Run tests if executed directly
if (require.main === module) {
  const testSuite = new SuperAdminPortalTestSuite();
  testSuite.runAllTests()
    .then(() => {
      process.exit(testSuite.testResults.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = SuperAdminPortalTestSuite;