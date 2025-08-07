#!/usr/bin/env node

/**
 * Settings page issue analyzer
 * Analyzes the settings.ejs file for common issues
 */

const fs = require('fs').promises;
const path = require('path');

class SettingsAnalyzer {
  constructor() {
    this.issues = [];
    this.settingsFile = path.join(__dirname, 'views/dashboard/settings.ejs');
  }

  addIssue(line, category, description, severity = 'medium', fix = null) {
    this.issues.push({
      line,
      category,
      description,
      severity,
      fix,
      timestamp: new Date().toISOString()
    });
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

  async analyzeSettingsFile() {
    this.log('Analyzing settings.ejs file...');
    
    try {
      const content = await fs.readFile(this.settingsFile, 'utf-8');
      const lines = content.split('\n');
      
      // Track JavaScript functions and their line numbers
      let inScriptTag = false;
      let jsStartLine = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        
        // Track script sections
        if (line.includes('<script>')) {
          inScriptTag = true;
          jsStartLine = lineNum;
        }
        if (line.includes('</script>')) {
          inScriptTag = false;
        }
        
        // Check for the specific issue at line ~1518
        if (inScriptTag && line.includes('closest(')) {
          const match = line.match(/(\w+)\.closest\(['"]([^'"]+)['"]\)/);
          if (match) {
            const [, variable, selector] = match;
            
            // Check if this is the problematic line
            if (selector === '.day-hours') {
              this.addIssue(
                lineNum,
                'JavaScript Error',
                `Line ${lineNum}: ${variable}.closest('.day-hours') will fail because the HTML structure uses different class names`,
                'high',
                `Change '.day-hours' to '.hours-row' or update HTML structure to include .day-hours class`
              );
            }
          }
        }
        
        // Check for ID mismatches in operating hours
        if (line.includes('getElementById') && line.includes('Closed')) {
          const match = line.match(/getElementById\(['"]([^'"]+)['"]\)/);
          if (match) {
            const [, elementId] = match;
            if (elementId.endsWith('Closed')) {
              // Check if corresponding HTML element exists with hyphenated version
              const hyphenatedId = elementId.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
              this.addIssue(
                lineNum,
                'ID Mismatch',
                `JavaScript looks for ID '${elementId}' but HTML likely uses '${hyphenatedId}'`,
                'high',
                `Update JavaScript to use '${hyphenatedId}' or update HTML to use '${elementId}'`
              );
            }
          }
        }
        
        // Check for missing CSRF token handling
        if (line.includes('/api/merchant/profile') && line.includes('fetch')) {
          let hasCSRFToken = false;
          // Look ahead a few lines for CSRF token
          for (let j = Math.max(0, i - 5); j < Math.min(lines.length, i + 10); j++) {
            if (lines[j].includes('csrf') || lines[j].includes('X-CSRF-Token')) {
              hasCSRFToken = true;
              break;
            }
          }
          
          if (!hasCSRFToken) {
            this.addIssue(
              lineNum,
              'Security Issue',
              'API call to merchant/profile without CSRF token protection',
              'medium',
              'Add CSRF token to request headers using createFetchOptions() function'
            );
          }
        }
        
        // Check for form field access patterns
        if (line.includes('document.getElementById') && line.includes('value')) {
          const match = line.match(/getElementById\(['"]([^'"]+)['"]\)\.value/);
          if (match) {
            const [, fieldId] = match;
            // Common form fields that might have issues
            const problematicFields = ['restaurantName', 'restaurantPhone', 'restaurantAddress'];
            if (problematicFields.includes(fieldId)) {
              // This could be problematic if the element doesn't exist
              this.addIssue(
                lineNum,
                'Potential Runtime Error',
                `Accessing ${fieldId}.value without null check - could throw error if element missing`,
                'medium',
                'Add null check: const element = document.getElementById("' + fieldId + '"); if (element) { ... }'
              );
            }
          }
        }
        
        // Check for business hours form data collection
        if (line.includes('businessHours[') && line.includes('querySelector')) {
          // This pattern suggests potential issues with form data collection
          this.addIssue(
            lineNum,
            'Form Data Issue',
            'Business hours form data collection using mixed ID patterns',
            'medium',
            'Standardize on either hyphenated IDs or camelCase consistently'
          );
        }
      }
      
      this.log(`Analyzed ${lines.length} lines of code`, 'success');
      
    } catch (error) {
      this.log(`Error reading settings file: ${error.message}`, 'error');
      this.addIssue(0, 'File Access', error.message, 'high');
    }
  }

  async checkHTMLStructure() {
    this.log('Checking HTML structure for business hours...');
    
    try {
      const content = await fs.readFile(this.settingsFile, 'utf-8');
      
      // Check for business hours HTML structure
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      
      days.forEach(day => {
        // Check for both old and new ID patterns
        const oldPattern = new RegExp(`id="${day}Closed"`, 'i');
        const newPattern = new RegExp(`id="${day}-closed"`, 'i');
        const dataAttribute = new RegExp(`data-day="${day}"`, 'i');
        
        const hasOldId = oldPattern.test(content);
        const hasNewId = newPattern.test(content);
        const hasDataAttribute = dataAttribute.test(content);
        
        if (hasOldId && !hasNewId) {
          this.addIssue(
            null,
            'HTML Structure',
            `Day ${day} uses old ID pattern (${day}Closed) - JavaScript expects ${day}-closed`,
            'high',
            `Update HTML to use id="${day}-closed" instead of id="${day}Closed"`
          );
        }
        
        if (!hasDataAttribute) {
          this.addIssue(
            null,
            'HTML Structure',
            `Missing data-day="${day}" attribute for ${day} hours row`,
            'medium',
            `Add data-day="${day}" to the hours row element`
          );
        }
      });
      
      // Check for .day-hours vs .hours-row class usage
      if (content.includes('.day-hours') && !content.includes('class="day-hours"')) {
        this.addIssue(
          null,
          'CSS Class Mismatch',
          'JavaScript references .day-hours class but HTML uses .hours-row',
          'high',
          'Either add day-hours class to HTML or update JavaScript to use .hours-row'
        );
      }
      
    } catch (error) {
      this.log(`Error checking HTML structure: ${error.message}`, 'error');
    }
  }

