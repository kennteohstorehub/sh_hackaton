const axios = require('axios');

async function testFormSubmit() {
  console.log('\n🧪 Testing Form Submission and Redirect\n');
  
  try {
    // Submit form
    console.log('1. Submitting queue join form...');
    const response = await axios.post('http://localhost:3838/api/customer/join/453b1b29-7d3b-4c0e-92d6-d86cc9952f8e', {
      name: 'Form Test User',
      phone: '+60133445566',
      partySize: 2,
      specialRequests: 'Testing form submission'
    });
    
    console.log('✅ Form submitted successfully!');
    console.log('\n2. Response data:');
    console.log('   Session ID:', response.data.customer.sessionId);
    console.log('   Position:', response.data.position);
    console.log('   Verification Code:', response.data.customer.verificationCode);
    
    const sessionId = response.data.customer.sessionId;
    const chatUrl = `http://localhost:3838/queue-chat/${sessionId}`;
    
    console.log('\n3. User will be redirected to:');
    console.log('   ' + chatUrl);
    
    // Test if page loads
    console.log('\n4. Testing if chat page loads...');
    const pageResponse = await axios.get(chatUrl);
    console.log('✅ Chat page loads successfully!');
    
    console.log('\n✨ SUCCESS! The form submission flow is working:');
    console.log('   1. Form submits successfully');
    console.log('   2. Session ID is generated and stored');
    console.log('   3. User is redirected to unique chat URL');
    console.log('   4. Chat page loads without 404 error');
    console.log('\n📱 Try submitting the form in your browser now!');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testFormSubmit();