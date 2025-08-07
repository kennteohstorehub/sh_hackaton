const axios = require('axios');

// Test the phone number update fix
async function testPhoneUpdateFix() {
  console.log('🧪 Testing phone number update fix...\n');
  
  const baseUrl = 'http://demo.lvh.me:3838';
  
  try {
    // Test simple phone number update (what the user is trying to do)
    console.log('1. Testing simple phone number update...');
    
    const updateResponse = await axios.put(`${baseUrl}/api/merchant/profile`, {
      phone: '+60123456733'  // The exact phone number from the screenshot
    }, {
      headers: {
        'Cookie': 'qms_session=s%3AyihecWtHUm-jVM-E_eqvcd33RXv6sD-O.%2FGMoJ%2FBSsRz8E4ZCHHJlhG9LzArOJH7D%2B1I9oWLN3hE',
        'Content-Type': 'application/json',
        'User-Agent': 'Debug-Script/1.0'
      },
      timeout: 10000
    }).catch(error => {
      console.log(`❌ Update failed: ${error.response?.status}`);
      console.log(`Error: ${error.response?.data?.error || error.message}`);
      
      if (error.response?.data?.details) {
        console.log(`Validation details:`, error.response.data.details);
      }
      
      return null;
    });
    
    if (updateResponse) {
      console.log('✅ Phone number update successful!');
      console.log(`Status: ${updateResponse.status}`);
      console.log(`Updated phone: ${updateResponse.data.merchant?.phone}`);
    }
    
    // Test with business name and phone together (common scenario)
    console.log('\n2. Testing business name + phone update...');
    
    const combinedResponse = await axios.put(`${baseUrl}/api/merchant/profile`, {
      businessName: 'Demo Restaurant Updated',
      phone: '+60123456789'
    }, {
      headers: {
        'Cookie': 'qms_session=s%3AyihecWtHUm-jVM-E_eqvcd33RXv6sD-O.%2FGMoJ%2FBSsRz8E4ZCHHJlhG9LzArOJH7D%2B1I9oWLN3hE',
        'Content-Type': 'application/json',
        'User-Agent': 'Debug-Script/1.0'
      },
      timeout: 10000
    }).catch(error => {
      console.log(`❌ Combined update failed: ${error.response?.status}`);
      console.log(`Error: ${error.response?.data?.error || error.message}`);
      return null;
    });
    
    if (combinedResponse) {
      console.log('✅ Combined update successful!');
      console.log(`Business Name: ${combinedResponse.data.merchant?.businessName}`);
      console.log(`Phone: ${combinedResponse.data.merchant?.phone}`);
    }
    
    console.log('\n✅ All tests completed');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the test
testPhoneUpdateFix().catch(console.error);