#!/usr/bin/env node

/**
 * Comprehensive Queue System Test
 * Tests the complete queue join flow and verification code display
 */

const puppeteer = require('puppeteer');
const chalk = require('chalk');

const BASE_URL = 'http://localhost:3000';

class QueueSystemTester {
    constructor() {
        this.browser = null;
        this.page = null;
        this.testResults = [];
    }

    async initialize() {
        console.log(chalk.blue('🚀 Initializing browser...'));
        this.browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: { width: 1280, height: 800 }
        });
        this.page = await this.browser.newPage();
        
        // Enable console logging
        this.page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'error') {
                console.log(chalk.red(`[Browser Error] ${text}`));
            } else if (type === 'warning') {
                console.log(chalk.yellow(`[Browser Warning] ${text}`));
            }
        });
        
        // Log network errors
        this.page.on('pageerror', error => {
            console.log(chalk.red(`[Page Error] ${error.message}`));
        });
        
        this.page.on('requestfailed', request => {
            console.log(chalk.red(`[Request Failed] ${request.url()} - ${request.failure().errorText}`));
        });
    }

    async test(name, testFn) {
        console.log(chalk.cyan(`\n📋 Testing: ${name}`));
        try {
            const result = await testFn();
            this.testResults.push({ name, success: true, result });
            console.log(chalk.green(`✅ ${name} - PASSED`));
            if (result) {
                console.log(chalk.gray(`   Result: ${JSON.stringify(result, null, 2)}`));
            }
            return result;
        } catch (error) {
            this.testResults.push({ name, success: false, error: error.message });
            console.log(chalk.red(`❌ ${name} - FAILED`));
            console.log(chalk.red(`   Error: ${error.message}`));
            throw error;
        }
    }

    async testMerchantLogin() {
        return await this.test('Merchant Login', async () => {
            await this.page.goto(`${BASE_URL}/auth/login`);
            await this.page.waitForSelector('#email');
            
            // Login as demo merchant
            await this.page.type('#email', 'demo@storehub.com');
            await this.page.type('#password', 'demo123');
            await this.page.click('button[type="submit"]');
            
            // Wait for dashboard
            await this.page.waitForNavigation();
            const url = this.page.url();
            if (!url.includes('/dashboard')) {
                throw new Error(`Expected to be on dashboard, but on ${url}`);
            }
            
            return { loggedIn: true, url };
        });
    }

    async testCreateAndStartQueue() {
        return await this.test('Create and Start Queue', async () => {
            // Navigate to queue management
            await this.page.goto(`${BASE_URL}/dashboard`);
            await this.page.waitForSelector('.queue-management-section', { timeout: 10000 });
            
            // Check if queue exists
            const existingQueue = await this.page.$('.queue-card');
            
            let queueId;
            if (existingQueue) {
                // Use existing queue
                console.log(chalk.gray('   Using existing queue'));
                queueId = await this.page.$eval('.queue-card', el => el.dataset.queueId);
                
                // Make sure it's active
                const isActive = await this.page.$eval('.queue-card', el => 
                    el.querySelector('.badge-success') !== null
                );
                
                if (!isActive) {
                    // Start the queue
                    await this.page.click('.queue-card .btn-start-queue');
                    await this.page.waitForTimeout(1000);
                }
            } else {
                // Create new queue
                console.log(chalk.gray('   Creating new queue'));
                await this.page.click('.btn-create-queue');
                await this.page.waitForSelector('#queueName');
                
                await this.page.type('#queueName', `Test Queue ${Date.now()}`);
                await this.page.click('#createQueueBtn');
                await this.page.waitForTimeout(2000);
                
                queueId = await this.page.$eval('.queue-card', el => el.dataset.queueId);
            }
            
            // Get the public queue URL
            const publicUrl = `${BASE_URL}/queue-join/${queueId}`;
            
            return { queueId, publicUrl };
        });
    }

    async testCustomerJoinQueue(queueData) {
        return await this.test('Customer Join Queue', async () => {
            // Open new page for customer
            const customerPage = await this.browser.newPage();
            
            // Navigate to queue join page
            await customerPage.goto(queueData.publicUrl);
            await customerPage.waitForSelector('#joinQueueForm');
            
            // Fill in customer details
            const customerName = `Test Customer ${Date.now()}`;
            const customerPhone = `+6012${Math.floor(Math.random() * 10000000)}`;
            
            await customerPage.type('#customerName', customerName);
            await customerPage.type('#customerPhone', customerPhone);
            await customerPage.type('#partySize', '2');
            await customerPage.type('#specialRequests', 'Test request');
            
            // Intercept the API response to capture verification code
            let verificationCode = null;
            let sessionId = null;
            let entryId = null;
            
            customerPage.on('response', async response => {
                if (response.url().includes('/api/customer/join')) {
                    const data = await response.json();
                    if (data.success) {
                        verificationCode = data.customer?.verificationCode;
                        sessionId = data.customer?.sessionId;
                        entryId = data.id || data.entryId;
                        console.log(chalk.gray(`   Captured verification code: ${verificationCode}`));
                        console.log(chalk.gray(`   Captured session ID: ${sessionId}`));
                        console.log(chalk.gray(`   Captured entry ID: ${entryId}`));
                    }
                }
            });
            
            // Submit form
            await customerPage.click('#submitBtn');
            
            // Wait for success modal
            await customerPage.waitForSelector('#successModal', { visible: true, timeout: 10000 });
            
            // Check if verification code is displayed in modal
            const modalContent = await customerPage.$eval('#successModal', el => el.innerText);
            const hasVerificationCode = modalContent.includes(verificationCode) || 
                                       modalContent.includes('Verification') ||
                                       modalContent.includes('verification');
            
            // Get queue position
            const queuePosition = await customerPage.$eval('#queueNumber', el => el.textContent);
            
            // Check if "View Queue Status" button exists
            const hasViewStatusBtn = await customerPage.$('.modal-footer button') !== null;
            
            // Click view status button
            if (hasViewStatusBtn) {
                await customerPage.click('.modal-footer button');
                await customerPage.waitForTimeout(2000);
                
                // Check if redirected to queue status page
                const currentUrl = customerPage.url();
                const isOnStatusPage = currentUrl.includes('/queue-status');
                
                // Check if verification code is shown on status page
                let statusPageHasCode = false;
                if (isOnStatusPage) {
                    await customerPage.waitForSelector('body');
                    const pageContent = await customerPage.$eval('body', el => el.innerText);
                    statusPageHasCode = pageContent.includes(verificationCode) ||
                                       pageContent.includes('Verification');
                }
                
                await customerPage.close();
                
                return {
                    customerName,
                    customerPhone,
                    queuePosition,
                    verificationCode,
                    sessionId,
                    entryId,
                    modalHasVerificationCode: hasVerificationCode,
                    redirectedToStatusPage: isOnStatusPage,
                    statusPageHasVerificationCode: statusPageHasCode,
                    statusPageUrl: currentUrl
                };
            }
            
            await customerPage.close();
            
            return {
                customerName,
                customerPhone,
                queuePosition,
                verificationCode,
                sessionId,
                entryId,
                modalHasVerificationCode: hasVerificationCode,
                hasViewStatusButton: hasViewStatusBtn
            };
        });
    }

    async generateReport() {
        console.log(chalk.cyan('\n📊 TEST REPORT'));
        console.log(chalk.cyan('═'.repeat(50)));
        
        const passed = this.testResults.filter(r => r.success).length;
        const failed = this.testResults.filter(r => !r.success).length;
        const total = this.testResults.length;
        
        console.log(chalk.white(`Total Tests: ${total}`));
        console.log(chalk.green(`Passed: ${passed}`));
        console.log(chalk.red(`Failed: ${failed}`));
        
        console.log(chalk.cyan('\n📝 ISSUES FOUND:'));
        console.log(chalk.cyan('─'.repeat(50)));
        
        // Check specific issues
        const customerJoinResult = this.testResults.find(r => r.name === 'Customer Join Queue');
        if (customerJoinResult && customerJoinResult.success) {
            const result = customerJoinResult.result;
            
            console.log('\n' + chalk.yellow('1. Verification Code Display:'));
            if (!result.modalHasVerificationCode) {
                console.log(chalk.red('   ❌ Verification code NOT displayed in success modal'));
                console.log(chalk.gray('   - The API returns the code but it\'s not shown to the user'));
                console.log(chalk.gray('   - Need to add verification code display in successModal'));
            } else {
                console.log(chalk.green('   ✅ Verification code displayed in success modal'));
            }
            
            console.log('\n' + chalk.yellow('2. Queue Status Redirect:'));
            if (result.redirectedToStatusPage) {
                console.log(chalk.green('   ✅ Successfully redirected to queue status page'));
                console.log(chalk.gray(`   - URL: ${result.statusPageUrl}`));
            } else {
                console.log(chalk.red('   ❌ Not redirected to queue status page'));
            }
            
            console.log('\n' + chalk.yellow('3. Status Page Verification Code:'));
            if (result.statusPageHasVerificationCode) {
                console.log(chalk.green('   ✅ Verification code displayed on status page'));
            } else {
                console.log(chalk.red('   ❌ Verification code NOT displayed on status page'));
                console.log(chalk.gray('   - Need to display verification code on queue-status page'));
            }
            
            console.log('\n' + chalk.yellow('4. Data Captured:'));
            console.log(chalk.gray(`   - Queue Position: ${result.queuePosition}`));
            console.log(chalk.gray(`   - Verification Code: ${result.verificationCode}`));
            console.log(chalk.gray(`   - Session ID: ${result.sessionId}`));
            console.log(chalk.gray(`   - Entry ID: ${result.entryId}`));
        }
        
        console.log(chalk.cyan('\n' + '═'.repeat(50)));
        
        if (failed > 0) {
            console.log(chalk.red('\n⚠️  TESTS FAILED - Issues need to be fixed'));
        } else {
            console.log(chalk.green('\n✅ ALL TESTS PASSED'));
        }
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async run() {
        try {
            await this.initialize();
            
            // Test merchant side
            await this.testMerchantLogin();
            const queueData = await this.testCreateAndStartQueue();
            
            // Test customer side
            if (queueData) {
                await this.testCustomerJoinQueue(queueData);
            }
            
            await this.generateReport();
        } catch (error) {
            console.log(chalk.red(`\n💥 Fatal Error: ${error.message}`));
        } finally {
            await this.cleanup();
        }
    }
}

// Run the tests
const tester = new QueueSystemTester();
tester.run();