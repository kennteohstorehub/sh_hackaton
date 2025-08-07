const { test, expect } = require('@playwright/test');

test.describe('Validate Notification Fix', () => {
    const BASE_URL = 'http://localhost:3000';
    const QUEUE_ID = '453b1b29-7d3b-4c0e-92d6-d86cc9952f8e';
    
    test('Ensure no null style errors in notification flow', async ({ page, context }) => {
        // Track console errors
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                errors.push(text);
                console.error('[ERROR]', text);
                
                // Fail immediately if we see a null style error
                if (text.includes('Cannot read properties of null') && text.includes('style')) {
                    throw new Error('NULL STYLE ERROR DETECTED: ' + text);
                }
            }
        });
        
        // Step 1: Join queue
        await page.goto(BASE_URL + '/queue/' + QUEUE_ID);
        await page.fill('#customerName', 'Test User');
        await page.fill('#customerPhone', '+60123456789');
        await page.selectOption('#partySize', '2');
        
        // Submit and wait for navigation
        await Promise.all([
            page.waitForNavigation(),
            page.click('#joinBtn')
        ]);
        
        console.log('Navigated to:', page.url());
        
        // Wait for page to fully load
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
        // Step 2: Check elements exist
        const elements = await page.evaluate(() => {
            const queueChat = window.queueChat;
            return {
                hasQueueChat: !!queueChat,
                hasElements: queueChat ? !!queueChat.elements : false,
                connectionStatus: queueChat?.elements?.connectionStatus ? 'exists' : 'missing',
                verificationDisplay: queueChat?.elements?.verificationDisplay ? 'exists' : 'missing',
                messagesContainer: queueChat?.elements?.messagesContainer ? 'exists' : 'missing'
            };
        });
        
        console.log('Elements check:', elements);
        
        // Step 3: Simulate notification events
        console.log('Simulating notification events...');
        
        // Test updateConnectionStatus
        await page.evaluate(() => {
            if (window.queueChat) {
                // Test various connection status updates
                window.queueChat.updateConnectionStatus(true);
                window.queueChat.updateConnectionStatus(false);
                window.queueChat.updateConnectionStatus('Connected', 'connected');
                window.queueChat.updateConnectionStatus('Ready', 'ready');
            }
        });
        
        // Test customer-called event
        await page.evaluate(() => {
            if (window.queueChat && window.queueChat.handleCustomerCalled) {
                window.queueChat.handleCustomerCalled({
                    entryId: window.queueChat.queueData?.entryId || 'test-id',
                    message: 'Your turn!',
                    verificationCode: 'TEST'
                });
            }
        });
        
        // Test notification revoked
        await page.evaluate(() => {
            if (window.queueChat && window.queueChat.handleNotificationRevoked) {
                window.queueChat.handleNotificationRevoked({
                    entryId: window.queueChat.queueData?.entryId || 'test-id',
                    message: 'Notification revoked'
                });
            }
        });
        
        // Wait a bit for any async errors
        await page.waitForTimeout(1000);
        
        // Final check
        console.log('Total errors:', errors.length);
        const nullStyleErrors = errors.filter(e => 
            e.includes('Cannot read properties of null') && e.includes('style')
        );
        
        expect(nullStyleErrors).toHaveLength(0);
        console.log('✅ No null style errors detected!');
    });
    
    test('Test all style-modifying methods', async ({ page }) => {
        // Navigate to queue chat
        await page.goto(BASE_URL + '/queue-chat/test_validation_' + Date.now());
        
        // Wait for error page or actual page
        await page.waitForTimeout(1000);
        
        // If we get error page, that's OK for this test
        const isErrorPage = await page.$('.error-container');
        if (isErrorPage) {
            console.log('Got error page, injecting test script...');
            
            // Navigate to a valid page and inject our test
            await page.goto(BASE_URL);
            
            // Inject queue-chat.js manually for testing
            await page.addScriptTag({ path: 'public/js/queue-chat.js' });
        }
        
        // Test all methods that access style properties
        const testResults = await page.evaluate(() => {
            const results = {
                tested: [],
                errors: []
            };
            
            // Create a mock QueueChat instance
            const queueChat = new window.QueueChat();
            
            // Test methods that might cause null style errors
            const testMethods = [
                () => {
                    queueChat.updateConnectionStatus('Test', 'ready');
                    results.tested.push('updateConnectionStatus');
                },
                () => {
                    queueChat.flashScreen();
                    results.tested.push('flashScreen');
                },
                () => {
                    queueChat.clearQueueData();
                    results.tested.push('clearQueueData');
                },
                () => {
                    if (queueChat.elements.messageInput) {
                        queueChat.elements.messageInput.style.height = 'auto';
                    }
                    results.tested.push('messageInput style');
                }
            ];
            
            // Run each test
            testMethods.forEach(test => {
                try {
                    test();
                } catch (e) {
                    results.errors.push(e.toString());
                }
            });
            
            return results;
        });
        
        console.log('Test results:', testResults);
        expect(testResults.errors).toHaveLength(0);
        console.log('✅ All style methods are safe!');
    });
});
