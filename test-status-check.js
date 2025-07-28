const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3838';

async function testStatusCheck() {
    console.log('Testing Queue Status Check Functionality\n');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        devtools: true
    });
    
    try {
        const page = await browser.newPage();
        
        // Enable console logging and network monitoring
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
        
        // Monitor network requests
        page.on('request', request => {
            if (request.url().includes('/api/webchat/status')) {
                console.log('API Request:', request.method(), request.url());
            }
        });
        
        page.on('response', response => {
            if (response.url().includes('/api/webchat/status')) {
                console.log('API Response:', response.status(), response.url());
                response.json().then(data => {
                    console.log('Response data:', JSON.stringify(data, null, 2));
                }).catch(() => {});
            }
        });
        
        // Step 1: Join queue
        console.log('1. Joining queue...');
        await page.goto(`${BASE_URL}/queue/join/3ecceb82-fb33-42c8-9d84-19eb69417e16`);
        await page.waitForSelector('#queueForm');
        
        await page.type('#customerName', 'Status Test User');
        await page.type('#customerPhone', '0123456789');
        await page.select('#partySize', '1');
        
        await Promise.all([
            page.waitForNavigation(),
            page.click('button[type="submit"]')
        ]);
        
        console.log('✅ Successfully joined queue and redirected to chat');
        
        // Wait for initial messages
        await page.waitForTimeout(3000);
        
        // Step 2: Check queue data in browser
        console.log('\n2. Checking browser state...');
        const browserState = await page.evaluate(() => {
            const chat = window.queueChat;
            return {
                hasQueueData: !!chat.queueData,
                sessionId: chat.sessionId,
                queueData: chat.queueData
            };
        });
        
        console.log('Browser state:', JSON.stringify(browserState, null, 2));
        
        // Step 3: Click status button
        console.log('\n3. Clicking status check button...');
        await page.click('button[onclick*="status"]');
        
        // Wait for response
        await page.waitForTimeout(2000);
        
        // Get all messages
        const messages = await page.$$eval('.message .message-bubble', els => 
            els.map(el => el.textContent)
        );
        
        console.log('\n4. All messages:');
        messages.forEach((msg, i) => {
            console.log(`   ${i + 1}. ${msg}`);
        });
        
        // Check if status message appeared
        const statusMessage = messages.find(msg => msg.includes('Current Status'));
        if (statusMessage) {
            console.log('\n✅ Status check successful!');
        } else {
            console.log('\n❌ Status message not found');
            
            // Take screenshot
            await page.screenshot({ path: 'status-check-error.png', fullPage: true });
            console.log('📸 Screenshot saved as status-check-error.png');
        }
        
    } catch (error) {
        console.error('\n❌ Test failed!');
        console.error('Error:', error.message);
    } finally {
        console.log('\nTest completed. Browser will close in 5 seconds...');
        await page.waitForTimeout(5000);
        await browser.close();
    }
}

// Run the test
testStatusCheck();