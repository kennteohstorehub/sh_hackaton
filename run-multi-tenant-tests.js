#!/usr/bin/env node

/**
 * Multi-Tenant Architecture Test Runner
 * 
 * Master test runner that executes all multi-tenant tests in the correct order
 * and generates a comprehensive report with recommendations.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./server/utils/logger');

// Import test suites
const MultiTenantTestSuite = require('./tests/multi-tenant-comprehensive.test.js');
const { TenantAwarePrismaTestSuite } = require('./tests/tenant-aware-prisma.test.js');
const SuperAdminPortalTestSuite = require('./tests/superadmin-portal.test.js');
const EmailServiceTestSuite = require('./tests/email-service.test.js');

class MultiTenantTestRunner {
  constructor() {
    this.testResults = {
      suites: [],
      totalPassed: 0,
      totalFailed: 0,
      totalTests: 0,
      startTime: new Date(),
      endTime: null,
      duration: null
    };
    this.currentSuite = null;
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
    } else if (level === 'warning') {
      logger.warn(logMessage);
      console.warn(`⚠️  ${message}`);
    } else {
      logger.info(logMessage);
      console.log(`ℹ️  ${message}`);
    }
  }

  async runTestSuite(SuiteClass, suiteName, description) {
    this.log(`\n🏃‍♂️ Running ${suiteName}...`);
    this.log(`📝 ${description}`);
    this.log('-'.repeat(80));

    const startTime = new Date();
    let suiteResult = {
      name: suiteName,
      description,
      startTime,
      endTime: null,
      duration: null,
      passed: 0,
      failed: 0,
      total: 0,
      errors: [],
      status: 'running'
    };

    try {
      const suite = new SuiteClass();
      
      // Monkey patch the recordTest method to capture results
      const originalRecordTest = suite.recordTest;
      suite.recordTest = function(testName, passed, details = '') {
        if (passed) {
          suiteResult.passed++;
        } else {
          suiteResult.failed++;
          suiteResult.errors.push(`${testName}: ${details}`);
        }
        suiteResult.total++;
        
        // Call original method
        return originalRecordTest.call(this, testName, passed, details);
      };

      // Run the test suite
      await suite.runAllTests();

      suiteResult.status = suiteResult.failed > 0 ? 'failed' : 'passed';
      
    } catch (error) {
      suiteResult.status = 'error';
      suiteResult.errors.push(`Fatal error: ${error.message}`);
      this.log(`❌ ${suiteName} failed with fatal error: ${error.message}`, 'error');
    }

    suiteResult.endTime = new Date();
    suiteResult.duration = suiteResult.endTime - startTime;

    // Update totals
    this.testResults.totalPassed += suiteResult.passed;
    this.testResults.totalFailed += suiteResult.failed;
    this.testResults.totalTests += suiteResult.total;
    this.testResults.suites.push(suiteResult);

    // Log suite results
    if (suiteResult.status === 'passed') {
      this.log(`✅ ${suiteName} completed successfully (${suiteResult.passed}/${suiteResult.total} passed)`, 'success');
    } else if (suiteResult.status === 'failed') {
      this.log(`❌ ${suiteName} completed with failures (${suiteResult.passed}/${suiteResult.total} passed)`, 'error');
    } else {
      this.log(`💥 ${suiteName} crashed (${suiteResult.passed}/${suiteResult.total} passed before crash)`, 'error');
    }

    this.log(`⏱️  Duration: ${(suiteResult.duration / 1000).toFixed(2)}s`);

    return suiteResult;
  }

  async runAllTests() {
    this.log('🚀 Starting Multi-Tenant Architecture Test Suite');
    this.log('=' .repeat(80));
    this.log('🎯 Testing comprehensive multi-tenant implementation including:');
    this.log('   • Tenant resolution and isolation');
    this.log('   • Data security and access controls'); 
    this.log('   • SuperAdmin portal functionality');
    this.log('   • Email service integration');
    this.log('   • Database constraints and performance');
    this.log('');

    try {
      // Test Suite 1: Core Multi-Tenant Functionality
      await this.runTestSuite(
        MultiTenantTestSuite,
        'Core Multi-Tenant Architecture',
        'Tests tenant resolution, data isolation, security, and subscription limits'
      );

      // Test Suite 2: TenantAware Prisma Wrapper
      await this.runTestSuite(
        TenantAwarePrismaTestSuite,
        'TenantAware Prisma Wrapper',
        'Tests the tenant-aware database abstraction layer and automatic filtering'
      );

      // Test Suite 3: SuperAdmin Portal
      await this.runTestSuite(
        SuperAdminPortalTestSuite,
        'SuperAdmin Portal',
        'Tests SuperAdmin authentication, tenant management, and audit logging'
      );

      // Test Suite 4: Email Service
      await this.runTestSuite(
        EmailServiceTestSuite,
        'Email Service',
        'Tests email functionality, templates, and tenant welcome emails'
      );

    } catch (error) {
      this.log(`Fatal error in test runner: ${error.message}`, 'error');
    }

    this.testResults.endTime = new Date();
    this.testResults.duration = this.testResults.endTime - this.testResults.startTime;

    // Generate comprehensive report
    this.generateComprehensiveReport();
  }

  generateComprehensiveReport() {
    this.log('\n📊 COMPREHENSIVE MULTI-TENANT TEST REPORT');
    this.log('='.repeat(80));
    
    // Overall summary
    const successRate = this.testResults.totalTests > 0 ? 
      (this.testResults.totalPassed / this.testResults.totalTests * 100).toFixed(1) : 0;
    
    this.log(`🏁 Overall Results:`);
    this.log(`   Total Test Suites: ${this.testResults.suites.length}`);
    this.log(`   Total Tests: ${this.testResults.totalTests}`);
    this.log(`   Passed: ${this.testResults.totalPassed}`, 'success');
    this.log(`   Failed: ${this.testResults.totalFailed}`, this.testResults.totalFailed > 0 ? 'error' : 'info');
    this.log(`   Success Rate: ${successRate}%`);
    this.log(`   Total Duration: ${(this.testResults.duration / 1000).toFixed(2)}s`);
    
    // Suite-by-suite breakdown
    this.log('\n📋 Test Suite Breakdown:');
    this.testResults.suites.forEach(suite => {
      const suiteSuccessRate = suite.total > 0 ? (suite.passed / suite.total * 100).toFixed(1) : 0;
      const status = suite.status === 'passed' ? '✅' : suite.status === 'failed' ? '❌' : '💥';
      
      this.log(`   ${status} ${suite.name}:`);
      this.log(`      Tests: ${suite.passed}/${suite.total} passed (${suiteSuccessRate}%)`);
      this.log(`      Duration: ${(suite.duration / 1000).toFixed(2)}s`);
      
      if (suite.errors.length > 0) {
        this.log(`      Errors: ${suite.errors.length}`);
      }
    });

    // Critical issues
    const criticalSuites = this.testResults.suites.filter(suite => 
      suite.status === 'error' || (suite.failed > 0 && suite.name.includes('Core Multi-Tenant'))
    );

    if (criticalSuites.length > 0) {
      this.log('\n🚨 CRITICAL ISSUES DETECTED:', 'error');
      criticalSuites.forEach(suite => {
        this.log(`   • ${suite.name}: ${suite.errors.length} critical issues`, 'error');
        suite.errors.slice(0, 3).forEach(error => {
          this.log(`     - ${error}`, 'error');
        });
        if (suite.errors.length > 3) {
          this.log(`     ... and ${suite.errors.length - 3} more errors`, 'error');
        }
      });
    }

    // Security analysis
    this.analyzeSecurityIssues();

    // Performance analysis
    this.analyzePerformanceIssues();

    // Recommendations
    this.generateRecommendations();

    // Write detailed report files
    this.writeDetailedReports();

    // Final verdict
    this.generateFinalVerdict();
  }

  analyzeSecurityIssues() {
    this.log('\n🔒 Security Analysis:');
    
    const securityTests = [];
    this.testResults.suites.forEach(suite => {
      if (suite.errors.length > 0) {
        suite.errors.forEach(error => {
          if (error.toLowerCase().includes('security') || 
              error.toLowerCase().includes('isolation') ||
              error.toLowerCase().includes('cross-tenant') ||
              error.toLowerCase().includes('unauthorized')) {
            securityTests.push({ suite: suite.name, error });
          }
        });
      }
    });

    if (securityTests.length === 0) {
      this.log('   ✅ No security vulnerabilities detected', 'success');
    } else {
      this.log(`   ⚠️  ${securityTests.length} potential security issues found:`, 'warning');
      securityTests.forEach(issue => {
        this.log(`      • ${issue.suite}: ${issue.error}`, 'warning');
      });
    }
  }

  analyzePerformanceIssues() {
    this.log('\n⚡ Performance Analysis:');
    
    const slowSuites = this.testResults.suites.filter(suite => suite.duration > 30000); // > 30s
    const performanceErrors = [];
    
    this.testResults.suites.forEach(suite => {
      suite.errors.forEach(error => {
        if (error.toLowerCase().includes('performance') || 
            error.toLowerCase().includes('slow') ||
            error.toLowerCase().includes('timeout')) {
          performanceErrors.push({ suite: suite.name, error });
        }
      });
    });

    if (slowSuites.length === 0 && performanceErrors.length === 0) {
      this.log('   ✅ No performance issues detected', 'success');
    } else {
      if (slowSuites.length > 0) {
        this.log(`   ⚠️  ${slowSuites.length} slow test suites:`, 'warning');
        slowSuites.forEach(suite => {
          this.log(`      • ${suite.name}: ${(suite.duration / 1000).toFixed(2)}s`, 'warning');
        });
      }
      
      if (performanceErrors.length > 0) {
        this.log(`   ⚠️  ${performanceErrors.length} performance-related failures:`, 'warning');
        performanceErrors.forEach(issue => {
          this.log(`      • ${issue.suite}: ${issue.error}`, 'warning');
        });
      }
    }
  }

  generateRecommendations() {
    this.log('\n💡 Recommendations:');
    
    const recommendations = [];
    
    // Check for failed core tests
    const coreFailures = this.testResults.suites.find(suite => 
      suite.name.includes('Core Multi-Tenant') && suite.failed > 0
    );
    
    if (coreFailures) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Architecture',
        recommendation: 'Fix core multi-tenant functionality before deploying to production'
      });
    }

    // Check for security issues
    const hasSecurityIssues = this.testResults.suites.some(suite =>
      suite.errors.some(error => 
        error.toLowerCase().includes('security') || 
        error.toLowerCase().includes('cross-tenant')
      )
    );

    if (hasSecurityIssues) {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'Security',
        recommendation: 'Address all data isolation and cross-tenant security issues immediately'
      });
    }

    // Check for SuperAdmin issues
    const superAdminIssues = this.testResults.suites.find(suite => 
      suite.name.includes('SuperAdmin') && suite.failed > 0
    );

    if (superAdminIssues) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Management',
        recommendation: 'Fix SuperAdmin portal issues for proper tenant management'
      });
    }

    // Check for email service issues
    const emailIssues = this.testResults.suites.find(suite => 
      suite.name.includes('Email') && suite.failed > 0
    );

    if (emailIssues) {
      recommendations.push({
        priority: 'LOW',
        category: 'Communication',
        recommendation: 'Resolve email service issues for tenant onboarding notifications'
      });
    }

    // General recommendations
    if (this.testResults.totalFailed === 0) {
      recommendations.push({
        priority: 'INFO',
        category: 'Deployment',
        recommendation: 'All tests passed! Multi-tenant architecture is ready for production'
      });
    } else if (this.testResults.totalFailed < 5) {
      recommendations.push({
        priority: 'LOW',
        category: 'Quality',
        recommendation: 'Minor issues detected. Review and fix before production deployment'
      });
    } else {
      recommendations.push({
        priority: 'HIGH',
        category: 'Quality',
        recommendation: 'Multiple issues detected. Requires significant fixes before production'
      });
    }

    // Display recommendations by priority
    const priorityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    priorityOrder.forEach(priority => {
      const priorityRecs = recommendations.filter(r => r.priority === priority);
      if (priorityRecs.length > 0) {
        priorityRecs.forEach(rec => {
          const icon = priority === 'CRITICAL' ? '🚨' : priority === 'HIGH' ? '⚠️' : 
                      priority === 'MEDIUM' ? '📝' : priority === 'LOW' ? 'ℹ️' : '✅';
          this.log(`   ${icon} [${priority}] ${rec.category}: ${rec.recommendation}`);
        });
      }
    });
  }

  writeDetailedReports() {
    // Master report
    const masterReport = {
      testRun: {
        timestamp: this.testResults.startTime.toISOString(),
        duration: this.testResults.duration,
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch
        }
      },
      summary: {
        totalSuites: this.testResults.suites.length,
        totalTests: this.testResults.totalTests,
        totalPassed: this.testResults.totalPassed,
        totalFailed: this.testResults.totalFailed,
        successRate: this.testResults.totalTests > 0 ? 
          (this.testResults.totalPassed / this.testResults.totalTests * 100).toFixed(1) + '%' : '0%'
      },
      suites: this.testResults.suites.map(suite => ({
        name: suite.name,
        description: suite.description,
        status: suite.status,
        passed: suite.passed,
        failed: suite.failed,
        total: suite.total,
        duration: suite.duration,
        successRate: suite.total > 0 ? (suite.passed / suite.total * 100).toFixed(1) + '%' : '0%',
        errors: suite.errors
      }))
    };

    fs.writeFileSync(
      'multi-tenant-test-master-report.json',
      JSON.stringify(masterReport, null, 2)
    );

    // Security report
    const securityReport = {
      timestamp: new Date().toISOString(),
      securityTests: this.testResults.suites.map(suite => ({
        suite: suite.name,
        securityIssues: suite.errors.filter(error => 
          error.toLowerCase().includes('security') || 
          error.toLowerCase().includes('isolation') ||
          error.toLowerCase().includes('cross-tenant')
        )
      })).filter(suite => suite.securityIssues.length > 0)
    };

    fs.writeFileSync(
      'multi-tenant-security-report.json',
      JSON.stringify(securityReport, null, 2)
    );

    this.log('\n📄 Reports generated:');
    this.log('   • multi-tenant-test-master-report.json - Complete test results');
    this.log('   • multi-tenant-security-report.json - Security analysis');
    this.log('   • Individual suite reports: *-test-report.json');
  }

  generateFinalVerdict() {
    this.log('\n🏆 FINAL VERDICT:');
    this.log('='.repeat(80));

    const successRate = this.testResults.totalTests > 0 ? 
      (this.testResults.totalPassed / this.testResults.totalTests * 100) : 0;

    if (successRate === 100) {
      this.log('🎉 EXCELLENT! All tests passed. Multi-tenant architecture is production-ready.', 'success');
    } else if (successRate >= 90) {
      this.log('👍 GOOD! Most tests passed. Minor issues need attention before production.', 'success');
    } else if (successRate >= 70) {
      this.log('⚠️  NEEDS WORK! Several issues detected. Significant fixes required.', 'warning');
    } else {
      this.log('❌ CRITICAL ISSUES! Major problems detected. NOT ready for production.', 'error');
    }

    this.log(`\n📈 Test Coverage: ${successRate.toFixed(1)}%`);
    this.log(`⏱️  Total Time: ${(this.testResults.duration / 1000).toFixed(2)}s`);
    this.log(`🧪 Tests Executed: ${this.testResults.totalTests}`);
    
    return successRate >= 90 ? 0 : 1; // Exit code for CI/CD
  }
}

// Run tests if executed directly
if (require.main === module) {
  const runner = new MultiTenantTestRunner();
  runner.runAllTests()
    .then(exitCode => {
      process.exit(runner.generateFinalVerdict());
    })
    .catch(error => {
      console.error('Fatal error in test runner:', error);
      process.exit(1);
    });
}

module.exports = MultiTenantTestRunner;