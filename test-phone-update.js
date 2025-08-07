// Using built-in fetch (Node.js 18+)

async function testPhoneUpdate() {
  const baseUrl = 'http://localhost:3838';
  
  console.log('Testing merchant phone number update...\n');
  
  try {
    // Step 1: Get login page to extract CSRF token
    console.log('1. Getting CSRF token...');
    const loginPageResponse = await fetch(`${baseUrl}/auth/login`);
    const loginPageHtml = await loginPageResponse.text();
    
    // Extract CSRF token from the HTML
    const csrfMatch = loginPageHtml.match(/name="csrf-token"\s+content="([^"]+)"/);
    if (!csrfMatch) {
      throw new Error('Could not find CSRF token');
    }
    const csrfToken = csrfMatch[1];
    
    // Extract session cookie
    const cookies = loginPageResponse.headers.get('set-cookie');
    const sessionCookie = cookies ? cookies.split(';')[0] : '';
    
    console.log('✓ CSRF token obtained\n');
    
    // Step 2: Login as merchant
    console.log('2. Logging in as merchant...');
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify({
        email: 'demo@merchant.com',
        password: 'password123'
      }),
    });
    
    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error('Login response:', errorText);
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    // Update session cookie if needed
    const newCookies = loginResponse.headers.get('set-cookie');
    if (newCookies) {
      const updatedSessionCookie = newCookies.split(';')[0];
      if (updatedSessionCookie) {
        sessionCookie = updatedSessionCookie;
      }
    }
    
    console.log('✓ Login successful\n');
    
    // Step 3: Get current profile
    console.log('3. Getting current profile...');
    const profileResponse = await fetch(`${baseUrl}/api/merchant/profile`, {
      headers: {
        'Cookie': sessionCookie
      }
    });
    
    const profile = await profileResponse.json();
    console.log('Current phone:', profile.merchant?.phone || 'Not set');
    console.log('✓ Profile retrieved\n');
    
    // Step 4: Update phone number
    console.log('4. Updating phone number...');
    const newPhone = '+1 (555) 123-4567';
    
    const updateResponse = await fetch(`${baseUrl}/api/merchant/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify({
        phone: newPhone
      })
    });
    
    console.log('Update response status:', updateResponse.status);
    const updateResult = await updateResponse.json();
    
    if (!updateResponse.ok) {
      console.error('Update failed:', updateResult);
      throw new Error(`Update failed: ${updateResult.error || 'Unknown error'}`);
    }
    
    console.log('✓ Phone updated successfully\n');
    
    // Step 5: Verify the update
    console.log('5. Verifying update...');
    const verifyResponse = await fetch(`${baseUrl}/api/merchant/profile`, {
      headers: {
        'Cookie': sessionCookie
      }
    });
    
    const verifyProfile = await verifyResponse.json();
    const updatedPhone = verifyProfile.merchant?.phone;
    
    console.log('Updated phone:', updatedPhone);
    
    if (updatedPhone === newPhone) {
      console.log('\n✅ Phone update test PASSED!');
      console.log('\nThe fix is working correctly:');
      console.log('- Phone number can be updated without errors');
      console.log('- The "Argument \'address\' must not be null" error is resolved');
      console.log('- Relations (address, businessHours) are handled separately');
    } else {
      console.log('\n❌ Phone update test FAILED!');
      console.log(`Expected: ${newPhone}`);
      console.log(`Got: ${updatedPhone}`);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

// Check if server is running (check root endpoint since /health doesn't exist)
fetch('http://localhost:3838/')
  .then(response => {
    // Any response means server is running
    testPhoneUpdate();
  })
  .catch(error => {
    console.error('Server is not running. Please start the server first.');
    console.error('Run: npm start');
    process.exit(1);
  });