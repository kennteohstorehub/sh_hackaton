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

test.describe('WebChat Notification System Tests', () => {
    const queueId = '453b1b29-7d3b-4c0e-92d6-d86cc9952f8e';
    const baseUrl = 'http://localhost:3838';
    
    test.beforeEach(async ({ page }) => {
        // Admin login before each test
        await page.goto(`${baseUrl}/auth/login`);
        await page.waitForURL(/.*dashboard/);
    });

    test('Customer joins queue and merchant notifies successfully', async ({ page, context }) => {
        const testPhone = generateUniquePhone();
        
        console.log('\n=== Comprehensive Notification Test ===');
        console.log('Test phone:', testPhone);
        
        // Step 1: Customer joins queue
        const customerPage = await context.newPage();
        customerPage.on('console', msg => console.log('[CUSTOMER]', msg.text()));
        
        await customerPage.goto(`${baseUrl}/queue/${queueId}`);
        await customerPage.fill('#customerName', 'Test Customer');
        await customerPage.fill('#customerPhone', testPhone);
        await customerPage.selectOption('#partySize', '2');
        
        // Submit form
        await customerPage.click('#joinBtn');
        
        // Wait for either the static HTML file or dynamic route
        await customerPage.waitForURL(/(queue-chat\.html|queue-chat\/)/);
        console.log('✅ Customer joined queue');
        
        // Wait for page to fully load
        await customerPage.waitForTimeout(2000);
        
        // Verify queue info is stored
        const queueInfo = await customerPage.evaluate(() => {
            const stored = localStorage.getItem('queueInfo');
            return stored ? JSON.parse(stored) : null;
        });
        
        expect(queueInfo).toBeTruthy();
        expect(queueInfo.customerName).toBe('Test Customer');
        console.log('Queue info:', queueInfo);
        
        // Get verification code
        const verifyCode = await customerPage.evaluate(() => {
            const codeElement = document.querySelector('#headerVerifyCode');
            if (codeElement) return codeElement.textContent;
            const queueInfo = JSON.parse(localStorage.getItem('queueInfo') || '{}');
            return queueInfo.verificationCode;
        });
        
        console.log('Verification code:', verifyCode);
        
        // Set up notification listener
        const notificationPromise = waitForSocketEvent(customerPage, 'customer-called');
        
        // Step 2: Merchant notifies customer
        console.log('\n=== Merchant Notifies Customer ===');
        
        // Refresh merchant dashboard to see new customer
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // Wait for customer list to load
        await page.waitForSelector('.customer-list, .customer-row', { timeout: 10000 });
        
        // Find and notify our customer
        const notifySuccess = await page.evaluate(({ phone }) => {
            const rows = document.querySelectorAll('.customer-row');
            console.log(`Found ${rows.length} customer rows`);
            
            for (const row of rows) {
                const rowText = row.textContent;
                console.log('Checking row:', rowText.substring(0, 100));
                
                if (rowText.includes(phone)) {
                    console.log('Found our customer!');
                    // Try different button selectors
                    const notifyBtn = row.querySelector('.btn-notify, .btn-select, .call-button, button[onclick*="notifyCustomer"]');
                    if (notifyBtn) {
                        console.log('Clicking notify button');
                        notifyBtn.click();
                        return true;
                    }
                }
            }
            return false;
        }, { phone: testPhone });
        
        expect(notifySuccess).toBe(true);
        console.log('✅ Notify button clicked');
        
        // Handle any modal that appears
        await page.waitForTimeout(1000);
        const modal = await page.;
        if (modal) {
            await modal.click();
            console.log('✅ Modal closed');
        }
        
        // Wait for notification
        console.log('Waiting for notification...');
        const notification = await notificationPromise;
        
        console.log('Notification result:', notification);
        expect(notification.received).toBe(true);
        
        // Verify notification contains correct data
        if (notification.received && notification.data) {
            console.log('Notification data:', notification.data);
            if (verifyCode) {
                expect(notification.data.verificationCode).toBe(verifyCode);
            }
        }
        
        // Verify notification appears in customer chat
        const notifyMessage = await customerPage.waitForSelector('text=/YOUR TURN|your turn|ready/', { 
            timeout: 5000,
            state: 'visible' 
        });
        expect(notifyMessage).toBeTruthy();
        
        console.log('✅ Customer received notification successfully!');
        
        // Keep pages open briefly for observation
        await page.waitForTimeout(2000);
        
        await customerPage.close();
    });

    test('Multiple customers - only targeted customer receives notification', async ({ page, context }) => {
        console.log('\n=== Multiple Customer Test ===');
        
        // Create 3 customers
        const customers = [];
        
        for (let i = 0; i < 3; i++) {
            const customerPage = await context.newPage();
            const phone = generateUniquePhone();
            
            await customerPage.goto(`${baseUrl}/queue/${queueId}`);
            await customerPage.fill('#customerName', `Customer ${i + 1}`);
            await customerPage.fill('#customerPhone', phone);
            await customerPage.selectOption('#partySize', '2');
            
            await customerPage.click('#joinBtn');
            await customerPage.waitForURL(/(queue-chat\.html|queue-chat\/)/);
            await customerPage.waitForTimeout(1000);
            
            const queueInfo = await customerPage.evaluate(() => {
                return JSON.parse(localStorage.getItem('queueInfo') || '{}');
            });
            
            customers.push({
                page: customerPage,
                phone,
                name: `Customer ${i + 1}`,
                queueInfo,
                notificationPromise: waitForSocketEvent(customerPage, 'customer-called')
            });
            
            console.log(`✅ ${customers[i].name} joined (${phone})`);
        }
        
        // Refresh merchant dashboard
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('.customer-list, .customer-row', { timeout: 10000 });
        
        // Notify only Customer 2
        const targetCustomer = customers[1];
        console.log(`\nNotifying ${targetCustomer.name} (${targetCustomer.phone})`);
        
        await page.evaluate(({ phone }) => {
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
        }, { phone: targetCustomer.phone });
        
        // Handle modal
        await page.waitForTimeout(1000);
        const modal = await page.;
        if (modal) await modal.click();
        
        // Wait and check notifications
        await page.waitForTimeout(3000);
        
        for (let i = 0; i < customers.length; i++) {
            const customer = customers[i];
            const notification = await Promise.race([
                customer.notificationPromise,
                new Promise(resolve => setTimeout(() => resolve({ received: false }), 1000))
            ]);
            
            if (i === 1) {
                // Only Customer 2 should receive notification
                expect(notification.received).toBe(true);
                console.log(`✅ ${customer.name} received notification (correct)`);
            } else {
                // Others should not
                expect(notification.received).toBe(false);
                console.log(`✅ ${customer.name} did NOT receive notification (correct)`);
            }
        }
        
        // Close all customer pages
        for (const customer of customers) {
            await customer.page.close();
        }
        
        console.log('\n✅ Multiple customer test passed - no cross-talk!');
    });

    test('System handles reconnection properly', async ({ page, context }) => {
        const testPhone = generateUniquePhone();
        
        console.log('\n=== Reconnection Test ===');
        
        // Customer joins queue
        const customerPage = await context.newPage();
        await customerPage.goto(`${baseUrl}/queue/${queueId}`);
        
        await customerPage.fill('#customerName', 'Reconnect Test');
        await customerPage.fill('#customerPhone', testPhone);
        await customerPage.selectOption('#partySize', '1');
        
        await customerPage.click('#joinBtn');
        await customerPage.waitForURL(/(queue-chat\.html|queue-chat\/)/);
        await customerPage.waitForTimeout(2000);
        
        // Get initial queue data
        const initialData = await customerPage.evaluate(() => {
            return {
                queueInfo: JSON.parse(localStorage.getItem('queueInfo') || '{}'),
                sessionId: localStorage.getItem('queueChatSessionId')
            };
        });
        
        console.log('Initial data stored:', initialData);
        
        // Simulate disconnection by reloading
        console.log('Simulating disconnection...');
        await customerPage.reload();
        await customerPage.waitForLoadState('networkidle');
        await customerPage.waitForTimeout(2000);
        
        // Verify data persists
        const afterReload = await customerPage.evaluate(() => {
            return {
                queueInfo: JSON.parse(localStorage.getItem('queueInfo') || '{}'),
                sessionId: localStorage.getItem('queueChatSessionId'),
                connected: window.queueChat && window.queueChat.socket && window.queueChat.socket.connected
            };
        });
        
        expect(afterReload.queueInfo.customerName).toBe('Reconnect Test');
        expect(afterReload.connected).toBe(true);
        console.log('✅ Data persisted after reload');
        
        // Set up notification listener
        const notificationPromise = waitForSocketEvent(customerPage, 'customer-called');
        
        // Notify from merchant side
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('.customer-list, .customer-row', { timeout: 10000 });
        
        await page.evaluate(({ phone }) => {
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
        }, { phone: testPhone });
        
        // Handle modal
        const modal = await page.;
        if (modal) await modal.click();
        
        // Verify notification still works
        const notification = await notificationPromise;
        expect(notification.received).toBe(true);
        
        console.log('✅ Notifications work after reconnection!');
        
        await customerPage.close();
    });
});

// Test configuration
test.use({
    // Extended timeout for complex tests
    timeout: 45000,
    
    // Video recording for debugging
    video: 'retain-on-failure',
    
    // Screenshots on failure
    screenshot: 'only-on-failure',
    
    // No retries to see failures clearly
    retries: 0
});
