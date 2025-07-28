const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3838';

async function testChatMessages() {
    console.log('Testing Chat Messages and Verification Code\n');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Enable console logging
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('PAGE ERROR:', msg.text());
            }
        });
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
        
        // Step 1: Join queue
        console.log('1. Joining queue...');
        await page.goto(`${BASE_URL}/queue/join/3ecceb82-fb33-42c8-9d84-19eb69417e16`);
        await page.waitForSelector('#queueForm', { timeout: 5000 });
        
        await page.type('#customerName', 'Message Test User');
        await page.type('#customerPhone', '0123456789');
        await page.select('#partySize', '3');
        
        await Promise.all([
            page.waitForNavigation(),
            page.click('button[type="submit"]')
        ]);
        
        console.log('✅ Successfully joined queue');
        
        // Step 2: Wait for chat page to load
        console.log('\n2. Waiting for chat interface...');
        await page.waitForSelector('#messagesContainer', { timeout: 5000 });
        
        // Wait for messages to appear
        await page.waitForTimeout(3500); // Wait for all timed messages
        
        // Step 3: Check welcome messages
        console.log('\n3. Checking welcome messages...');
        const messages = await page.$$eval('.message.bot .message-bubble', els => 
            els.map(el => el.textContent)
        );
        
        console.log(`Found ${messages.length} bot messages:`);
        messages.forEach((msg, i) => {
            console.log(`\n   Message ${i + 1}:`);
            console.log(`   ${msg}`);
        });
        
        // Step 4: Check verification code in header
        console.log('\n4. Checking verification code display...');
        const hasVerifyDisplay = await page.$('#verificationDisplay') !== null;
        console.log(`   Verification display element: ${hasVerifyDisplay ? 'Found' : 'Not found'}`);
        
        if (hasVerifyDisplay) {
            const isVisible = await page.$eval('#verificationDisplay', el => {
                return window.getComputedStyle(el).display !== 'none';
            });
            console.log(`   Verification display visible: ${isVisible}`);
            
            if (isVisible) {
                const code = await page.$eval('#headerVerifyCode', el => el.textContent);
                console.log(`   Verification code: ${code}`);
            }
        }
        
        // Step 5: Test Check Status button
        console.log('\n5. Testing Check Status button...');
        
        // Check if queueChat is available
        const hasQueueChat = await page.evaluate(() => {
            return typeof window.queueChat !== 'undefined';
        });
        console.log(`   window.queueChat available: ${hasQueueChat}`);
        
        // Count messages before
        const beforeCount = await page.$$eval('.message', els => els.length);
        
        // Click Check Status
        const statusButton = await page.$x('//button[contains(text(), "Check Status")]');
        if (statusButton.length > 0) {
            await statusButton[0].click();
        } else {
            console.log('   ❌ Check Status button not found');
        }
        
        // Wait for new message
        await page.waitForFunction(
            count => document.querySelectorAll('.message').length > count,
            { timeout: 5000 },
            beforeCount
        ).catch(() => console.log('   No new message after 5 seconds'));
        
        // Get updated messages
        const allMessages = await page.$$eval('.message .message-bubble', els => 
            els.map(el => el.textContent)
        );
        
        const statusMessage = allMessages.find(msg => msg.includes('Current Status'));
        if (statusMessage) {
            console.log('   ✅ Status message received:');
            console.log(`   ${statusMessage}`);
        } else {
            console.log('   ❌ No status message found');
        }
        
        // Step 6: Check queue data
        console.log('\n6. Checking queue data...');
        const queueData = await page.evaluate(() => {
            if (window.queueChat && window.queueChat.queueData) {
                return {
                    hasData: true,
                    position: window.queueChat.queueData.position,
                    waitTime: window.queueChat.queueData.estimatedWait,
                    verificationCode: window.queueChat.queueData.verificationCode
                };
            }
            return { hasData: false };
        });
        
        console.log('   Queue data:', JSON.stringify(queueData, null, 2));
        
        console.log('\n✨ Test completed!');
        
    } catch (error) {
        console.error('\n❌ Test failed!');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        await page.screenshot({ path: 'chat-error.png', fullPage: true });
        console.log('📸 Screenshot saved as chat-error.png');
    } finally {
        console.log('\nClosing browser in 5 seconds...');
        await page.waitForTimeout(5000);
        await browser.close();
    }
}

// Run the test
testChatMessages();