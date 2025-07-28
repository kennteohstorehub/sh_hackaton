const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3838';

async function testUpdatedChat() {
    console.log('Testing Updated Chat Interface\n');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
    
    try {
        const page = await browser.newPage();
        
        // Clear cache and cookies
        await page.setCacheEnabled(false);
        await page.goto('about:blank');
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        
        // Enable console logging
        page.on('console', msg => {
            console.log('PAGE LOG:', msg.type(), '-', msg.text());
        });
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
        
        // Step 1: Go directly to chat page
        console.log('1. Going directly to chat page...');
        await page.goto(`${BASE_URL}/queue-chat.html`, {
            waitUntil: 'networkidle2',
            timeout: 10000
        });
        
        // Step 2: Check if elements are initialized
        console.log('\n2. Checking element initialization...');
        const elementCheck = await page.evaluate(() => {
            if (window.queueChat) {
                return {
                    chatExists: true,
                    elementsInitialized: Object.keys(window.queueChat.elements).length > 0,
                    messagesContainer: !!window.queueChat.elements.messagesContainer,
                    elements: Object.keys(window.queueChat.elements)
                };
            }
            return { chatExists: false };
        });
        
        console.log('Element check:', JSON.stringify(elementCheck, null, 2));
        
        // Step 3: Check for welcome messages
        console.log('\n3. Checking for welcome messages...');
        await page.waitForTimeout(2000);
        
        const messages = await page.$$eval('.message', els => els.length);
        console.log(`Found ${messages} messages`);
        
        if (messages > 0) {
            const messageTexts = await page.$$eval('.message .message-bubble', els => 
                els.map(el => el.textContent)
            );
            console.log('Messages:');
            messageTexts.forEach((msg, i) => {
                console.log(`  ${i + 1}. ${msg}`);
            });
        }
        
        // Step 4: Try joining queue via form
        console.log('\n4. Joining queue via form...');
        await page.goto(`${BASE_URL}/queue/join/3ecceb82-fb33-42c8-9d84-19eb69417e16`);
        await page.waitForSelector('#queueForm');
        
        await page.type('#customerName', 'Cache Test User');
        await page.type('#customerPhone', '0123456789');
        await page.select('#partySize', '2');
        
        await Promise.all([
            page.waitForNavigation(),
            page.click('button[type="submit"]')
        ]);
        
        console.log('✅ Successfully joined queue');
        
        // Step 5: Check messages after joining
        console.log('\n5. Checking messages after joining...');
        await page.waitForTimeout(3000);
        
        const afterJoinMessages = await page.$$eval('.message', els => els.length);
        console.log(`Found ${afterJoinMessages} messages after joining`);
        
        if (afterJoinMessages > 0) {
            const messageTexts = await page.$$eval('.message .message-bubble', els => 
                els.map(el => el.textContent)
            );
            console.log('Messages:');
            messageTexts.forEach((msg, i) => {
                console.log(`  ${i + 1}. ${msg}`);
            });
        }
        
        // Step 6: Check script version
        console.log('\n6. Checking script version...');
        const scriptSrc = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script'));
            const queueScript = scripts.find(s => s.src && s.src.includes('queue-chat.js'));
            return queueScript ? queueScript.src : 'Not found';
        });
        console.log('Queue chat script src:', scriptSrc);
        
        console.log('\n✨ Test completed!');
        
    } catch (error) {
        console.error('\n❌ Test failed!');
        console.error('Error:', error.message);
        
        await page.screenshot({ path: 'updated-chat-error.png', fullPage: true });
        console.log('📸 Screenshot saved as updated-chat-error.png');
    } finally {
        console.log('\nClosing browser in 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        await browser.close();
    }
}

// Run the test
testUpdatedChat();