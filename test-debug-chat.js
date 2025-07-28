const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3838';

async function testDebugChat() {
    console.log('Testing Chat with Debug Info\n');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    try {
        // Enable all console logging
        page.on('console', msg => {
            console.log(`[${msg.type()}]`, msg.text());
        });
        
        page.on('pageerror', error => {
            console.log('[PAGE ERROR]', error.message);
        });
        
        page.on('error', error => {
            console.log('[ERROR]', error.message);
        });
        
        // Step 1: Go directly to chat page (no queue join)
        console.log('1. Loading chat page directly...');
        await page.goto(`${BASE_URL}/queue-chat.html`, {
            waitUntil: 'networkidle2'
        });
        
        // Wait a bit
        await page.waitForTimeout(2000);
        
        // Step 2: Check JavaScript execution
        console.log('\n2. Checking JavaScript execution...');
        const jsInfo = await page.evaluate(() => {
            return {
                hasQueueChat: typeof window.queueChat !== 'undefined',
                queueChatType: typeof window.queueChat,
                DOMLoaded: document.readyState,
                scripts: Array.from(document.scripts).map(s => ({
                    src: s.src || 'inline',
                    loaded: !s.src || s.readyState === 'complete' || s.readyState === undefined
                }))
            };
        });
        
        console.log('JavaScript info:', JSON.stringify(jsInfo, null, 2));
        
        // Step 3: Try to manually initialize if needed
        if (!jsInfo.hasQueueChat) {
            console.log('\n3. QueueChat not found, checking for errors...');
            
            // Check if QueueChat class exists
            const classExists = await page.evaluate(() => {
                return typeof QueueChat !== 'undefined';
            });
            console.log('QueueChat class exists:', classExists);
            
            // Try to create instance manually
            if (classExists) {
                await page.evaluate(() => {
                    window.queueChat = new QueueChat();
                });
                console.log('Manually created QueueChat instance');
            }
        }
        
        // Step 4: Check for messages
        console.log('\n4. Checking for messages...');
        const messageInfo = await page.evaluate(() => {
            const container = document.getElementById('messagesContainer');
            return {
                containerExists: !!container,
                messageCount: container ? container.children.length : 0,
                containerHTML: container ? container.innerHTML.substring(0, 200) : 'N/A'
            };
        });
        
        console.log('Message info:', JSON.stringify(messageInfo, null, 2));
        
        // Step 5: Try calling showWelcomeMessage directly
        console.log('\n5. Trying to show welcome message directly...');
        const welcomeResult = await page.evaluate(() => {
            if (window.queueChat && typeof window.queueChat.showWelcomeMessage === 'function') {
                window.queueChat.showWelcomeMessage();
                return 'Called showWelcomeMessage';
            }
            return 'QueueChat or method not available';
        });
        console.log('Welcome result:', welcomeResult);
        
        // Wait and check again
        await page.waitForTimeout(1000);
        
        const finalMessageCount = await page.$$eval('.message', els => els.length);
        console.log('\nFinal message count:', finalMessageCount);
        
        // Take screenshot
        await page.screenshot({ path: 'debug-chat.png', fullPage: true });
        console.log('\n📸 Screenshot saved as debug-chat.png');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        console.log('\nKeeping browser open for inspection...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        await browser.close();
    }
}

testDebugChat();