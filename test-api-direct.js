const fetch = require('node-fetch');

async function testAPIDirectly() {
  console.log('🧪 Testing API directly without browser...\n');
  
  try {
    // First login to get session
    console.log('1️⃣ Logging in...');
    const loginResponse = await fetch('http://localhost:3838/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'email=demo@smartqueue.com&password=demo123456&redirect=/dashboard',
      redirect: 'manual'
    });
    
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('✅ Got session cookie');
    
    // Get CSRF token
    console.log('\n2️⃣ Getting CSRF token...');
    const dashResponse = await fetch('http://localhost:3838/dashboard', {
      headers: {
        'Cookie': cookies
      }
    });
    
    const dashHTML = await dashResponse.text();
    const csrfMatch = dashHTML.match(/name="csrf-token" content="([^"]+)"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : null;
    console.log('✅ Got CSRF token:', csrfToken ? 'Yes' : 'No');
    
    // Test API update
    console.log('\n3️⃣ Testing PUT /api/merchant/profile...');
    const updateResponse = await fetch('http://localhost:3838/api/merchant/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify({
        businessName: 'Test Restaurant API',
        phone: '+60111111111'
      })
    });
    
    console.log('📡 Response Status:', updateResponse.status);
    console.log('📡 Response Status Text:', updateResponse.statusText);
    
    if (updateResponse.status === 500) {
      const errorText = await updateResponse.text();
      console.log('\n❌ Server Error Response:');
      console.log(errorText);
      
      // Try to parse error details
      if (errorText.includes('ReferenceError')) {
        console.log('\n🔍 Error Analysis:');
        const errorMatch = errorText.match(/ReferenceError: (\w+) is not defined/);
        if (errorMatch) {
          console.log(`  - Undefined variable: ${errorMatch[1]}`);
          console.log('  - This confirms the server-side bug in merchant.js');
        }
      }
    } else if (updateResponse.status === 200) {
      const result = await updateResponse.json();
      console.log('\n✅ Success Response:', JSON.stringify(result, null, 2));
    } else {
      console.log('\n⚠️ Unexpected Response:', await updateResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAPIDirectly();