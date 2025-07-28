const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3838';

async function createTestCustomer() {
    console.log('=== Creating Test WebChat Customer ===\n');
    
    // Generate test session ID
    const sessionId = 'qc_test_' + Date.now();
    console.log('Test sessionId:', sessionId);
    
    // Test data
    const testData = {
        customerName: 'WebChat Test Customer',
        customerPhone: '+60198765432',
        partySize: 4,
        merchantId: '3ecceb82-fb33-42c8-9d84-19eb69417e16',
        sessionId: sessionId,
        specialRequests: 'Testing dashboard notification'
    };
    
    try {
        // Join queue
        console.log('\nJoining queue...');
        const joinResponse = await fetch(`${BASE_URL}/api/webchat/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testData)
        });
        
        const joinData = await joinResponse.json();
        console.log('Join response:', JSON.stringify(joinData, null, 2));
        
        if (!joinResponse.ok) {
            throw new Error(`Join failed: ${joinData.error}`);
        }
        
        console.log('\n✅ Customer created successfully!');
        console.log('Queue Number:', joinData.queueNumber);
        console.log('Position:', joinData.position);
        console.log('Verification Code:', joinData.verificationCode);
        console.log('Customer ID:', joinData.queueEntry.id);
        console.log('\nNow go to the merchant dashboard and try to notify this customer.');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

createTestCustomer();