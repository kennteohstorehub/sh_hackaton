#!/usr/bin/env node

/**
 * Comprehensive Queue System Test using Playwright
 * Tests the complete queue join flow and verification code display
 */

const { chromium } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';

class QueueSystemTester {
    constructor() {
        this.browser = null;
        this.context = null;
        this.testResults = [];
    }

    async initialize() {
        console.log('🚀 Initializing browser...');
        this.browser = await chromium.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.context = await this.browser.newContext({
            viewport: { width: 1280, height: 800 }
        });
    }

    async test(name, testFn) {
        console.log(`\n📋 Testing: ${name}`);
        try {
            const result = await testFn();
            this.testResults.push({ name, success: true, result });
            console.log(`✅ ${name} - PASSED`);
            if (result) {
                console.log(`   Result: ${JSON.stringify(result, null, 2)}`);
            }
            return result;
        } catch (error) {
            this.testResults.push({ name, success: false, error: error.message });
            console.log(`❌ ${name} - FAILED`);
            console.log(`   Error: ${error.message}`);
            throw error;
        }
    }

    async testMerchantLogin() {
        return await this.test('Merchant Login', async () => {
            const page = await this.context.newPage();
            
            await page.goto(`${BASE_URL}/auth/login`);
            await page.waitForSelector('#email');
            
            // Login as demo merchant
            await page.fill('#email', 'demo@storehub.com');
            await page.fill('#password', 'demo123');
            await page.click('button[type="submit"]');
            
            // Wait for dashboard
            await page.waitForURL('**/dashboard', { timeout: 10000 });
            const url = page.url();
            
            await page.close();
            return { loggedIn: true, url };
        });
    }

    async testCreateAndStartQueue() {
        return await this.test('Create and Start Queue', async () => {
            const page = await this.context.newPage();
            
            // Login first
            await page.goto(`${BASE_URL}/auth/login`);
            await page.fill('#email', 'demo@storehub.com');
            await page.fill('#password', 'demo123');
            await page.click('button[type="submit"]');
            await page.waitForURL('**/dashboard', { timeout: 10000 });
            
            // Navigate to queue management
            await page.goto(`${BASE_URL}/dashboard`);
            await page.waitForSelector('.queue-management-section', { timeout: 10000 });
            
            // Check if queue exists
            const existingQueue = await page.$('.queue-card');
            
            let queueId;
            if (existingQueue) {
                // Use existing queue
                console.log('   Using existing queue');
                queueId = await existingQueue.getAttribute('data-queue-id');
                
                // Make sure it's active
                const isActive = await page.$('.queue-card .badge-success') !== null;
                
                if (!isActive) {
                    // Start the queue
                    const startBtn = await page.$('.queue-card .btn-start-queue');
                    if (startBtn) {
                        await startBtn.click();
                        await page.waitForTimeout(1000);
                    }
                }
            } else {
                // Create new queue - look for different possible button selectors
                const createBtn = await page.$('.btn-create-queue, [data-action="create-queue"], button:has-text("Create Queue")');
                if (createBtn) {
                    await createBtn.click();
                    await page.waitForSelector('#queueName');
                    
                    await page.fill('#queueName', `Test Queue ${Date.now()}`);
                    await page.click('#createQueueBtn');
                    await page.waitForTimeout(2000);
                    
                    const queueCard = await page.$('.queue-card');
                    queueId = await queueCard.getAttribute('data-queue-id');
                }
            }
            
            // Get the public queue URL
            const publicUrl = `${BASE_URL}/queue-join/${queueId}`;
            
            await page.close();
            return { queueId, publicUrl };
        });
    }

