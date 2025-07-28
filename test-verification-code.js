const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3838';

async function testVerificationCodeDisplay() {
    console.log('Testing Verification Code Display in Header\n');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Enable console logging
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        
        // Step 1: Join queue
        console.log('1. Joining queue...');
        await page.goto(`${BASE_URL}/queue/join/3ecceb82-fb33-42c8-9d84-19eb69417e16`);
        await page.waitForSelector('#queueForm');
        
        await page.type('#customerName', 'Code Test User');
        await page.type('#customerPhone', '0123456789');
        await page.select('#partySize', '2');
        
        await Promise.all([
            page.waitForNavigation(),
            page.click('button[type="submit"]')
        ]);
        
        // Step 2: Check verification code in header
        console.log('\n2. Checking verification code display...');
        
        // Wait for verification display to appear
        try {
            await page.waitForSelector('#verificationDisplay', { 
                visible: true, 
                timeout: 5000 
            });
            console.log('✅ Verification display container found');
            
            // Get the verification code
            const verifyCode = await page.$eval('#headerVerifyCode', el => el.textContent);
            console.log(`✅ Verification code in header: ${verifyCode}`);
            
            // Check if it's visible
            const isVisible = await page.$eval('#verificationDisplay', el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden';
            });
            
            console.log(`✅ Verification display is ${isVisible ? 'visible' : 'hidden'}`);
            
            // Get queue data from localStorage
            const queueData = await page.evaluate(() => {
                const data = localStorage.getItem('queueData');
                return data ? JSON.parse(data) : null;
            });
            
            if (queueData && queueData.verificationCode) {
                console.log(`✅ Queue data has verification code: ${queueData.verificationCode}`);
                console.log(`✅ Codes match: ${queueData.verificationCode === verifyCode}`);
            }
            
        } catch (error) {
            console.log('❌ Verification display not found or not visible');
            console.log('Error:', error.message);
            
            // Take screenshot for debugging
            await page.screenshot({ 
                path: 'verification-code-error.png',
                fullPage: true 
            });
            console.log('📸 Screenshot saved as verification-code-error.png');
        }
        
        // Step 3: Check messages for verification code
        console.log('\n3. Checking messages for verification code...');
        await page.waitForTimeout(3000);
        
        const messages = await page.$$eval('.message.bot .message-bubble', els => 
            els.map(el => el.textContent)
        );
        
        const verifyMessage = messages.find(msg => msg.includes('Verification code:'));
        if (verifyMessage) {
            console.log('✅ Verification code mentioned in messages');
            const codeMatch = verifyMessage.match(/Verification code: (\w+)/);
            if (codeMatch) {
                console.log(`   Code in message: ${codeMatch[1]}`);
            }
        }
        
        console.log('\n✨ Test completed!');
        
    } catch (error) {
        console.error('\n❌ Test failed!');
        console.error('Error:', error.message);
        
        await page.screenshot({ path: 'test-error.png' });
        console.log('Screenshot saved as test-error.png');
    } finally {
        await browser.close();
    }
}

// Run the test
testVerificationCodeDisplay();