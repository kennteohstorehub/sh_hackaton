// Test the chat interface after joining queue
const puppeteer = require('puppeteer');
const io = require('socket.io-client');

async function testChatInterface() {
    console.log('🧪 Testing Chat Interface');
    console.log('=====================================\n');
    
    // First join queue via API
    const fetch = require('node-fetch');
    const testData = {
        name: 'Test Customer ' + Date.now(),
        phone: '+60' + Math.floor(100000000 + Math.random() * 900000000),
        partySize: 2,
        specialRequests: 'Testing webchat'
    };
    
    console.log('1️⃣ Joining queue via API...');
    const joinResponse = await fetch('http://localhost:3838/api/customer/join/453b1b29-7d3b-4c0e-92d6-d86cc9952f8e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
    });
    
    const joinResult = await joinResponse.json();
    if (!joinResult.success) {
        console.error('Failed to join queue:', joinResult);
        return;
    }
    
    console.log('✅ Joined successfully!');
    console.log('- Entry ID:', joinResult.entryId);
    console.log('- Session ID:', joinResult.customer.sessionId);
    console.log('- Verification Code:', joinResult.customer.verificationCode);
    
    // Now open the chat interface
    const browser = await puppeteer.launch({ 
        headless: false,
        devtools: true
    });
    const page = await browser.newPage();
    
    // Log console messages
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[QUEUE]') || text.includes('[SOCKET]') || text.includes('[DISPLAY]')) {
            console.log(`📱 ${text}`);
        }
    });
    
    console.log('\n2️⃣ Opening chat interface...');
    const chatUrl = `http://localhost:3838${joinResult.chatUrl}`;
    await page.goto(chatUrl, { waitUntil: 'networkidle2' });
    
    // Wait a bit for initialization
    await page.waitForTimeout(3000);
    
    // Check what's in storage
    console.log('\n3️⃣ Checking storage...');
    const storageData = await page.evaluate(() => {
        return {
            sessionStorage: Object.keys(sessionStorage).reduce((acc, key) => {
                acc[key] = sessionStorage.getItem(key);
                return acc;
            }, {}),
            localStorage: {
                queueData: localStorage.getItem('queueData'),
                sessionId: localStorage.getItem('queueChatSessionId')
            }
        };
    });
    
    console.log('Storage contents:', JSON.stringify(storageData, null, 2));
    
    // Check verification code display
    console.log('\n4️⃣ Checking verification code display...');
    const verificationInfo = await page.evaluate(() => {
        const display = document.getElementById('verificationDisplay');
        const code = document.getElementById('headerVerifyCode');
        return {
            displayElement: !!display,
            codeElement: !!code,
            isVisible: display ? display.style.display !== 'none' : false,
            codeText: code ? code.textContent : null
        };
    });
    
    console.log('Verification display:', verificationInfo);
    
    // Check messages
    console.log('\n5️⃣ Checking chat messages...');
    const messages = await page.$$eval('.message', elements => {
        return elements.map(el => {
            const textEl = el.querySelector('.message-text');
            return {
                type: el.classList.contains('bot') ? 'bot' : 
                      el.classList.contains('user') ? 'user' : 'system',
                text: textEl ? textEl.textContent : 'No text found'
            };
        });
    });
    
    console.log('Messages found:', messages.length);
    messages.forEach((msg, i) => {
        console.log(`  ${i + 1}. [${msg.type}] ${msg.text.substring(0, 80)}...`);
    });
    
    // Test sending a message
    console.log('\n6️⃣ Testing message send...');
    await page.type('#messageInput', 'status');
    await page.click('#sendButton');
    
    await page.waitForTimeout(2000);
    
    // Now test notification from merchant
    console.log('\n7️⃣ Simulating merchant notification...');
    console.log('Entry ID to notify:', joinResult.entryId);
    
    const notifyResponse = await fetch('http://localhost:3838/api/queue/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            queueId: '453b1b29-7d3b-4c0e-92d6-d86cc9952f8e',
            customerId: joinResult.customer.customerId,
            entryId: joinResult.entryId
        })
    });
    
    if (notifyResponse.ok) {
        console.log('✅ Notification sent from merchant!');
        console.log('Check the browser to see if notification was received.');
    } else {
        console.log('❌ Failed to send notification:', await notifyResponse.text());
    }
    
    console.log('\n✅ Test completed! Check the browser window.');
    console.log('The chat interface should show:');
    console.log('- Welcome message');
    console.log('- Verification code in header');
    console.log('- Status response');
    console.log('- Notification (if working correctly)');
}

testChatInterface().catch(console.error);