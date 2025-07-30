// Test the complete webchat flow with detailed logging
const puppeteer = require('puppeteer');

async function testWebchatFlow() {
    console.log('🧪 Testing Complete Webchat Flow');
    console.log('=====================================\n');
    
    const browser = await puppeteer.launch({ 
        headless: false, // Show browser for debugging
        devtools: true   // Open DevTools automatically
    });
    const page = await browser.newPage();
    
    // Log console messages from the page
    page.on('console', msg => {
        console.log(`📱 [Browser Console] ${msg.type()}: ${msg.text()}`);
    });
    
    // Log any page errors
    page.on('pageerror', error => {
        console.error('❌ [Page Error]:', error.message);
    });
    
    try {
        // 1. Navigate to queue info page
        console.log('1️⃣ Navigating to queue page...');
        await page.goto('http://localhost:3838/queue/453b1b29-7d3b-4c0e-92d6-d86cc9952f8e', {
            waitUntil: 'networkidle2'
        });
        
        // 2. Fill out the join queue form
        console.log('\n2️⃣ Filling out queue join form...');
        const testCustomer = {
            name: 'Test Customer ' + Date.now(),
            phone: '0123456789',
            partySize: '2',
            specialRequests: 'Testing webchat notifications'
        };
        
        await page.type('#customerName', testCustomer.name);
        await page.type('#customerPhone', testCustomer.phone);
        await page.select('#partySize', testCustomer.partySize);
        await page.type('#specialRequests', testCustomer.specialRequests);
        
        console.log('Customer details:', testCustomer);
        
        // 3. Submit the form
        console.log('\n3️⃣ Submitting form...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('#joinBtn')
        ]);
        
        // 4. Check if we're redirected to queue-chat
        const currentUrl = page.url();
        console.log('\n4️⃣ Current URL:', currentUrl);
        
        if (!currentUrl.includes('/queue-chat/')) {
            console.error('❌ Not redirected to queue chat!');
            return;
        }
        
        console.log('✅ Successfully redirected to queue chat');
        
        // 5. Wait for chat to load and check for welcome message
        console.log('\n5️⃣ Waiting for chat to initialize...');
        await page.waitForTimeout(3000); // Give time for messages to appear
        
        // Check sessionStorage and localStorage
        const storageData = await page.evaluate(() => {
            return {
                sessionStorage: {
                    queueInfo: sessionStorage.getItem('queueInfo'),
                    queueJoined: sessionStorage.getItem('queueJoined')
                },
                localStorage: {
                    queueData: localStorage.getItem('queueData'),
                    sessionId: localStorage.getItem('queueChatSessionId')
                }
            };
        });
        
        console.log('\n📦 Storage Data:');
        console.log('SessionStorage:', JSON.stringify(storageData.sessionStorage, null, 2));
        console.log('LocalStorage:', JSON.stringify(storageData.localStorage, null, 2));
        
        // Parse queue data to check contents
        if (storageData.localStorage.queueData) {
            const queueData = JSON.parse(storageData.localStorage.queueData);
            console.log('\n📋 Queue Data Contents:');
            console.log('- Entry ID:', queueData.entryId);
            console.log('- Customer ID:', queueData.customerId);
            console.log('- Position:', queueData.position);
            console.log('- Verification Code:', queueData.verificationCode);
            console.log('- Session ID:', queueData.sessionId);
        }
        
        // Check for verification code display
        const verificationDisplay = await page.$eval('#verificationDisplay', el => {
            return {
                displayed: el.style.display !== 'none',
                code: document.getElementById('headerVerifyCode')?.textContent || 'Not found'
            };
        }).catch(() => ({ displayed: false, code: 'Element not found' }));
        
        console.log('\n🎫 Verification Code Display:');
        console.log('- Displayed:', verificationDisplay.displayed);
        console.log('- Code:', verificationDisplay.code);
        
        // Check for messages in chat
        const messages = await page.$$eval('.message', elements => {
            return elements.map(el => ({
                type: el.classList.contains('bot') ? 'bot' : 
                      el.classList.contains('user') ? 'user' : 'system',
                text: el.querySelector('.message-text')?.textContent || ''
            }));
        });
        
        console.log('\n💬 Chat Messages:');
        messages.forEach((msg, i) => {
            console.log(`${i + 1}. [${msg.type}] ${msg.text.substring(0, 100)}...`);
        });
        
        // 6. Test Socket.IO connection
        const socketStatus = await page.$eval('#connectionStatus', el => el.textContent);
        console.log('\n🔌 Socket.IO Status:', socketStatus);
        
        console.log('\n✅ Test completed! Check the browser window for the chat interface.');
        console.log('Leave the browser open to test receiving notifications from the merchant dashboard.');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        await browser.close();
    }
    
    // Don't close browser so we can test notifications
}

// Run the test
testWebchatFlow().catch(console.error);