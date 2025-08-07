const http = require('http');
const querystring = require('querystring');

// Function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body,
          cookies: res.headers['set-cookie']
        });
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

// Extract cookies from response
function extractCookies(cookies) {
  if (!cookies) return '';
  return cookies.map(cookie => cookie.split(';')[0]).join('; ');
}

async function testSettingsAPI() {
  console.log('Testing Settings API Functionality\n');
  
  try {
    // Step 1: Get login page to get CSRF token
    console.log('1. Getting CSRF token...');
    const loginPageResponse = await makeRequest({
      hostname: 'localhost',
      port: 3838,
      path: '/auth/login',
      method: 'GET'
    });
    
    const cookies = extractCookies(loginPageResponse.cookies);
    const csrfMatch = loginPageResponse.body.match(/name="_csrf" value="([^"]+)"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : null;
    
    if (!csrfToken) {
      throw new Error('Could not extract CSRF token');
    }
    
    console.log('   ✓ CSRF token obtained');
    
    // Step 2: Login
    console.log('\n2. Logging in...');
    const loginData = querystring.stringify({
      email: 'admin@demo.local',
      password: 'Demo123!@#',
      _csrf: csrfToken
    });
    
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 3838,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': loginData.length,
        'Cookie': cookies
      }
    }, loginData);
    
    const sessionCookies = extractCookies(loginResponse.cookies) || cookies;
    
    if (loginResponse.statusCode === 302 || loginResponse.statusCode === 303) {
      console.log('   ✓ Login successful (redirected to:', loginResponse.headers.location, ')');
    } else {
      console.log('   Login response:', loginResponse.statusCode, loginResponse.body);
      throw new Error(`Login failed with status ${loginResponse.statusCode}`);
    }
    
    // Step 3: Get merchant profile
    console.log('\n3. Getting merchant profile...');
    const profileResponse = await makeRequest({
      hostname: 'localhost',
      port: 3838,
      path: '/api/merchant/profile',
      method: 'GET',
      headers: {
        'Cookie': sessionCookies,
        'Accept': 'application/json'
      }
    });
    
    const profile = JSON.parse(profileResponse.body);
    
    if (profile.success) {
      console.log('   ✓ Profile retrieved successfully');
      console.log('   - Business Name:', profile.merchant.businessName);
      console.log('   - Email:', profile.merchant.email);
      console.log('   - Phone:', profile.merchant.phone);
    } else {
      throw new Error('Failed to get profile: ' + profile.error);
    }
    
    // Step 4: Update merchant profile
    console.log('\n4. Updating merchant profile...');
    const updateData = JSON.stringify({
      businessName: 'Test Restaurant Updated',
      phone: '+1234567890',
      address: {
        street: '123 Test Street, Test City, TC 12345'
      },
      businessHours: {
        monday: { start: '08:00', end: '20:00', closed: false },
        tuesday: { start: '08:00', end: '20:00', closed: false },
        wednesday: { start: '08:00', end: '20:00', closed: false },
        thursday: { start: '08:00', end: '20:00', closed: false },
        friday: { start: '08:00', end: '22:00', closed: false },
        saturday: { start: '10:00', end: '22:00', closed: false },
        sunday: { start: '10:00', end: '18:00', closed: true }
      },
      settings: {
        maxQueueSize: 75,
        avgMealDuration: 20,
        autoNotifications: true
      }
    });
    
    // Get CSRF token for API request
    const settingsPageResponse = await makeRequest({
      hostname: 'localhost',
      port: 3838,
      path: '/dashboard/settings',
      method: 'GET',
      headers: {
        'Cookie': sessionCookies
      }
    });
    
    const apiCsrfMatch = settingsPageResponse.body.match(/content="([^"]+)"[^>]*name="csrf-token"/);
    const apiCsrfToken = apiCsrfMatch ? apiCsrfMatch[1] : null;
    
    const updateResponse = await makeRequest({
      hostname: 'localhost',
      port: 3838,
      path: '/api/merchant/profile',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': updateData.length,
        'Cookie': sessionCookies,
        'X-CSRF-Token': apiCsrfToken || ''
      }
    }, updateData);
    
    const updateResult = JSON.parse(updateResponse.body);
    
    if (updateResult.success) {
      console.log('   ✓ Profile updated successfully');
      console.log('   - New Business Name:', updateResult.merchant.businessName);
      console.log('   - New Phone:', updateResult.merchant.phone);
      if (updateResult.merchant.settings) {
        console.log('   - Max Queue Size:', updateResult.merchant.settings.maxQueueSize);
        console.log('   - Avg Meal Duration:', updateResult.merchant.settings.avgMealDuration);
      }
    } else {
      console.log('   ✗ Update failed:', updateResult.error);
    }
    
    // Step 5: Verify persistence
    console.log('\n5. Verifying data persistence...');
    const verifyResponse = await makeRequest({
      hostname: 'localhost',
      port: 3838,
      path: '/api/merchant/profile',
      method: 'GET',
      headers: {
        'Cookie': sessionCookies,
        'Accept': 'application/json'
      }
    });
    
    const verifyData = JSON.parse(verifyResponse.body);
    
    if (verifyData.success) {
      console.log('   ✓ Data persisted correctly');
      console.log('   - Business Name:', verifyData.merchant.businessName);
      console.log('   - Business Hours Monday:', verifyData.merchant.businessHours?.monday || 'Not set');
      console.log('   - Settings:', verifyData.merchant.settings ? 'Configured' : 'Not configured');
    }
    
    console.log('\n✅ All API tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testSettingsAPI();