    async testCustomerJoinQueue(queueData) {
        return await this.test('Customer Join Queue', async () => {
            const customerPage = await this.context.newPage();
            
            // Set up response interceptor
            let verificationCode = null;
            let sessionId = null;
            let entryId = null;
            
            customerPage.on('response', async response => {
                if (response.url().includes('/api/customer/join')) {
                    try {
                        const data = await response.json();
                        if (data.success) {
                            verificationCode = data.customer?.verificationCode;
                            sessionId = data.customer?.sessionId;
                            entryId = data.id || data.entryId;
                            console.log(`   Captured verification code: ${verificationCode}`);
                            console.log(`   Captured session ID: ${sessionId}`);
                            console.log(`   Captured entry ID: ${entryId}`);
                        }
                    } catch (e) {
                        // Ignore JSON parse errors
                    }
                }
            });
            
            // Navigate to queue join page
            await customerPage.goto(queueData.publicUrl);
            await customerPage.waitForSelector('#joinQueueForm');
            
            // Fill in customer details
            const customerName = `Test Customer ${Date.now()}`;
            const customerPhone = `+6012${Math.floor(Math.random() * 10000000)}`;
            
            await customerPage.fill('#customerName', customerName);
            await customerPage.fill('#customerPhone', customerPhone);
            await customerPage.fill('#partySize', '2');
            await customerPage.fill('#specialRequests', 'Test request');
            
            // Submit form
            await customerPage.click('#submitBtn');
            
            // Wait for success modal
            await customerPage.waitForSelector('#successModal', { visible: true, timeout: 10000 });
            
            // Check if verification code is displayed in modal
            const modalContent = await customerPage.textContent('#successModal');
            const hasVerificationCode = modalContent.includes(verificationCode) || 
                                       modalContent.includes('Verification') ||
                                       modalContent.includes('verification');
            
            // Get queue position
            const queuePosition = await customerPage.textContent('#queueNumber');
            
            // Check if "View Queue Status" button exists
            const viewStatusBtn = await customerPage.$('.modal-footer button');
            let redirectedToStatusPage = false;
            let statusPageHasCode = false;
            let statusPageUrl = '';
            
            if (viewStatusBtn) {
                await viewStatusBtn.click();
                await customerPage.waitForTimeout(2000);
                
                // Check if redirected to queue status page
                statusPageUrl = customerPage.url();
                redirectedToStatusPage = statusPageUrl.includes('/queue-status');
                
                // Check if verification code is shown on status page
                if (redirectedToStatusPage) {
                    await customerPage.waitForSelector('body');
                    const pageContent = await customerPage.textContent('body');
                    statusPageHasCode = pageContent.includes(verificationCode) ||
                                       pageContent.includes('Verification');
                }
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
                redirectedToStatusPage,
                statusPageHasVerificationCode: statusPageHasCode,
                statusPageUrl,
                hasViewStatusButton: !!viewStatusBtn
            };
        });
    }

    generateReport() {
        console.log('\n📊 TEST REPORT');
        console.log('═'.repeat(50));
        
        const passed = this.testResults.filter(r => r.success).length;
        const failed = this.testResults.filter(r => !r.success).length;
        const total = this.testResults.length;
        
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        
        console.log('\n📝 ISSUES FOUND:');
        console.log('─'.repeat(50));
        
        // Check specific issues
        const customerJoinResult = this.testResults.find(r => r.name === 'Customer Join Queue');
        if (customerJoinResult && customerJoinResult.success && customerJoinResult.result) {
            const result = customerJoinResult.result;
            
            console.log('\n1. Verification Code Display:');
            if (!result.modalHasVerificationCode) {
                console.log('   ❌ Verification code NOT displayed in success modal');
                console.log('   - The API returns the code but it\'s not shown to the user');
                console.log('   - Need to add verification code display in successModal');
            } else {
                console.log('   ✅ Verification code displayed in success modal');
            }
            
            console.log('\n2. Queue Status Redirect:');
            if (result.redirectedToStatusPage) {
                console.log('   ✅ Successfully redirected to queue status page');
                console.log(`   - URL: ${result.statusPageUrl}`);
            } else {
                console.log('   ❌ Not redirected to queue status page');
            }
            
            console.log('\n3. Status Page Verification Code:');
            if (result.statusPageHasVerificationCode) {
                console.log('   ✅ Verification code displayed on status page');
            } else {
                console.log('   ❌ Verification code NOT displayed on status page');
                console.log('   - Need to display verification code on queue-status page');
            }
            
            console.log('\n4. Data Captured:');
            console.log(`   - Queue Position: ${result.queuePosition}`);
            console.log(`   - Verification Code: ${result.verificationCode}`);
            console.log(`   - Session ID: ${result.sessionId}`);
            console.log(`   - Entry ID: ${result.entryId}`);
        }
        
        console.log('\n' + '═'.repeat(50));
        
        if (failed > 0) {
            console.log('\n⚠️  TESTS FAILED - Issues need to be fixed');
        } else {
            console.log('\n✅ ALL TESTS PASSED');
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
            if (queueData && queueData.queueId) {
                await this.testCustomerJoinQueue(queueData);
            }
            
            this.generateReport();
        } catch (error) {
            console.log(`\n💥 Fatal Error: ${error.message}`);
            console.error(error);
        } finally {
            await this.cleanup();
        }
    }
}

// Run the tests
const tester = new QueueSystemTester();
tester.run();