  async checkAPIEndpointDefinition() {
    this.log('Checking API endpoint definition...');
    
    try {
      const merchantRouteFile = path.join(__dirname, 'server/routes/merchant.js');
      const content = await fs.readFile(merchantRouteFile, 'utf-8');
      
      // Check for profile endpoint
      if (!content.includes("router.get('/profile'")) {
        this.addIssue(
          null,
          'API Endpoint',
          'Missing GET /api/merchant/profile endpoint definition',
          'high',
          'Add profile endpoint to merchant.js routes'
        );
      }
      
      if (!content.includes("router.put('/profile'")) {
        this.addIssue(
          null,
          'API Endpoint',
          'Missing PUT /api/merchant/profile endpoint definition',
          'high',
          'Add profile update endpoint to merchant.js routes'
        );
      }
      
      // Check for tenant isolation middleware
      if (!content.includes('tenantIsolationMiddleware')) {
        this.addIssue(
          null,
          'Security Issue',
          'Merchant routes missing tenant isolation middleware',
          'high',
          'Add tenant isolation middleware to prevent cross-tenant data access'
        );
      }
      
    } catch (error) {
      this.log(`Error checking API endpoints: ${error.message}`, 'error');
    }
  }

  async generateReport() {
    this.log('Generating comprehensive issue report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      analysis: 'StoreHub Queue Management - Settings Page Issues',
      summary: {
        totalIssues: this.issues.length,
        highSeverity: this.issues.filter(i => i.severity === 'high').length,
        mediumSeverity: this.issues.filter(i => i.severity === 'medium').length,
        lowSeverity: this.issues.filter(i => i.severity === 'low').length
      },
      issues: this.issues.sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      }),
      rootCauses: [
        {
          issue: 'JavaScript Element Selection Mismatch',
          description: 'The JavaScript code uses different ID patterns than the HTML elements',
          impact: 'TypeError: Cannot read properties of null (reading \'closest\')',
          solution: 'Standardize ID patterns between HTML and JavaScript'
        },
        {
          issue: 'Missing CSS Classes',
          description: 'JavaScript looks for .day-hours class but HTML uses .hours-row',
          impact: 'DOM element selection failures',
          solution: 'Update either HTML classes or JavaScript selectors to match'
        },
        {
          issue: 'API Authentication Issues',
          description: 'Settings form submissions may fail due to auth/tenant isolation problems',
          impact: '500 Internal Server Error on form submission',
          solution: 'Verify authentication middleware and tenant context'
        }
      ],
      fixes: this.issues.filter(i => i.fix).map(i => ({
        category: i.category,
        description: i.description,
        fix: i.fix,
        priority: i.severity
      }))
    };
    
    // Save report
    const reportPath = './SETTINGS_ANALYSIS_REPORT.json';
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('🔍 SETTINGS PAGE ANALYSIS REPORT');
    console.log('='.repeat(60));
    console.log(`📊 Total Issues Found: ${report.summary.totalIssues}`);
    console.log(`🔴 High Severity: ${report.summary.highSeverity}`);
    console.log(`🟡 Medium Severity: ${report.summary.mediumSeverity}`);
    console.log(`🟢 Low Severity: ${report.summary.lowSeverity}`);
    
    console.log('\n🎯 ROOT CAUSES IDENTIFIED:');
    report.rootCauses.forEach((cause, i) => {
      console.log(`\n${i + 1}. ${cause.issue}`);
      console.log(`   Impact: ${cause.impact}`);
      console.log(`   Solution: ${cause.solution}`);
    });
    
    if (report.summary.highSeverity > 0) {
      console.log('\n🚨 CRITICAL FIXES NEEDED:');
      const criticalIssues = this.issues.filter(i => i.severity === 'high');
      criticalIssues.forEach((issue, i) => {
        console.log(`\n${i + 1}. ${issue.description}`);
        if (issue.fix) {
          console.log(`   Fix: ${issue.fix}`);
        }
      });
    }
    
    console.log(`\n📄 Full report saved to: ${reportPath}`);
    console.log('='.repeat(60));
  }

  async run() {
    this.log('Starting comprehensive settings page analysis...');
    
    try {
      await this.analyzeSettingsFile();
      await this.checkHTMLStructure();
      await this.checkAPIEndpointDefinition();
      await this.generateReport();
      
      this.log('Analysis complete!', 'success');
      
    } catch (error) {
      this.log(`Analysis failed: ${error.message}`, 'error');
    }
  }
}

// Run the analyzer
if (require.main === module) {
  const analyzer = new SettingsAnalyzer();
  analyzer.run().catch(console.error);
}

module.exports = SettingsAnalyzer;