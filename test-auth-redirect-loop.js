const axios = require('axios');

const BASE_URL = 'http://localhost:3838';

console.log('=== AUTH REDIRECT LOOP DEMONSTRATION ===\n');

async function testRedirectLoop() {
  console.log('Configuration:');
  console.log('- NODE_ENV: Not set (defaults to development)');
  console.log('- USE_AUTH_BYPASS: false');
  console.log('- Result: auth-redirect.js is loaded but real auth is required\n');

  console.log('Testing redirect behavior:\n');

  // Test 1: Access dashboard without auth
  try {
    console.log('1. GET /dashboard (without auth)');
    const response1 = await axios.get(`${BASE_URL}/dashboard`, {
      maxRedirects: 0,
      validateStatus: () => true
    });
    console.log(`   Status: ${response1.status}`);
    console.log(`   Location: ${response1.headers.location}`);
    console.log(`   Expected: Redirect to /auth/login ✓\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 2: Access login page
  try {
    console.log('2. GET /auth/login');
    const response2 = await axios.get(`${BASE_URL}/auth/login`, {
      maxRedirects: 0,
      validateStatus: () => true
    });
    console.log(`   Status: ${response2.status}`);
    console.log(`   Location: ${response2.headers.location}`);
    console.log(`   Problem: Redirects to /dashboard! ✗\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 3: Follow the redirect chain
  console.log('3. Following redirect chain:');
  const redirects = [];
  let currentUrl = '/dashboard';
  let count = 0;

  while (count < 10) {
    try {
      const response = await axios.get(`${BASE_URL}${currentUrl}`, {
        maxRedirects: 0,
        validateStatus: () => true
      });
      
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.location;
        redirects.push(`   ${count + 1}. ${currentUrl} -> ${location}`);
        
        // Check if we've seen this redirect before (loop detected)
        if (count > 2 && redirects[count - 2].includes(currentUrl)) {
          redirects.push('   ... INFINITE LOOP DETECTED! ...');
          break;
        }
        
        currentUrl = location;
        count++;
      } else {
        break;
      }
    } catch (error) {
      console.log(`   Error: ${error.message}`);
      break;
    }
  }

  redirects.forEach(r => console.log(r));

  console.log('\n=== ROOT CAUSE ===');
  console.log('\nIn server/index.js (lines 289-293):');
  console.log('```javascript');
  console.log('if (process.env.NODE_ENV !== "production") {');
  console.log('  app.use("/auth", require("./routes/frontend/auth-redirect"));');
  console.log('} else {');
  console.log('  app.use("/auth", require("./routes/frontend/auth"));');
  console.log('}');
  console.log('```');
  
  console.log('\nThe problem:');
  console.log('1. NODE_ENV is not "production", so auth-redirect.js is used');
  console.log('2. auth-redirect.js makes /auth/login redirect to /dashboard');
  console.log('3. But USE_AUTH_BYPASS=false, so real auth middleware is active');
  console.log('4. /dashboard requires auth and redirects to /auth/login');
  console.log('5. This creates an infinite redirect loop!');

  console.log('\n=== SOLUTION ===');
  console.log('\nChange the condition to check USE_AUTH_BYPASS instead:');
  console.log('```javascript');
  console.log('const useAuthBypass = process.env.USE_AUTH_BYPASS === "true";');
  console.log('if (useAuthBypass) {');
  console.log('  app.use("/auth", require("./routes/frontend/auth-redirect"));');
  console.log('} else {');
  console.log('  app.use("/auth", require("./routes/frontend/auth"));');
  console.log('}');
  console.log('```');
}

testRedirectLoop().catch(console.error);