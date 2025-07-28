const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3838';

async function testSimpleChat() {
    console.log('Testing Chat Interface with Fresh Load\n');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    try {
        // Disable cache
        await page.setCacheEnabled(false);
        
        // Enable console logging
        page.on('console', msg => {
            console.log('BROWSER:', msg.text());
        });
        
        // Step 1: Join queue first
        console.log('1. Joining queue...');
        await page.goto(`${BASE_URL}/queue/join/3ecceb82-fb33-42c8-9d84-19eb69417e16`);
        await page.waitForSelector('#queueForm');
        
        await page.type('#customerName', 'Test User');
        await page.type('#customerPhone', '0123456789');
        await page.select('#partySize', '2');
        
        await Promise.all([
            page.waitForNavigation(),
            page.click('button[type="submit"]')
        ]);
        
        console.log('✅ Redirected to:', page.url());
        
        // Step 2: Wait and check
        console.log('\n2. Waiting for page to fully load...');
        await page.waitForTimeout(5000);
        
        // Step 3: Check what's on the page
        console.log('\n3. Checking page content...');
        
        // Check if messages container exists
        const hasMessagesContainer = await page.$('#messagesContainer') !== null;
        console.log('Messages container exists:', hasMessagesContainer);
        
        // Check for messages
        const messageCount = await page.$$eval('.message', els => els.length);
        console.log('Number of messages:', messageCount);
        
        // Get all message texts
        if (messageCount > 0) {
            const messages = await page.$$eval('.message .message-bubble', els => 
                els.map(el => el.textContent)
            );
            console.log('\nMessages found:');
            messages.forEach((msg, i) => {
                console.log(`${i + 1}. ${msg}`);
            });
        }
        
        // Check verification code
        const verifyCodeVisible = await page.evaluate(() => {
            const el = document.getElementById('verificationDisplay');
            return el && window.getComputedStyle(el).display !== 'none';
        });
        
        if (verifyCodeVisible) {
            const code = await page.$eval('#headerVerifyCode', el => el.textContent);
            console.log('\nVerification code:', code);
        }
        
        // Take screenshot
        await page.screenshot({ path: 'chat-test-result.png', fullPage: true });
        console.log('\n📸 Screenshot saved as chat-test-result.png');
        
        console.log('\n✨ Test completed!');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        await page.screenshot({ path: 'chat-test-error.png', fullPage: true });
    } finally {
        await new Promise(resolve => setTimeout(resolve, 5000));
        await browser.close();
    }
}

testSimpleChat();