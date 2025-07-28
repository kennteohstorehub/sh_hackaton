const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3838';
const MERCHANT_ID = '3ecceb82-fb33-42c8-9d84-19eb69417e16';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testCustomerFlow() {
    console.log('=== WebChat Customer Flow Test ===\n');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 400, height: 800 }  // Mobile viewport
    });
    
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
        const text = msg.text();
        if (!text.includes('instrument.js') && !text.includes('Failed to load resource')) {
            console.log(`[Browser]`, text);
        }
    });
    
    try {
        // Step 1: Join Queue
        console.log('1. Joining queue...');
        await page.goto(`${BASE_URL}/queue/join/${MERCHANT_ID}`);
        await page.waitForSelector('#queueForm');
        
        const testName = `Test User ${Date.now().toString().slice(-4)}`;
        await page.type('#customerName', testName);
        await page.type('#customerPhone', '0123456789');
        await page.select('#partySize', '2');
        await page.type('#specialRequests', 'Testing queue system');
        
        // Submit form
        await Promise.all([
            page.waitForNavigation(),
            page.click('button[type="submit"]')
        ]);
        
        console.log('✅ Joined queue successfully');
        
        // Wait for chat to load and messages to appear
        await page.waitForSelector('#messagesContainer');
        await sleep(4000);  // Wait for welcome messages
        
        // Get queue info
        const queueInfo = await page.evaluate(() => {
            if (window.queueChat && window.queueChat.queueData) {
                return {
                    sessionId: window.queueChat.sessionId,
                    queueNumber: window.queueChat.queueData.queueNumber,
                    position: window.queueChat.queueData.position,
                    verificationCode: window.queueChat.queueData.verificationCode,
                    estimatedWait: window.queueChat.queueData.estimatedWait
                };
            }
            return null;
        });
        
        console.log('\n📋 Queue Information:');
        console.log(`   Queue Number: ${queueInfo?.queueNumber}`);
        console.log(`   Position: #${queueInfo?.position}`);
        console.log(`   Verification Code: ${queueInfo?.verificationCode}`);
        console.log(`   Estimated Wait: ${queueInfo?.estimatedWait} minutes`);
        console.log(`   Session ID: ${queueInfo?.sessionId}`);
        
        // Step 2: Test Status Check
        console.log('\n2. Testing status check...');
        
        // Find and click "Check Status" button
        const checkStatusBtn = await page.$x('//button[contains(text(), "Check Status")]');
        if (checkStatusBtn.length > 0) {
            await checkStatusBtn[0].click();
            await sleep(3000);
            
            // Get the latest message
            const statusMessage = await page.evaluate(() => {
                const messages = Array.from(document.querySelectorAll('.message-bubble'));
                const statusMsg = messages.reverse().find(msg => 
                    msg.textContent.includes('Current Status:') || 
                    msg.textContent.includes('Position:')
                );
                return statusMsg ? statusMsg.textContent : null;
            });
            
            if (statusMessage) {
                console.log('✅ Status check successful');
                console.log('   Response:', statusMessage.split('\n')[0]);
            } else {
                console.log('❌ No status message received');
            }
        }
        
        // Step 3: Send a message
        console.log('\n3. Testing message sending...');
        const messageInput = await page.$('#messageInput');
        if (messageInput) {
            await messageInput.type('What is my wait time?');
            await page.keyboard.press('Enter');
            await sleep(2000);
            
            console.log('✅ Message sent successfully');
        }
        
        // Step 4: Test Cancel Flow
        console.log('\n4. Testing cancellation flow...');
        
        // Click "Cancel Queue" button
        const cancelBtn = await page.$x('//button[contains(text(), "Cancel Queue")]');
        if (cancelBtn.length > 0) {
            await cancelBtn[0].click();
            await sleep(2000);
            
            // Check for confirmation message
            const confirmMessage = await page.evaluate(() => {
                const messages = Array.from(document.querySelectorAll('.message-bubble'));
                return messages.some(msg => msg.textContent.includes('Are you sure you want to cancel'));
            });
            
            if (confirmMessage) {
                console.log('✅ Cancellation confirmation received');
                
                // Type YES to confirm
                await page.type('#messageInput', 'YES');
                await page.keyboard.press('Enter');
                await sleep(3000);
                
                // Check for cancellation success
                const cancelSuccess = await page.evaluate(() => {
                    const messages = Array.from(document.querySelectorAll('.message-bubble'));
                    return messages.some(msg => msg.textContent.includes('successfully removed from the queue'));
                });
                
                console.log(cancelSuccess ? '✅ Queue cancelled successfully' : '❌ Cancellation failed');
            }
        }
        
        // Step 5: Verify status after cancellation
        console.log('\n5. Verifying status after cancellation...');
        
        const checkStatusBtn2 = await page.$x('//button[contains(text(), "Check Status")]');
        if (checkStatusBtn2.length > 0) {
            await checkStatusBtn2[0].click();
            await sleep(2000);
            
            const notInQueueMsg = await page.evaluate(() => {
                const messages = Array.from(document.querySelectorAll('.message-bubble'));
                return messages.some(msg => 
                    msg.textContent.includes('not currently in any queue') ||
                    msg.textContent.includes('Would you like to join')
                );
            });
            
            console.log(notInQueueMsg ? '✅ Correctly shows not in queue' : '❌ Still showing in queue');
        }
        
        // Get all messages for debugging
        console.log('\n📝 Chat History:');
        const allMessages = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.message-bubble'))
                .map(msg => ({
                    text: msg.textContent.substring(0, 100),
                    sender: msg.closest('.message').classList.contains('user') ? 'User' : 'Bot'
                }));
        });
        
        allMessages.slice(-10).forEach(msg => {
            console.log(`   [${msg.sender}] ${msg.text}...`);
        });
        
        console.log('\n✨ Customer Flow Test Completed!');
        
    } catch (error) {
        console.error('\n❌ Test Error:', error.message);
        
        // Take screenshot on error
        await page.screenshot({ path: 'test-error.png', fullPage: true });
        console.log('Screenshot saved as test-error.png');
    } finally {
        console.log('\nBrowser will remain open for 20 seconds for inspection...');
        await sleep(20000);
        await browser.close();
    }
}

// Run the test
testCustomerFlow();