// Test manual queue join
const fetch = require('node-fetch');

async function testManualJoin() {
    console.log('🧪 Testing Manual Queue Join');
    console.log('=====================================\n');
    
    const testData = {
        name: 'Test Customer ' + Date.now(),
        phone: '+60' + Math.floor(100000000 + Math.random() * 900000000),
        partySize: 2,
        specialRequests: 'Testing webchat'
    };
    
    console.log('Test data:', testData);
    
    try {
        console.log('\n1️⃣ Attempting to join queue...');
        const response = await fetch('http://localhost:3838/api/customer/join/453b1b29-7d3b-4c0e-92d6-d86cc9952f8e', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData)
        });
        
        const result = await response.json();
        
        console.log('\n2️⃣ Response status:', response.status);
        console.log('Response body:', JSON.stringify(result, null, 2));
        
        if (result.success) {
            console.log('\n✅ Successfully joined queue!');
            console.log('Entry ID:', result.entryId);
            console.log('Customer ID:', result.customer.customerId);
            console.log('Session ID:', result.customer.sessionId);
            console.log('Verification Code:', result.customer.verificationCode);
            console.log('Chat URL:', result.chatUrl);
            
            // Open the chat URL
            const chatUrl = `http://localhost:3838${result.chatUrl}`;
            console.log('\n🌐 Open this URL in your browser to test the chat:');
            console.log(chatUrl);
        } else {
            console.log('\n❌ Failed to join queue:', result.error);
            if (result.message) {
                console.log('Message:', result.message);
            }
        }
    } catch (error) {
        console.error('\n❌ Error:', error);
    }
}

testManualJoin();