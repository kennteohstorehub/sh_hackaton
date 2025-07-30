// Test script to verify the webchat fix
const fetch = require('node-fetch');

async function testWebchatFix() {
    console.log('🔧 Testing Webchat Fix');
    console.log('=====================================\n');
    
    // 1. Create a test customer
    const testData = {
        name: 'WebChat Fix Test ' + Date.now(),
        phone: '+60' + Math.floor(100000000 + Math.random() * 900000000),
        partySize: 2,
        specialRequests: 'Testing webchat fix'
    };
    
    console.log('1️⃣ Creating test customer...');
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
    
    console.log('✅ Customer created successfully!');
    console.log('- Entry ID:', result.entryId);
    console.log('- Session ID:', result.customer.sessionId);
    console.log('- Verification Code:', result.customer.verificationCode);
    console.log('- Position:', result.position);
    
    const chatUrl = `http://localhost:3838${result.chatUrl}`;
    console.log('\n2️⃣ Chat URL:', chatUrl);
    
    console.log('\n3️⃣ Testing notification...');
    
    // Wait a moment for socket to connect
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Send notification
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
    
    console.log('\n📋 Test Summary:');
    console.log('1. Open this URL in your browser:', chatUrl);
    console.log('2. You should see:');
    console.log('   - Welcome message with your name');
    console.log('   - Queue position and verification code');
    console.log('   - No console errors');
    console.log('3. The notification should appear in the chat');
    
    console.log('\n💡 If you see "Cannot read properties of null" errors:');
    console.log('   - The DOM initialization fix needs to be applied');
    console.log('   - Check that queue-chat.js has the proper fixes');
}

testWebchatFix().catch(console.error);