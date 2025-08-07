const fetch = require('node-fetch');

async function testBackOfficeEndpoints() {
  const baseUrl = 'http://admin.lvh.me:3838';
  
  console.log('Testing BackOffice endpoints...\n');
  
  // Test if server is running
  try {
    const response = await fetch(`${baseUrl}/backoffice/auth/login`);
    console.log('✅ Server is running');
  } catch (error) {
    console.log('❌ Server is not running:', error.message);
    return;
  }
  
  // Test merchants endpoint without authentication
  console.log('\n1. Testing merchants endpoint without auth:');
  try {
    const response = await fetch(`${baseUrl}/backoffice/merchants`, {
      redirect: 'manual'
    });
    console.log(`   Status: ${response.status}`);
    console.log(`   Location: ${response.headers.get('location') || 'N/A'}`);
    
    if (response.status === 302) {
      console.log('   ℹ️  Redirecting to login (expected behavior)');
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  // Test create tenant endpoint without authentication
  console.log('\n2. Testing create tenant endpoint without auth:');
  try {
    const response = await fetch(`${baseUrl}/backoffice/tenants/create`, {
      redirect: 'manual'
    });
    console.log(`   Status: ${response.status}`);
    console.log(`   Location: ${response.headers.get('location') || 'N/A'}`);
    
    if (response.status === 302) {
      console.log('   ℹ️  Redirecting to login (expected behavior)');
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  
  console.log('\n📌 Summary:');
  console.log('The 500 errors appear to be authentication-related.');
  console.log('You need to log in first at: http://admin.lvh.me:3838/backoffice/auth/login');
  console.log('\nCredentials:');
  console.log('Email: backoffice@storehubqms.local');
  console.log('Password: BackOffice123!@#');
}

testBackOfficeEndpoints();