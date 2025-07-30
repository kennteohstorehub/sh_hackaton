// Test the emergency fix for webchat
const fetch = require('node-fetch');
const { exec } = require('child_process');

async function testEmergencyFix() {
    console.log('🚨 EMERGENCY FIX TEST');
    console.log('=====================================\n');
    
    console.log('FIXES APPLIED:');
    console.log('✅ Added null checks to displayQueueBanner');
    console.log('✅ Fixed onclick handlers to check queueChat exists');
    console.log('✅ Deferred initialization to ensure DOM ready');
    console.log('✅ Added requestAnimationFrame for safer timing');
    console.log('=====================================\n');
    
    // Create test customer
    const testData = {
        name: 'Emergency Fix Test',
        phone: '+60' + Math.floor(100000000 + Math.random() * 900000000),
        partySize: 2,
        specialRequests: 'Testing emergency fix'
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
    
    console.log('✅ Customer created!');
    console.log('- Entry ID:', result.entryId);
    console.log('- Session ID:', result.customer.sessionId);
    console.log('- Code:', result.customer.verificationCode);
    
    const chatUrl = `http://localhost:3838${result.chatUrl}`;
    
    console.log('\n2️⃣ Opening chat...');
    exec(`${process.platform === 'darwin' ? 'open' : 'start'} "${chatUrl}"`);
    
    console.log('\n🔍 CHECK FOR:');
    console.log('1. NO "Cannot read properties of null" errors');
    console.log('2. Welcome message appears');
    console.log('3. Verification code shows in header');
    console.log('4. Quick action buttons work (try clicking them)');
    
    // Wait then send notification
    console.log('\n3️⃣ Waiting 3 seconds then sending notification...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const notifyResponse = await fetch(`http://localhost:3838/api/queue/${result.customer.queueId}/call-specific`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: result.entryId })
    });
    
    if (notifyResponse.ok) {
        console.log('✅ Notification sent!');
        console.log('\n🎯 VERIFY: Notification should appear in chat');
    }
    
    console.log('\n✅ Emergency fix test complete!');
    console.log('If no errors appear, the system is WORKING!');
}

testEmergencyFix().catch(console.error);