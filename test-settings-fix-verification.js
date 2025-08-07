#!/usr/bin/env node

/**
 * Settings fix verification test
 * Tests that the applied fixes resolve the issues
 */

const fs = require('fs').promises;
const path = require('path');

class SettingsFixVerifier {
  constructor() {
    this.settingsFile = path.join(__dirname, 'views/dashboard/settings.ejs');
    this.verifications = [];
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[34m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };
    console.log(`${colors[type]}[${type.toUpperCase()}]${colors.reset} ${message}`);
  }

  addVerification(test, status, details) {
    this.verifications.push({
      test,
      status,
      details,
      timestamp: new Date().toISOString()
    });
  }

  async verifyJavaScriptFixes() {
    this.log('Verifying JavaScript fixes...');

    try {
      const content = await fs.readFile(this.settingsFile, 'utf-8');

      // Verify fix 1: No more '.day-hours' references
      const dayHoursRefs = content.match(/\.closest\(['"].day-hours['"]\)/g);
      if (!dayHoursRefs) {
        this.addVerification('JavaScript closest() fix', 'PASS', 'No .day-hours references found in closest() calls');
        this.log('✅ Fix 1: JavaScript closest() method fixed', 'success');
      } else {
        this.addVerification('JavaScript closest() fix', 'FAIL', `Still has ${dayHoursRefs.length} .day-hours references`);
        this.log('❌ Fix 1: Still has .day-hours references', 'error');
      }

      // Verify fix 2: Uses .hours-row instead
      const hoursRowRefs = content.match(/\.closest\(['"].hours-row['"]\)/g);
      if (hoursRowRefs && hoursRowRefs.length > 0) {
        this.addVerification('Hours row selector fix', 'PASS', `Found ${hoursRowRefs.length} .hours-row references`);
        this.log('✅ Fix 2: Now uses .hours-row selector', 'success');
      } else {
        this.addVerification('Hours row selector fix', 'FAIL', 'No .hours-row references found');
        this.log('❌ Fix 2: Missing .hours-row references', 'error');
      }

      // Verify fix 3: Consistent ID patterns (hyphenated)
      const hyphenatedIds = content.match(/getElementById\(['"]\w+-closed['"]\)/g);
      const camelCaseIds = content.match(/getElementById\(['"]\w+Closed['"]\)/g);
      
      if (hyphenatedIds && hyphenatedIds.length > 0) {
        this.addVerification('Hyphenated ID usage', 'PASS', `Found ${hyphenatedIds.length} hyphenated ID references`);
        this.log('✅ Fix 3: Uses hyphenated IDs', 'success');
      } else {
        this.addVerification('Hyphenated ID usage', 'FAIL', 'No hyphenated ID references found');
        this.log('❌ Fix 3: Missing hyphenated ID references', 'warning');
      }

      if (camelCaseIds && camelCaseIds.length > 0) {
        this.addVerification('CamelCase ID cleanup', 'FAIL', `Still has ${camelCaseIds.length} camelCase ID references`);
        this.log('❌ Fix 3: Still has camelCase ID references', 'error');
      } else {
        this.addVerification('CamelCase ID cleanup', 'PASS', 'No camelCase ID references found');
        this.log('✅ Fix 3: CamelCase IDs cleaned up', 'success');
      }

      // Verify fix 4: Null checks added
      const nullChecks = content.match(/if\s*\(\s*!\w+El?\s*\)/g);
      if (nullChecks && nullChecks.length >= 5) {
        this.addVerification('Null checks added', 'PASS', `Found ${nullChecks.length} null checks`);
        this.log('✅ Fix 4: Null checks added for element access', 'success');
      } else {
        this.addVerification('Null checks added', 'FAIL', `Only found ${nullChecks ? nullChecks.length : 0} null checks`);
        this.log('❌ Fix 4: Insufficient null checks', 'warning');
      }

      // Verify fix 5: Error handling in functions
      const errorHandling = content.match(/console\.warn\(/g);
      if (errorHandling && errorHandling.length > 0) {
        this.addVerification('Error handling added', 'PASS', `Found ${errorHandling.length} console.warn statements`);
        this.log('✅ Fix 5: Error handling added', 'success');
      } else {
        this.addVerification('Error handling added', 'FAIL', 'No error handling found');
        this.log('❌ Fix 5: Missing error handling', 'warning');
      }

    } catch (error) {
      this.addVerification('File access', 'FAIL', error.message);
      this.log(`Error reading settings file: ${error.message}`, 'error');
    }
  }

  async verifyHTMLConsistency() {
    this.log('Verifying HTML/JavaScript consistency...');

    try {
      const content = await fs.readFile(this.settingsFile, 'utf-8');

      // Check that HTML elements match JavaScript expectations
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      let consistencyScore = 0;

      days.forEach(day => {
        // Check for hyphenated ID in HTML
        const hyphenatedIdPattern = new RegExp(`id="${day}-closed"`, 'i');
        const hasHyphenatedId = hyphenatedIdPattern.test(content);

        // Check for data-day attribute
        const dataAttrPattern = new RegExp(`data-day="${day}"`, 'i');
        const hasDataAttr = dataAttrPattern.test(content);

        // Check for hours-row class
        const hoursRowPattern = /class="[^"]*hours-row[^"]*"/i;
        const hasHoursRowClass = hoursRowPattern.test(content);

        if (hasHyphenatedId) consistencyScore++;
        if (hasDataAttr) consistencyScore++;
      });

      const maxScore = days.length * 2; // 2 checks per day
      const consistencyPercentage = (consistencyScore / maxScore) * 100;

      if (consistencyPercentage >= 90) {
        this.addVerification('HTML/JS consistency', 'PASS', `${consistencyPercentage.toFixed(1)}% consistency`);
        this.log(`✅ HTML/JavaScript consistency: ${consistencyPercentage.toFixed(1)}%`, 'success');
      } else if (consistencyPercentage >= 70) {
        this.addVerification('HTML/JS consistency', 'WARN', `${consistencyPercentage.toFixed(1)}% consistency`);
        this.log(`⚠️ HTML/JavaScript consistency: ${consistencyPercentage.toFixed(1)}%`, 'warning');
      } else {
        this.addVerification('HTML/JS consistency', 'FAIL', `${consistencyPercentage.toFixed(1)}% consistency`);
        this.log(`❌ HTML/JavaScript consistency: ${consistencyPercentage.toFixed(1)}%`, 'error');
      }

    } catch (error) {
      this.addVerification('HTML consistency check', 'FAIL', error.message);
      this.log(`Error checking HTML consistency: ${error.message}`, 'error');
    }
  }

  async verifySecurityImprovements() {
    this.log('Verifying security improvements...');

    try {
      const content = await fs.readFile(this.settingsFile, 'utf-8');

      // Check for CSRF token usage
      const csrfUsage = content.match(/createFetchOptions\(/g);
      if (csrfUsage && csrfUsage.length > 0) {
        this.addVerification('CSRF protection', 'PASS', `Found ${csrfUsage.length} createFetchOptions calls`);
        this.log('✅ CSRF protection: Using createFetchOptions', 'success');
      } else {
        // Check if CSRF is handled directly
        const directCsrf = content.match(/X-CSRF-Token/g);
        if (directCsrf && directCsrf.length > 0) {
          this.addVerification('CSRF protection', 'PASS', 'Direct CSRF token handling found');
          this.log('✅ CSRF protection: Direct token handling', 'success');
        } else {
          this.addVerification('CSRF protection', 'FAIL', 'No CSRF protection found');
          this.log('❌ CSRF protection: Missing token handling', 'warning');
        }
      }

    } catch (error) {
      this.addVerification('Security check', 'FAIL', error.message);
      this.log(`Error checking security improvements: ${error.message}`, 'error');
    }
  }

  async generateFixReport() {
    this.log('Generating fix verification report...');

    const summary = {
      timestamp: new Date().toISOString(),
      totalTests: this.verifications.length,
      passed: this.verifications.filter(v => v.status === 'PASS').length,
      warnings: this.verifications.filter(v => v.status === 'WARN').length,
      failed: this.verifications.filter(v => v.status === 'FAIL').length
    };

    const report = {
      summary,
      verifications: this.verifications,
      overallStatus: summary.failed === 0 ? 'STABLE' : summary.failed <= 2 ? 'IMPROVED' : 'NEEDS_WORK',
      recommendations: []
    };

    // Generate recommendations based on results
    const failedTests = this.verifications.filter(v => v.status === 'FAIL');
    failedTests.forEach(test => {
      if (test.test.includes('consistency')) {
        report.recommendations.push({
          priority: 'Medium',
          issue: 'HTML/JavaScript consistency',
          action: 'Review HTML element IDs and ensure they match JavaScript selectors'
        });
      }
      if (test.test.includes('CSRF')) {
        report.recommendations.push({
          priority: 'High',
          issue: 'CSRF protection missing',
          action: 'Add CSRF token handling to API calls'
        });
      }
      if (test.test.includes('closest')) {
        report.recommendations.push({
          priority: 'High',
          issue: 'JavaScript selector issues',
          action: 'Fix remaining .day-hours references in JavaScript'
        });
      }
    });

    // Save report
    await fs.writeFile('./SETTINGS_FIX_VERIFICATION.json', JSON.stringify(report, null, 2));

    // Display results
    console.log('\n' + '='.repeat(60));
    console.log('🔧 SETTINGS FIX VERIFICATION REPORT');
    console.log('='.repeat(60));
    console.log(`📊 Tests Run: ${summary.totalTests}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`⚠️ Warnings: ${summary.warnings}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`\n🎯 Overall Status: ${report.overallStatus}`);

    if (report.overallStatus === 'STABLE') {
      console.log('\n🎉 All critical fixes have been successfully applied!');
      console.log('The settings page should now work correctly for multi-tenant restaurant information.');
    } else if (report.overallStatus === 'IMPROVED') {
      console.log('\n✨ Major improvements applied! Some minor issues remain.');
      console.log('The settings page should be significantly more stable.');
    } else {
      console.log('\n⚠️ Additional fixes needed for full stability.');
    }

    if (report.recommendations.length > 0) {
      console.log('\n📋 REMAINING RECOMMENDATIONS:');
      report.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. [${rec.priority}] ${rec.issue}`);
        console.log(`   Action: ${rec.action}`);
      });
    }

    console.log(`\n📄 Full report saved to: SETTINGS_FIX_VERIFICATION.json`);
    console.log('='.repeat(60));
  }

  async run() {
    this.log('Starting settings fix verification...');

    try {
      await this.verifyJavaScriptFixes();
      await this.verifyHTMLConsistency();
      await this.verifySecurityImprovements();
      await this.generateFixReport();

      this.log('Fix verification complete!', 'success');

    } catch (error) {
      this.log(`Verification failed: ${error.message}`, 'error');
    }
  }
}

// Run the verifier
if (require.main === module) {
  const verifier = new SettingsFixVerifier();
  verifier.run().catch(console.error);
}

module.exports = SettingsFixVerifier;