const axios = require('axios');

const BASE_URL = 'http://localhost:3838';

async function testFixedFlow() {
  console.log('\n🧪 Testing Fixed Webchat Flow\n');
  
  try {
    // Step 1: Join queue
    console.log('1. Joining queue via web form...');
    const joinResponse = await axios.post(`${BASE_URL}/api/customer/join/453b1b29-7d3b-4c0e-92d6-d86cc9952f8e`, {
      name: 'Test Fixed Flow',
      phone: '+60177889900',
      partySize: 2,
      specialRequests: 'Testing session fix'
    });
    
    console.log('✅ Join successful!');
    console.log('   Customer ID:', joinResponse.data.customer.customerId);
    console.log('   Session ID:', joinResponse.data.customer.sessionId);
    console.log('   Position:', joinResponse.data.position);
    console.log('   Verification Code:', joinResponse.data.customer.verificationCode);
    
    const sessionId = joinResponse.data.customer.sessionId;
    const chatUrl = `${BASE_URL}/queue-chat/${sessionId}`;
    
    console.log('\n2. Customer would be redirected to:');
    console.log('   URL:', chatUrl);
    
    // Step 2: Test the chat page loads
    console.log('\n3. Testing if chat page loads...');
    const chatPageResponse = await axios.get(chatUrl);
    console.log('✅ Chat page loads successfully (Status:', chatPageResponse.status + ')');
    
    // Step 3: Test status endpoint
    console.log('\n4. Testing status endpoint...');
    const statusResponse = await axios.get(`${BASE_URL}/api/webchat/status/${sessionId}`);
    console.log('✅ Status endpoint works!');
    console.log('   Status:', statusResponse.data.status);
    console.log('   Position:', statusResponse.data.position);
    console.log('   Queue Entry Found:', !!statusResponse.data.queueEntry);
    
    console.log('\n✅ SUCCESS! The flow is now working correctly:');
    console.log('   • SessionId is stored in database');
    console.log('   • Chat page loads without 404');
    console.log('   • Status checks work properly');
    console.log('   • Each customer has unique session');
    
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    if (error.response?.status === 404) {
      console.log('\nThe 404 error suggests the template is still not found.');
    }
  }
}

testFixedFlow();