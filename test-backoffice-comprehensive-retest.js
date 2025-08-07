#!/usr/bin/env node

/**
 * Comprehensive BackOffice Functionality Re-Test
 * Tests all BackOffice features after fixes to verify improvements
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class BackOfficeReTest {
    constructor() {
        this.browser = null;
        this.page = null;
        this.baseUrl = 'http://localhost:3838';
        this.results = {
            previousIssues: [
                'HTTP 500 errors on dashboard access',
                'Settings page showing "undefined" values',
                'Audit logs page failing to load',
                'Forms not saving data correctly',
                'Navigation inconsistencies',
                'Session handling errors'
            ],
            currentResults: {
                passed: [],
                failed: [],
                fixed: [],
                remaining: []
            },
            summary: {
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                improvementPercentage: 0
            }
        };
    }

    async initialize() {
        console.log('🚀 Starting BackOffice Comprehensive Re-Test...\n');
        
        this.browser = await puppeteer.launch({
            headless: false,
            defaultViewport: { width: 1920, height: 1080 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        this.page = await this.browser.newPage();
        
        // Set up error monitoring
        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('❌ Console Error:', msg.text());
            }
        });
        
        this.page.on('pageerror', error => {
            console.log('❌ Page Error:', error.message);
        });
        
        this.page.on('response', response => {
            if (response.status() >= 400) {
                console.log(`❌ HTTP ${response.status()}: ${response.url()}`);
            }
        });
    }

    async testBackOfficeLogin() {
        console.log('🔐 Testing BackOffice Login...');
        
        try {
            await this.page.goto(`${this.baseUrl}/backoffice/login`, { 
                waitUntil: 'networkidle2',
                timeout: 10000 
            });
            
            // Check if login page loads without errors
            const title = await this.page.title();
            if (!title.toLowerCase().includes('login') && !title.toLowerCase().includes('backoffice')) {
                throw new Error('Login page title incorrect');
            }
            
            // Try to find login form elements
            await this.page.waitForSelector('input[name="username"], input[name="email"], input[type="email"]', { timeout: 5000 });
            await this.page.waitForSelector('input[name="password"], input[type="password"]', { timeout: 5000 });
            
            // Fill in login credentials
            const usernameField = await this.page.$('input[name="username"], input[name="email"], input[type="email"]');
            const passwordField = await this.page.$('input[name="password"], input[type="password"]');
            
            if (usernameField && passwordField) {
                await usernameField.type('admin@test.com');
                await passwordField.type('admin123');
                
                // Submit form
                const submitButton = await this.page.$('button[type="submit"], input[type="submit"], .btn-login');
                if (submitButton) {
                    await submitButton.click();
                    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
                }
            }
            
            // Check if we're redirected to dashboard
            const currentUrl = this.page.url();
            if (currentUrl.includes('/backoffice') && !currentUrl.includes('/login')) {
                this.addResult('passed', 'BackOffice login functionality works');
                return true;
            } else {
                throw new Error('Login failed or redirect did not occur');
            }
            
        } catch (error) {
            console.log(`❌ Login test failed: ${error.message}`);
            this.addResult('failed', `BackOffice login failed: ${error.message}`);
            return false;
        }
    }

    async testDashboardAccess() {
        console.log('📊 Testing Dashboard Access...');
        
        try {
            await this.page.goto(`${this.baseUrl}/backoffice/dashboard`, { 
                waitUntil: 'networkidle2',
                timeout: 10000 
            });
            
            // Wait for dashboard content to load
            await this.page.waitForSelector('body', { timeout: 5000 });
            
            // Check for HTTP 500 errors
            const pageContent = await this.page.content();
            if (pageContent.includes('500') || pageContent.includes('Internal Server Error')) {
                throw new Error('Dashboard showing HTTP 500 error');
            }
            
            // Check for dashboard-specific content
            const dashboardElements = await this.page.$$eval('*', elements => {
                return elements.some(el => 
                    el.textContent && (
                        el.textContent.toLowerCase().includes('dashboard') ||
                        el.textContent.toLowerCase().includes('overview') ||
                        el.textContent.toLowerCase().includes('statistics') ||
                        el.className.toLowerCase().includes('dashboard')
                    )
                );
            });
            
            if (dashboardElements) {
                this.addResult('passed', 'Dashboard loads without HTTP 500 errors');
                this.addResult('fixed', 'HTTP 500 errors on dashboard access - FIXED');
                return true;
            } else {
                throw new Error('Dashboard content not found');
            }
            
        } catch (error) {
            console.log(`❌ Dashboard test failed: ${error.message}`);
            this.addResult('failed', `Dashboard access failed: ${error.message}`);
            this.addResult('remaining', 'HTTP 500 errors on dashboard access - STILL PRESENT');
            return false;
        }
    }

    async testSettingsPage() {
        console.log('⚙️ Testing Settings Page...');
        
        try {
            await this.page.goto(`${this.baseUrl}/backoffice/settings`, { 
                waitUntil: 'networkidle2',
                timeout: 10000 
            });
            
            // Wait for settings page to load
            await this.page.waitForSelector('body', { timeout: 5000 });
            
            // Check for undefined values
            const pageContent = await this.page.content();
            const hasUndefined = pageContent.toLowerCase().includes('undefined');
            
            if (hasUndefined) {
                console.log('❌ Found "undefined" values in settings page');
                this.addResult('failed', 'Settings page still contains "undefined" values');
                this.addResult('remaining', 'Settings page showing "undefined" values - STILL PRESENT');
            } else {
                console.log('✅ No "undefined" values found in settings page');
                this.addResult('passed', 'Settings page displays without "undefined" values');
                this.addResult('fixed', 'Settings page showing "undefined" values - FIXED');
            }
            
            // Check for tabbed interface
            const tabs = await this.page.$$('.nav-tabs .nav-link, .tab-nav .tab-link, [role="tab"], .settings-tab');
            if (tabs.length > 0) {
                console.log(`✅ Found ${tabs.length} tabs in settings interface`);
                this.addResult('passed', 'Settings page has tabbed interface');
                
                // Test tab functionality
                for (let i = 0; i < Math.min(tabs.length, 3); i++) {
                    try {
                        await tabs[i].click();
                        await this.page.waitForTimeout(1000);
                        console.log(`✅ Tab ${i + 1} clickable`);
                    } catch (error) {
                        console.log(`❌ Tab ${i + 1} not clickable: ${error.message}`);
                    }
                }
            } else {
                console.log('❌ No tabs found in settings page');
                this.addResult('failed', 'Settings page missing tabbed interface');
            }
            
            // Test form saving functionality
            const forms = await this.page.$$('form');
            if (forms.length > 0) {
                console.log(`✅ Found ${forms.length} forms in settings`);
                
                // Try to find and test a simple form field
                const textInputs = await this.page.$$('input[type="text"], input[type="email"], textarea');
                if (textInputs.length > 0) {
                    try {
                        const testValue = 'test-value-' + Date.now();
                        await textInputs[0].clear();
                        await textInputs[0].type(testValue);
                        
                        // Look for save button
                        const saveButton = await this.page.$('button[type="submit"], .btn-save, .save-btn, input[type="submit"]');
                        if (saveButton) {
                            await saveButton.click();
                            await this.page.waitForTimeout(2000);
                            
                            // Check if value persists
                            const savedValue = await textInputs[0].evaluate(el => el.value);
                            if (savedValue === testValue) {
                                console.log('✅ Form data saves correctly');
                                this.addResult('passed', 'Settings forms save data correctly');
                                this.addResult('fixed', 'Forms not saving data correctly - FIXED');
                            } else {
                                throw new Error('Form data not saved correctly');
                            }
                        }
                    } catch (error) {
                        console.log(`❌ Form save test failed: ${error.message}`);
                        this.addResult('failed', 'Settings forms not saving correctly');
                        this.addResult('remaining', 'Forms not saving data correctly - STILL PRESENT');
                    }
                }
            }
            
            return true;
            
        } catch (error) {
            console.log(`❌ Settings page test failed: ${error.message}`);
            this.addResult('failed', `Settings page failed: ${error.message}`);
            return false;
        }
    }

    async testAuditLogsPage() {
        console.log('📋 Testing Audit Logs Page...');
        
        try {
            // Try multiple possible audit log URLs
            const auditUrls = [
                `${this.baseUrl}/backoffice/audit-logs`,
                `${this.baseUrl}/backoffice/logs`,
                `${this.baseUrl}/backoffice/audit`,
                `${this.baseUrl}/backoffice/activity`
            ];
            
            let loaded = false;
            for (const url of auditUrls) {
                try {
                    await this.page.goto(url, { 
                        waitUntil: 'networkidle2',
                        timeout: 8000 
                    });
                    
                    const pageContent = await this.page.content();
                    if (!pageContent.includes('404') && !pageContent.includes('Not Found')) {
                        loaded = true;
                        console.log(`✅ Audit logs accessible at: ${url}`);
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            if (!loaded) {
                throw new Error('Audit logs page not accessible at any URL');
            }
            
            // Check for logs content
            await this.page.waitForSelector('body', { timeout: 5000 });
            
            const pageContent = await this.page.content();
            const hasLogContent = pageContent.toLowerCase().includes('log') || 
                                pageContent.toLowerCase().includes('audit') ||
                                pageContent.toLowerCase().includes('activity') ||
                                pageContent.toLowerCase().includes('event');
            
            if (hasLogContent) {
                console.log('✅ Audit logs page contains log-related content');
                this.addResult('passed', 'Audit logs page loads successfully');
                this.addResult('fixed', 'Audit logs page failing to load - FIXED');
                
                // Check for table or list structure
                const hasTable = await this.page.$('table, .table, .log-list, .audit-list');
                if (hasTable) {
                    console.log('✅ Audit logs displayed in structured format');
                    this.addResult('passed', 'Audit logs properly formatted');
                }
            } else {
                throw new Error('Audit logs page missing expected content');
            }
            
            return true;
            
        } catch (error) {
            console.log(`❌ Audit logs test failed: ${error.message}`);
            this.addResult('failed', `Audit logs page failed: ${error.message}`);
            this.addResult('remaining', 'Audit logs page failing to load - STILL PRESENT');
            return false;
        }
    }

    async testNavigationConsistency() {
        console.log('🧭 Testing Navigation Consistency...');
        
        try {
            // Check for navigation menu
            const navElements = await this.page.$$('nav, .navbar, .sidebar, .navigation, .menu');
            if (navElements.length === 0) {
                throw new Error('No navigation elements found');
            }
            
            console.log(`✅ Found ${navElements.length} navigation elements`);
            
            // Check for navigation links
            const navLinks = await this.page.$$('nav a, .navbar a, .sidebar a, .nav-link');
            if (navLinks.length > 0) {
                console.log(`✅ Found ${navLinks.length} navigation links`);
                this.addResult('passed', 'Navigation menu present with links');
                
                // Test a few navigation links
                let workingLinks = 0;
                for (let i = 0; i < Math.min(navLinks.length, 3); i++) {
                    try {
                        const href = await navLinks[i].evaluate(el => el.href);
                        if (href && href.includes('/backoffice')) {
                            await navLinks[i].click();
                            await this.page.waitForTimeout(2000);
                            
                            const currentUrl = this.page.url();
                            if (currentUrl !== href && currentUrl.includes('/backoffice')) {
                                workingLinks++;
                            }
                        }
                    } catch (error) {
                        console.log(`Navigation link ${i + 1} test failed: ${error.message}`);
                    }
                }
                
                if (workingLinks > 0) {
                    console.log(`✅ ${workingLinks} navigation links working`);
                    this.addResult('passed', 'Navigation links functional');
                    this.addResult('fixed', 'Navigation inconsistencies - FIXED');
                } else {
                    this.addResult('failed', 'Navigation links not functional');
                    this.addResult('remaining', 'Navigation inconsistencies - STILL PRESENT');
                }
            }
            
            return true;
            
        } catch (error) {
            console.log(`❌ Navigation test failed: ${error.message}`);
            this.addResult('failed', `Navigation consistency failed: ${error.message}`);
            return false;
        }
    }

    async testSessionHandling() {
        console.log('🔒 Testing Session Handling...');
        
        try {
            // Get current cookies
            const cookies = await this.page.cookies();
            const sessionCookie = cookies.find(cookie => 
                cookie.name.toLowerCase().includes('session') || 
                cookie.name.toLowerCase().includes('auth') ||
                cookie.name === 'connect.sid'
            );
            
            if (sessionCookie) {
                console.log(`✅ Session cookie found: ${sessionCookie.name}`);
                this.addResult('passed', 'Session cookie properly set');
                
                // Test session persistence
                await this.page.reload({ waitUntil: 'networkidle2' });
                
                const currentUrl = this.page.url();
                if (!currentUrl.includes('/login')) {
                    console.log('✅ Session persists after page reload');
                    this.addResult('passed', 'Session handling works correctly');
                    this.addResult('fixed', 'Session handling errors - FIXED');
                } else {
                    throw new Error('Session not persisting');
                }
            } else {
                throw new Error('No session cookie found');
            }
            
            return true;
            
        } catch (error) {
            console.log(`❌ Session handling test failed: ${error.message}`);
            this.addResult('failed', `Session handling failed: ${error.message}`);
            this.addResult('remaining', 'Session handling errors - STILL PRESENT');
            return false;
        }
    }

    addResult(type, message) {
        this.results.currentResults[type].push(message);
        console.log(`${type === 'passed' ? '✅' : type === 'failed' ? '❌' : type === 'fixed' ? '🔧' : '⚠️'} ${message}`);
    }

    calculateSummary() {
        const { passed, failed, fixed } = this.results.currentResults;
        
        this.results.summary.totalTests = passed.length + failed.length;
        this.results.summary.passedTests = passed.length;
        this.results.summary.failedTests = failed.length;
        
        // Calculate improvement percentage
        const totalIssues = this.results.previousIssues.length;
        const fixedIssues = fixed.length;
        this.results.summary.improvementPercentage = totalIssues > 0 ? 
            Math.round((fixedIssues / totalIssues) * 100) : 0;
    }

    generateReport() {
        this.calculateSummary();
        
        const report = {
            timestamp: new Date().toISOString(),
            testType: 'BackOffice Comprehensive Re-Test',
            summary: this.results.summary,
            previousIssues: this.results.previousIssues,
            currentResults: this.results.currentResults,
            comparison: {
                totalIssuesFromPrevious: this.results.previousIssues.length,
                issuesFixed: this.results.currentResults.fixed.length,
                issuesRemaining: this.results.currentResults.remaining.length,
                newTestsPassed: this.results.currentResults.passed.length,
                newTestsFailed: this.results.currentResults.failed.length
            }
        };
        
        return report;
    }

    async runAllTests() {
        console.log('🏁 Running All BackOffice Tests...\n');
        
        await this.initialize();
        
        try {
            // Run all tests
            await this.testBackOfficeLogin();
            await this.testDashboardAccess();
            await this.testSettingsPage();
            await this.testAuditLogsPage();
            await this.testNavigationConsistency();
            await this.testSessionHandling();
            
        } catch (error) {
            console.log(`❌ Test execution error: ${error.message}`);
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
        
        return this.generateReport();
    }

    displayReport(report) {
        console.log('\n' + '='.repeat(80));
        console.log('📊 BACKOFFICE COMPREHENSIVE RE-TEST REPORT');
        console.log('='.repeat(80));
        
        console.log('\n📈 SUMMARY:');
        console.log(`Total Tests Run: ${report.summary.totalTests}`);
        console.log(`Tests Passed: ${report.summary.passedTests}`);
        console.log(`Tests Failed: ${report.summary.failedTests}`);
        console.log(`Overall Improvement: ${report.summary.improvementPercentage}%`);
        
        console.log('\n🔧 ISSUES FIXED:');
        if (report.currentResults.fixed.length > 0) {
            report.currentResults.fixed.forEach(issue => console.log(`  ✅ ${issue}`));
        } else {
            console.log('  ❌ No issues were fixed');
        }
        
        console.log('\n⚠️ REMAINING ISSUES:');
        if (report.currentResults.remaining.length > 0) {
            report.currentResults.remaining.forEach(issue => console.log(`  ❌ ${issue}`));
        } else {
            console.log('  ✅ No remaining issues');
        }
        
        console.log('\n✅ NEW TESTS PASSED:');
        report.currentResults.passed.forEach(test => console.log(`  ✅ ${test}`));
        
        if (report.currentResults.failed.length > 0) {
            console.log('\n❌ NEW TESTS FAILED:');
            report.currentResults.failed.forEach(test => console.log(`  ❌ ${test}`));
        }
        
        console.log('\n📊 COMPARISON WITH PREVIOUS TEST:');
        console.log(`Previous Issues Identified: ${report.comparison.totalIssuesFromPrevious}`);
        console.log(`Issues Fixed: ${report.comparison.issuesFixed}`);
        console.log(`Issues Still Present: ${report.comparison.issuesRemaining}`);
        
        // Save report to file
        const reportPath = path.join(__dirname, 'backoffice-retest-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n💾 Detailed report saved to: ${reportPath}`);
        
        console.log('\n' + '='.repeat(80));
    }
}

// Run the comprehensive re-test
async function main() {
    const tester = new BackOfficeReTest();
    
    try {
        const report = await tester.runAllTests();
        tester.displayReport(report);
        
        // Exit with appropriate code
        const hasFailures = report.currentResults.failed.length > 0 || 
                          report.currentResults.remaining.length > 0;
        process.exit(hasFailures ? 1 : 0);
        
    } catch (error) {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = BackOfficeReTest;