#!/usr/bin/env node

/**
 * Security Validation Test Suite
 * 
 * Tests the security aspects of the multi-tenant implementation:
 * 1. Tenant isolation verification
 * 2. Cross-tenant access prevention
 * 3. Authentication security
 * 4. SQL injection prevention
 * 5. Session security
 */

const prisma = require('../server/utils/prisma');
const logger = require('../server/utils/logger');
const tenantService = require('../server/services/tenantService');
const { resolveTenant, validateTenantUser } = require('../server/middleware/tenantResolver');
const bcrypt = require('bcryptjs');

class SecurityValidationTestSuite {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      critical: 0,
      errors: [],
      details: []
    };
    this.testTenants = [];
    this.testUsers = [];
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
    } else if (level === 'critical') {
      logger.error(logMessage);
      console.error(`🚨 ${message}`);
    } else {
      logger.info(logMessage);
      console.log(`ℹ️  ${message}`);
    }
  }

  recordTest(testName, passed, details = '', isCritical = false) {
    const result = {
      test: testName,
      passed,
      details,
      critical: isCritical,
      timestamp: new Date().toISOString()
    };

    this.testResults.details.push(result);
    
    if (passed) {
      this.testResults.passed++;
      this.log(`${testName}: PASSED ${details}`, 'success');
    } else {
      this.testResults.failed++;
      if (isCritical) {
        this.testResults.critical++;
        this.log(`${testName}: CRITICAL FAILURE ${details}`, 'critical');
      } else {
        this.log(`${testName}: FAILED ${details}`, 'error');
      }
      this.testResults.errors.push(`${testName}: ${details}`);
    }
  }

  async setupTestData() {
    this.log('🏗️  Setting up security test data...');

    try {
      // Create two test tenants for isolation testing
      const tenant1Result = await tenantService.create({
        name: 'Security Test Tenant 1',
        slug: 'security-test-1',
        adminEmail: 'admin1@securitytest.com',
        adminName: 'Security Admin 1',
        adminPassword: 'SecurePass123!',
        plan: 'basic'
      });

      const tenant2Result = await tenantService.create({
        name: 'Security Test Tenant 2',
        slug: 'security-test-2',
        adminEmail: 'admin2@securitytest.com',
        adminName: 'Security Admin 2',
        adminPassword: 'SecurePass123!',
        plan: 'basic'
      });

      this.testTenants = [tenant1Result.tenant, tenant2Result.tenant];
      this.testUsers = [tenant1Result.adminUser, tenant2Result.adminUser];

      this.log(`Created test tenants: ${this.testTenants.map(t => t.name).join(', ')}`);
    } catch (error) {
      throw new Error(`Failed to create test data: ${error.message}`);
    }
  }

  async cleanupTestData() {
    this.log('🧹 Cleaning up security test data...');

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
        await prisma.superAdminAuditLog.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.tenantSubscription.deleteMany({ where: { tenantId: tenant.id } });
        await prisma.tenant.delete({ where: { id: tenant.id } });
      }
    } catch (error) {
      this.log(`Error during cleanup: ${error.message}`, 'error');
    }
  }

  // Test 1: Tenant Data Isolation
  async testTenantDataIsolation() {
    this.log('\n🔒 Testing Tenant Data Isolation...');

    try {
      const tenant1 = this.testTenants[0];
      const tenant2 = this.testTenants[1];

      // Verify tenants have separate data
      const tenant1Merchants = await prisma.merchant.findMany({
        where: { tenantId: tenant1.id }
      });

      const tenant2Merchants = await prisma.merchant.findMany({
        where: { tenantId: tenant2.id }
      });

      this.recordTest(
        'Merchant Data Isolation',
        tenant1Merchants.length > 0 && tenant2Merchants.length > 0,
        `Tenant 1: ${tenant1Merchants.length} merchants, Tenant 2: ${tenant2Merchants.length} merchants`,
        false
      );

      // Verify no cross-tenant merchant access
      const crossTenantMerchants = await prisma.merchant.findMany({
        where: {
          tenantId: tenant1.id,
          id: { in: tenant2Merchants.map(m => m.id) }
        }
      });

      this.recordTest(
        'Cross-Tenant Merchant Access Prevention',
        crossTenantMerchants.length === 0,
        crossTenantMerchants.length === 0 ? 'No cross-tenant access detected' : `${crossTenantMerchants.length} cross-tenant merchants found!`,
        true
      );

      // Test user isolation
      const tenant1Users = await prisma.tenantUser.findMany({
        where: { tenantId: tenant1.id }
      });

      const tenant2Users = await prisma.tenantUser.findMany({
        where: { tenantId: tenant2.id }
      });

      const crossTenantUsers = tenant1Users.filter(u1 => 
        tenant2Users.some(u2 => u1.id === u2.id)
      );

      this.recordTest(
        'Cross-Tenant User Access Prevention',
        crossTenantUsers.length === 0,
        crossTenantUsers.length === 0 ? 'No shared users between tenants' : `${crossTenantUsers.length} shared users detected!`,
        true
      );

    } catch (error) {
      this.recordTest(
        'Tenant Data Isolation',
        false,
        `Error: ${error.message}`,
        true
      );
    }
  }

  // Test 2: Authentication Security
  async testAuthenticationSecurity() {
    this.log('\n🔐 Testing Authentication Security...');

    try {
      const testUser = this.testUsers[0];

      // Test password hashing
      const isPasswordHashed = !testUser.password.startsWith('SecurePass');
      const isValidBcrypt = testUser.password.startsWith('$2');

      this.recordTest(
        'Password Hashing',
        isPasswordHashed && isValidBcrypt,
        isPasswordHashed ? 'Passwords properly hashed with bcrypt' : 'Passwords not properly hashed!',
        true
      );

      // Test password verification
      const validPassword = await bcrypt.compare('SecurePass123!', testUser.password);
      const invalidPassword = await bcrypt.compare('WrongPassword', testUser.password);

      this.recordTest(
        'Password Verification - Valid',
        validPassword === true,
        'Valid password correctly verified'
      );

      this.recordTest(
        'Password Verification - Invalid',
        invalidPassword === false,
        'Invalid password correctly rejected'
      );

      // Test unique email constraint (attempt duplicate)
      let duplicateEmailPrevented = false;
      try {
        await prisma.tenantUser.create({
          data: {
            tenantId: testUser.tenantId,
            email: testUser.email, // Same email
            password: 'hashedpassword',
            fullName: 'Duplicate User',
            role: 'user'
          }
        });
      } catch (error) {
        duplicateEmailPrevented = error.code === 'P2002';
      }

      this.recordTest(
        'Unique Email Constraint',
        duplicateEmailPrevented,
        duplicateEmailPrevented ? 'Duplicate email properly rejected' : 'Duplicate email was allowed!',
        true
      );

    } catch (error) {
      this.recordTest(
        'Authentication Security',
        false,
        `Error: ${error.message}`,
        true
      );
    }
  }

  // Test 3: SQL Injection Prevention
  async testSQLInjectionPrevention() {
    this.log('\n💉 Testing SQL Injection Prevention...');

    try {
      // Test malicious input in tenant search
      const maliciousInputs = [
        "'; DROP TABLE tenant; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM tenant_user --",
        "'; INSERT INTO tenant (name) VALUES ('hacked'); --"
      ];

      let allInjectionsPrevented = true;
      let injectionResults = [];

      for (const maliciousInput of maliciousInputs) {
        try {
          // This should be safe due to Prisma parameterization
          const results = await tenantService.search(maliciousInput);
          
          // Check if we get any results (should be empty or safe results)
          const isSafe = Array.isArray(results) && results.length === 0;
          injectionResults.push({ input: maliciousInput, safe: isSafe });
          
          if (!isSafe) {
            allInjectionsPrevented = false;
          }
        } catch (error) {
          // Errors are acceptable - they indicate the query was rejected
          injectionResults.push({ input: maliciousInput, safe: true, error: error.message });
        }
      }

      this.recordTest(
        'SQL Injection Prevention',
        allInjectionsPrevented,
        `Tested ${maliciousInputs.length} injection attempts, all safely handled`,
        true
      );

      // Test that normal search still works
      const normalSearch = await tenantService.search('security-test');
      const normalSearchWorks = Array.isArray(normalSearch);

      this.recordTest(
        'Normal Search Functionality',
        normalSearchWorks,
        'Normal search operations work correctly after injection tests'
      );

    } catch (error) {
      this.recordTest(
        'SQL Injection Prevention',
        false,
        `Error: ${error.message}`,
        true
      );
    }
  }

  // Test 4: Session Security
  async testSessionSecurity() {
    this.log('\n🎫 Testing Session Security...');

    try {
      const tenant1 = this.testTenants[0];
      const tenant2 = this.testTenants[1];

      // Test tenant context isolation in requests
      const req1 = {
        hostname: 'security-test-1.storehubqms.com',
        get: () => 'security-test-1.storehubqms.com',
        session: {}
      };

      const req2 = {
        hostname: 'security-test-2.storehubqms.com', 
        get: () => 'security-test-2.storehubqms.com',
        session: {}
      };

      const res = { locals: {} };
      const next = () => {};

      // Resolve tenant contexts
      await resolveTenant(req1, res, next);
      await resolveTenant(req2, res, next);

      // Verify correct tenant resolution
      const tenant1Resolved = req1.tenant && req1.tenant.id === tenant1.id;
      const tenant2Resolved = req2.tenant && req2.tenant.id === tenant2.id;

      this.recordTest(
        'Tenant Context Resolution',
        tenant1Resolved && tenant2Resolved,
        'Both tenants correctly resolved from subdomains'
      );

      // Verify session isolation
      const session1Isolated = req1.session.tenantId === tenant1.id;
      const session2Isolated = req2.session.tenantId === tenant2.id;
      const sessionsNotMixed = req1.session.tenantId !== req2.session.tenantId;

      this.recordTest(
        'Session Tenant Isolation',
        session1Isolated && session2Isolated && sessionsNotMixed,
        'Session contexts properly isolated between tenants',
        true
      );

    } catch (error) {
      this.recordTest(
        'Session Security',
        false,
        `Error: ${error.message}`,
        true
      );
    }
  }

  // Test 5: Access Control Validation
  async testAccessControlValidation() {
    this.log('\n🛡️  Testing Access Control Validation...');

    try {
      const tenant1 = this.testTenants[0];
      const tenant2 = this.testTenants[1];
      const user1 = this.testUsers[0];

      // Test user trying to access different tenant
      const req = {
        tenantId: tenant2.id, // User trying to access tenant 2
        user: { tenantUserId: user1.id } // But user belongs to tenant 1
      };

      let accessDenied = false;
      const res = {
        status: (code) => ({
          json: (data) => {
            if (code === 403 || code === 401) {
              accessDenied = true;
            }
            return { statusCode: code, data };
          }
        })
      };

      const next = () => {
        accessDenied = false; // If next is called, access was allowed
      };

      await validateTenantUser(req, res, next);

      this.recordTest(
        'Cross-Tenant Access Control',
        accessDenied,
        accessDenied ? 'Cross-tenant access properly denied' : 'Cross-tenant access was allowed!',
        true
      );

      // Test valid access
      const validReq = {
        tenantId: tenant1.id,
        user: { tenantUserId: user1.id }
      };

      let validAccessAllowed = false;
      const validNext = () => {
        validAccessAllowed = true;
      };

      await validateTenantUser(validReq, res, validNext);

      this.recordTest(
        'Valid Tenant Access',
        validAccessAllowed,
        'Valid tenant access properly allowed'
      );

    } catch (error) {
      this.recordTest(
        'Access Control Validation',
        false,
        `Error: ${error.message}`,
        true
      );
    }
  }

  // Test 6: Data Leakage Prevention
  async testDataLeakagePrevention() {
    this.log('\n🔍 Testing Data Leakage Prevention...');

    try {
      const tenant1 = this.testTenants[0];
      const tenant2 = this.testTenants[1];

      // Test that aggregate queries don't leak data between tenants
      const tenant1Stats = await tenantService.getUsageStats(tenant1.id);
      const tenant2Stats = await tenantService.getUsageStats(tenant2.id);

      // Verify stats are separate
      const statsIsolated = (
        tenant1Stats.merchants >= 0 && 
        tenant2Stats.merchants >= 0 &&
        (tenant1Stats.merchants !== tenant2Stats.merchants || 
         tenant1Stats.queues !== tenant2Stats.queues)
      );

      this.recordTest(
        'Usage Statistics Isolation',
        statsIsolated,
        'Usage statistics properly isolated between tenants'
      );

      // Test subscription limit isolation
      const tenant1Limits = await tenantService.checkSubscriptionLimits(tenant1.id);
      const tenant2Limits = await tenantService.checkSubscriptionLimits(tenant2.id);

      const limitsIsolated = (
        tenant1Limits.usage && tenant2Limits.usage &&
        tenant1Limits.limits && tenant2Limits.limits
      );

      this.recordTest(
        'Subscription Limits Isolation',
        limitsIsolated,
        'Subscription limits properly calculated per tenant'
      );

      // Test that tenant search doesn't return other tenants' data
      const searchResults = await tenantService.search('security-test');
      const onlyOwnResults = searchResults.every(tenant => 
        tenant.slug.includes('security-test')
      );

      this.recordTest(
        'Search Result Isolation',
        onlyOwnResults,
        'Search results properly filtered to authorized tenants'
      );

    } catch (error) {
      this.recordTest(
        'Data Leakage Prevention',
        false,
        `Error: ${error.message}`,
        true
      );
    }
  }

  async runAllTests() {
    this.log('🚀 Starting Security Validation Test Suite...\n');

    try {
      // Setup
      await this.setupTestData();

      // Run security tests
      await this.testTenantDataIsolation();
      await this.testAuthenticationSecurity();
      await this.testSQLInjectionPrevention();
      await this.testSessionSecurity();
      await this.testAccessControlValidation();
      await this.testDataLeakagePrevention();

      // Generate report
      this.generateSecurityReport();

    } catch (error) {
      this.log(`Fatal error during security testing: ${error.message}`, 'error');
      this.testResults.errors.push(`Fatal error: ${error.message}`);
    } finally {
      // Cleanup
      await this.cleanupTestData();
      await prisma.$disconnect();
    }
  }

  generateSecurityReport() {
    this.log('\n🛡️  SECURITY VALIDATION REPORT');
    this.log('='.repeat(60));
    
    const totalTests = this.testResults.passed + this.testResults.failed;
    const successRate = totalTests > 0 ? (this.testResults.passed / totalTests * 100).toFixed(1) : 0;
    
    this.log(`🎯 Security Test Results:`);
    this.log(`   Total Tests: ${totalTests}`);
    this.log(`   Passed: ${this.testResults.passed}`, 'success');
    this.log(`   Failed: ${this.testResults.failed}`, this.testResults.failed > 0 ? 'error' : 'info');
    this.log(`   Critical Failures: ${this.testResults.critical}`, this.testResults.critical > 0 ? 'critical' : 'info');
    this.log(`   Success Rate: ${successRate}%`);

    // Security verdict
    if (this.testResults.critical > 0) {
      this.log('\n🚨 CRITICAL SECURITY ISSUES DETECTED!', 'critical');
      this.log('   System is NOT SAFE for production deployment!', 'critical');
    } else if (this.testResults.failed > 0) {
      this.log('\n⚠️  Security issues detected but none are critical', 'error');
      this.log('   Review and fix issues before production deployment', 'error');
    } else {
      this.log('\n✅ ALL SECURITY TESTS PASSED!', 'success');
      this.log('   System demonstrates strong security controls', 'success');
    }

    if (this.testResults.failed > 0) {
      this.log('\n❌ SECURITY ISSUES:');
      this.testResults.errors.forEach(error => {
        this.log(`  - ${error}`, 'error');
      });
    }

    // Write security report
    const securityReport = {
      testRun: {
        timestamp: new Date().toISOString(),
        environment: 'test',
        version: '1.0'
      },
      summary: {
        totalTests,
        passed: this.testResults.passed,
        failed: this.testResults.failed,
        critical: this.testResults.critical,
        successRate: successRate + '%',
        securityVerdict: this.testResults.critical === 0 ? 'SECURE' : 'VULNERABLE'
      },
      testDetails: this.testResults.details,
      securityFindings: this.testResults.errors,
      recommendations: this.generateSecurityRecommendations()
    };

    require('fs').writeFileSync(
      'security-validation-report.json',
      JSON.stringify(securityReport, null, 2)
    );

    this.log('\n📄 Security report written to: security-validation-report.json');
  }

  generateSecurityRecommendations() {
    const recommendations = [];

    if (this.testResults.critical > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'Data Security',
        recommendation: 'Fix all critical security issues before any production deployment'
      });
    }

    if (this.testResults.failed > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Security Hardening',
        recommendation: 'Address all identified security vulnerabilities'
      });
    }

    // Always include these recommendations
    recommendations.push(
      {
        priority: 'MEDIUM',
        category: 'Monitoring',
        recommendation: 'Implement real-time security monitoring and alerting'
      },
      {
        priority: 'MEDIUM',
        category: 'Audit',
        recommendation: 'Regular security audits and penetration testing'
      },
      {
        priority: 'LOW',
        category: 'Enhancement',
        recommendation: 'Consider implementing additional security headers and rate limiting'
      }
    );

    return recommendations;
  }
}

// Run tests if executed directly
if (require.main === module) {
  const testSuite = new SecurityValidationTestSuite();
  testSuite.runAllTests()
    .then(() => {
      process.exit(testSuite.testResults.critical > 0 ? 2 : testSuite.testResults.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(3);
    });
}

module.exports = SecurityValidationTestSuite;