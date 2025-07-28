const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3838';

async function testSessionDebug() {
    console.log('=== Session Debug Test ===\n');
    
    // Generate test session ID
    const sessionId = 'qc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    console.log('Test sessionId:', sessionId);
    
    // Test data
    const testData = {
        customerName: 'Session Debug Test',
        customerPhone: '+60123456789',
        partySize: 2,
        merchantId: '3ecceb82-fb33-42c8-9d84-19eb69417e16',
        sessionId: sessionId,
        specialRequests: 'Testing session management'
    };
    
    try {
        // Step 1: Join queue
        console.log('\n1. Joining queue...');
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
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Step 2: Check status
        console.log('\n2. Checking status...');
        const statusResponse = await fetch(`${BASE_URL}/api/webchat/status/${sessionId}`);
        const statusData = await statusResponse.json();
        
        console.log('Status response:', {
            status: statusResponse.status,
            ok: statusResponse.ok,
            data: JSON.stringify(statusData, null, 2)
        });
        
        // Step 3: Try cancellation
        console.log('\n3. Testing cancellation...');
        const cancelResponse = await fetch(`${BASE_URL}/api/webchat/cancel/${sessionId}`, {
            method: 'POST'
        });
        
        const cancelData = await cancelResponse.json();
        console.log('Cancel response:', {
            status: cancelResponse.status,
            ok: cancelResponse.ok,
            data: JSON.stringify(cancelData, null, 2)
        });
        
        // Step 4: Check status after cancel
        console.log('\n4. Checking status after cancel...');
        const statusAfterResponse = await fetch(`${BASE_URL}/api/webchat/status/${sessionId}`);
        const statusAfterData = await statusAfterResponse.json();
        
        console.log('Status after cancel:', {
            status: statusAfterResponse.status,
            ok: statusAfterResponse.ok,
            data: JSON.stringify(statusAfterData, null, 2)
        });
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

testSessionDebug();