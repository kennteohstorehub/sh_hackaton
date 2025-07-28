const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3838';

async function testQueueStatus() {
    console.log('Testing Queue Status Check\n');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    try {
        // Enable console logging
        page.on('console', msg => {
            console.log(`[${msg.type()}]`, msg.text());
        });
        
        // Monitor network
        page.on('request', request => {
            if (request.url().includes('/api/webchat')) {
                console.log('[REQUEST]', request.method(), request.url());
            }
        });
        
        page.on('response', response => {
            if (response.url().includes('/api/webchat')) {
                console.log('[RESPONSE]', response.status(), response.url());
            }
        });
        
        // Step 1: Join queue
        console.log('1. Joining queue...');
        await page.goto(`${BASE_URL}/queue/join/3ecceb82-fb33-42c8-9d84-19eb69417e16`);
        await page.waitForSelector('#queueForm');
        
        await page.type('#customerName', 'Status Test');
        await page.type('#customerPhone', '0123456789');
        await page.select('#partySize', '2');
        
        await Promise.all([
            page.waitForNavigation(),
            page.click('button[type="submit"]')
        ]);
        
        console.log('✅ Joined queue');
        
        // Wait for messages
        await page.waitForTimeout(3000);
        
        // Step 2: Get session info
        console.log('\n2. Checking session info...');
        const sessionInfo = await page.evaluate(() => {
            if (window.queueChat) {
                return {
                    sessionId: window.queueChat.sessionId,
                    hasQueueData: !!window.queueChat.queueData,
                    queueData: window.queueChat.queueData
                };
            }
            return null;
        });
        
        console.log('Session info:', JSON.stringify(sessionInfo, null, 2));
        
        // Step 3: Click Check Status
        console.log('\n3. Clicking Check Status...');
        const statusButton = await page.$x('//button[contains(text(), "Check Status")]');
        if (statusButton.length > 0) {
            await statusButton[0].click();
        }
        
        // Wait for response
        await page.waitForTimeout(2000);
        
        // Step 4: Check session info again
        console.log('\n4. Checking session info after status check...');
        const afterInfo = await page.evaluate(() => {
            if (window.queueChat) {
                return {
                    sessionId: window.queueChat.sessionId,
                    hasQueueData: !!window.queueChat.queueData,
                    queueData: window.queueChat.queueData
                };
            }
            return null;
        });
        
        console.log('After status check:', JSON.stringify(afterInfo, null, 2));
        
        // Get messages
        const messages = await page.$$eval('.message .message-bubble', els => 
            els.map(el => el.textContent)
        );
        
        console.log('\n5. Messages:');
        messages.slice(-3).forEach((msg, i) => {
            console.log(`   ${msg}`);
        });
        
        console.log('\n✨ Test completed!');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    } finally {
        console.log('\nKeeping browser open for 10 seconds...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        await browser.close();
    }
}

testQueueStatus();