const { test, expect } = require('@playwright/test');

// Helper function to generate unique phone numbers
function generateUniquePhone() {
    const random = Math.floor(Math.random() * 9000) + 1000;
    return `+60123456${random}`;
}

test.describe('Queue Notification System - Simple', () => {
    test('Basic notification flow', async ({ page, context }) => {
        const testPhone = generateUniquePhone();
        const queueId = '453b1b29-7d3b-4c0e-92d6-d86cc9952f8e';
        
        console.log('Test phone:', testPhone);
        
        // Enable console logging
        page.on('console', msg => console.log('[PAGE]', msg.text()));
        
        // Step 1: Admin logs in
        console.log('\n=== Step 1: Admin Login ===');
        await page.goto('http://localhost:3838/auth/login');
        await page.waitForURL(/.*dashboard/);
        console.log('✅ Admin logged in');
        
        // Step 2: Customer joins queue in a new tab
        console.log('\n=== Step 2: Customer Joins Queue ===');
        const customerPage = await context.newPage();
        customerPage.on('console', msg => console.log('[CUSTOMER]', msg.text()));
        
        await customerPage.goto(`http://localhost:3838/queue/${queueId}`);
        await customerPage.fill('#customerName', 'Test Customer');
        await customerPage.fill('#customerPhone', testPhone);
        await customerPage.selectOption('#partySize', '2');
        await customerPage.fill('#specialRequests', 'Test notification');
        
        // Submit and wait for redirect
        await customerPage.click('#joinBtn');
        await customerPage.waitForURL('**/queue-chat.html', { timeout: 10000 });
        console.log('✅ Customer joined queue');
        
        // Get queue data including verification code
        const queueData = await customerPage.evaluate(() => {
            const queueInfo = JSON.parse(localStorage.getItem('queueInfo') || '{}');
            return {
                verificationCode: document.querySelector('#headerVerifyCode')?.textContent || queueInfo.verificationCode,
                position: queueInfo.position,
                customerId: queueInfo.customerId
            };
        });
        const verificationCode = queueData.verificationCode;
        console.log('Queue data:', queueData);
        
        // Step 3: Admin sees customer and notifies
        console.log('\n=== Step 3: Admin Notifies Customer ===');
        
        // Go back to admin page and refresh
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // Wait for customer list container
        await page.waitForSelector('.customer-list, .no-customers', { timeout: 10000 });
        
        // Scroll down to see the customer list
        await page.evaluate(() => {
            const customerList = document.querySelector('.customer-list');
            if (customerList) {
                customerList.scrollIntoView({ behavior: 'smooth' });
            }
        });
        await page.waitForTimeout(1000);
        
        // Check if there are customers
        const hasCustomers = await page.$('.customer-row, .customer-card');
        console.log('Has customers:', !!hasCustomers);
        
        if (!hasCustomers) {
            // Log what we see
            const pageContent = await page.$eval('body', el => el.textContent);
            console.log('Page shows:', pageContent.substring(0, 500));
            throw new Error('No customers found in queue');
        }
        
        // Find our test customer by phone number and verification code
        const customerFound = await page.evaluate((args) => {
            const { phone, verifyCode } = args;
            const rows = document.querySelectorAll('.customer-row');
            console.log(`Looking for customer with phone ${phone} or code ${verifyCode}`);
            console.log(`Found ${rows.length} customer rows`);
            
            for (const row of rows) {
                const rowText = row.textContent;
                const phoneCell = row.querySelector('.phone');
                const codeCell = row.querySelector('.verification-code');
                
                console.log('Checking row:', {
                    hasPhone: rowText.includes(phone),
                    phoneText: phoneCell?.textContent,
                    codeText: codeCell?.textContent
                });
                
                if (rowText.includes(phone) || (verifyCode && rowText.includes(verifyCode))) {
                    return {
                        found: true,
                        id: row.getAttribute('data-customer-id'),
                        text: rowText.substring(0, 300),
                        position: row.querySelector('.position')?.textContent?.trim()
                    };
                }
            }
            
            // Log all customer names found
            const names = Array.from(rows).map(r => r.querySelector('.customer-name')?.textContent?.trim());
            console.log('All customer names:', names);
            
            return { found: false };
        }, { phone: testPhone, verifyCode: verificationCode });
        
        console.log('Customer found:', customerFound);
        expect(customerFound.found).toBe(true);
        
        // Set up notification listener on customer page
        const notificationPromise = customerPage.evaluate(() => {
            return new Promise((resolve) => {
                if (window.queueChat && window.queueChat.socket) {
                    window.queueChat.socket.once('customer-called', (data) => {
                        resolve({ received: true, data });
                    });
                    setTimeout(() => resolve({ received: false, timeout: true }), 10000);
                } else {
                    resolve({ received: false, error: 'Socket not ready' });
                }
            });
        });
        
        // Find and click notify button for our customer
        const notifyClicked = await page.evaluate((customerId) => {
            console.log('Looking for customer:', customerId);
            const row = document.querySelector(`[data-customer-id="${customerId}"]`);
            if (row) {
                console.log('Found customer row');
                // Look for any action button
                const notifyBtn = row.querySelector('.btn-notify');
                const selectBtn = row.querySelector('.btn-select');
                const callBtn = row.querySelector('.call-button');
                
                if (notifyBtn) {
                    console.log('Clicking notify button');
                    notifyBtn.click();
                    return 'notify';
                } else if (selectBtn) {
                    console.log('Clicking select button');
                    selectBtn.click();
                    return 'select';
                } else if (callBtn) {
                    console.log('Clicking call button');
                    callBtn.click();
                    return 'call';
                }
            }
            
            // Try to find by position if customer is first
            const firstRow = document.querySelector('.customer-row:first-child');
            if (firstRow) {
                console.log('Trying first row');
                const notifyBtn = firstRow.querySelector('.btn-notify');
                if (notifyBtn) {
                    notifyBtn.click();
                    return 'first-notify';
                }
            }
            
            return null;
        }, customerFound.id);
        
        console.log('Notify clicked:', notifyClicked);
        
        if (notifyClicked) {
            // Handle any modal that appears
            await page.waitForTimeout(1000);
            const modalOkButton = await page.$('.notification-modal .btn-primary');
            if (modalOkButton) {
                console.log('Closing notification modal');
                await modalOkButton.click();
            }
        }
        
        // Wait for notification with timeout
        console.log('Waiting for notification...');
        const notification = await Promise.race([
            notificationPromise,
            new Promise(resolve => setTimeout(() => resolve({ received: false, error: 'Test timeout' }), 8000))
        ]);
        console.log('Notification result:', notification);
        
        expect(notification.received).toBe(true);
        console.log('\n✅ Test completed successfully!');
        
        // Keep browsers open for inspection
        await page.waitForTimeout(5000);
    });
});