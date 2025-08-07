const fetch = require('node-fetch');

async function testAuthenticatedFlow() {
  const baseUrl = 'http://admin.lvh.me:3838';
  let cookies = '';
  
  console.log('Testing BackOffice authenticated flow...\n');
  
  // Step 1: Get CSRF token
  console.log('1. Getting CSRF token from login page:');
  try {
    const loginPageResponse = await fetch(`${baseUrl}/backoffice/auth/login`);
    const setCookies = loginPageResponse.headers.raw()['set-cookie'] || [];
    
    // Extract cookies
    cookies = setCookies.map(cookie => cookie.split(';')[0]).join('; ');
    console.log('   ✅ Cookies obtained');
    
    const loginPageHtml = await loginPageResponse.text();
    const csrfMatch = loginPageHtml.match(/name="_csrf"\s+value="([^"]+)"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : null;
    
    if (csrfToken) {
      console.log('   ✅ CSRF token found');
    } else {
      console.log('   ❌ CSRF token not found');
      return;
    }
    
    // Step 2: Login
    console.log('\n2. Logging in:');
    const loginResponse = await fetch(`${baseUrl}/backoffice/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies
      },
      body: `email=backoffice@storehubqms.local&password=BackOffice123!@%23&_csrf=${csrfToken}`,
      redirect: 'manual'
    });
    
    console.log(`   Status: ${loginResponse.status}`);
    console.log(`   Location: ${loginResponse.headers.get('location') || 'N/A'}`);
    
    if (loginResponse.status === 302) {
      // Update cookies with session
      const newCookies = loginResponse.headers.raw()['set-cookie'] || [];
      cookies = newCookies.map(cookie => cookie.split(';')[0]).join('; ');
      console.log('   ✅ Login successful');
      
      // Step 3: Test merchants page
      console.log('\n3. Testing merchants page with auth:');
      const merchantsResponse = await fetch(`${baseUrl}/backoffice/merchants`, {
        headers: {
          'Cookie': cookies
        }
      });
      
      console.log(`   Status: ${merchantsResponse.status}`);
      
      if (merchantsResponse.status === 200) {
        const html = await merchantsResponse.text();
        console.log('   ✅ Merchants page loaded successfully');
        console.log(`   Page title contains: ${html.includes('Merchant Management') ? 'Merchant Management' : 'Unknown'}`);
      } else if (merchantsResponse.status === 500) {
        const html = await merchantsResponse.text();
        console.log('   ❌ Server error 500');
        // Extract error message if present
        const errorMatch = html.match(/<div class="error-message">([^<]+)<\/div>/);
        if (errorMatch) {
          console.log(`   Error message: ${errorMatch[1].trim()}`);
        }
      }
      
      // Step 4: Test create tenant page
      console.log('\n4. Testing create tenant page with auth:');
      const createTenantResponse = await fetch(`${baseUrl}/backoffice/tenants/create`, {
        headers: {
          'Cookie': cookies
        }
      });
      
      console.log(`   Status: ${createTenantResponse.status}`);
      
      if (createTenantResponse.status === 200) {
        const html = await createTenantResponse.text();
        console.log('   ✅ Create tenant page loaded successfully');
        console.log(`   Page title contains: ${html.includes('Create New Tenant') ? 'Create New Tenant' : 'Unknown'}`);
      } else if (createTenantResponse.status === 500) {
        const html = await createTenantResponse.text();
        console.log('   ❌ Server error 500');
        // Extract error message if present
        const errorMatch = html.match(/<div class="error-message">([^<]+)<\/div>/);
        if (errorMatch) {
          console.log(`   Error message: ${errorMatch[1].trim()}`);
        }
      }
      
    } else {
      console.log('   ❌ Login failed');
    }
    
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  console.log('\n📌 Summary:');
  console.log('Check the status codes above to see if authentication is working.');
}

testAuthenticatedFlow();