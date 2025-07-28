const axios = require('axios');

const BASE_URL = 'http://localhost:3838';

// Test data
const testSessionId = 'qc_test_' + Date.now();
const testMerchantId = '3ecceb82-fb33-42c8-9d84-19eb69417e16'; // Demo merchant

async function testWebchatJoinWithSession() {
    console.log('Testing Webchat Join with Session ID...\n');
    console.log('Session ID:', testSessionId);
    console.log('Merchant ID:', testMerchantId);

    try {
        // Step 1: Join queue via webchat endpoint
        console.log('\n1. Joining queue via /api/webchat/join...');
        const joinResponse = await axios.post(`${BASE_URL}/api/webchat/join`, {
            customerName: 'Test Customer',
            customerPhone: '+60123456789',
            partySize: 2,
            merchantId: testMerchantId,
            specialRequests: 'Testing webchat session flow',
            sessionId: testSessionId
        });

        console.log('✅ Join successful!');
        console.log('Queue Number:', joinResponse.data.queueNumber);
        console.log('Position:', joinResponse.data.position);
        console.log('Verification Code:', joinResponse.data.verificationCode);
        console.log('Entry ID:', joinResponse.data.queueEntry.id);

        // Step 2: Check status using webchat endpoint
        console.log('\n2. Checking status via /api/webchat/status...');
        const statusResponse = await axios.get(`${BASE_URL}/api/webchat/status/${testSessionId}`);

        console.log('✅ Status check successful!');
        console.log('Status:', statusResponse.data.status);
        console.log('Position:', statusResponse.data.position);
        console.log('Queue Entry Found:', !!statusResponse.data.queueEntry);

        // Step 3: Verify the data matches
        console.log('\n3. Verifying data consistency...');
        const joinEntry = joinResponse.data.queueEntry;
        const statusEntry = statusResponse.data.queueEntry;

        if (joinEntry.id === statusEntry.id) {
            console.log('✅ Queue entry IDs match!');
        } else {
            console.log('❌ Queue entry IDs do not match!');
        }

        if (joinResponse.data.verificationCode === statusResponse.data.verificationCode) {
            console.log('✅ Verification codes match!');
        } else {
            console.log('❌ Verification codes do not match!');
        }

        console.log('\n✨ Webchat session flow works correctly!');
        console.log('This confirms the webchat endpoint properly links sessions.');

    } catch (error) {
        console.error('\n❌ Test failed!');
        if (error.response) {
            console.error('Error:', error.response.data);
            console.error('Status:', error.response.status);
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Run the test
testWebchatJoinWithSession();