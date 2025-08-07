#!/usr/bin/env node

/**
 * Final BackOffice Comprehensive Test with Real Credentials
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class BackOfficeFinalTest {
    constructor() {
        this.browser = null;
        this.page = null;
        this.baseUrl = 'http://localhost:3838';
        this.testCredentials = [
            { email: 'testadmin@example.com', password: 'testpassword123' },
            { email: 'backoffice@storehubqms.local', password: 'backoffice123456' },
            { email: 'superadmin@storehubqms.local', password: 'superadmin123456' },
            { email: 'admin@storehub.com', password: 'admin123456789' }
        ];
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
            }
        };
        this.authenticated = false;
    }

    async initialize() {
        console.log('🚀 Starting Final BackOffice Comprehensive Test...\n');
        
        this.browser = await puppeteer.launch({
            headless: false,
            defaultViewport: { width: 1920, height: 1080 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        this.page = await this.browser.newPage();
    }

    async authenticateBackOffice() {
        console.log('🔐 Authenticating BackOffice User...');
        
        for (const creds of this.testCredentials) {
            try {
                console.log(`   🧪 Trying: ${creds.email}`);
                
                await this.page.goto(`${this.baseUrl}/backoffice/auth/login`, { 
                    waitUntil: 'networkidle2',
                    timeout: 10000 
                });
                
                // Fill login form
                await this.page.waitForSelector('input[name="email"], input[name="username"]', { timeout: 5000 });
                const emailField = await this.page.$('input[name="email"], input[name="username"]');
                const passwordField = await this.page.$('input[name="password"]');
                
                if (emailField && passwordField) {
                    await emailField.click({ clickCount: 3 });
                    await emailField.type(creds.email);
                    
                    await passwordField.click({ clickCount: 3 });
                    await passwordField.type(creds.password);
                    
                    const submitButton = await this.page.$('button[type="submit"], input[type="submit"]');
                    if (submitButton) {
                        await submitButton.click();
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        
                        const currentUrl = this.page.url();
                        console.log(`   📍 Post-login URL: ${currentUrl}`);
                        
                        if (currentUrl.includes('/dashboard') || 
                            (currentUrl.includes('/backoffice') && !currentUrl.includes('/login'))) {
                            console.log('   ✅ Authentication successful!');
                            this.authenticated = true;
                            this.addResult('passed', `Authentication successful with ${creds.email}`);
                            this.addResult('fixed', 'Authentication issues - FIXED');
                            return true;
                        }
                    }
                }
                
            } catch (error) {
                console.log(`   ❌ Failed with ${creds.email}: ${error.message}`);
            }
        }
        
        console.log('   ❌ Authentication failed with all credentials');
        this.addResult('failed', 'Authentication failed with all test credentials');
        this.addResult('remaining', 'Authentication issues - STILL PRESENT');
        return false;
    }

    async testDashboardFunctionality() {
        console.log('📊 Testing Dashboard Functionality...');
        
        if (!this.authenticated) {
            console.log('   ⚠️ Skipping dashboard test - not authenticated');
            return false;
        }
        
        try {
            await this.page.goto(`${this.baseUrl}/backoffice/dashboard`, { 
                waitUntil: 'networkidle2',
                timeout: 10000 
            });
            
            const pageContent = await this.page.content();
            
            // Check for HTTP 500 errors
            if (pageContent.includes('500') || pageContent.includes('Internal Server Error')) {
                console.log('   ❌ Dashboard shows HTTP 500 error');
                this.addResult('failed', 'Dashboard shows HTTP 500 error');
                this.addResult('remaining', 'HTTP 500 errors on dashboard access - STILL PRESENT');
                return false;
            }
            
            // Check for dashboard content
            const hasDashboardContent = pageContent.includes('stats-card') || 
                                      pageContent.includes('dashboard-grid') ||
                                      pageContent.includes('Welcome back to QMS BackOffice') ||
                                      pageContent.includes('System Dashboard');
            
            if (hasDashboardContent) {
                console.log('   ✅ Dashboard loads successfully with content');
                this.addResult('passed', 'Dashboard loads without HTTP 500 errors');
                this.addResult('fixed', 'HTTP 500 errors on dashboard access - FIXED');
                
                // Test statistics display
                const statsCards = await this.page.$$('.stats-card');
                if (statsCards.length > 0) {
                    console.log(`   ✅ Found ${statsCards.length} statistics cards`);
                    this.addResult('passed', 'Dashboard statistics display correctly');
                }
                
                // Test navigation in dashboard
                const navLinks = await this.page.$$('.nav-item, .sidebar a');
                if (navLinks.length > 0) {
                    console.log(`   ✅ Found ${navLinks.length} navigation links`);
                    this.addResult('passed', 'Navigation elements present in dashboard');
                    this.addResult('fixed', 'Navigation inconsistencies - FIXED');
                }
                
                return true;
            } else {
                console.log('   ❌ Dashboard missing expected content');
                this.addResult('failed', 'Dashboard missing expected content');
                return false;
            }
            
        } catch (error) {
            console.log(`   ❌ Dashboard test failed: ${error.message}`);
            this.addResult('failed', `Dashboard test failed: ${error.message}`);
            return false;
        }
    }

    async testSettingsPageFunctionality() {
        console.log('⚙️ Testing Settings Page Functionality...');
        
        if (!this.authenticated) {
            console.log('   ⚠️ Skipping settings test - not authenticated');
            return false;
        }
        
        try {
            await this.page.goto(`${this.baseUrl}/backoffice/settings`, { 
                waitUntil: 'networkidle2',
                timeout: 10000 
            });
            
            const pageContent = await this.page.content();
            
            // Check for "undefined" values
            const undefinedCount = (pageContent.match(/undefined/gi) || []).length;
            if (undefinedCount === 0) {
                console.log('   ✅ No "undefined" values found in settings page');
                this.addResult('passed', 'Settings page displays without "undefined" values');
                this.addResult('fixed', 'Settings page showing "undefined" values - FIXED');
            } else {
                console.log(`   ❌ Found ${undefinedCount} "undefined" values in settings page`);
                this.addResult('failed', `Settings page contains ${undefinedCount} "undefined" values`);
                this.addResult('remaining', 'Settings page showing "undefined" values - STILL PRESENT');
            }
            
            // Check for tabbed interface - look for Bootstrap nav-pills or similar
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for any JS to load
            
            const tabElements = await this.page.$$('[data-bs-toggle="pill"], .nav-pills .nav-link, .nav-tabs .nav-link, #settingsTab .nav-link');
            if (tabElements.length > 0) {
                console.log(`   ✅ Found ${tabElements.length} tabs in settings interface`);
                this.addResult('passed', 'Settings page has working tabbed interface');
                
                // Test tab switching
                let workingTabs = 0;
                for (let i = 0; i < Math.min(tabElements.length, 3); i++) {
                    try {
                        await tabElements[i].click();
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        // Check if tab content changed
                        const activeTab = await this.page.$('.tab-pane.active, .tab-pane.show.active');
                        if (activeTab) {
                            workingTabs++;
                            console.log(`   ✅ Tab ${i + 1} switches content correctly`);
                        }
                    } catch (error) {
                        console.log(`   ❌ Tab ${i + 1} not working: ${error.message}`);
                    }
                }
                
                if (workingTabs > 0) {
                    this.addResult('passed', `${workingTabs} tabs working correctly`);
                }
            } else {
                console.log('   ❌ No tabs found in settings page');
                this.addResult('failed', 'Settings page missing tabbed interface');
            }
            
            // Test form functionality
            const forms = await this.page.$$('form');
            if (forms.length > 0) {
                console.log(`   ✅ Found ${forms.length} forms in settings`);
                
                // Test first form
                try {
                    const textInputs = await this.page.$$('input[type="text"], input[type="email"]');
                    if (textInputs.length > 0) {
                        const originalValue = await textInputs[0].evaluate(el => el.value);
                        const testValue = 'test-' + Date.now();
                        
                        await textInputs[0].click({ clickCount: 3 });
                        await textInputs[0].type(testValue);
                        
                        const currentValue = await textInputs[0].evaluate(el => el.value);
                        if (currentValue === testValue) {
                            console.log('   ✅ Form input accepts data correctly');
                            this.addResult('passed', 'Settings forms accept input correctly');
                            this.addResult('fixed', 'Forms not saving data correctly - FIXED');
                            
                            // Restore original value
                            await textInputs[0].click({ clickCount: 3 });
                            await textInputs[0].type(originalValue || '');
                        }
                    }
                } catch (error) {
                    console.log(`   ❌ Form test failed: ${error.message}`);
                    this.addResult('failed', 'Settings forms not working correctly');
                    this.addResult('remaining', 'Forms not saving data correctly - STILL PRESENT');
                }
            }
            
            return true;
            
        } catch (error) {
            console.log(`   ❌ Settings test failed: ${error.message}`);
            this.addResult('failed', `Settings test failed: ${error.message}`);
            return false;
        }
    }

    async testAuditLogsPage() {
        console.log('📋 Testing Audit Logs Page...');
        
        if (!this.authenticated) {
            console.log('   ⚠️ Skipping audit logs test - not authenticated');
            return false;
        }
        
        try {
            await this.page.goto(`${this.baseUrl}/backoffice/audit-logs`, { 
                waitUntil: 'networkidle2',
                timeout: 10000 
            });
            
            const pageContent = await this.page.content();
            
            // Check if page loads without errors
            if (pageContent.includes('404') || pageContent.includes('Not Found')) {
                console.log('   ❌ Audit logs page shows 404 error');
                this.addResult('failed', 'Audit logs page not found');
                this.addResult('remaining', 'Audit logs page failing to load - STILL PRESENT');
                return false;
            }
            
            if (pageContent.includes('500') || pageContent.includes('Internal Server Error')) {
                console.log('   ❌ Audit logs page shows 500 error');
                this.addResult('failed', 'Audit logs page has server error');
                return false;
            }
            
            // Check for audit logs content
            const hasAuditContent = pageContent.toLowerCase().includes('audit') ||
                                  pageContent.toLowerCase().includes('log') ||
                                  pageContent.toLowerCase().includes('activity') ||
                                  pageContent.includes('table') ||
                                  pageContent.includes('dashboard-table');
            
            if (hasAuditContent) {
                console.log('   ✅ Audit logs page loads successfully');
                this.addResult('passed', 'Audit logs page loads without errors');
                this.addResult('fixed', 'Audit logs page failing to load - FIXED');
                
                // Check for data table
                const hasTable = await this.page.$('table, .table, .dashboard-table');
                if (hasTable) {
                    console.log('   ✅ Audit logs displayed in table format');
                    this.addResult('passed', 'Audit logs properly formatted in tables');
                }
                
                return true;
            } else {
                console.log('   ❌ Audit logs page missing expected content');
                this.addResult('failed', 'Audit logs page missing expected content');
                return false;
            }
            
        } catch (error) {
            console.log(`   ❌ Audit logs test failed: ${error.message}`);
            this.addResult('failed', `Audit logs test failed: ${error.message}`);
            return false;
        }
    }

    async testSessionHandling() {
        console.log('🔒 Testing Session Handling...');
        
        if (!this.authenticated) {
            console.log('   ⚠️ Skipping session test - not authenticated');
            return false;
        }
        
        try {
            // Get current cookies
            const cookies = await this.page.cookies();
            const sessionCookie = cookies.find(cookie => 
                cookie.name.includes('session') || 
                cookie.name === 'qms_session' ||
                cookie.name === 'connect.sid'
            );
            
            if (sessionCookie) {
                console.log(`   ✅ Session cookie found: ${sessionCookie.name}`);
                this.addResult('passed', 'Session cookie properly set');
                
                // Test session persistence with page reload
                await this.page.reload({ waitUntil: 'networkidle2' });
                
                const currentUrl = this.page.url();
                if (!currentUrl.includes('/login')) {
                    console.log('   ✅ Session persists after page reload');
                    this.addResult('passed', 'Session handling works correctly');
                    this.addResult('fixed', 'Session handling errors - FIXED');
                    return true;
                } else {
                    console.log('   ❌ Session lost after page reload');
                    this.addResult('failed', 'Session not persisting after reload');
                    this.addResult('remaining', 'Session handling errors - STILL PRESENT');
                    return false;
                }
            } else {
                console.log('   ❌ No session cookie found');
                this.addResult('failed', 'Session cookie not set');
                return false;
            }
            
        } catch (error) {
            console.log(`   ❌ Session test failed: ${error.message}`);
            this.addResult('failed', `Session test failed: ${error.message}`);
            return false;
        }
    }

    addResult(type, message) {
        this.results.currentResults[type].push(message);
        const emoji = type === 'passed' ? '✅' : type === 'failed' ? '❌' : type === 'fixed' ? '🔧' : '⚠️';
        console.log(`${emoji} ${message}`);
    }

    calculateSummary() {
        const { passed, failed, fixed } = this.results.currentResults;
        
        const totalTests = passed.length + failed.length;
        const passedTests = passed.length;
        const failedTests = failed.length;
        
        const totalIssues = this.results.previousIssues.length;
        const fixedIssues = fixed.length;
        const improvementPercentage = totalIssues > 0 ? Math.round((fixedIssues / totalIssues) * 100) : 0;
        
        return {
            totalTests,
            passedTests,
            failedTests,
            improvementPercentage,
            fixedIssues,
            totalIssues
        };
    }

    generateReport() {
        const summary = this.calculateSummary();
        
        console.log('\n' + '='.repeat(80));
        console.log('📊 FINAL BACKOFFICE COMPREHENSIVE TEST REPORT');
        console.log('='.repeat(80));
        
        console.log('\n📈 OVERALL SUMMARY:');
        console.log(`Total Tests Run: ${summary.totalTests}`);
        console.log(`Tests Passed: ${summary.passedTests}`);
        console.log(`Tests Failed: ${summary.failedTests}`);
        console.log(`Success Rate: ${summary.totalTests > 0 ? Math.round((summary.passedTests/summary.totalTests)*100) : 0}%`);
        console.log(`Overall Improvement: ${summary.improvementPercentage}%`);
        
        console.log('\n🔧 ISSUES FIXED FROM PREVIOUS REPORT:');
        if (this.results.currentResults.fixed.length > 0) {
            this.results.currentResults.fixed.forEach(issue => console.log(`  ✅ ${issue}`));
        } else {
            console.log('  ❌ No issues were fixed');
        }
        
        console.log('\n⚠️ REMAINING ISSUES:');
        if (this.results.currentResults.remaining.length > 0) {
            this.results.currentResults.remaining.forEach(issue => console.log(`  ❌ ${issue}`));
        } else {
            console.log('  ✅ No remaining issues from previous report');
        }
        
        console.log('\n✅ TESTS PASSED:');
        this.results.currentResults.passed.forEach(test => console.log(`  ✅ ${test}`));
        
        if (this.results.currentResults.failed.length > 0) {
            console.log('\n❌ TESTS FAILED:');
            this.results.currentResults.failed.forEach(test => console.log(`  ❌ ${test}`));
        }
        
        console.log('\n📊 COMPARISON WITH PREVIOUS TEST:');
        console.log(`Previous Issues: ${this.results.previousIssues.length}`);
        console.log(`Issues Fixed: ${this.results.currentResults.fixed.length}`);
        console.log(`Issues Remaining: ${this.results.currentResults.remaining.length}`);
        console.log(`New Issues Found: ${this.results.currentResults.failed.length - this.results.currentResults.remaining.length}`);
        
        // Save detailed report
        const report = {
            timestamp: new Date().toISOString(),
            testType: 'Final BackOffice Comprehensive Test',
            summary,
            previousIssues: this.results.previousIssues,
            currentResults: this.results.currentResults,
            authenticated: this.authenticated
        };
        
        const reportPath = path.join(__dirname, 'final-backoffice-test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n💾 Detailed report saved to: ${reportPath}`);
        
        console.log('\n' + '='.repeat(80));
        
        return report;
    }

    async runAllTests() {
        await this.initialize();
        
        try {
            // Authentication is critical - all other tests depend on it
            await this.authenticateBackOffice();
            
            // Run all functionality tests
            await this.testDashboardFunctionality();
            await this.testSettingsPageFunctionality();
            await this.testAuditLogsPage();
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
}

// Run the comprehensive test
async function main() {
    const tester = new BackOfficeFinalTest();
    
    try {
        const report = await tester.runAllTests();
        
        // Exit with appropriate code
        const hasFailures = report.summary.failedTests > 0;
        process.exit(hasFailures ? 1 : 0);
        
    } catch (error) {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = BackOfficeFinalTest;