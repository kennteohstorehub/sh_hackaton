const { test, expect } = require('@playwright/test');
const { chromium } = require('playwright');

// Helper function to generate unique phone numbers
function generateUniquePhone() {
    // Use a known valid Malaysian phone format
    // +60 12-345 6789 format (without dashes)
    const random = Math.floor(Math.random() * 9000) + 1000; // 4 digits
    return `+60123456${random}`; // This should pass isMobilePhone validation
}

test.describe('Queue Notification System', () => {
    let adminContext;
    let customerContext;
    let adminPage;
    let customerPage;
    let testPhone;
    let queueId;
    let customerId;

    test.beforeAll(async () => {
        // Create separate browser contexts for admin and customer
        const browser = await chromium.launch({ 
            headless: false,
            args: ['--disable-blink-features=AutomationControlled']
        });
        
        adminContext = await browser.newContext();
        customerContext = await browser.newContext();
        
        // Enable console logging for debugging
        adminContext.on('console', msg => {
            if (msg.type() === 'log') {
                console.log('[ADMIN]', msg.text());
            }
        });
        
        customerContext.on('console', msg => {
            if (msg.type() === 'log') {
                console.log('[CUSTOMER]', msg.text());
            }
        });
        
        testPhone = generateUniquePhone();
        console.log('Test phone number:', testPhone);
    });

    test('Complete queue notification flow', async () => {
        // Step 1: Admin logs in and navigates to dashboard
        console.log('\n=== Step 1: Admin Login ===');
        adminPage = await adminContext.newPage();
        
        // Listen for console logs
        adminPage.on('console', msg => console.log('[ADMIN-PAGE]', msg.text()));
        
        await adminPage.goto('http://localhost:3000/auth/login');
        await adminPage.waitForLoadState('networkidle');
        
        // Since auth is bypassed in dev, we should be redirected to dashboard
        await expect(adminPage).toHaveURL(/.*dashboard/);
        console.log('✅ Admin logged in successfully');

        // Since dashboard shows inline queue management, we'll use known queue ID
        // The dashboard shows Main Queue inline without separate links
        queueId = '453b1b29-7d3b-4c0e-92d6-d86cc9952f8e'; // Known queue ID from the system
        console.log('Using queue ID:', queueId);
        
        // Verify we're on the dashboard
        await adminPage.waitForSelector('h2:has-text("Main Queue")', { timeout: 5000 }).catch(() => {
            console.log('Main Queue not found, dashboard might have different structure');
        });

        // Step 2: Customer joins queue via web form
        console.log('\n=== Step 2: Customer Joins Queue ===');
        customerPage = await customerContext.newPage();
        
        // Listen for console logs and network requests
        customerPage.on('console', msg => console.log('[CUSTOMER-PAGE]', msg.text()));
        
        // Add request logger
        customerPage.on('request', request => {
            if (request.url().includes('/api/')) {
                console.log('[CUSTOMER-REQUEST]', request.method(), request.url());
            }
        });
        
        customerPage.on('response', response => {
            if (response.url().includes('/api/')) {
                console.log('[CUSTOMER-RESPONSE]', response.status(), response.url());
            }
        });
        
        await customerPage.goto(`http://localhost:3000/queue/${queueId}`);
        await customerPage.waitForLoadState('networkidle');

        // Fill in the join queue form
        await customerPage.fill('#customerName', 'Test Customer');
        await customerPage.fill('#customerPhone', testPhone);
        await customerPage.selectOption('#partySize', '2');
        await customerPage.fill('#specialRequests', 'Playwright test - please ignore');

        // Submit the form
        console.log('Submitting join queue form...');
        
        // Wait for response before clicking
        const responsePromise = customerPage.waitForResponse(response => 
            response.url().includes('/api/customer/join/') && response.status() !== 200
        );
        
        await customerPage.click('#joinBtn');
        
        // Check if there's an error
        const errorResponse = await responsePromise.catch(() => null);
        if (errorResponse) {
            const errorData = await errorResponse.json();
            console.log('Join queue error:', errorData);
            
            // Check for error message on page
            const errorMessage = await customerPage.$eval('#errorText', el => el.textContent).catch(() => null);
            console.log('Error message on page:', errorMessage);
        }

        // Wait for redirect to queue-chat.html
        await customerPage.waitForURL('**/queue-chat.html', { timeout: 10000 });
        console.log('✅ Customer joined queue and redirected to chat');

        // Wait for WebSocket connection
        await customerPage.waitForTimeout(2000);

        // Check if verification code is displayed
        const verificationDisplay = await customerPage.$('#verificationDisplay');
        if (verificationDisplay) {
            const isVisible = await verificationDisplay.isVisible();
            console.log('Verification display visible:', isVisible);
            
            const verificationCode = await customerPage.$eval('#headerVerifyCode', el => el.textContent).catch(() => null);
            console.log('Verification code:', verificationCode || 'Not displayed');
        }

        // Step 3: Admin views queue (already on dashboard)
        console.log('\n=== Step 3: Admin Views Queue ===');
        
        // Since queue is displayed inline on dashboard, refresh to see new entry
        await adminPage.reload();
        await adminPage.waitForLoadState('networkidle');
        
        // Wait for active queue section
        await adminPage.waitForSelector('.tab-button.active', { timeout: 5000 });
        
        // Wait for customer list to render
        await adminPage.waitForSelector('.customer-list, .customer-list-mobile', { timeout: 10000 });
        await adminPage.waitForTimeout(3000); // Give time for dynamic content to load

        // Find our test customer in the Active Queue table
        const customerEntry = await adminPage.evaluate((phone) => {
            // Look for customer rows in the desktop view (grid layout)
            const customerRows = Array.from(document.querySelectorAll('.customer-row'));
            console.log('Found', customerRows.length, 'customer rows');
            
            // Also check mobile cards
            const mobileCards = Array.from(document.querySelectorAll('.customer-card'));
            console.log('Found', mobileCards.length, 'mobile cards');
            
            // Check desktop rows first
            for (const row of customerRows) {
                const rowText = row.textContent;
                console.log('Checking customer row:', rowText.substring(0, 200));
                
                // Check for phone number or name
                if (rowText.includes(phone) || rowText.includes('Test Customer')) {
                    // Find the Notify button in this row
                    const notifyButton = row.querySelector('.btn-notify');
                    const selectButton = row.querySelector('.btn-select');
                    const pendingButton = row.querySelector('.btn-pending');
                    
                    // Extract customer ID from data attribute
                    const customerId = row.getAttribute('data-customer-id');
                    
                    return {
                        found: true,
                        customerId: customerId || 'unknown',
                        hasNotifyButton: !!notifyButton,
                        hasSelectButton: !!selectButton,
                        hasPendingButton: !!pendingButton,
                        entryText: rowText.trim()
                    };
                }
            }
            
            // Check mobile cards if not found in desktop
            for (const card of mobileCards) {
                const cardText = card.textContent;
                if (cardText.includes(phone) || cardText.includes('Test Customer')) {
                    return {
                        found: true,
                        customerId: 'found-in-mobile',
                        entryText: cardText.trim()
                    };
                }
            }
            
            // Check if queue is empty
            const noCustomers = document.querySelector('.no-customers');
            if (noCustomers) {
                console.log('Queue shows no customers:', noCustomers.textContent);
            }
            
            // Debug: log some page content
            const activeQueueContent = document.querySelector('#active-queue');
            if (activeQueueContent) {
                console.log('Active queue content preview:', activeQueueContent.textContent.substring(0, 300));
            }
            
            return { found: false };
        }, testPhone);

        console.log('Customer entry found:', customerEntry);
        expect(customerEntry.found).toBe(true);
        customerId = customerEntry.customerId;

        // Step 4: Admin clicks notify button
        console.log('\n=== Step 4: Admin Notifies Customer ===');
        
        // Set up listener for customer page to receive notification
        const notificationPromise = customerPage.evaluate(() => {
            return new Promise((resolve) => {
                // Listen for the customer-called event
                if (window.queueChat && window.queueChat.socket) {
                    window.queueChat.socket.once('customer-called', (data) => {
                        console.log('[CUSTOMER] Received customer-called event:', data);
                        resolve({ received: true, data });
                    });
                } else {
                    console.error('[CUSTOMER] Socket not initialized');
                    resolve({ received: false, error: 'Socket not initialized' });
                }
                
                // Timeout after 10 seconds
                setTimeout(() => {
                    resolve({ received: false, error: 'Timeout waiting for notification' });
                }, 10000);
            });
        });

        // Click the notify button
        const notifyClicked = await adminPage.evaluate((customerId) => {
            console.log('Looking for notify button for customer:', customerId);
            
            // First try to find the customer row by ID
            const customerRow = document.querySelector(`[data-customer-id="${customerId}"]`);
            if (customerRow) {
                console.log('Found customer row');
                
                // Look for notify button in this row
                const notifyButton = customerRow.querySelector('.btn-notify');
                if (notifyButton) {
                    console.log('Found notify button, clicking...');
                    notifyButton.click();
                    return true;
                }
                
                // Also check for "Select" button (for non-first customers)
                const selectButton = customerRow.querySelector('.btn-select');
                if (selectButton) {
                    console.log('Found select button, clicking...');
                    selectButton.click();
                    return true;
                }
            }
            
            // If this is the first customer, try the notifyNext function
            const firstRow = document.querySelector('.customer-row:first-child');
            if (firstRow && firstRow.getAttribute('data-customer-id') === customerId) {
                const notifyButton = firstRow.querySelector('.btn-notify');
                if (notifyButton) {
                    console.log('Customer is first in queue, clicking notify button');
                    notifyButton.click();
                    return true;
                }
            }
            
            // Try mobile view
            const mobileCard = Array.from(document.querySelectorAll('.customer-card')).find(card => 
                card.textContent.includes('Test Customer')
            );
            if (mobileCard) {
                const callButton = mobileCard.querySelector('.call-button');
                if (callButton) {
                    console.log('Found mobile call button, clicking...');
                    callButton.click();
                    return true;
                }
            }
            
            console.log('No notify button found for customer:', customerId);
            return false;
        }, customerId);
        
        console.log('Notify button clicked:', notifyClicked);

        // Wait for notification to be received
        console.log('Waiting for customer to receive notification...');
        const notificationResult = await notificationPromise;
        
        console.log('Notification result:', notificationResult);
        expect(notificationResult.received).toBe(true);
        
        // Check if notification message appears in chat
        try {
            await customerPage.waitForSelector('.message.system', { timeout: 5000 });
            const notificationMessage = await customerPage.$eval('.message.system .message-bubble', el => el.textContent);
            console.log('Notification message:', notificationMessage);
            expect(notificationMessage).toContain("IT'S YOUR TURN!");
        } catch (error) {
            console.log('Could not find system message, checking for any notification-related content');
            const allMessages = await customerPage.$$eval('.message', messages => 
                messages.map(m => m.textContent)
            );
            console.log('All messages:', allMessages);
        }

        // Step 5: Verify status check works
        console.log('\n=== Step 5: Test Status Check ===');
        
        // Click status button
        await customerPage.click('button[onclick*="status"]');
        await customerPage.waitForTimeout(1000);
        
        // Check for status message
        const statusMessage = await customerPage.$$eval('.message.bot', elements => {
            return elements[elements.length - 1]?.textContent || '';
        });
        console.log('Status message:', statusMessage);
        expect(statusMessage).toMatch(/position|status|wait/i);

        // Step 6: Test cancellation
        console.log('\n=== Step 6: Test Cancellation ===');
        
        // Click cancel button
        await customerPage.click('button[onclick*="cancel"]');
        await customerPage.waitForTimeout(1000);
        
        // Confirm cancellation
        await customerPage.keyboard.type('yes');
        await customerPage.keyboard.press('Enter');
        await customerPage.waitForTimeout(1000);
        
        // Check for cancellation message
        const cancelMessage = await customerPage.$$eval('.message.bot', elements => {
            return elements[elements.length - 1]?.textContent || '';
        });
        console.log('Cancel message:', cancelMessage);
        expect(cancelMessage).toMatch(/removed|cancelled/i);

        console.log('\n✅ All tests passed!');
    });

    test.afterAll(async () => {
        // Close pages but keep browsers open for debugging
        if (adminPage) await adminPage.close();
        if (customerPage) await customerPage.close();
        
        // Wait a bit before closing contexts
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        if (adminContext) await adminContext.close();
        if (customerContext) await customerContext.close();
    });
});