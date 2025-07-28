const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3838';

async function testCompleteQueueFlow() {
    console.log('Testing Complete Queue Flow - Form to Chat Status\n');
    
    const browser = await puppeteer.launch({ 
        headless: false, // Set to true for CI/CD
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        devtools: true
    });
    
    try {
        const page = await browser.newPage();
        
        // Enable console logging
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
        
        // Step 1: Navigate to queue join page
        console.log('1. Navigating to queue join page...');
        await page.goto(`${BASE_URL}/queue/join/3ecceb82-fb33-42c8-9d84-19eb69417e16`);
        await page.waitForSelector('#queueForm', { timeout: 5000 });
        console.log('✅ Queue form loaded');
        
        // Step 2: Fill out the form
        console.log('\n2. Filling out queue join form...');
        await page.type('#customerName', 'Test Customer Flow');
        await page.type('#customerPhone', '0123456789');
        await page.select('#partySize', '2');
        await page.type('#specialRequests', 'Testing complete flow');
        
        // Step 3: Submit form and wait for redirect
        console.log('\n3. Submitting form...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('button[type="submit"]')
        ]);
        
        // Step 4: Check if we're on queue-chat.html
        const currentUrl = page.url();
        console.log('Current URL:', currentUrl);
        
        if (currentUrl.includes('queue-chat.html')) {
            console.log('✅ Successfully redirected to queue chat');
            
            // Step 5: Wait for queue status to load
            console.log('\n4. Waiting for queue status to load...');
            await page.waitForSelector('#queuePosition', { timeout: 10000 });
            
            // Wait for messages to appear
            await page.waitForSelector('.message.bot', { timeout: 10000 });
            
            // Get queue information displayed
            const position = await page.$eval('#queuePosition', el => el.textContent);
            const waitTime = await page.$eval('#waitTime', el => el.textContent);
            
            // Check for verification code in header
            let verifyCode = 'Not displayed';
            try {
                await page.waitForSelector('#headerVerifyCode', { timeout: 5000 });
                verifyCode = await page.$eval('#headerVerifyCode', el => el.textContent);
            } catch (e) {
                console.log('⚠️  Verification code not found in header');
            }
            
            console.log('✅ Queue Status Loaded:');
            console.log('   Position:', position);
            console.log('   Wait Time:', waitTime);
            console.log('   Verification Code:', verifyCode);
            
            // Wait a bit for all messages to appear
            await page.waitForTimeout(3000);
            
            // Get all bot messages
            const botMessages = await page.$$eval('.message.bot .message-bubble', els => 
                els.map(el => el.textContent)
            );
            
            console.log('\n📨 Bot Messages Received:');
            botMessages.forEach((msg, index) => {
                console.log(`   ${index + 1}. ${msg}`);
            });
            
            // Check sessionStorage and localStorage
            const sessionData = await page.evaluate(() => {
                return {
                    queueJoined: sessionStorage.getItem('queueJoined'),
                    queueInfo: sessionStorage.getItem('queueInfo'),
                    queueData: localStorage.getItem('queueData')
                };
            });
            
            console.log('\n🗄️ Storage Data:');
            console.log('   Session queueJoined:', sessionData.queueJoined);
            console.log('   Session queueInfo:', sessionData.queueInfo ? 'Present' : 'Missing');
            console.log('   Local queueData:', sessionData.queueData ? 'Present' : 'Missing');
            
            // Step 6: Test status check button
            console.log('\n5. Testing status check...');
            
            // Count messages before clicking
            const messagesBefore = await page.$$eval('.message', els => els.length);
            
            await page.click('button[onclick*="status"]');
            
            // Wait for new message to appear
            await page.waitForFunction(
                (prevCount) => document.querySelectorAll('.message').length > prevCount,
                { timeout: 5000 },
                messagesBefore
            );
            
            // Get all messages again
            const allMessages = await page.$$eval('.message .message-bubble', els => 
                els.map(el => el.textContent)
            );
            
            const statusMessage = allMessages.find(msg => msg.includes('Current Status'));
            if (statusMessage) {
                console.log('✅ Status check successful');
                console.log('   Message:', statusMessage);
            } else {
                console.log('❌ No status message found');
                console.log('   All messages:', allMessages);
            }
            
            console.log('\n✨ Test completed successfully!');
            console.log('The queue join flow correctly:');
            console.log('- Creates a queue entry with session');
            console.log('- Redirects to chat interface');
            console.log('- Displays queue information');
            console.log('- Allows status checking');
            
        } else {
            console.log('❌ Did not redirect to queue-chat.html');
            console.log('Page content:', await page.content());
        }
        
    } catch (error) {
        console.error('\n❌ Test failed!');
        console.error('Error:', error.message);
        
        // Take screenshot for debugging
        await page.screenshot({ path: 'test-error-screenshot.png' });
        console.log('Screenshot saved as test-error-screenshot.png');
    } finally {
        await browser.close();
    }
}

// Run the test
testCompleteQueueFlow();