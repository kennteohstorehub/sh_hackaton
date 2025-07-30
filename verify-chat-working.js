// Simple verification that chat is working
const fetch = require('node-fetch');

async function verifyChat() {
    console.log('🧪 Verifying Chat Functionality');
    console.log('=====================================\n');
    
    // 1. Join queue
    const testData = {
        name: 'Test Customer ' + Date.now(),
        phone: '+60' + Math.floor(100000000 + Math.random() * 900000000),
        partySize: 2,
        specialRequests: 'Testing webchat'
    };
    
    console.log('1️⃣ Joining queue...');
    const joinResponse = await fetch('http://localhost:3838/api/customer/join/453b1b29-7d3b-4c0e-92d6-d86cc9952f8e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
    });
    
    const result = await joinResponse.json();
    
    if (result.success) {
        console.log('\n✅ Successfully joined queue!');
        console.log('Entry ID:', result.entryId);
        console.log('Customer ID:', result.customer.customerId);
        console.log('Session ID:', result.customer.sessionId);
        console.log('Verification Code:', result.customer.verificationCode);
        console.log('Position:', result.position);
        
        console.log('\n📱 Open this URL in your browser to see the chat:');
        console.log(`http://localhost:3838${result.chatUrl}`);
        
        console.log('\n📋 To test notifications:');
        console.log('1. Open the merchant dashboard: http://localhost:3838/dashboard');
        console.log('2. Find this customer in the queue (position ' + result.position + ')');
        console.log('3. Click the "Notify" button');
        console.log('4. Check if notification appears in the chat window');
        
        // Store the entry info for easy testing
        const fs = require('fs');
        fs.writeFileSync('last-test-entry.json', JSON.stringify({
            entryId: result.entryId,
            customerId: result.customer.customerId,
            sessionId: result.customer.sessionId,
            verificationCode: result.customer.verificationCode,
            chatUrl: result.chatUrl
        }, null, 2));
        
        console.log('\n💾 Entry details saved to last-test-entry.json');
    } else {
        console.error('❌ Failed to join queue:', result);
    }
}

verifyChat();