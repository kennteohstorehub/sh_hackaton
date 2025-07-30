// Final test of the webchat notification system
const fetch = require('node-fetch');
const { exec } = require('child_process');

async function finalTest() {
    console.log('🎯 FINAL WEBCHAT NOTIFICATION TEST');
    console.log('=====================================\n');
    
    // 1. Create test customer
    const testData = {
        name: 'Final Test Customer',
        phone: '+60' + Math.floor(100000000 + Math.random() * 900000000),
        partySize: 2,
        specialRequests: 'Final test of notification system'
    };
    
    console.log('1️⃣ Creating test customer...');
    console.log('Name:', testData.name);
    console.log('Phone:', testData.phone);
    
    const joinResponse = await fetch('http://localhost:3838/api/customer/join/453b1b29-7d3b-4c0e-92d6-d86cc9952f8e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
    });
    
    const result = await joinResponse.json();
    
    if (!result.success) {
        console.error('❌ Failed to join queue:', result);
        return;
    }
    
    console.log('\n✅ Customer created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Entry ID:', result.entryId);
    console.log('Session ID:', result.customer.sessionId);
    console.log('Verification Code:', result.customer.verificationCode);
    console.log('Position:', result.position);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const chatUrl = `http://localhost:3838${result.chatUrl}`;
    
    console.log('\n2️⃣ Opening chat in browser...');
    console.log('URL:', chatUrl);
    
    // Open in browser
    const command = process.platform === 'darwin' ? 'open' : 
                    process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${command} "${chatUrl}"`);
    
    console.log('\n3️⃣ Wait 5 seconds for chat to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n4️⃣ Sending notification from merchant...');
    const notifyResponse = await fetch(`http://localhost:3838/api/queue/${result.customer.queueId}/call-specific`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: result.entryId })
    });
    
    if (notifyResponse.ok) {
        console.log('✅ Notification sent successfully!');
    } else {
        console.log('❌ Failed to send notification');
    }
    
    console.log('\n📋 EXPECTED RESULTS:');
    console.log('══════════════════════════════════════════');
    console.log('1. ✅ Chat page loads without errors');
    console.log('2. ✅ Welcome message appears');
    console.log('3. ✅ Verification code shows in header');
    console.log('4. ✅ Queue position is displayed');
    console.log('5. ✅ Notification appears when sent');
    console.log('6. ✅ No "Cannot read properties of null" errors');
    console.log('══════════════════════════════════════════');
    
    console.log('\n🔍 CHECK THE BROWSER:');
    console.log('- Open Developer Console (F12)');
    console.log('- Look for any red errors');
    console.log('- Verify all features work');
    
    console.log('\n✨ If everything works, the webchat system is FIXED!');
}

finalTest().catch(console.error);