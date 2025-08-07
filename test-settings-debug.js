#!/usr/bin/env node

/**
 * Settings page debugging test
 * Tests the exact scenarios causing issues in the browser
 */

const puppeteer = require('puppeteer');
const chalk = require('chalk');
const fs = require('fs').promises;

class SettingsDebugger {
  constructor() {
    this.browser = null;
    this.page = null;
    this.baseUrl = 'http://localhost:3838';
    this.issues = [];
  }

  log(message, type = 'info') {
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
      debug: chalk.gray
    };
    console.log(`${colors[type]('[' + type.toUpperCase() + ']')} ${message}`);
  }

  addIssue(category, description, severity = 'medium') {
    this.issues.push({
      category,
      description,
      severity,
      timestamp: new Date().toISOString()
    });
  }

  async init() {
    this.log('Initializing browser for settings debugging...');
    this.browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      devtools: true
    });
    this.page = await this.browser.newPage();
    
    // Enable console logging
    this.page.on('console', msg => {
      const type = msg.type();
      if (type === 'error') {
        this.log(`Browser Console Error: ${msg.text()}`, 'error');
        this.addIssue('JavaScript Error', msg.text(), 'high');
      } else if (type === 'warning') {
        this.log(`Browser Console Warning: ${msg.text()}`, 'warning');
      }
    });

    // Listen for network failures
    this.page.on('response', response => {
      if (response.status() >= 400) {
        this.log(`Network Error: ${response.status()} - ${response.url()}`, 'error');
        if (response.url().includes('/api/merchant/profile')) {
          this.addIssue('API Error', `${response.status()} error on merchant/profile endpoint`, 'high');
        }
      }
    });

    // Listen for page errors
    this.page.on('pageerror', error => {
      this.log(`Page Error: ${error.message}`, 'error');
      this.addIssue('Page Error', error.message, 'high');
    });
  }

  async loginIfNeeded() {
    this.log('Checking authentication state...');
    
    try {
      // Navigate to dashboard first to check auth
      await this.page.goto(`${this.baseUrl}/dashboard`, { waitUntil: 'networkidle0' });
      
      // Check if we're redirected to login
      const currentUrl = this.page.url();
      if (currentUrl.includes('/auth/login')) {
        this.log('Authentication required, logging in...');
        
        // Fill login form
        await this.page.waitForSelector('#email');
        await this.page.type('#email', 'admin@demo.com');
        await this.page.type('#password', 'admin123');
        
        // Submit login
        await this.page.click('button[type="submit"]');
        await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
        
        this.log('Login completed', 'success');
      } else {
        this.log('Already authenticated', 'success');
      }
    } catch (error) {
      this.log(`Login error: ${error.message}`, 'error');
      this.addIssue('Authentication', `Login failed: ${error.message}`, 'high');
      throw error;
    }
  }

  async testSettingsPageLoad() {
    this.log('Testing settings page load...');
    
    try {
      await this.page.goto(`${this.baseUrl}/dashboard/settings`, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      
      // Wait for main elements to load
      await this.page.waitForSelector('#restaurantName', { timeout: 10000 });
      
      // Check for JavaScript errors related to line 1518
      const jsErrors = await this.page.evaluate(() => {
        const errors = [];
        
        // Test the specific function that's failing
        try {
          const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
          days.forEach(day => {
            const checkbox = document.getElementById(`${day}Closed`);
            if (!checkbox) {
              errors.push(`Missing checkbox for ${day}Closed`);
              return;
            }
            
            // This is the line causing the error - line ~1518
            const dayHoursElement = checkbox.closest('.day-hours');
            if (!dayHoursElement) {
              errors.push(`Element with ID '${day}Closed' cannot find closest '.day-hours' element`);
            }
          });
        } catch (error) {
          errors.push(`JavaScript execution error: ${error.message}`);
        }
        
        return errors;
      });
      
      if (jsErrors.length > 0) {
        jsErrors.forEach(error => {
          this.log(`JS Error: ${error}`, 'error');
          this.addIssue('DOM Issue', error, 'high');
        });
      } else {
        this.log('JavaScript validation passed', 'success');
      }
      
      this.log('Settings page loaded successfully', 'success');
      
    } catch (error) {
      this.log(`Settings page load failed: ${error.message}`, 'error');
      this.addIssue('Page Load', `Settings page failed to load: ${error.message}`, 'high');
    }
  }

  async testAPIEndpoints() {
    this.log('Testing API endpoints...');
    
    try {
      // Test GET /api/merchant/profile
      const response = await this.page.evaluate(async () => {
        try {
          const response = await fetch('/api/merchant/profile', {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          return {
            status: response.status,
            statusText: response.statusText,
            data: response.ok ? await response.json() : await response.text()
          };
        } catch (error) {
          return {
            error: error.message
          };
        }
      });
      
      if (response.error) {
        this.log(`API Error: ${response.error}`, 'error');
        this.addIssue('API Error', `Fetch error: ${response.error}`, 'high');
      } else if (response.status !== 200) {
        this.log(`API returned ${response.status}: ${response.statusText}`, 'error');
        this.addIssue('API Error', `${response.status} - ${response.data}`, 'high');
      } else {
        this.log('Merchant profile API working correctly', 'success');
      }
      
    } catch (error) {
      this.log(`API test failed: ${error.message}`, 'error');
      this.addIssue('API Test', error.message, 'high');
    }
  }

  async testFormSubmission() {
    this.log('Testing form submission...');
    
    try {
      // Test filling and submitting the restaurant form
      await this.page.focus('#restaurantName');
      await this.page.keyboard.selectAll();
      await this.page.type('#restaurantName', 'Test Restaurant Debug');
      
      await this.page.focus('#restaurantPhone');
      await this.page.keyboard.selectAll();
      await this.page.type('#restaurantPhone', '+1234567890');
      
      // Listen for form submission
      const formSubmissionPromise = new Promise((resolve) => {
        this.page.on('response', async (response) => {
          if (response.url().includes('/api/merchant/profile') && response.request().method() === 'PUT') {
            resolve({
              status: response.status(),
              statusText: response.statusText(),
              url: response.url()
            });
          }
        });
      });
      
      // Submit the form
      await this.page.click('#restaurantForm button[type="submit"]');
      
      // Wait for the response
      const formResponse = await Promise.race([
        formSubmissionPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Form submission timeout')), 10000))
      ]);
      
      if (formResponse.status === 200) {
        this.log('Form submission successful', 'success');
      } else {
        this.log(`Form submission failed: ${formResponse.status} - ${formResponse.statusText}`, 'error');
        this.addIssue('Form Submission', `${formResponse.status} error on form submit`, 'high');
      }
      
    } catch (error) {
      this.log(`Form submission test failed: ${error.message}`, 'error');
      this.addIssue('Form Test', error.message, 'medium');
    }
  }

  async checkDOMStructure() {
    this.log('Analyzing DOM structure for missing elements...');
    
    const domAnalysis = await this.page.evaluate(() => {
      const analysis = {
        missingElements: [],
        structureIssues: [],
        checkboxIssues: []
      };
      
      // Check for expected form elements
      const expectedIds = [
        'restaurantName', 'restaurantPhone', 'restaurantAddress',
        'maxCapacity', 'avgServiceTime'
      ];
      
      expectedIds.forEach(id => {
        if (!document.getElementById(id)) {
          analysis.missingElements.push(id);
        }
      });
      
      // Check business hours structure
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      days.forEach(day => {
        const checkbox = document.getElementById(`${day}-closed`);
        const hoursRow = document.querySelector(`[data-day="${day}"]`);
        
        if (!checkbox) {
          analysis.checkboxIssues.push(`Missing checkbox: ${day}-closed`);
        }
        
        if (!hoursRow) {
          analysis.structureIssues.push(`Missing hours row for ${day}`);
        }
        
        // Check if the old ID pattern exists (this might be the issue)
        const oldCheckbox = document.getElementById(`${day}Closed`);
        if (oldCheckbox) {
          analysis.checkboxIssues.push(`Old ID pattern found: ${day}Closed (should be ${day}-closed)`);
        }
      });
      
      return analysis;
    });
    
    // Report findings
    if (domAnalysis.missingElements.length > 0) {
      this.log(`Missing form elements: ${domAnalysis.missingElements.join(', ')}`, 'error');
      domAnalysis.missingElements.forEach(id => {
        this.addIssue('DOM Issue', `Missing element with ID: ${id}`, 'medium');
      });
    }
    
    if (domAnalysis.checkboxIssues.length > 0) {
      this.log('Checkbox ID issues found:', 'warning');
      domAnalysis.checkboxIssues.forEach(issue => {
        this.log(`  - ${issue}`, 'warning');
        this.addIssue('DOM Issue', issue, 'high');
      });
    }
    
    if (domAnalysis.structureIssues.length > 0) {
      domAnalysis.structureIssues.forEach(issue => {
        this.log(`Structure issue: ${issue}`, 'error');
        this.addIssue('DOM Issue', issue, 'medium');
      });
    }
    
    if (domAnalysis.missingElements.length === 0 && 
        domAnalysis.checkboxIssues.length === 0 && 
        domAnalysis.structureIssues.length === 0) {
      this.log('DOM structure validation passed', 'success');
    }
  }

  async generateReport() {
    this.log('Generating debug report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues: this.issues.length,
        highSeverity: this.issues.filter(i => i.severity === 'high').length,
        mediumSeverity: this.issues.filter(i => i.severity === 'medium').length,
        lowSeverity: this.issues.filter(i => i.severity === 'low').length
      },
      issues: this.issues,
      recommendations: []
    };
    
    // Generate recommendations based on found issues
    const jsErrors = this.issues.filter(i => i.category === 'JavaScript Error' || i.category === 'DOM Issue');
    const apiErrors = this.issues.filter(i => i.category === 'API Error');
    
    if (jsErrors.length > 0) {
      report.recommendations.push({
        priority: 'High',
        issue: 'JavaScript/DOM Issues',
        solution: 'Fix element ID mismatches between JavaScript code and HTML. Update initializeOperationHours function to use correct selectors.'
      });
    }
    
    if (apiErrors.length > 0) {
      report.recommendations.push({
        priority: 'High',
        issue: 'API Endpoint Failures',
        solution: 'Check authentication middleware, tenant isolation, and database connectivity for merchant profile endpoints.'
      });
    }
    
    // Save report
    await fs.writeFile('./SETTINGS_DEBUG_REPORT.json', JSON.stringify(report, null, 2));
    
    // Display summary
    this.log('\n=== DEBUG REPORT SUMMARY ===', 'info');
    this.log(`Total Issues Found: ${report.summary.totalIssues}`, 'info');
    this.log(`High Severity: ${report.summary.highSeverity}`, 'error');
    this.log(`Medium Severity: ${report.summary.mediumSeverity}`, 'warning');
    this.log(`Low Severity: ${report.summary.lowSeverity}`, 'info');
    
    if (report.recommendations.length > 0) {
      this.log('\n=== RECOMMENDATIONS ===', 'info');
      report.recommendations.forEach((rec, i) => {
        this.log(`${i + 1}. [${rec.priority}] ${rec.issue}`, 'info');
        this.log(`   Solution: ${rec.solution}`, 'debug');
      });
    }
    
    this.log(`\nDetailed report saved to: SETTINGS_DEBUG_REPORT.json`, 'success');
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.log('Browser closed', 'debug');
    }
  }

  async run() {
    try {
      await this.init();
      await this.loginIfNeeded();
      await this.testSettingsPageLoad();
      await this.checkDOMStructure();
      await this.testAPIEndpoints();
      await this.testFormSubmission();
      await this.generateReport();
      
    } catch (error) {
      this.log(`Debug test failed: ${error.message}`, 'error');
      this.addIssue('Test Execution', error.message, 'high');
    } finally {
      await this.cleanup();
    }
  }
}

// Run the debugger
if (require.main === module) {
  const settingsDebugger = new SettingsDebugger();
  settingsDebugger.run().catch(console.error);
}

module.exports = SettingsDebugger;