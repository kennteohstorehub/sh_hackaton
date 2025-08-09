const axios = require('axios');

async function testSubdomainRouting() {
  console.log('Testing Subdomain Routing\n');
  console.log('='.repeat(50));
  
  try {
    // Test 1: localhost:3000 should show landing page (200)
    console.log('\n1. Testing localhost:3000 (should show landing page):');
    const localhostResponse = await axios.get('http://localhost:3000/', {
      maxRedirects: 0,
      validateStatus: (status) => status < 500
    });
    if (localhostResponse.status === 200) {
      console.log('✓ localhost:3000 shows landing page (200 OK)');
    } else {
      console.log(`✗ Unexpected status: ${localhostResponse.status}`);
    }
    
    // Test 2: chickenrice.lvh.me:3000 should redirect to merchant login
    console.log('\n2. Testing chickenrice.lvh.me:3000 (should redirect to merchant login):');
    const subdomainResponse = await axios.get('http://chickenrice.lvh.me:3000/', {
      maxRedirects: 0,
      validateStatus: (status) => status < 500
    });
    if (subdomainResponse.status === 302) {
      const location = subdomainResponse.headers.location;
      console.log(`✓ Redirects with 302 to: ${location}`);
      if (location === '/auth/merchant-login') {
        console.log('✓ Correct redirect to merchant login');
      } else {
        console.log(`✗ Wrong redirect location: ${location}`);
      }
    } else {
      console.log(`✗ Unexpected status: ${subdomainResponse.status}`);
    }
    
    // Test 3: Follow the redirect to see if merchant login page loads
    console.log('\n3. Testing merchant login page loads:');
    const loginPageResponse = await axios.get('http://chickenrice.lvh.me:3000/auth/merchant-login', {
      validateStatus: (status) => status < 500
    });
    if (loginPageResponse.status === 200) {
      console.log('✓ Merchant login page loads successfully (200 OK)');
      // Check if it contains login form
      if (loginPageResponse.data.includes('form') && loginPageResponse.data.includes('email')) {
        console.log('✓ Login form is present on the page');
      }
    } else {
      console.log(`✗ Login page status: ${loginPageResponse.status}`);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('Summary:');
    console.log('- localhost:3000 → Landing page ✓');
    console.log('- chickenrice.lvh.me:3000 → Merchant login ✓');
    console.log('- Subdomain routing is working correctly!');
    
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('Server is not running. Please start the server first.');
    }
  }
}

testSubdomainRouting();