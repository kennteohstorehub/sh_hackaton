const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3838';
const QUEUE_ID = '453b1b29-7d3b-4c0e-92d6-d86cc9952f8e';

async function testNotificationFlow() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    
    // Enable console logging
    const adminPage = await context.newPage();
    adminPage.on('console', msg => console.log('[ADMIN]', msg.text()));
    
    const customerPage = await context.newPage();
    customerPage.on('console', msg => console.log('[CUSTOMER]', msg.text()));
    
    try {
        const phone = `+6012345${Math.floor(Math.random() * 90000) + 10000}`;
        console.log('Test phone:', phone);
        
        // Step 1: Admin login
        console.log('\n1. Admin login...');
        await adminPage.goto(`${BASE_URL}/auth/login`);
        await adminPage.waitForURL(/.*dashboard/);
        console.log('✅ Admin logged in');
        
        // Step 2: Customer joins queue
        console.log('\n2. Customer joining queue...');
        await customerPage.goto(`${BASE_URL}/queue/${QUEUE_ID}`);
        await customerPage.fill('#customerName', 'Test Customer');
        await customerPage.fill('#customerPhone', phone);
        await customerPage.selectOption('#partySize', '2');
        await customerPage.click('#joinBtn');
        await customerPage.waitForURL('**/queue-chat.html');
        
        // Wait a bit for data to be stored
        await customerPage.waitForTimeout(2000);
        
        // Extract customer data
        const customerData = await customerPage.evaluate(() => {
            const queueInfo = JSON.parse(sessionStorage.getItem('queueInfo') || '{}');
            console.log('[DEBUG] sessionStorage queueInfo:', queueInfo);
            
            return {
                customerId: queueInfo.customerId,
                verificationCode: document.querySelector('#headerVerifyCode')?.textContent || queueInfo.verificationCode,
                sessionId: queueInfo.sessionId,
                position: queueInfo.position,
                phone: queueInfo.customerPhone
            };
        });
        console.log('✅ Customer joined:', customerData);
        
        // Step 3: Admin views and notifies
        console.log('\n3. Admin viewing queue...');
        await adminPage.reload();
        await adminPage.waitForTimeout(2000);
        
        // Debug: Check what Socket.IO rooms the customer is in
        await customerPage.evaluate(() => {
            if (window.queueChat && window.queueChat.socket) {
                console.log('[DEBUG] Socket connected:', window.queueChat.socket.connected);
                console.log('[DEBUG] Socket ID:', window.queueChat.socket.id);
            }
        });
        
        // Find customer in admin dashboard
        let customerFound = false;
        if (customerData.customerId) {
            // Try to find by text content
            const found = await adminPage.evaluate((phone) => {
                const rows = document.querySelectorAll('.customer-row');
                for (const row of rows) {
                    if (row.textContent.includes(phone)) {
                        const id = row.getAttribute('data-customer-id');
                        console.log('Found customer with ID:', id);
                        // Try to click the action button
                        const btn = row.querySelector('.btn-notify, .btn-select');
                        if (btn) {
                            btn.click();
                            return { found: true, id };
                        }
                    }
                }
                return { found: false };
            }, phone);
            
            if (!found.found) {
                throw new Error('Customer not found in dashboard');
            }
            console.log('✅ Found and clicked notify for customer');
        }
        
        // Set up notification listener
        const notificationReceived = await customerPage.evaluate(() => {
            return new Promise((resolve) => {
                if (window.queueChat && window.queueChat.socket) {
                    console.log('[DEBUG] Setting up notification listener');
                    
                    // Listen to all events for debugging
                    const originalEmit = window.queueChat.socket.emit;
                    window.queueChat.socket.emit = function(...args) {
                        console.log('[DEBUG] Socket emit:', args[0], args[1]);
                        return originalEmit.apply(this, args);
                    };
                    
                    const events = ['customer-called', 'notification', 'queue-update', 'message'];
                    events.forEach(event => {
                        window.queueChat.socket.on(event, (data) => {
                            console.log(`[DEBUG] Received ${event}:`, data);
                            if (event === 'customer-called') {
                                resolve({ success: true, data });
                            }
                        });
                    });
                    
                    setTimeout(() => resolve({ success: false, reason: 'timeout' }), 10000);
                } else {
                    resolve({ success: false, reason: 'no socket' });
                }
            });
        });
        
        console.log('\n4. Notification result:', notificationReceived);
        
        if (notificationReceived.success) {
            console.log('✅ TEST PASSED - Notification received!');
        } else {
            console.log('❌ TEST FAILED -', notificationReceived.reason);
        }
        
    } catch (error) {
        console.error('Test error:', error);
    } finally {
        await browser.close();
    }
}

testNotificationFlow();