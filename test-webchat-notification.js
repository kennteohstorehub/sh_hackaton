const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3838';
const MERCHANT_ID = '3ecceb82-fb33-42c8-9d84-19eb69417e16';

async function testWebchatNotification() {
    console.log('=== Testing WebChat Notification Flow ===\n');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
        if (msg.type() === 'log' || msg.type() === 'info') {
            console.log(`[Browser ${msg.type()}]`, msg.text());
        }
    });
    
    try {
        // Step 1: Join queue as webchat customer
        console.log('1. Joining queue as webchat customer...');
        await page.goto(`${BASE_URL}/queue/join/${MERCHANT_ID}`);
        await page.waitForSelector('#queueForm');
        
        await page.type('#customerName', 'Test WebChat User');
        await page.type('#customerPhone', '0123456789');
        await page.select('#partySize', '2');
        await page.type('#specialRequests', 'Testing notification system');
        
        await Promise.all([
            page.waitForNavigation(),
            page.click('button[type="submit"]')
        ]);
        
        console.log('✅ Joined queue and redirected to chat');
        
        // Wait for messages to load
        await page.waitForTimeout(3000);
        
        // Get session info
        const sessionInfo = await page.evaluate(() => {
            if (window.queueChat) {
                return {
                    sessionId: window.queueChat.sessionId,
                    queueData: window.queueChat.queueData,
                    socketConnected: window.queueChat.socket?.connected
                };
            }
            return null;
        });
        
        console.log('\n2. Session Info:');
        console.log('SessionId:', sessionInfo?.sessionId);
        console.log('CustomerId:', sessionInfo?.queueData?.customerId);
        console.log('Socket Connected:', sessionInfo?.socketConnected);
        console.log('Queue Entry ID:', sessionInfo?.queueData?.entryId);
        
        // Step 3: Call the customer via API
        console.log('\n3. Calling customer via API...');
        const queueId = '5a9afc58-3636-4fd4-b40d-d5a6581b0426'; // Demo queue ID
        const customerId = sessionInfo?.queueData?.entryId;
        
        if (customerId) {
            const response = await fetch(`${BASE_URL}/api/queue/${queueId}/call-specific`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId })
            });
            
            const result = await response.json();
            console.log('API Response:', result.success ? 'Success' : result.error);
            
            if (result.success) {
                console.log('Verification Code:', result.customer.verificationCode);
            }
        }
        
        // Wait for notification to appear
        console.log('\n4. Waiting for notification...');
        await page.waitForTimeout(5000);
        
        // Check for notification message
        const messages = await page.$$eval('.message .message-bubble', els => 
            els.map(el => el.textContent)
        );
        
        console.log('\n5. Chat Messages:');
        messages.forEach((msg, i) => {
            if (msg.includes('YOUR TURN')) {
                console.log(`✅ NOTIFICATION RECEIVED: ${msg}`);
            }
        });
        
        console.log('\n✨ Test completed! Check the browser window.');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    } finally {
        console.log('\nKeeping browser open for manual inspection...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        await browser.close();
    }
}

testWebchatNotification();