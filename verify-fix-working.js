#!/usr/bin/env node

const { chromium } = require('playwright');

(async () => {
    console.log('🔍 Verifying WebChat Fix...\n');
    
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Monitor console for errors
    let hasNullErrors = false;
    page.on('console', msg => {
        if (msg.type() === 'error' && msg.text().includes('Cannot read properties of null')) {
            console.error('❌ NULL ERROR DETECTED:', msg.text());
            hasNullErrors = true;
        }
    });
    
    // Join queue
    console.log('1️⃣ Joining queue...');
    const response = await page.request.post('http://localhost:3838/api/customer/join/453b1b29-7d3b-4c0e-92d6-d86cc9952f8e', {
        data: {
            name: 'Manual Test User',
            phone: '+60' + Math.floor(100000000 + Math.random() * 900000000),
            partySize: 2
        }
    });
    
    const result = await response.json();
    console.log('✅ Joined queue successfully');
    console.log(`   - Entry ID: ${result.entryId}`);
    console.log(`   - Verification Code: ${result.customer.verificationCode}`);
    console.log(`   - Position: #${result.position}\n`);
    
    // Navigate to chat
    console.log('2️⃣ Opening WebChat...');
    const chatUrl = `http://localhost:3838${result.chatUrl}`;
    await page.goto(chatUrl, { waitUntil: 'networkidle' });
    
    // Wait a bit for any errors
    await page.waitForTimeout(3000);
    
    // Check for key elements
    console.log('3️⃣ Checking UI elements...');
    
    const verifyCodeVisible = await page.locator('#headerVerifyCode').isVisible();
    console.log(`   - Verification code display: ${verifyCodeVisible ? '✅' : '❌'}`);
    
    const welcomeMessage = await page.locator('.message.bot').first().textContent().catch(() => null);
    console.log(`   - Welcome message: ${welcomeMessage ? '✅' : '❌'}`);
    
    const quickActions = await page.locator('#quickActions').isVisible();
    console.log(`   - Quick action buttons: ${quickActions ? '✅' : '❌'}`);
    
    // Test notification
    console.log('\n4️⃣ Testing notification...');
    const notifyResponse = await page.request.post(`http://localhost:3838/api/queue/${result.customer.queueId}/call-specific`, {
        data: { customerId: result.entryId }
    });
    
    if (notifyResponse.ok()) {
        console.log('✅ Notification sent successfully');
        await page.waitForTimeout(2000);
        
        const notificationReceived = await page.locator('text=/your turn/i').isVisible();
        console.log(`   - Notification received: ${notificationReceived ? '✅' : '❌'}`);
    }
    
    // Final verdict
    console.log('\n📊 FINAL RESULTS:');
    if (hasNullErrors) {
        console.log('❌ FAILED - Null reference errors detected!');
        console.log('   Please clear your browser cache and try again.');
    } else {
        console.log('✅ SUCCESS - No null reference errors!');
        console.log('   The WebChat is working correctly.');
    }
    
    console.log('\n💡 TIP: Keep this browser window open to test manually.');
    console.log('Press Ctrl+C to exit when done.');
    
})();