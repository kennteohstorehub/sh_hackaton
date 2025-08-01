const axios = require('axios');
const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:3838';

// Test configuration
const testConfig = {
  superAdminData: {
    fullName: 'Test SuperAdmin',
    email: 'test@superadmin.com',
    password: 'TestPassword123!@#',
    confirmPassword: 'TestPassword123!@#'
  }
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSuperAdminAuthentication() {
  console.log('🧪 Testing SuperAdmin Authentication System\n');

  try {
    // Test 1: Check if server is running
    console.log('1️⃣ Testing server connectivity...');
    try {
      const response = await axios.get(`${BASE_URL}/api/health`);
      console.log('✅ Server is running:', response.data);
    } catch (error) {
      console.log('❌ Server not running. Please start the server first.');
      console.log('Run: npm start or node server/index.js');
      return;
    }

    // Test 2: Check setup status
    console.log('\n2️⃣ Checking SuperAdmin setup status...');
    try {
      const setupResponse = await axios.get(`${BASE_URL}/superadmin/auth/setup-check`);
      console.log('✅ Setup status:', setupResponse.data);
      
      if (!setupResponse.data.needsSetup) {
        console.log('⚠️  SuperAdmin already exists. Testing login instead of registration.');
      }
    } catch (error) {
      console.log('⚠️  Could not check setup status:', error.response?.data || error.message);
    }

    // Test 3: Test SuperAdmin login page
    console.log('\n3️⃣ Testing SuperAdmin login page...');
    try {
      const loginPageResponse = await axios.get(`${BASE_URL}/superadmin/auth/login`);
      console.log('✅ SuperAdmin login page accessible (Status:', loginPageResponse.status, ')');
    } catch (error) {
      console.log('❌ SuperAdmin login page error:', error.response?.status, error.response?.statusText);
    }

    // Test 4: Test SuperAdmin registration page
    console.log('\n4️⃣ Testing SuperAdmin registration page...');
    try {
      const registerPageResponse = await axios.get(`${BASE_URL}/superadmin/auth/register`);
      console.log('✅ SuperAdmin registration page accessible (Status:', registerPageResponse.status, ')');
    } catch (error) {
      console.log('❌ SuperAdmin registration page error:', error.response?.status, error.response?.statusText);
    }

    // Test 5: Test protected dashboard route (should redirect to login)
    console.log('\n5️⃣ Testing protected dashboard route...');
    try {
      const dashboardResponse = await axios.get(`${BASE_URL}/superadmin/dashboard`, {
        maxRedirects: 0,
        validateStatus: function (status) {
          return status >= 200 && status < 400; // Accept redirects as success
        }
      });
      
      if (dashboardResponse.status === 302) {
        console.log('✅ Dashboard correctly redirects to login when not authenticated');
        console.log('   Redirect location:', dashboardResponse.headers.location);
      } else {
        console.log('⚠️  Dashboard response status:', dashboardResponse.status);
      }
    } catch (error) {
      if (error.response?.status === 302) {
        console.log('✅ Dashboard correctly redirects to login when not authenticated');
        console.log('   Redirect location:', error.response.headers.location);
      } else {
        console.log('❌ Dashboard access error:', error.response?.status, error.response?.statusText);
      }
    }

    // Test 6: Database connection test
    console.log('\n6️⃣ Testing database connectivity...');
    try {
      // Check if we can query the SuperAdmin table
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      const superAdminCount = await prisma.superAdmin.count();
      console.log('✅ Database connection successful');
      console.log('   SuperAdmin count:', superAdminCount);
      
      await prisma.$disconnect();
    } catch (error) {
      console.log('❌ Database connection error:', error.message);
    }

    console.log('\n🎉 SuperAdmin Authentication System Test Complete!');
    console.log('\n📋 Next Steps:');
    console.log('1. Start the server: npm start');
    console.log('2. Visit: http://localhost:3838/superadmin/auth/login');
    console.log('3. If no SuperAdmin exists, visit: http://localhost:3838/superadmin/auth/register');
    console.log('4. Use the test credentials:');
    console.log('   Email:', testConfig.superAdminData.email);
    console.log('   Password:', testConfig.superAdminData.password);

  } catch (error) {
    console.log('❌ Test suite error:', error.message);
  }
}

// Additional utility functions for manual testing
async function testSuperAdminLogin(email, password) {
  console.log('\n🔐 Testing SuperAdmin Login...');
  
  try {
    // First get the login page to extract CSRF token
    const loginPageResponse = await axios.get(`${BASE_URL}/superadmin/auth/login`);
    
    // Extract CSRF token from HTML (simple regex - in production use proper HTML parser)
    const csrfMatch = loginPageResponse.data.match(/name="_csrf" value="([^"]+)"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : '';
    
    if (!csrfToken) {
      console.log('⚠️  Could not extract CSRF token from login page');
    }

    // Attempt login
    const loginResponse = await axios.post(`${BASE_URL}/superadmin/auth/login`, {
      email,
      password,
      _csrf: csrfToken
    }, {
      maxRedirects: 0,
      validateStatus: function (status) {
        return status >= 200 && status < 400;
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (loginResponse.status === 302) {
      console.log('✅ Login attempt processed (redirected)');
      console.log('   Redirect location:', loginResponse.headers.location);
    } else {
      console.log('Login response status:', loginResponse.status);
    }

  } catch (error) {
    if (error.response?.status === 302) {
      console.log('✅ Login processed with redirect');
      console.log('   Location:', error.response.headers.location);
    } else {
      console.log('❌ Login test error:', error.response?.data || error.message);
    }
  }
}

// Run the tests
if (require.main === module) {
  testSuperAdminAuthentication();
}