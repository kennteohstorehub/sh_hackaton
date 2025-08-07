#!/usr/bin/env node

/**
 * Manual BackOffice Verification Test
 * Simple test to verify each component step by step
 */

const puppeteer = require('puppeteer');
const path = require('path');

class BackOfficeManualTest {
    constructor() {
        this.browser = null;
        this.page = null;
        this.baseUrl = 'http://localhost:3838';
        this.testResults = {
            loginPageAccess: false,
            loginFormFound: false,
            authenticationWorking: false,
            dashboardAccess: false,
            settingsAccess: false,
            settingsTabsFound: false,
            auditLogsAccess: false,
            navigationWorking: false
        };
    }

    async initialize() {
        console.log('🚀 Starting BackOffice Manual Verification Test...\n');
        
        this.browser = await puppeteer.launch({
            headless: false,
            defaultViewport: { width: 1920, height: 1080 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        this.page = await this.browser.newPage();
        
        // Add console logging
        this.page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        this.page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    }

    async testLoginPageAccess() {
        console.log('🔐 Testing Login Page Access...');
        
        try {
            await this.page.goto(`${this.baseUrl}/backoffice/auth/login`, { 
                waitUntil: 'networkidle2',
                timeout: 10000 
            });
            
            const title = await this.page.title();
            console.log(`   Page title: ${title}`);
            
            this.testResults.loginPageAccess = true;
            console.log('   ✅ Login page accessible');
            return true;
            
        } catch (error) {
            console.log(`   ❌ Login page access failed: ${error.message}`);
            return false;
        }
    }

    async testLoginForm() {
        console.log('📝 Testing Login Form...');
        
        try {
            // Look for form elements
            const usernameField = await this.page.$('input[name="username"], input[name="email"], input[type="email"]');
            const passwordField = await this.page.$('input[name="password"], input[type="password"]');
            const submitButton = await this.page.$('button[type="submit"], input[type="submit"], .btn-login');
            
            if (usernameField && passwordField && submitButton) {
                console.log('   ✅ Login form found with all required fields');
                this.testResults.loginFormFound = true;
                
                // Check if there's a register link or create account option
                const hasRegisterLink = await this.page.$('a[href*="register"], .register-link, .create-account');
                if (hasRegisterLink) {
                    console.log('   📝 Register link found, testing account creation...');
                    
                    await this.page.goto(`${this.baseUrl}/backoffice/auth/register`);
                    await this.page.waitForSelector('body', { timeout: 5000 });
                    
                    // Try to create a test account
                    const nameField = await this.page.$('input[name="name"], input[name="fullName"]');
                    const emailField = await this.page.$('input[name="email"], input[type="email"]');
                    const passwordField = await this.page.$('input[name="password"], input[type="password"]');
                    const confirmPasswordField = await this.page.$('input[name="confirmPassword"], input[name="password_confirmation"]');
                    const registerButton = await this.page.$('button[type="submit"], input[type="submit"]');
                    
                    if (nameField && emailField && passwordField && registerButton) {
                        await nameField.type('Test Admin');
                        await emailField.type('testadmin@example.com');
                        await passwordField.type('password123');
                        if (confirmPasswordField) {
                            await confirmPasswordField.type('password123');
                        }
                        
                        await registerButton.click();
                        await this.page.waitForTimeout(3000);
                        
                        console.log('   📝 Attempted to create test account');
                    }
                }
                
                return true;
            } else {
                console.log('   ❌ Login form incomplete or missing');
                return false;
            }
            
        } catch (error) {
            console.log(`   ❌ Login form test failed: ${error.message}`);
            return false;
        }
    }

    async testAuthentication() {
        console.log('🔑 Testing Authentication...');
        
        try {
            // Go back to login page
            await this.page.goto(`${this.baseUrl}/backoffice/auth/login`);
            await this.page.waitForSelector('body', { timeout: 5000 });
            
            const usernameField = await this.page.$('input[name="username"], input[name="email"], input[type="email"]');
            const passwordField = await this.page.$('input[name="password"], input[type="password"]');
            
            if (usernameField && passwordField) {
                // Try different common credentials
                const testCredentials = [
                    { username: 'testadmin@example.com', password: 'password123' },
                    { username: 'admin@example.com', password: 'admin123' },
                    { username: 'admin', password: 'password' },
                    { username: 'admin@storehubqms.com', password: 'admin123' }
                ];
                
                for (const creds of testCredentials) {
                    console.log(`   🧪 Trying credentials: ${creds.username}`);
                    
                    // Clear previous values
                    await usernameField.click({ clickCount: 3 });
                    await usernameField.type(creds.username);
                    
                    await passwordField.click({ clickCount: 3 });
                    await passwordField.type(creds.password);
                    
                    const submitButton = await this.page.$('button[type="submit"], input[type="submit"], .btn-login');
                    if (submitButton) {
                        await submitButton.click();
                        await this.page.waitForTimeout(3000);
                        
                        const currentUrl = this.page.url();
                        console.log(`   📍 Current URL after login attempt: ${currentUrl}`);
                        
                        if (currentUrl.includes('/dashboard') || currentUrl.includes('/backoffice') && !currentUrl.includes('/login')) {
                            console.log('   ✅ Authentication successful!');
                            this.testResults.authenticationWorking = true;
                            return true;
                        }
                    }
                    
                    // If still on login page, try next credentials
                    await this.page.goto(`${this.baseUrl}/backoffice/auth/login`);
                    await this.page.waitForSelector('body', { timeout: 5000 });
                }
            }
            
            console.log('   ❌ Authentication failed with all test credentials');
            return false;
            
        } catch (error) {
            console.log(`   ❌ Authentication test failed: ${error.message}`);
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
            
            const pageContent = await this.page.content();
            
            // Check for error pages
            if (pageContent.includes('500') || pageContent.includes('Internal Server Error')) {
                console.log('   ❌ Dashboard shows HTTP 500 error');
                return false;
            }
            
            if (pageContent.includes('404') || pageContent.includes('Not Found')) {
                console.log('   ❌ Dashboard shows HTTP 404 error');
                return false;
            }
            
            if (pageContent.includes('login') && pageContent.includes('password')) {
                console.log('   ❌ Dashboard redirected to login (authentication required)');
                return false;
            }
            
            // Check for dashboard content
            const hasDashboardContent = pageContent.toLowerCase().includes('dashboard') || 
                                      pageContent.toLowerCase().includes('welcome') ||
                                      pageContent.toLowerCase().includes('statistics') ||
                                      pageContent.includes('stats-card');
            
            if (hasDashboardContent) {
                console.log('   ✅ Dashboard loads with content');
                this.testResults.dashboardAccess = true;
                return true;
            } else {
                console.log('   ❌ Dashboard loads but missing expected content');
                return false;
            }
            
        } catch (error) {
            console.log(`   ❌ Dashboard access failed: ${error.message}`);
            return false;
        }
    }

    async testSettingsAccess() {
        console.log('⚙️ Testing Settings Access...');
        
        try {
            await this.page.goto(`${this.baseUrl}/backoffice/settings`, { 
                waitUntil: 'networkidle2',
                timeout: 10000 
            });
            
            const pageContent = await this.page.content();
            
            // Check for "undefined" values
            const hasUndefined = pageContent.toLowerCase().includes('undefined');
            if (hasUndefined) {
                console.log('   ⚠️ Settings page contains "undefined" values');
            } else {
                console.log('   ✅ No "undefined" values found');
            }
            
            // Check for settings content
            const hasSettingsContent = pageContent.toLowerCase().includes('settings') ||
                                     pageContent.toLowerCase().includes('configuration') ||
                                     pageContent.includes('nav-pills') ||
                                     pageContent.includes('settingsTab');
            
            if (hasSettingsContent) {
                console.log('   ✅ Settings page loads with content');
                this.testResults.settingsAccess = true;
                
                // Check for tabs
                const tabs = await this.page.$$('.nav-link[role="tab"], .tab-nav .tab-link, [data-bs-toggle="pill"]');
                if (tabs.length > 0) {
                    console.log(`   ✅ Found ${tabs.length} tabs in settings interface`);
                    this.testResults.settingsTabsFound = true;
                    
                    // Test tab switching
                    for (let i = 0; i < Math.min(tabs.length, 3); i++) {
                        try {
                            await tabs[i].click();
                            await this.page.waitForTimeout(1000);
                            console.log(`   ✅ Tab ${i + 1} clickable`);
                        } catch (error) {
                            console.log(`   ❌ Tab ${i + 1} not clickable: ${error.message}`);
                        }
                    }
                } else {
                    console.log('   ❌ No tabs found in settings page');
                }
                
                return true;
            } else {
                console.log('   ❌ Settings page missing expected content');
                return false;
            }
            
        } catch (error) {
            console.log(`   ❌ Settings access failed: ${error.message}`);
            return false;
        }
    }

    async testAuditLogsAccess() {
        console.log('📋 Testing Audit Logs Access...');
        
        try {
            await this.page.goto(`${this.baseUrl}/backoffice/audit-logs`, { 
                waitUntil: 'networkidle2',
                timeout: 10000 
            });
            
            const pageContent = await this.page.content();
            
            // Check for audit logs content
            const hasAuditContent = pageContent.toLowerCase().includes('audit') ||
                                  pageContent.toLowerCase().includes('log') ||
                                  pageContent.toLowerCase().includes('activity') ||
                                  pageContent.includes('table');
            
            if (hasAuditContent) {
                console.log('   ✅ Audit logs page loads with content');
                this.testResults.auditLogsAccess = true;
                return true;
            } else {
                console.log('   ❌ Audit logs page missing expected content');
                return false;
            }
            
        } catch (error) {
            console.log(`   ❌ Audit logs access failed: ${error.message}`);
            return false;
        }
    }

    async testNavigation() {
        console.log('🧭 Testing Navigation...');
        
        try {
            // Go to any BackOffice page
            await this.page.goto(`${this.baseUrl}/backoffice/dashboard`);
            await this.page.waitForSelector('body', { timeout: 5000 });
            
            // Look for navigation elements
            const navElements = await this.page.$$('nav, .navbar, .sidebar, .navigation, .nav-link');
            
            if (navElements.length > 0) {
                console.log(`   ✅ Found ${navElements.length} navigation elements`);
                this.testResults.navigationWorking = true;
                return true;
            } else {
                console.log('   ❌ No navigation elements found');
                return false;
            }
            
        } catch (error) {
            console.log(`   ❌ Navigation test failed: ${error.message}`);
            return false;
        }
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('🔍 BACKOFFICE MANUAL VERIFICATION REPORT');
        console.log('='.repeat(60));
        
        const tests = [
            { name: 'Login Page Access', result: this.testResults.loginPageAccess },
            { name: 'Login Form Found', result: this.testResults.loginFormFound },
            { name: 'Authentication Working', result: this.testResults.authenticationWorking },
            { name: 'Dashboard Access', result: this.testResults.dashboardAccess },
            { name: 'Settings Access', result: this.testResults.settingsAccess },
            { name: 'Settings Tabs Found', result: this.testResults.settingsTabsFound },
            { name: 'Audit Logs Access', result: this.testResults.auditLogsAccess },
            { name: 'Navigation Working', result: this.testResults.navigationWorking }
        ];
        
        let passed = 0;
        let total = tests.length;
        
        tests.forEach(test => {
            const status = test.result ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} ${test.name}`);
            if (test.result) passed++;
        });
        
        console.log('\n📊 SUMMARY:');
        console.log(`Tests Passed: ${passed}/${total} (${Math.round((passed/total)*100)}%)`);
        
        if (passed === total) {
            console.log('🎉 All tests passed! BackOffice is working correctly.');
        } else {
            console.log('⚠️  Some tests failed. Issues need to be addressed.');
        }
        
        console.log('\n💡 RECOMMENDATIONS:');
        if (!this.testResults.authenticationWorking) {
            console.log('   - Check if BackOffice user accounts exist in database');
            console.log('   - Verify authentication middleware configuration');
            console.log('   - Test user registration process');
        }
        if (!this.testResults.dashboardAccess) {
            console.log('   - Check dashboard route handler for errors');
            console.log('   - Verify database connectivity');
            console.log('   - Check template rendering');
        }
        if (!this.testResults.settingsTabsFound) {
            console.log('   - Verify Bootstrap JS is loaded for tab functionality');
            console.log('   - Check CSS classes for tab styling');
        }
        if (!this.testResults.navigationWorking) {
            console.log('   - Check if layout template includes navigation');
            console.log('   - Verify navigation styling and JavaScript');
        }
        
        console.log('='.repeat(60));
    }

    async runAllTests() {
        await this.initialize();
        
        try {
            await this.testLoginPageAccess();
            await this.testLoginForm();
            await this.testAuthentication();
            await this.testDashboardAccess();
            await this.testSettingsAccess();
            await this.testAuditLogsAccess();
            await this.testNavigation();
            
        } catch (error) {
            console.log(`❌ Test execution error: ${error.message}`);
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
        
        this.generateReport();
    }
}

// Run the test
async function main() {
    const tester = new BackOfficeManualTest();
    await tester.runAllTests();
}

if (require.main === module) {
    main();
}

module.exports = BackOfficeManualTest;