const { test, expect } = require('@playwright/test');

// Helper function to generate unique phone numbers
function generateUniquePhone() {
    const random = Math.floor(Math.random() * 9000) + 1000;
    return `+60123456${random}`;
}

test.describe('WebChat Notification System - Final Test', () => {
    test('Complete notification flow test', async ({ page, context }) => {
        const testPhone = generateUniquePhone();
        const queueId = '453b1b29-7d3b-4c0e-92d6-d86cc9952f8e';
        
        console.log('\n=== Final Notification Test ===');
        console.log('Test phone:', testPhone);
        
        // Step 1: Admin logs in
        await page.goto('http://localhost:3838/auth/login');
        await page.waitForURL(/.*dashboard/);
        console.log('✅ Admin logged in');
        
        // Step 2: Customer joins queue
        const customerPage = await context.newPage();
        customerPage.on('console', msg => console.log('[CUSTOMER]', msg.text()));
        
        await customerPage.goto(`http://localhost:3838/queue/${queueId}`);
        await customerPage.fill('#customerName', 'Test Customer');
        await customerPage.fill('#customerPhone', testPhone);
        await customerPage.selectOption('#partySize', '2');
        
        // Submit and wait for redirect
        await customerPage.click('#joinBtn');
        await customerPage.waitForURL(/queue-chat/, { waitUntil: 'domcontentloaded' });
        
        // Wait for queue data to be processed
        await customerPage.waitForTimeout(2000);
        
        // Get all queue data
        const queueData = await customerPage.evaluate(() => {
            // Try multiple sources
            const sessionInfo = sessionStorage.getItem('queueInfo');
            const localInfo = localStorage.getItem('queueInfo');
            const queueDataStr = localStorage.getItem('queueData');
            
            let data = {};
            if (queueDataStr) {
                data = JSON.parse(queueDataStr);
            } else if (localInfo) {
                data = JSON.parse(localInfo);
            } else if (sessionInfo) {
                data = JSON.parse(sessionInfo);
            }
            
            // Also get from DOM
            const verifyCode = document.querySelector('#headerVerifyCode')?.textContent;
            if (verifyCode) data.verificationCode = verifyCode;
            
            return data;
        });
        
        console.log('Queue data retrieved:', queueData);
        expect(queueData.entryId).toBeTruthy();
        expect(queueData.verificationCode).toBeTruthy();
        
        // Set up notification listener
        const notificationReceived = await customerPage.evaluate(() => {
            return new Promise((resolve) => {
                if (!window.queueChat || !window.queueChat.socket) {
                    resolve({ success: false, error: 'Socket not ready' });
                    return;
                }
                
                const timeout = setTimeout(() => {
                    resolve({ success: false, error: 'Timeout' });
                }, 10000);
                
                window.queueChat.socket.once('customer-called', (data) => {
                    clearTimeout(timeout);
                    resolve({ success: true, data });
                });
                
                // Also listen for notification events
                window.queueChat.socket.once('notification', (data) => {
                    clearTimeout(timeout);
                    resolve({ success: true, data, type: 'notification' });
                });
                
                console.log('Notification listeners set up');
            });
        });
        
        // Step 3: Admin notifies customer
        console.log('\n=== Admin Notifies Customer ===');
        
        // Refresh dashboard
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // Wait for customer list
        await page.waitForSelector('.customer-list, .customer-row');
        
        // Find and click notify for our customer
        const notifyClicked = await page.evaluate((phone) => {
            const rows = document.querySelectorAll('.customer-row');
            for (const row of rows) {
                if (row.textContent.includes(phone)) {
                    // Look for notify button
                    const btn = row.querySelector('.btn-notify, .btn-select, button[onclick*="notify"]');
                    if (btn) {
                        console.log('Clicking notify button');
                        btn.click();
                        return true;
                    }
                }
            }
            return false;
        }, testPhone);
        
        expect(notifyClicked).toBe(true);
        console.log('✅ Notify button clicked');
        
        // Handle any modal
        await page.waitForTimeout(1000);
        const modal = await page.$('.modal .btn-primary, button[onclick*="confirm"]');
        if (modal) {
            await modal.click();
            console.log('✅ Modal confirmed');
        }
        
        // Wait for notification
        console.log('Waiting for notification...');
        await customerPage.waitForTimeout(5000); // Give time for notification
        
        // Check if notification was received
        const result = await customerPage.evaluate(() => {
            // Check for any notification in the UI
            const messages = document.querySelectorAll('.message-bubble');
            for (const msg of messages) {
                const text = msg.textContent.toLowerCase();
                if (text.includes('your turn') || text.includes('ready') || text.includes('proceed')) {
                    return { success: true, message: msg.textContent };
                }
            }
            return { success: false };
        });
        
        console.log('Notification check result:', result);
        expect(result.success).toBe(true);
        
        console.log('\n✅ Test completed successfully!');
        
        // Keep open for observation
        await page.waitForTimeout(3000);
        
        await customerPage.close();
    });
});

// Simplified test configuration
test.use({
    timeout: 30000,
    video: 'on-first-retry',
    screenshot: 'only-on-failure'
});
