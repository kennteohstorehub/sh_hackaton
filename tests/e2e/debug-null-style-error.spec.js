const { test, expect } = require('@playwright/test');

test.describe('Debug Null Style Error', () => {
    const BASE_URL = 'http://localhost:3838';
    const QUEUE_ID = '453b1b29-7d3b-4c0e-92d6-d86cc9952f8e';
    
    test('Capture exact null style error with debugging', async ({ page, context }) => {
        // Set up comprehensive error capturing
        const errors = [];
        const warnings = [];
        const logs = [];
        
        page.on('console', msg => {
            const text = msg.text();
            const type = msg.type();
            const location = msg.location();
            
            if (type === 'error') {
                errors.push({
                    text,
                    type,
                    url: location.url,
                    lineNumber: location.lineNumber,
                    columnNumber: location.columnNumber,
                    timestamp: new Date().toISOString()
                });
                console.error('[ERROR at ' + location.url + ':' + location.lineNumber + ':' + location.columnNumber + ']', text);
            } else if (type === 'warning') {
                warnings.push({ text, type, location });
                console.warn('[WARNING]', text);
            } else {
                logs.push({ text, type });
                console.log('[' + type.toUpperCase() + ']', text);
            }
        });
        
        // Capture page errors
        page.on('pageerror', error => {
            console.error('[PAGE ERROR]', error.message);
            console.error('[STACK]', error.stack);
        });
        
        // Test 1: Direct navigation to queue-chat
        console.log('\n=== TEST 1: Direct Queue Chat Navigation ===');
        
        try {
            await page.goto(BASE_URL + '/queue-chat/qc_test_' + Date.now(), {
                waitUntil: 'domcontentloaded'
            });
            
            // Wait a bit for any errors to surface
            await page.waitForTimeout(2000);
            
            // Take screenshot if there are errors
            if (errors.length > 0) {
                await page.screenshot({ 
                    path: 'test-results/direct-nav-error.png',
                    fullPage: true 
                });
                console.log('Screenshot saved: test-results/direct-nav-error.png');
            }
            
            // Check DOM state
            const domState = await page.evaluate(() => {
                const elements = {
                    messagesContainer: document.getElementById('messagesContainer'),
                    messageInput: document.getElementById('messageInput'),
                    sendButton: document.getElementById('sendButton'),
                    connectionStatus: document.getElementById('connectionStatus'),
                    verificationDisplay: document.getElementById('verificationDisplay'),
                    headerVerifyCode: document.getElementById('headerVerifyCode')
                };
                
                const state = {};
                for (const [key, element] of Object.entries(elements)) {
                    state[key] = {
                        exists: !!element,
                        id: element?.id,
                        className: element?.className,
                        hasStyle: !!element?.style,
                        display: element?.style?.display
                    };
                }
                
                return state;
            });
            
            console.log('DOM State:', JSON.stringify(domState, null, 2));
            
        } catch (navError) {
            console.error('Navigation error:', navError);
        }
        
        // Test 2: Join queue and redirect to chat
        console.log('\n=== TEST 2: Queue Join Flow ===');
        
        // Reset error tracking
        errors.length = 0;
        
        // Navigate to queue join page
        await page.goto(BASE_URL + '/queue/' + QUEUE_ID);
        
        // Fill form
        await page.fill('#customerName', 'Debug Test User');
        await page.fill('#customerPhone', '+60123456789');
        await page.selectOption('#partySize', '2');
        
        // Monitor for errors during redirect
        const navigationPromise = page.waitForNavigation();
        await page.click('#joinBtn');
        
        try {
            await navigationPromise;
            console.log('Redirected to:', page.url());
            
            // Wait for potential errors
            await page.waitForTimeout(3000);
            
            if (errors.length > 0) {
                await page.screenshot({ 
                    path: 'test-results/join-flow-error.png',
                    fullPage: true 
                });
                console.log('Screenshot saved: test-results/join-flow-error.png');
                
                // Get more detailed error info
                const errorDetails = await page.evaluate(() => {
                    // Try to get the actual line of code
                    const scripts = Array.from(document.querySelectorAll('script[src*="queue-chat.js"]'));
                    return {
                        scripts: scripts.map(s => s.src),
                        queueChatExists: typeof window.queueChat !== 'undefined',
                        socketIOExists: typeof window.io !== 'undefined'
                    };
                });
                
                console.log('Error context:', errorDetails);
            }
            
        } catch (joinError) {
            console.error('Join flow error:', joinError);
            await page.screenshot({ 
                path: 'test-results/join-error.png',
                fullPage: true 
            });
        }
        
        // Test 3: Rapid navigation to trigger race conditions
        console.log('\n=== TEST 3: Race Condition Test ===');
        
        for (let i = 0; i < 5; i++) {
            errors.length = 0;
            
            await page.goto(BASE_URL + '/queue-chat/qc_race_' + i + '_' + Date.now(), {
                waitUntil: 'domcontentloaded'
            });
            
            // Immediately try to interact with elements
            await page.evaluate(() => {
                // Try to access elements that might not be ready
                const container = document.getElementById('messagesContainer');
                const input = document.getElementById('messageInput');
                const verification = document.getElementById('verificationDisplay');
                
                // Log what we find
                console.log('Race test - Container:', !!container);
                console.log('Race test - Input:', !!input);
                console.log('Race test - Verification:', !!verification);
            });
            
            await page.waitForTimeout(500);
            
            if (errors.length > 0) {
                console.log('Race condition ' + i + ' triggered errors:', errors);
                break;
            }
        }
        
        // Final report
        console.log('\n=== FINAL ERROR REPORT ===');
        console.log('Total errors captured:', errors.length);
        
        if (errors.length > 0) {
            console.log('\nDetailed errors:');
            errors.forEach((error, index) => {
                console.log('\nError ' + (index + 1) + ':');
                console.log('  Text:', error.text);
                console.log('  Location:', error.url + ':' + error.lineNumber + ':' + error.columnNumber);
                console.log('  Time:', error.timestamp);
            });
            
            // Save detailed report
            const report = {
                errors,
                warnings,
                timestamp: new Date().toISOString(),
                url: page.url()
            };
            
            await page.evaluate((reportData) => {
                console.log('DETAILED ERROR REPORT:', JSON.stringify(reportData, null, 2));
            }, report);
        }
        
        // Ensure we capture the exact error
        expect(errors.length).toBe(0);
    });
    
    test('Monitor specific line 161 execution', async ({ page }) => {
        // Inject debugging into queue-chat.js before it loads
        await page.addInitScript(() => {
            // Override console methods to capture more context
            const originalError = console.error;
            console.error = function(...args) {
                if (args[0] && args[0].toString().includes('Cannot read properties of null')) {
                    // Capture stack trace
                    const stack = new Error().stack;
                    originalError.call(console, 'NULL PROPERTY ERROR DETECTED');
                    originalError.call(console, 'Arguments:', ...args);
                    originalError.call(console, 'Stack:', stack);
                    
                    // Try to identify which element is null
                    const stackLines = stack.split('\n');
                    for (const line of stackLines) {
                        if (line.includes('queue-chat.js')) {
                            originalError.call(console, 'Error in queue-chat.js:', line);
                        }
                    }
                }
                originalError.apply(console, args);
            };
        });
        
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });
        
        // Navigate to trigger the error
        await page.goto(BASE_URL + '/queue-chat/qc_line161_test');
        await page.waitForTimeout(3000);
        
        // Check if we caught the specific error
        const nullErrors = errors.filter(e => e.includes('Cannot read properties of null'));
        
        if (nullErrors.length > 0) {
            console.log('Found null property errors:', nullErrors);
            
            // Get the current state of the page
            const pageState = await page.evaluate(() => {
                return {
                    url: window.location.href,
                    readyState: document.readyState,
                    hasQueueChat: typeof window.queueChat !== 'undefined',
                    queueChatInitialized: window.queueChat?.initialized,
                    elements: {
                        messagesContainer: !!document.getElementById('messagesContainer'),
                        messageInput: !!document.getElementById('messageInput'),
                        verificationDisplay: !!document.getElementById('verificationDisplay')
                    }
                };
            });
            
            console.log('Page state when error occurred:', pageState);
        }
        
        expect(nullErrors.length).toBe(0);
    });
});

// Run with: npx playwright test tests/e2e/debug-null-style-error.spec.js --headed
