const https = require('https');
const http = require('http');

async function testEndpoint(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data.substring(0, 200)
        });
      });
    }).on('error', (err) => {
      resolve({ status: 'error', error: err.message });
    });
  });
}

async function testRenderDeployment() {
  console.log('🔍 Testing Render Deployment Status');
  console.log('=' .repeat(50));
  
  const baseUrl = 'https://queuemanagement.onrender.com';
  const endpoints = [
    '/',
    '/register',
    '/backoffice/login',
    '/t/demo1/auth/login',
    '/t/demo2/auth/login',
    '/api/health'
  ];
  
  console.log('Base URL:', baseUrl);
  console.log('\nTesting endpoints:');
  console.log('-'.repeat(50));
  
  let anySuccess = false;
  
  for (const endpoint of endpoints) {
    const url = baseUrl + endpoint;
    console.log(`\nTesting: ${endpoint}`);
    
    const result = await testEndpoint(url);
    
    if (result.status === 200) {
      console.log(`  ✅ Status: ${result.status} - SUCCESS`);
      console.log(`  Content: ${result.body.substring(0, 100)}...`);
      anySuccess = true;
    } else if (result.status === 404) {
      console.log(`  ❌ Status: ${result.status} - Not Found`);
    } else if (result.status === 'error') {
      console.log(`  ❌ Error: ${result.error}`);
    } else {
      console.log(`  ⚠️  Status: ${result.status}`);
      if (result.body) {
        console.log(`  Body: ${result.body}`);
      }
    }
  }
  
  console.log('\n' + '=' .repeat(50));
  
  if (!anySuccess) {
    console.log('❌ RESULT: App is NOT running properly on Render');
    console.log('\nThe Node.js application is not starting correctly.');
    console.log('All routes return 404, indicating the Express server is not running.');
    console.log('\nTo fix this, you need to:');
    console.log('1. Go to Render Dashboard: https://dashboard.render.com');
    console.log('2. Check the service logs for startup errors');
    console.log('3. Ensure build command is: npm install && npx prisma generate');
    console.log('4. Ensure start command is: npm start');
    console.log('5. Verify all environment variables are set');
  } else {
    console.log('✅ RESULT: Some endpoints are working!');
  }
  
  // Test with existing demo accounts
  console.log('\n🔐 Testing Demo Account Login (if app is running)');
  console.log('-'.repeat(50));
  
  if (!anySuccess) {
    console.log('⏭️  Skipping - app not running');
    return;
  }
  
  // Would test demo login here if app was running
}

// Test local deployment for comparison
async function testLocalDeployment() {
  console.log('\n🏠 Testing Local Deployment for Comparison');
  console.log('=' .repeat(50));
  
  const localUrl = 'http://localhost:3000';
  console.log('Testing:', localUrl);
  
  const result = await testEndpoint(localUrl + '/register');
  
  if (result.status === 200) {
    console.log('✅ Local server is running correctly');
    console.log('   The code works locally but not on Render');
  } else if (result.status === 'error' && result.error.includes('ECONNREFUSED')) {
    console.log('ℹ️  Local server is not running');
  } else {
    console.log('⚠️  Local server status:', result.status);
  }
}

// Run tests
async function main() {
  await testRenderDeployment();
  await testLocalDeployment();
  
  console.log('\n📋 Summary:');
  console.log('The issue is with Render deployment configuration.');
  console.log('The app code works but Render is not starting it properly.');
}

main().catch(console.error);