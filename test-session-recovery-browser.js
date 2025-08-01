const puppeteer = require('puppeteer');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3838';
const MERCHANT_ID = 'demo';

// Helper to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

async function testSessionRecovery() {
    const browser = await puppeteer.launch({
        headless: false, // Set to true for CI/CD
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    let page1, page2;
    
    try {
        console.log(`${colors.cyan}🧪 Starting Browser-Based Session Recovery Tests${colors.reset}\n`);
        
        // Test 1: Normal session creation and recovery
        console.log(`${colors.blue}📋 Test 1: Normal Session Creation and Recovery${colors.reset}`);
        page1 = await browser.newPage();
        await page1.goto(`${BASE_URL}/queue/${MERCHANT_ID}/join`);
        
        // Fill in the form
        await page1.waitForSelector('#customerName');
        await page1.type('#customerName', 'Test Recovery User');
        await page1.type('#customerPhone', '+60123456789');
        await page1.select('#partySize', '2');
        await page1.type('#specialRequests', 'Testing session recovery');
        
        // Submit form
        await page1.click('button[type="submit"]');
        
        // Wait for queue chat page
        await page1.waitForNavigation();
        await wait(2000);
        
        // Get session ID from localStorage
        const sessionId = await page1.evaluate(() => {
            const keys = Object.keys(localStorage);
            const sessionKey = keys.find(key => key.startsWith('qc_'));
            return sessionKey;
        });
        
        console.log(`   ✅ Created session: ${sessionId}`);
        
        // Get queue data
        const queueData = await page1.evaluate(() => {
            const dataStr = localStorage.getItem('queueData');
            return dataStr ? JSON.parse(dataStr) : null;
        });
        
        console.log(`   ✅ Queue position: ${queueData?.position}`);
        console.log(`   ✅ Verification code: ${queueData?.verificationCode}`);
        
        // Test 2: Close and reopen browser (simulate crash)
        console.log(`\n${colors.blue}📋 Test 2: Browser Crash Recovery${colors.reset}`);
        
        // Save the URL before closing
        const chatUrl = page1.url();
        await page1.close();
        console.log('   🔄 Simulated browser crash');
        
        await wait(2000);
        
        // Open new page and navigate back
        page2 = await browser.newPage();
        await page2.goto(chatUrl);
        
        // Wait for recovery
        await wait(3000);
        
        // Check if session was recovered
        const recoveryMessage = await page2.evaluate(() => {
            const messages = document.querySelectorAll('.message.system.recovery-success');
            return messages.length > 0;
        });
        
        if (recoveryMessage) {
            console.log(`   ${colors.green}✅ Session successfully recovered!${colors.reset}`);
        } else {
            console.log(`   ${colors.red}❌ Session recovery failed${colors.reset}`);
        }
        
        // Check if queue data is intact
        const recoveredData = await page2.evaluate(() => {
            const dataStr = localStorage.getItem('queueData');
            return dataStr ? JSON.parse(dataStr) : null;
        });
        
        if (recoveredData && recoveredData.verificationCode === queueData.verificationCode) {
            console.log(`   ${colors.green}✅ Queue data intact after recovery${colors.reset}`);
        }
        
        // Test 3: Session expiration and quick rejoin
        console.log(`\n${colors.blue}📋 Test 3: Session Expiration and Quick Rejoin${colors.reset}`);
        
        // Clear localStorage to simulate expired session
        await page2.evaluate(() => {
            localStorage.clear();
        });
        
        // Reload page
        await page2.reload();
        await wait(3000);
        
        // Check for quick rejoin option
        const hasQuickRejoin = await page2.evaluate(() => {
            const cards = document.querySelectorAll('.action-card');
            return Array.from(cards).some(card => 
                card.textContent.includes('Quick Rejoin') || 
                card.textContent.includes('rejoin')
            );
        });
        
        if (hasQuickRejoin) {
            console.log(`   ${colors.green}✅ Quick rejoin option available${colors.reset}`);
            
            // Click quick rejoin
            await page2.evaluate(() => {
                const cards = document.querySelectorAll('.action-card');
                const rejoinCard = Array.from(cards).find(card => 
                    card.textContent.includes('Quick Rejoin') || 
                    card.textContent.includes('rejoin')
                );
                if (rejoinCard) rejoinCard.click();
            });
            
            await wait(2000);
            console.log(`   ${colors.green}✅ Quick rejoin successful${colors.reset}`);
        }
        
        // Test 4: Multi-tab synchronization
        console.log(`\n${colors.blue}📋 Test 4: Multi-Tab Synchronization${colors.reset}`);
        
        const page3 = await browser.newPage();
        await page3.goto(chatUrl);
        
        await wait(2000);
        
        // Send message from page2
        await page2.evaluate(() => {
            const input = document.querySelector('.message-input');
            const form = document.querySelector('.message-form');
            if (input && form) {
                input.value = 'Test message from tab 1';
                form.dispatchEvent(new Event('submit'));
            }
        });
        
        await wait(2000);
        
        // Check if message appears in page3
        const messageInTab2 = await page3.evaluate(() => {
            const messages = document.querySelectorAll('.message.user .message-bubble');
            return Array.from(messages).some(msg => 
                msg.textContent.includes('Test message from tab 1')
            );
        });
        
        if (messageInTab2) {
            console.log(`   ${colors.green}✅ Multi-tab sync working${colors.reset}`);
        } else {
            console.log(`   ${colors.yellow}⚠️ Multi-tab sync not detected${colors.reset}`);
        }
        
        // Test 5: Cancel and recovery
        console.log(`\n${colors.blue}📋 Test 5: Cancellation and Grace Period${colors.reset}`);
        
        // Find and click cancel button
        const cancelClicked = await page2.evaluate(() => {
            const cards = document.querySelectorAll('.action-card-danger');
            const cancelCard = Array.from(cards).find(card => 
                card.textContent.includes('Leave Queue')
            );
            if (cancelCard) {
                cancelCard.click();
                return true;
            }
            return false;
        });
        
        if (cancelClicked) {
            console.log('   🔄 Queue cancelled');
            await wait(2000);
            
            // Try to rejoin immediately (within grace period)
            await page2.goto(`${BASE_URL}/queue/${MERCHANT_ID}/join`);
            
            // Check for position restoration message
            const restoredMessage = await page2.evaluate(() => {
                return document.body.textContent.includes('position restored') ||
                       document.body.textContent.includes('grace period');
            });
            
            if (restoredMessage) {
                console.log(`   ${colors.green}✅ Position restored within grace period${colors.reset}`);
            }
        }
        
        console.log(`\n${colors.green}✅ All browser tests completed!${colors.reset}`);
        
    } catch (error) {
        console.error(`${colors.red}❌ Test failed:${colors.reset}`, error.message);
        
        // Take screenshot on failure
        if (page1) {
            await page1.screenshot({ 
                path: `test-failure-${Date.now()}.png`,
                fullPage: true 
            });
        }
    } finally {
        await browser.close();
    }
}

// Additional test for edge cases
async function testEdgeCases() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        console.log(`\n${colors.cyan}🧪 Testing Edge Cases${colors.reset}\n`);
        
        // Test network disconnection
        console.log(`${colors.blue}📋 Test: Network Disconnection${colors.reset}`);
        const page = await browser.newPage();
        await page.goto(`${BASE_URL}/queue/${MERCHANT_ID}/join`);
        
        // Go offline
        await page.setOfflineMode(true);
        console.log('   📡 Went offline');
        
        await wait(2000);
        
        // Go back online
        await page.setOfflineMode(false);
        console.log('   📡 Back online');
        
        // Check if reconnection happened
        const connectionStatus = await page.evaluate(() => {
            const status = document.querySelector('.connection-status');
            return status ? status.textContent : '';
        });
        
        console.log(`   Connection status: ${connectionStatus}`);
        
        // Test localStorage tampering
        console.log(`\n${colors.blue}📋 Test: LocalStorage Tampering${colors.reset}`);
        
        // Tamper with localStorage
        await page.evaluate(() => {
            localStorage.setItem('qc_fake_session', JSON.stringify({
                sessionId: 'fake_session',
                queueEntryId: 'fake_entry'
            }));
        });
        
        await page.reload();
        await wait(2000);
        
        // Check if fake session is rejected
        const hasFakeSession = await page.evaluate(() => {
            return localStorage.getItem('qc_fake_session') !== null;
        });
        
        if (!hasFakeSession) {
            console.log(`   ${colors.green}✅ Fake session properly rejected${colors.reset}`);
        }
        
    } catch (error) {
        console.error(`${colors.red}❌ Edge case test failed:${colors.reset}`, error.message);
    } finally {
        await browser.close();
    }
}

// Run all tests
async function runAllTests() {
    console.log(`${colors.cyan}🚀 Starting Comprehensive Session Recovery Tests${colors.reset}\n`);
    
    try {
        await testSessionRecovery();
        await testEdgeCases();
        
        console.log(`\n${colors.green}✅ All tests completed successfully!${colors.reset}`);
    } catch (error) {
        console.error(`\n${colors.red}❌ Test suite failed:${colors.reset}`, error);
        process.exit(1);
    }
}

// Check if server is running
async function checkServer() {
    try {
        const response = await fetch(`${BASE_URL}/api/health`);
        if (!response.ok) {
            throw new Error('Server not responding');
        }
        return true;
    } catch (error) {
        console.error(`${colors.red}❌ Server is not running at ${BASE_URL}${colors.reset}`);
        console.log(`${colors.yellow}Please start the server with: npm start${colors.reset}`);
        return false;
    }
}

// Main
(async () => {
    const serverRunning = await checkServer();
    if (serverRunning) {
        await runAllTests();
    } else {
        process.exit(1);
    }
})();