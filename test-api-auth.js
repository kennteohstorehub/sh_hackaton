const axios = require('axios');

const BASE_URL = 'https://queuemanagement-vtc2.onrender.com';

async function testAPIAuth() {
  console.log('🧪 Testing API Authentication Flow\n');
  
  const axiosInstance = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json'
    },
    validateStatus: () => true, // Don't throw on any status
    maxRedirects: 0 // Don't follow redirects automatically
  });
  
  try {
    // Step 1: Get CSRF token
    console.log('1️⃣ Getting CSRF token...');
    const loginPageRes = await axiosInstance.get('/auth/login');
    
    // Extract CSRF token from HTML
    const csrfMatch = loginPageRes.data.match(/name="_csrf" value="([^"]+)"/);
    if (!csrfMatch) {
      console.log('❌ CSRF token not found in login page');
      return;
    }
    
    const csrfToken = csrfMatch[1];
    console.log(`✅ CSRF token: ${csrfToken.substring(0, 20)}...`);
    
    // Get cookies from response
    const cookies = loginPageRes.headers['set-cookie'] || [];
    const cookieString = cookies.map(c => c.split(';')[0]).join('; ');
    console.log(`✅ Cookies received: ${cookies.length}`);
    
    // Step 2: Login
    console.log('\n2️⃣ Attempting login...');
    const loginRes = await axiosInstance.post('/auth/login', 
      `_csrf=${csrfToken}&email=demo@smartqueue.com&password=demo123456&redirect=/dashboard`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieString
        }
      }
    );
    
    console.log(`   Status: ${loginRes.status}`);
    console.log(`   Location: ${loginRes.headers.location || 'none'}`);
    
    if (loginRes.status === 302) {
      console.log('✅ Login successful (redirect received)');
      
      // Get new session cookie
      const newCookies = loginRes.headers['set-cookie'] || [];
      const sessionCookie = newCookies.find(c => c.includes('qms_session'));
      
      if (sessionCookie) {
        console.log('✅ Session cookie received');
        
        // Merge cookies
        const allCookies = [...cookies, ...newCookies].map(c => c.split(';')[0]).join('; ');
        
        // Step 3: Access protected route
        console.log('\n3️⃣ Testing dashboard access...');
        const dashboardRes = await axiosInstance.get('/dashboard', {
          headers: {
            'Cookie': allCookies
          }
        });
        
        console.log(`   Status: ${dashboardRes.status}`);
        
        if (dashboardRes.status === 200) {
          console.log('✅ Dashboard accessible!');
          
          // Check if it's actually the dashboard
          if (dashboardRes.data.includes('Dashboard') || dashboardRes.data.includes('Welcome')) {
            console.log('✅ Dashboard content verified');
          } else if (dashboardRes.data.includes('Login')) {
            console.log('❌ Redirected back to login');
          }
        } else if (dashboardRes.status === 302) {
          console.log(`❌ Redirected to: ${dashboardRes.headers.location}`);
        }
        
        // Step 4: Test API endpoint
        console.log('\n4️⃣ Testing authenticated API access...');
        const apiRes = await axiosInstance.get('/api/merchant/profile', {
          headers: {
            'Cookie': allCookies
          }
        });
        
        console.log(`   Status: ${apiRes.status}`);
        
        if (apiRes.status === 200) {
          console.log('✅ API access successful!');
          console.log(`   Merchant: ${apiRes.data.businessName || apiRes.data.email}`);
        } else {
          console.log('❌ API access failed');
          console.log(`   Response: ${JSON.stringify(apiRes.data)}`);
        }
        
      } else {
        console.log('❌ No session cookie received');
      }
    } else {
      console.log('❌ Login failed');
      if (loginRes.data.includes('Invalid email or password')) {
        console.log('   Error: Invalid credentials');
      }
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.status, error.response.data);
    }
  }
}

testAPIAuth();