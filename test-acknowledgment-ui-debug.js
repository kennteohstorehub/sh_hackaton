const puppeteer = require('puppeteer');
const axios = require('axios');

const BASE_URL = 'http://localhost:3838';

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

class AcknowledgmentUITester {
    constructor() {
        this.browser = null;
        this.page = null;
        this.testResults = {
            welcomeMessage: { status: 'pending', details: [] },
            acknowledgmentUI: { status: 'pending', details: [] },
            consoleErrors: [],
            domChecks: []
        };
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        let color = colors.cyan;
        if (type === 'success') color = colors.green;
        if (type === 'error') color = colors.red;
        if (type === 'warning') color = colors.yellow;
        if (type === 'debug') color = colors.magenta;
        
        console.log(color + '[' + timestamp + '] ' + message + colors.reset);
    }

    async init() {
        try {
            this.browser = await puppeteer.launch({
                headless: false, // Set to true for CI/CD
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                defaultViewport: {
                    width: 390,
                    height: 844
                }
            });
            this.page = await this.browser.newPage();
            
            // Capture console logs
            this.page.on('console', msg => {
                const text = msg.text();
                if (text.includes('[OVERLAY]') || text.includes('[NOTIFICATION]') || text.includes('[DEBUG]')) {
                    this.testResults.consoleErrors.push({
                        type: msg.type(),
                        message: text
                    });
                    this.log('Browser console: ' + text, 'debug');
                }
            });
            
            // Capture errors
            this.page.on('pageerror', error => {
                this.testResults.consoleErrors.push({
                    type: 'error',
                    message: error.message
                });
                this.log('Browser error: ' + error.message, 'error');
            });
            
        } catch (error) {
            this.log('Failed to initialize browser: ' + error.message, 'error');
            throw error;
        }
    }

