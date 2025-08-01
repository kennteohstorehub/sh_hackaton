/**
 * Comprehensive Settings Page Edit Functionality Test
 * 
 * This test reproduces issues with the settings page edit functionality
 * focusing on phone number and business name editing problems.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class SettingsPageTester {
    constructor() {
        this.browser = null;
        this.page = null;
        this.screenshots = [];
        this.errors = [];
        this.networkRequests = [];
        this.consoleLogs = [];
        this.testResults = {
            loginSuccess: false,
            pageLoadSuccess: false,
            formFieldsAccessible: false,
            phoneEditSuccess: false,
            businessNameEditSuccess: false,
            formSubmissionSuccess: false,
            apiErrors: [],
            jsErrors: [],
            networkErrors: []
        };
    }

    async setup() {
        console.log('🚀 Setting up browser and test environment...');
        
        this.browser = await puppeteer.launch({
            headless: false, // Show browser for better debugging
            devtools: true,
            defaultViewport: { width: 1366, height: 768 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        this.page = await this.browser.newPage();
        
        // Enable request interception to monitor network
        await this.page.setRequestInterception(true);
        
        // Monitor all network requests
        this.page.on('request', request => {
            this.networkRequests.push({
                type: 'request',
                url: request.url(),
                method: request.method(),
                headers: request.headers(),
                timestamp: new Date()
            });
            request.continue();
        });

        this.page.on('response', response => {
            this.networkRequests.push({
                type: 'response',
                url: response.url(),
                status: response.status(),
                headers: response.headers(),
                timestamp: new Date()
            });
        });

        // Monitor console logs and errors
        this.page.on('console', msg => {
            const logEntry = {
                type: msg.type(),
                text: msg.text(),
                timestamp: new Date()
            };
            this.consoleLogs.push(logEntry);
            
            if (msg.type() === 'error') {
                this.errors.push({
                    type: 'console_error',
                    message: msg.text(),
                    timestamp: new Date()
                });
            }
        });

        // Monitor page errors
        this.page.on('pageerror', error => {
            this.errors.push({
                type: 'page_error',
                message: error.message,
                stack: error.stack,
                timestamp: new Date()
            });
        });

        // Monitor failed requests
        this.page.on('requestfailed', request => {
            this.errors.push({
                type: 'network_error',
                url: request.url(),
                failure: request.failure(),
                timestamp: new Date()
            });
        });

        console.log('✅ Browser setup complete');
    }

    async takeScreenshot(name, description) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `settings-test-${name}-${timestamp}.png`;
        const filepath = path.join(__dirname, 'auth-test-screenshots', filename);
        
        // Ensure screenshots directory exists
        const screenshotDir = path.dirname(filepath);
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }
        
        await this.page.screenshot({
            path: filepath,
            fullPage: true
        });
        
        this.screenshots.push({
            name,
            description,
            filepath,
            timestamp: new Date()
        });
        
        console.log(`📸 Screenshot saved: ${filename} - ${description}`);
        return filepath;
    }

    async login() {
        console.log('🔐 Attempting login...');
        
        try {
            // Navigate to login page
            await this.page.goto('http://localhost:3838/auth/login', { 
                waitUntil: 'networkidle2',
                timeout: 10000 
            });

            await this.takeScreenshot('01-login-page', 'Login page loaded');

            // Fill login form
            await this.page.waitForSelector('#email', { timeout: 5000 });
            await this.page.type('#email', 'demo@smartqueue.com');
            await this.page.type('#password', 'demo123456');

            await this.takeScreenshot('02-login-filled', 'Login form filled');

            // Submit login
            await this.page.click('button[type="submit"]');
            
            // Wait for navigation or error
            try {
                await this.page.waitForNavigation({ 
                    waitUntil: 'networkidle2', 
                    timeout: 10000 
                });
                
                // Check if we're on dashboard (successful login)
                const currentUrl = this.page.url();
                if (currentUrl.includes('/dashboard')) {
                    this.testResults.loginSuccess = true;
                    console.log('✅ Login successful');
                    await this.takeScreenshot('03-login-success', 'Login successful - Dashboard loaded');
                } else {
                    console.log('❌ Login failed - not redirected to dashboard');
                    await this.takeScreenshot('03-login-failed', 'Login failed - not on dashboard');
                }
            } catch (navError) {
                console.log('❌ Login navigation failed:', navError.message);
                await this.takeScreenshot('03-login-nav-error', 'Login navigation error');
            }

        } catch (error) {
            console.error('❌ Login error:', error.message);
            this.errors.push({
                type: 'login_error',
                message: error.message,
                timestamp: new Date()
            });
            await this.takeScreenshot('03-login-error', 'Login error occurred');
        }
    }

    async navigateToSettings() {
        console.log('🛠️ Navigating to settings page...');
        
        try {
            // Navigate to settings page
            await this.page.goto('http://localhost:3838/dashboard/settings', { 
                waitUntil: 'networkidle2',
                timeout: 10000 
            });

            await this.takeScreenshot('04-settings-page', 'Settings page loaded');

            // Check if page loaded correctly
            const pageTitle = await this.page.title();
            const hasSettingsForm = await this.page.$('#restaurantForm');
            
            if (hasSettingsForm) {
                this.testResults.pageLoadSuccess = true;
                console.log('✅ Settings page loaded successfully');
            } else {
                console.log('❌ Settings page missing form elements');
                await this.takeScreenshot('04-settings-missing-form', 'Settings form not found');
            }

        } catch (error) {
            console.error('❌ Settings navigation error:', error.message);
            this.errors.push({
                type: 'navigation_error',
                message: error.message,
                timestamp: new Date()
            });
            await this.takeScreenshot('04-settings-nav-error', 'Settings navigation error');
        }
    }

    async testFormFields() {
        console.log('📝 Testing form field accessibility...');
        
        try {
            // Check if form fields are accessible
            const restaurantNameField = await this.page.$('#restaurantName');
            const phoneField = await this.page.$('#restaurantPhone');
            const addressField = await this.page.$('#restaurantAddress');

            if (restaurantNameField && phoneField && addressField) {
                this.testResults.formFieldsAccessible = true;
                console.log('✅ All form fields are accessible');
                
                // Get current values
                const currentName = await this.page.$eval('#restaurantName', el => el.value);
                const currentPhone = await this.page.$eval('#restaurantPhone', el => el.value);
                
                console.log(`📊 Current values - Name: "${currentName}", Phone: "${currentPhone}"`);
                
                await this.takeScreenshot('05-form-fields-accessible', 'Form fields accessible and populated');
            } else {
                console.log('❌ Some form fields are missing');
                await this.takeScreenshot('05-form-fields-missing', 'Form fields not accessible');
            }

        } catch (error) {
            console.error('❌ Form field test error:', error.message);
            this.errors.push({
                type: 'form_field_error',
                message: error.message,
                timestamp: new Date()
            });
        }
    }

    async testPhoneNumberEdit() {
        console.log('📞 Testing phone number editing...');
        
        try {
            const phoneField = await this.page.$('#restaurantPhone');
            if (!phoneField) {
                console.log('❌ Phone field not found');
                return;
            }

            // Clear and enter new phone number
            await this.page.focus('#restaurantPhone');
            await this.page.keyboard.down('Control');
            await this.page.keyboard.press('KeyA');
            await this.page.keyboard.up('Control');
            await this.page.keyboard.press('Delete');
            
            const newPhone = '+1-555-TEST-123';
            await this.page.type('#restaurantPhone', newPhone);
            
            await this.takeScreenshot('06-phone-edited', `Phone number edited to: ${newPhone}`);

            // Verify the value was set
            const phoneValue = await this.page.$eval('#restaurantPhone', el => el.value);
            if (phoneValue === newPhone) {
                console.log('✅ Phone number edit successful');
                this.testResults.phoneEditSuccess = true;
            } else {
                console.log(`❌ Phone number edit failed. Expected: ${newPhone}, Got: ${phoneValue}`);
            }

        } catch (error) {
            console.error('❌ Phone edit error:', error.message);
            this.errors.push({
                type: 'phone_edit_error',
                message: error.message,
                timestamp: new Date()
            });
        }
    }

    async testBusinessNameEdit() {
        console.log('🏪 Testing business name editing...');
        
        try {
            const nameField = await this.page.$('#restaurantName');
            if (!nameField) {
                console.log('❌ Business name field not found');
                return;
            }

            // Clear and enter new business name
            await this.page.focus('#restaurantName');
            await this.page.keyboard.down('Control');
            await this.page.keyboard.press('KeyA');
            await this.page.keyboard.up('Control');
            await this.page.keyboard.press('Delete');
            
            const newName = 'Test Restaurant Updated';
            await this.page.type('#restaurantName', newName);
            
            await this.takeScreenshot('07-name-edited', `Business name edited to: ${newName}`);

            // Verify the value was set
            const nameValue = await this.page.$eval('#restaurantName', el => el.value);
            if (nameValue === newName) {
                console.log('✅ Business name edit successful');
                this.testResults.businessNameEditSuccess = true;
            } else {
                console.log(`❌ Business name edit failed. Expected: ${newName}, Got: ${nameValue}`);
            }

        } catch (error) {
            console.error('❌ Business name edit error:', error.message);
            this.errors.push({
                type: 'business_name_edit_error',
                message: error.message,
                timestamp: new Date()
            });
        }
    }

    async testFormSubmission() {
        console.log('💾 Testing form submission...');
        
        try {
            // Clear network requests to focus on submission
            this.networkRequests = [];
            
            // Submit the form
            const submitButton = await this.page.$('#restaurantForm button[type="submit"]');
            if (!submitButton) {
                console.log('❌ Submit button not found');
                await this.takeScreenshot('08-no-submit-button', 'Submit button not found');
                return;
            }

            await this.takeScreenshot('08-before-submit', 'Before form submission');

            // Click submit and wait for response
            await submitButton.click();
            
            // Wait a bit for the request to be made
            await this.page.waitForTimeout(2000);
            
            await this.takeScreenshot('09-after-submit', 'After form submission');

            // Check for success/error messages
            const successMessage = await this.page.$('.success-message:not([style*="display: none"])');
            const errorMessage = await this.page.$('.error-message:not([style*="display: none"])');
            
            if (successMessage) {
                const messageText = await this.page.$eval('.success-message', el => el.textContent);
                console.log('✅ Success message found:', messageText);
                this.testResults.formSubmissionSuccess = true;
            } else if (errorMessage) {
                const messageText = await this.page.$eval('.error-message', el => el.textContent);
                console.log('❌ Error message found:', messageText);
                this.errors.push({
                    type: 'form_submission_error',
                    message: messageText,
                    timestamp: new Date()
                });
            } else {
                console.log('⚠️ No success or error message found');
            }

            // Check network requests for API calls
            const apiRequests = this.networkRequests.filter(req => 
                req.type === 'request' && req.url.includes('/api/merchant')
            );
            const apiResponses = this.networkRequests.filter(req => 
                req.type === 'response' && req.url.includes('/api/merchant')
            );

            console.log(`📊 API Requests: ${apiRequests.length}, Responses: ${apiResponses.length}`);
            
            for (const response of apiResponses) {
                if (response.status >= 400) {
                    console.log(`❌ API Error: ${response.status} on ${response.url}`);
                    this.testResults.apiErrors.push({
                        url: response.url,
                        status: response.status,
                        timestamp: response.timestamp
                    });
                }
            }

        } catch (error) {
            console.error('❌ Form submission error:', error.message);
            this.errors.push({
                type: 'form_submission_error',
                message: error.message,
                timestamp: new Date()
            });
            await this.takeScreenshot('09-submit-error', 'Form submission error');
        }
    }

    async checkServerLogs() {
        console.log('📋 Checking for server-side errors...');
        
        // Check network tab for failed requests
        const failedRequests = this.networkRequests.filter(req => 
            req.type === 'response' && req.status >= 400
        );

        for (const failed of failedRequests) {
            console.log(`❌ Failed Request: ${failed.method || 'GET'} ${failed.url} - Status: ${failed.status}`);
            this.testResults.networkErrors.push(failed);
        }

        // Log JavaScript errors
        const jsErrors = this.errors.filter(err => 
            err.type === 'console_error' || err.type === 'page_error'
        );

        for (const jsError of jsErrors) {
            console.log(`❌ JavaScript Error: ${jsError.message}`);
            this.testResults.jsErrors.push(jsError);
        }
    }

    async generateReport() {
        console.log('📊 Generating comprehensive test report...');
        
        const report = {
            testName: 'Settings Page Edit Functionality Test',
            timestamp: new Date(),
            testResults: this.testResults,
            errors: this.errors,
            screenshots: this.screenshots,
            networkRequests: this.networkRequests.slice(-20), // Last 20 requests
            consoleLogs: this.consoleLogs.slice(-50), // Last 50 logs
            summary: {
                totalErrors: this.errors.length,
                loginWorking: this.testResults.loginSuccess,
                settingsPageWorking: this.testResults.pageLoadSuccess,
                formFieldsWorking: this.testResults.formFieldsAccessible,
                phoneEditWorking: this.testResults.phoneEditSuccess,
                businessNameEditWorking: this.testResults.businessNameEditSuccess,
                formSubmissionWorking: this.testResults.formSubmissionSuccess,
                apiErrorCount: this.testResults.apiErrors.length,
                jsErrorCount: this.testResults.jsErrors.length,
                networkErrorCount: this.testResults.networkErrors.length
            }
        };

        // Save report to file
        const reportFile = path.join(__dirname, `settings-test-report-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        console.log(`📁 Test report saved: ${reportFile}`);
        
        // Print summary
        console.log('\n📊 TEST SUMMARY:');
        console.log('================');
        console.log(`✅ Login: ${report.summary.loginWorking ? 'PASS' : 'FAIL'}`);
        console.log(`✅ Settings Page Load: ${report.summary.settingsPageWorking ? 'PASS' : 'FAIL'}`);
        console.log(`✅ Form Fields Accessible: ${report.summary.formFieldsWorking ? 'PASS' : 'FAIL'}`);
        console.log(`✅ Phone Edit: ${report.summary.phoneEditWorking ? 'PASS' : 'FAIL'}`);
        console.log(`✅ Business Name Edit: ${report.summary.businessNameEditWorking ? 'PASS' : 'FAIL'}`);
        console.log(`✅ Form Submission: ${report.summary.formSubmissionWorking ? 'PASS' : 'FAIL'}`);
        console.log(`❌ Total Errors: ${report.summary.totalErrors}`);
        console.log(`❌ API Errors: ${report.summary.apiErrorCount}`);
        console.log(`❌ JS Errors: ${report.summary.jsErrorCount}`);
        console.log(`❌ Network Errors: ${report.summary.networkErrorCount}`);
        
        if (this.screenshots.length > 0) {
            console.log('\n📸 Screenshots taken:');
            this.screenshots.forEach(screenshot => {
                console.log(`  - ${screenshot.name}: ${screenshot.description}`);
            });
        }
        
        if (this.errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            this.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. [${error.type}] ${error.message}`);
            });
        }

        return report;
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async runFullTest() {
        console.log('🚀 Starting comprehensive settings page test...');
        console.log('==========================================');
        
        try {
            await this.setup();
            await this.login();
            
            if (this.testResults.loginSuccess) {
                await this.navigateToSettings();
                
                if (this.testResults.pageLoadSuccess) {
                    await this.testFormFields();
                    await this.testPhoneNumberEdit();
                    await this.testBusinessNameEdit();
                    await this.testFormSubmission();
                }
            }
            
            await this.checkServerLogs();
            const report = await this.generateReport();
            
            return report;
            
        } catch (error) {
            console.error('❌ Test execution error:', error);
            await this.takeScreenshot('99-test-error', 'Test execution error');
            throw error;
        } finally {
            await this.cleanup();
        }
    }
}

// Run the test
async function main() {
    const tester = new SettingsPageTester();
    
    try {
        const report = await tester.runFullTest();
        console.log('\n🎉 Test completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n💥 Test failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = SettingsPageTester;