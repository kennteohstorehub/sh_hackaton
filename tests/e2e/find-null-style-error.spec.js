const { test, expect } = require('@playwright/test');

test.describe('Find Null Style Error', () => {
    const BASE_URL = 'http://localhost:3838';
    
    test('Monitor console for null style errors during notification flow', async ({ page, context }) => {
        // Track all console errors
        const consoleErrors = [];
        
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                const location = msg.location();
                consoleErrors.push({
                    text,
                    url: location.url,
                    line: location.lineNumber,
                    column: location.columnNumber,
                    timestamp: new Date().toISOString()
                });
                
                console.error('[CONSOLE ERROR]', text);
                console.error('  Location:', location.url + ':' + location.lineNumber + ':' + location.columnNumber);
                
                // If it's the null style error, capture more info
                if (text.includes('Cannot read properties of null') && text.includes('style')) {
                    console.error('  NULL STYLE ERROR DETECTED!');
                }
            }
        });
        
        // Monitor uncaught exceptions
        page.on('pageerror', error => {
            console.error('[PAGE ERROR]', error.message);
            console.error('[STACK]', error.stack);
        });
        
        // Test various navigation scenarios
        console.log('\n=== Test 1: Direct Queue Chat Navigation ===');
        await page.goto(BASE_URL + '/queue-chat/test_session_' + Date.now());
        await page.waitForTimeout(2000);
        
        // Check for any elements that might be null
        const checkElements = await page.evaluate(() => {
            const checks = {
                notificationBanner: document.getElementById('notificationBanner'),
                messagesContainer: document.getElementById('messagesContainer'),
                messageInput: document.getElementById('messageInput'),
                verificationDisplay: document.getElementById('verificationDisplay'),
                connectionStatus: document.getElementById('connectionStatus')
            };
            
            const results = {};
            for (const [name, elem] of Object.entries(checks)) {
                results[name] = {
                    exists: !!elem,
                    hasStyle: elem ? !!elem.style : false,
                    display: elem?.style?.display || 'N/A'
                };
            }
            
            return results;
        });
        
        console.log('Element check:', JSON.stringify(checkElements, null, 2));
        
        // Test 2: Try notification modal if it exists
        console.log('\n=== Test 2: Notification Modal Test ===');
        
        // Check if there's a notification modal script
        const hasNotificationModal = await page.evaluate(() => {
            return typeof window.showNotificationModal !== 'undefined';
        });
        
        if (hasNotificationModal) {
            console.log('Notification modal function exists, attempting to trigger...');
            
            // Try to trigger notification modal
            await page.evaluate(() => {
                if (window.showNotificationModal) {
                    try {
                        window.showNotificationModal('Test notification');
                    } catch (e) {
                        console.error('Error triggering notification modal:', e);
                    }
                }
            });
            
            await page.waitForTimeout(1000);
        }
        
        // Test 3: Search for any notification-related code
        console.log('\n=== Test 3: Notification Code Analysis ===');
        
        const notificationCode = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script'));
            const notificationScripts = [];
            
            scripts.forEach(script => {
                const content = script.textContent || '';
                if (content.includes('notificationBanner') || 
                    content.includes('notification') && content.includes('style')) {
                    notificationScripts.push({
                        src: script.src || 'inline',
                        hasNotificationBanner: content.includes('notificationBanner'),
                        hasStyleAccess: content.includes('.style.')
                    });
                }
            });
            
            return notificationScripts;
        });
        
        console.log('Notification-related scripts:', notificationCode);
        
        // Test 4: Load queue chat with actual queue data
        console.log('\n=== Test 4: Queue Chat with Data ===');
        
        // Set up queue data in localStorage first
        await page.evaluate(() => {
            localStorage.setItem('queueInfo', JSON.stringify({
                queueId: 'test-queue-id',
                entryId: 'test-entry-id',
                position: 1,
                customerName: 'Test User',
                verificationCode: 'TEST'
            }));
            
            localStorage.setItem('queueData', JSON.stringify({
                entryId: 'test-entry-id',
                queueId: 'test-queue-id',
                customerId: 'test-customer-id',
                customerName: 'Test User',
                customerPhone: '+60123456789',
                verificationCode: 'TEST'
            }));
        });
        
        // Reload page with queue data
        await page.reload();
        await page.waitForTimeout(2000);
        
        // Try to trigger customer-called event
        console.log('\n=== Test 5: Socket Event Simulation ===');
        
        const socketExists = await page.evaluate(() => {
            return window.queueChat && window.queueChat.socket;
        });
        
        if (socketExists) {
            console.log('Socket exists, simulating customer-called event...');
            
            await page.evaluate(() => {
                if (window.queueChat && window.queueChat.socket) {
                    // Manually trigger the event handler
                    const mockData = {
                        entryId: 'test-entry-id',
                        message: 'Your turn!',
                        verificationCode: 'TEST'
                    };
                    
                    // Try to call the handler directly
                    if (window.queueChat.handleCustomerCalled) {
                        try {
                            window.queueChat.handleCustomerCalled(mockData);
                        } catch (e) {
                            console.error('Error in handleCustomerCalled:', e);
                        }
                    }
                }
            });
            
            await page.waitForTimeout(1000);
        }
        
        // Final report
        console.log('\n=== FINAL CONSOLE ERROR REPORT ===');
        console.log('Total console errors:', consoleErrors.length);
        
        const nullStyleErrors = consoleErrors.filter(e => 
            e.text.includes('Cannot read properties of null') && e.text.includes('style')
        );
        
        if (nullStyleErrors.length > 0) {
            console.log('\nNULL STYLE ERRORS FOUND:');
            nullStyleErrors.forEach((error, i) => {
                console.log('\nError ' + (i + 1) + ':');
                console.log('  Text:', error.text);
                console.log('  Location:', error.url + ':' + error.line + ':' + error.column);
                console.log('  Time:', error.timestamp);
            });
            
            // Try to get the exact line of code
            if (nullStyleErrors[0] && nullStyleErrors[0].url.includes('queue-chat.js')) {
                const lineNumber = nullStyleErrors[0].line;
                console.log('\nAttempting to get line ' + lineNumber + ' from queue-chat.js...');
                
                const codeLine = await page.evaluate((lineNum) => {
                    // Try to fetch the script content
                    const scripts = Array.from(document.querySelectorAll('script[src*="queue-chat.js"]'));
                    if (scripts.length > 0) {
                        return fetch(scripts[0].src)
                            .then(r => r.text())
                            .then(text => {
                                const lines = text.split('\n');
                                const context = [];
                                for (let i = lineNum - 3; i <= lineNum + 3; i++) {
                                    if (lines[i - 1]) {
                                        context.push(i + ': ' + lines[i - 1]);
                                    }
                                }
                                return context.join('\n');
                            })
                            .catch(e => 'Could not fetch script: ' + e);
                    }
                    return 'No queue-chat.js script found';
                }, lineNumber);
                
                console.log('\nCode context:\n', codeLine);
            }
        } else {
            console.log('\nNo null style errors detected in this test run.');
        }
        
        // The test should fail if we find null style errors
        expect(nullStyleErrors.length).toBe(0);
    });
});
