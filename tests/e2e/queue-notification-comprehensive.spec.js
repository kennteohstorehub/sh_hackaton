const { test, expect } = require('@playwright/test');

// Helper function to generate unique phone numbers
function generateUniquePhone() {
    const random = Math.floor(Math.random() * 9000) + 1000;
    return `+60123456${random}`;
}

// Helper to wait for socket event with timeout
async function waitForSocketEvent(page, eventName, timeout = 10000) {
    return page.evaluate(({ event, timeoutMs }) => {
        return new Promise((resolve) => {
            if (!window.queueChat || !window.queueChat.socket) {
                resolve({ received: false, error: 'Socket not initialized' });
                return;
            }
            
            const timer = setTimeout(() => {
                resolve({ received: false, error: `Timeout waiting for ${event}` });
            }, timeoutMs);
            
            window.queueChat.socket.once(event, (data) => {
                clearTimeout(timer);
                resolve({ received: true, data });
            });
        });
    }, { event: eventName, timeoutMs: timeout });
}

test.describe('WebChat Notification System - Comprehensive E2E Tests', () => {
    const queueId = '453b1b29-7d3b-4c0e-92d6-d86cc9952f8e';
    const baseUrl = 'http://localhost:3838';
    
    test.beforeEach(async ({ page }) => {
        // Admin login before each test
        await page.goto(`${baseUrl}/auth/login`);
        await page.waitForURL(/.*dashboard/);
    });

    test('Test 1: Customer joins queue and receives confirmation', async ({ page, context }) => {
        const testPhone = generateUniquePhone();
        const customerName = 'Test Customer 1';
        
        console.log('\n=== Test 1: Queue Join Confirmation ===');
        
        // Customer joins queue
        const customerPage = await context.newPage();
        await customerPage.goto(`${baseUrl}/queue/${queueId}`);
        
        await customerPage.fill('#customerName', customerName);
        await customerPage.fill('#customerPhone', testPhone);
        await customerPage.selectOption('#partySize', '2');
        
        // Submit form
        await customerPage.click('#joinBtn');
        await customerPage.waitForURL('**/queue-chat.html');
        
        // Verify welcome message is displayed
        const welcomeMessage = await customerPage.waitForSelector('text=/Welcome.*🎉/', { timeout: 5000 });
        expect(welcomeMessage).toBeTruthy();
        
        // Verify queue information is displayed
        const queueInfo = await customerPage.waitForSelector('text=/Queue Number.*#W/', { timeout: 5000 });
        expect(queueInfo).toBeTruthy();
        
        // Verify verification code is displayed
        const verifyCode = await customerPage.evaluate(() => {
            return document.querySelector('#headerVerifyCode')?.textContent;
        });
        expect(verifyCode).toMatch(/^[A-Z0-9]{4}$/);
        
        console.log('✅ Customer successfully joined queue and received confirmation');
        
        await customerPage.close();
    });

    test('Test 2: Customer can check queue status', async ({ page, context }) => {
        const testPhone = generateUniquePhone();
        
        console.log('\n=== Test 2: Queue Status Check ===');
        
        // Customer joins queue
        const customerPage = await context.newPage();
        await customerPage.goto(`${baseUrl}/queue/${queueId}`);
        
        await customerPage.fill('#customerName', 'Status Test Customer');
        await customerPage.fill('#customerPhone', testPhone);
        await customerPage.selectOption('#partySize', '3');
        
        await customerPage.click('#joinBtn');
        await customerPage.waitForURL('**/queue-chat.html');
        
        // Wait for initial messages
        await customerPage.waitForTimeout(2000);
        
        // Click status button
        await customerPage.click('button:has-text("Check Status")');
        
        // Wait for status message
        const statusMessage = await customerPage.waitForSelector('text=/Your current position/', { timeout: 5000 });
        expect(statusMessage).toBeTruthy();
        
        // Verify status contains position information
        const statusText = await statusMessage.textContent();
        expect(statusText).toContain('position');
        expect(statusText).toMatch(/\d+ minutes?/); // Contains wait time
        
        console.log('✅ Customer can successfully check queue status');
        
        await customerPage.close();
    });

    test('Test 5: Merchant notifies customer successfully', async ({ page, context }) => {
        const testPhone = generateUniquePhone();
        
        console.log('\n=== Test 5: Customer Notification ===');
        
        // Customer joins queue
        const customerPage = await context.newPage();
        customerPage.on('console', msg => console.log('[CUSTOMER]', msg.text()));
        
        await customerPage.goto(`${baseUrl}/queue/${queueId}`);
        await customerPage.fill('#customerName', 'Notify Test Customer');
        await customerPage.fill('#customerPhone', testPhone);
        await customerPage.selectOption('#partySize', '2');
        
        await customerPage.click('#joinBtn');
        await customerPage.waitForURL('**/queue-chat.html');
        await customerPage.waitForTimeout(2000);
        
        // Get customer data
        const customerData = await customerPage.evaluate(() => {
            const queueInfo = JSON.parse(localStorage.getItem('queueInfo') || '{}');
            return {
                id: queueInfo.id || queueInfo.entryId,
                verificationCode: document.querySelector('#headerVerifyCode')?.textContent || queueInfo.verificationCode
            };
        });
        
        // Set up notification listener
        const notificationPromise = waitForSocketEvent(customerPage, 'customer-called');
        
        // Refresh merchant dashboard
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // Find and notify customer
        const notifySuccess = await page.evaluate(({ phone, customerId }) => {
            const rows = document.querySelectorAll('.customer-row');
            for (const row of rows) {
                if (row.textContent.includes(phone)) {
                    const notifyBtn = row.querySelector('.btn-notify, .btn-select, .call-button');
                    if (notifyBtn) {
                        notifyBtn.click();
                        return true;
                    }
                }
            }
            return false;
        }, { phone: testPhone, customerId: customerData.id });
        
        expect(notifySuccess).toBe(true);
        
        // Handle any modal
        const modal = await page.$('.notification-modal .btn-primary');
        if (modal) await modal.click();
        
        // Wait for notification
        const notification = await notificationPromise;
        expect(notification.received).toBe(true);
        expect(notification.data.verificationCode).toBe(customerData.verificationCode);
        
        // Verify notification appears in customer chat
        const notifyMessage = await customerPage.waitForSelector('text=/YOUR TURN/', { timeout: 5000 });
        expect(notifyMessage).toBeTruthy();
        
        console.log('✅ Customer receives notification successfully');
        
        await customerPage.close();
    });
});

// Test configuration
test.use({
    // Extended timeout for complex tests
    timeout: 60000,
    
    // Video recording for debugging
    video: 'retain-on-failure',
    
    // Screenshots on failure
    screenshot: 'only-on-failure',
    
    // Retry failed tests once
    retries: 1
});