    async runTests() {
        this.log('Starting Acknowledgment UI Debug Tests', 'info');
        this.log('=====================================\n', 'info');

        try {
            await this.init();
            
            // Test 1: Welcome Message Fix
            await this.testWelcomeMessage();
            
            // Test 2: Acknowledgment UI Debugging
            await this.testAcknowledgmentUI();
            
            // Print final report
            this.printReport();
            
        } catch (error) {
            this.log('Fatal error: ' + error.message, 'error');
            console.error(error);
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }

    async testWelcomeMessage() {
        this.log('TEST 1: Welcome Message Fix', 'info');
        this.log('---------------------------', 'info');

        const testData = {
            customerName: 'Test User ' + Date.now(),
            customerPhone: '+60123456789',
            partySize: 2,
            merchantId: '507f1f77bcf86cd799439011',
            queueId: '507f1f77bcf86cd799439012'
        };

        try {
            // Join queue via API
            this.log('Joining queue as new customer...', 'debug');
            const joinResponse = await axios.post(BASE_URL + '/api/customer/join-queue', testData);
            
            if (joinResponse.data.success) {
                const sessionId = joinResponse.data.sessionId;
                const verificationCode = joinResponse.data.verificationCode;
                
                this.log('Joined queue successfully:', 'success');
                this.log('  Session ID: ' + sessionId, 'info');
                this.log('  Verification Code: ' + verificationCode, 'info');

                // Navigate to chat page
                await this.page.goto(BASE_URL + '/queue-chat', { waitUntil: 'networkidle2' });
                
                // Wait for messages to load
                await this.page.waitForSelector('.message', { timeout: 5000 });
                
                // Check welcome message
                const welcomeMessage = await this.page.evaluate(() => {
                    const messages = document.querySelectorAll('.message.bot .message-bubble');
                    return messages.length > 0 ? messages[0].textContent : null;
                });
                
                const expectedMessage = 'Welcome ' + testData.customerName + '\! 🎉';
                const isCorrect = welcomeMessage === expectedMessage;
                const hasWelcomeBack = welcomeMessage && welcomeMessage.includes('Welcome back');
                
                this.log('Initial welcome message check:', 'info');
                this.log('  Expected: "' + expectedMessage + '"', 'debug');
                this.log('  Found: "' + (welcomeMessage || 'NO MESSAGE') + '"', 'debug');
                this.log('  Correct: ' + (isCorrect ? 'YES' : 'NO'), isCorrect ? 'success' : 'error');
                
                this.testResults.welcomeMessage.details.push({
                    test: 'Initial join',
                    result: { correct: isCorrect, hasWelcomeBack: hasWelcomeBack }
                });

                // Refresh page
                this.log('Refreshing page...', 'debug');
                await this.page.reload({ waitUntil: 'networkidle2' });
                await this.page.waitForSelector('.message', { timeout: 5000 });
                
                // Check message after refresh
                const refreshMessage = await this.page.evaluate(() => {
                    const messages = document.querySelectorAll('.message.bot .message-bubble');
                    return messages.length > 0 ? messages[0].textContent : null;
                });
                
                const refreshCorrect = refreshMessage && \!refreshMessage.includes('Welcome back');
                
                this.log('After refresh message check:', 'info');
                this.log('  Found: "' + (refreshMessage || 'NO MESSAGE') + '"', 'debug');
                this.log('  Correct (no "back"): ' + (refreshCorrect ? 'YES' : 'NO'), refreshCorrect ? 'success' : 'error');
                
                this.testResults.welcomeMessage.details.push({
                    test: 'After refresh',
                    result: { correct: refreshCorrect, hasWelcomeBack: \!refreshCorrect }
                });

                this.testResults.welcomeMessage.status = 
                    (isCorrect && refreshCorrect) ? 'passed' : 'failed';

                // Clean up
                await this.cancelQueue(sessionId);
            }
        } catch (error) {
            this.log('Welcome message test error: ' + error.message, 'error');
            this.testResults.welcomeMessage.status = 'error';
            this.testResults.welcomeMessage.error = error.message;
        }
    }

    async testAcknowledgmentUI() {
        this.log('\nTEST 2: Acknowledgment UI Debugging', 'info');
        this.log('------------------------------------', 'info');

        const testData = {
            customerName: 'Acknowledgment Test ' + Date.now(),
            customerPhone: '+60123456789',
            partySize: 2,
            merchantId: '507f1f77bcf86cd799439011',
            queueId: '507f1f77bcf86cd799439012'
        };

        try {
            // Join queue
            this.log('Creating test queue entry...', 'debug');
            const joinResponse = await axios.post(BASE_URL + '/api/customer/join-queue', testData);
            
            if (joinResponse.data.success) {
                const sessionId = joinResponse.data.sessionId;
                const entryId = joinResponse.data.entryId;
                const verificationCode = joinResponse.data.verificationCode;
                
                this.log('Queue entry created:', 'success');
                this.log('  Entry ID: ' + entryId, 'info');
                this.log('  Session ID: ' + sessionId, 'info');

                // Navigate to chat with session
                await this.page.goto(BASE_URL + '/queue-chat', { waitUntil: 'networkidle2' });
                
                // Wait for WebSocket connection
                await this.delay(2000);
                
                // Call the customer
                this.log('\nCalling customer to trigger notification...', 'debug');
                const callResponse = await axios.post(BASE_URL + '/api/queue/' + entryId + '/call', {
                    merchantId: testData.merchantId
                });

                if (callResponse.data.success) {
                    this.log('Customer called successfully', 'success');
                    
                    // Wait for overlay to appear
                    this.log('Waiting for acknowledgment overlay...', 'debug');
                    
                    try {
                        await this.page.waitForSelector('.acknowledgment-overlay', { 
                            timeout: 10000,
                            visible: true 
                        });
                        
                        this.log('Acknowledgment overlay appeared\!', 'success');
                        
                        // Check DOM elements
                        const domCheck = await this.page.evaluate(() => {
                            const overlay = document.querySelector('.acknowledgment-overlay');
                            const content = document.querySelector('.acknowledgment-content');
                            const codeElement = document.querySelector('.verification-code-large');
                            const button = document.querySelector('.ack-btn-primary');
                            
                            return {
                                overlay: {
                                    exists: \!\!overlay,
                                    display: overlay ? window.getComputedStyle(overlay).display : null,
                                    visibility: overlay ? window.getComputedStyle(overlay).visibility : null,
                                    opacity: overlay ? window.getComputedStyle(overlay).opacity : null,
                                    zIndex: overlay ? window.getComputedStyle(overlay).zIndex : null
                                },
                                content: {
                                    exists: \!\!content,
                                    visible: content ? window.getComputedStyle(content).display \!== 'none' : false
                                },
                                code: {
                                    exists: \!\!codeElement,
                                    text: codeElement ? codeElement.textContent : null
                                },
                                button: {
                                    exists: \!\!button,
                                    text: button ? button.textContent : null,
                                    enabled: button ? \!button.disabled : false
                                }
                            };
                        });
                        
                        this.log('\n=== DOM ELEMENT CHECKS ===', 'warning');
                        this.log('Overlay: ' + (domCheck.overlay.exists ? 'FOUND' : 'MISSING'), 
                                 domCheck.overlay.exists ? 'success' : 'error');
                        if (domCheck.overlay.exists) {
                            this.log('  Display: ' + domCheck.overlay.display, 'debug');
                            this.log('  Visibility: ' + domCheck.overlay.visibility, 'debug');
                            this.log('  Opacity: ' + domCheck.overlay.opacity, 'debug');
                            this.log('  Z-Index: ' + domCheck.overlay.zIndex, 'debug');
                        }
                        
                        this.log('Content: ' + (domCheck.content.exists ? 'FOUND' : 'MISSING'), 
                                 domCheck.content.exists ? 'success' : 'error');
                        
                        this.log('Verification Code: ' + (domCheck.code.exists ? 'FOUND' : 'MISSING'), 
                                 domCheck.code.exists ? 'success' : 'error');
                        if (domCheck.code.exists) {
                            this.log('  Code: ' + domCheck.code.text, 'debug');
                        }
                        
                        this.log('Button: ' + (domCheck.button.exists ? 'FOUND' : 'MISSING'), 
                                 domCheck.button.exists ? 'success' : 'error');
                        if (domCheck.button.exists) {
                            this.log('  Text: ' + domCheck.button.text, 'debug');
                            this.log('  Enabled: ' + domCheck.button.enabled, 'debug');
                        }
                        
                        // Take screenshot
                        await this.page.screenshot({ 
                            path: 'acknowledgment-overlay-screenshot.png',
                            fullPage: true 
                        });
                        this.log('\nScreenshot saved: acknowledgment-overlay-screenshot.png', 'info');
                        
                        this.testResults.acknowledgmentUI.status = 'completed';
                        this.testResults.domChecks = domCheck;
                        
                    } catch (timeoutError) {
                        this.log('Acknowledgment overlay did not appear within 10 seconds', 'error');
                        
                        // Check what's in the DOM
                        const bodyContent = await this.page.evaluate(() => {
                            return {
                                bodyClasses: document.body.className,
                                overlayCount: document.querySelectorAll('.acknowledgment-overlay').length,
                                messagesCount: document.querySelectorAll('.message').length,
                                lastMessage: document.querySelector('.message:last-child .message-bubble')?.textContent
                            };
                        });
                        
                        this.log('\nDOM State:', 'warning');
                        this.log('  Body classes: ' + bodyContent.bodyClasses, 'debug');
                        this.log('  Overlay elements: ' + bodyContent.overlayCount, 'debug');
                        this.log('  Message count: ' + bodyContent.messagesCount, 'debug');
                        this.log('  Last message: ' + (bodyContent.lastMessage || 'none'), 'debug');
                        
                        // Take failure screenshot
                        await this.page.screenshot({ 
                            path: 'acknowledgment-failure-screenshot.png',
                            fullPage: true 
                        });
                        this.log('\nFailure screenshot saved: acknowledgment-failure-screenshot.png', 'info');
                        
                        this.testResults.acknowledgmentUI.status = 'failed';
                    }
                } else {
                    this.log('Failed to call customer', 'error');
                    this.testResults.acknowledgmentUI.status = 'failed';
                }

                // Clean up
                await this.cancelQueue(sessionId);
            }
        } catch (error) {
            this.log('Acknowledgment UI test error: ' + error.message, 'error');
            this.testResults.acknowledgmentUI.status = 'error';
            this.testResults.acknowledgmentUI.error = error.message;
        }
    }

    async cancelQueue(sessionId) {
        try {
            await axios.post(BASE_URL + '/api/webchat/cancel/' + sessionId);
            this.log('Test queue entry cleaned up', 'debug');
        } catch (error) {
            this.log('Failed to clean up: ' + error.message, 'warning');
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    printReport() {
        this.log('\n\n=== FINAL TEST REPORT ===', 'info');
        this.log('========================', 'info');

        // Welcome Message Test
        this.log('\n1. Welcome Message Fix:', 'info');
        const welcomeStatus = this.testResults.welcomeMessage.status;
        this.log('   Status: ' + welcomeStatus.toUpperCase(), 
                 welcomeStatus === 'passed' ? 'success' : 'error');
        
        // Acknowledgment UI Test
        this.log('\n2. Acknowledgment UI:', 'info');
        const ackStatus = this.testResults.acknowledgmentUI.status;
        this.log('   Status: ' + ackStatus.toUpperCase(), 
                 ackStatus === 'completed' ? 'success' : 'error');

        // Console Errors
        const errors = this.testResults.consoleErrors.filter(e => e.type === 'error');
        this.log('\n3. Console Errors: ' + (errors.length > 0 ? errors.length + ' found' : 'NONE'), 
                 errors.length === 0 ? 'success' : 'error');
        
        if (errors.length > 0) {
            errors.forEach(err => {
                this.log('   - ' + err.message, 'error');
            });
        }

        // Important console logs
        const overlayLogs = this.testResults.consoleErrors.filter(e => 
            e.message.includes('[OVERLAY]') || e.message.includes('[NOTIFICATION]')
        );
        
        if (overlayLogs.length > 0) {
            this.log('\n4. Relevant Console Logs:', 'info');
            overlayLogs.forEach(log => {
                this.log('   ' + log.message, 'debug');
            });
        }

        this.log('\n=========================\n', 'info');
    }
}

// Check if server is running
axios.get(BASE_URL + '/health')
    .then(() => {
        // Run the tests
        const tester = new AcknowledgmentUITester();
        tester.runTests();
    })
    .catch(() => {
        console.log(colors.red + 'Error: Server is not running on ' + BASE_URL + colors.reset);
        console.log(colors.yellow + 'Please start the server with: npm run dev' + colors.reset);
        process.exit(1);
    });
ENDOFFILE < /dev/null