#!/usr/bin/env node

const fetch = require('node-fetch');
const colors = require('colors/safe');

const BASE_URL = 'http://localhost:3838';

// Test results tracking
let passedTests = 0;
let failedTests = 0;
const testResults = [];

// Helper to log test results
function logTest(testName, passed, details = '') {
  if (passed) {
    console.log(colors.green(`✅ ${testName}`));
    passedTests++;
  } else {
    console.log(colors.red(`❌ ${testName}`));
    if (details) console.log(colors.yellow(`   Details: ${details}`));
    failedTests++;
  }
  testResults.push({ testName, passed, details });
}

// Helper to make API requests
async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    const data = response.headers.get('content-type')?.includes('application/json') 
      ? await response.json() 
      : await response.text();
      
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// Test suite
async function runTests() {
  console.log(colors.bold('\n🚀 MongoDB to Prisma Migration Test Suite\n'));
  console.log('Testing all database operations after migration...\n');

  // Test 1: Queue Service - Get all queues
  console.log(colors.bold('\n📋 Testing Queue Service Operations\n'));
  
  const queuesResult = await makeRequest(`${BASE_URL}/api/queue`);
  logTest(
    'Get all queues (GET /api/queue)',
    queuesResult.ok && Array.isArray(queuesResult.data?.queues),
    queuesResult.error || `Found ${queuesResult.data?.queues?.length} queues`
  );

  // Get test IDs from actual data
  let TEST_QUEUE_ID = null;
  let TEST_MERCHANT_ID = null;
  
  if (queuesResult.ok && queuesResult.data?.queues?.length > 0) {
    TEST_QUEUE_ID = queuesResult.data.queues[0].id;
    TEST_MERCHANT_ID = queuesResult.data.queues[0].merchantId;
  }

  // Test 2: Queue Service - Get specific queue
  if (TEST_QUEUE_ID) {
    const queueResult = await makeRequest(`${BASE_URL}/api/queue/${TEST_QUEUE_ID}`);
    logTest(
      'Get specific queue (GET /api/queue/:id)',
      queueResult.ok && queueResult.data?.queue?.id === TEST_QUEUE_ID,
      queueResult.error || `Queue: ${queueResult.data?.queue?.name}`
    );
  } else {
    logTest('Get specific queue (GET /api/queue/:id)', false, 'No queues available to test');
  }

  // Test 3: Queue Service - Get queue performance
  const perfResult = await makeRequest(`${BASE_URL}/api/queue/performance`);
  logTest(
    'Get queue performance (GET /api/queue/performance)',
    perfResult.ok && Array.isArray(perfResult.data?.queues),
    perfResult.error || `Performance data for ${perfResult.data?.queues?.length} queues`
  );

  // Test 4: Merchant Service - Get merchant profile
  console.log(colors.bold('\n🏪 Testing Merchant Service Operations\n'));
  
  const merchantResult = await makeRequest(`${BASE_URL}/api/merchant/profile`);
  logTest(
    'Get merchant profile (GET /api/merchant/profile)',
    merchantResult.ok && merchantResult.data?.merchant?.id,
    merchantResult.error || `Merchant: ${merchantResult.data?.merchant?.businessName}`
  );

  // Test 5: WebChat - Join queue
  console.log(colors.bold('\n💬 Testing WebChat Operations\n'));
  
  const sessionId = `test_${Date.now()}`;
  const joinData = {
    customerName: 'Prisma Test User',
    customerPhone: '+60123456789',
    partySize: 2,
    merchantId: TEST_MERCHANT_ID || '7a99f35e-0f73-4f8e-831c-fde8fc3a5532',
    sessionId: sessionId,
    specialRequests: 'Testing Prisma migration'
  };
  
  const joinResult = await makeRequest(`${BASE_URL}/api/webchat/join`, {
    method: 'POST',
    body: JSON.stringify(joinData)
  });
  
  logTest(
    'WebChat join queue (POST /api/webchat/join)',
    joinResult.ok && joinResult.data?.success,
    joinResult.error || `Position: ${joinResult.data?.position}, Code: ${joinResult.data?.verificationCode}`
  );

  // Test 6: WebChat - Check status
  if (joinResult.ok) {
    const statusResult = await makeRequest(`${BASE_URL}/api/webchat/status/${sessionId}`);
    logTest(
      'WebChat check status (GET /api/webchat/status/:sessionId)',
      statusResult.ok && statusResult.data?.status === 'waiting',
      statusResult.error || `Status: ${statusResult.data?.status}, Position: ${statusResult.data?.position}`
    );

    // Test 7: WebChat - Cancel queue
    const cancelResult = await makeRequest(`${BASE_URL}/api/webchat/cancel/${sessionId}`, {
      method: 'POST'
    });
    logTest(
      'WebChat cancel queue (POST /api/webchat/cancel/:sessionId)',
      cancelResult.ok && cancelResult.data?.success,
      cancelResult.error || cancelResult.data?.message
    );
  }

  // Test 8: Customer Routes - Join queue
  console.log(colors.bold('\n👥 Testing Customer Operations\n'));
  
  const customerData = {
    name: 'Customer API Test',
    phone: '+60198765432',
    partySize: 3,
    specialRequests: 'Testing customer routes'
  };
  
  if (TEST_QUEUE_ID) {
    const customerJoinResult = await makeRequest(`${BASE_URL}/api/customer/join/${TEST_QUEUE_ID}`, {
      method: 'POST',
      body: JSON.stringify(customerData)
    });
    
    logTest(
      'Customer join queue (POST /api/customer/join/:queueId)',
      customerJoinResult.ok && customerJoinResult.data?.success,
      customerJoinResult.error || `Position: ${customerJoinResult.data?.position}`
    );
  } else {
    logTest('Customer join queue (POST /api/customer/join/:queueId)', false, 'No queues available to test');
  }

  // Test 9: Analytics - Dashboard analytics
  console.log(colors.bold('\n📊 Testing Analytics Operations\n'));
  
  const analyticsResult = await makeRequest(`${BASE_URL}/api/analytics/dashboard?period=7d`);
  logTest(
    'Get dashboard analytics (GET /api/analytics/dashboard)',
    analyticsResult.ok && analyticsResult.data?.analytics,
    analyticsResult.error || `Total served: ${analyticsResult.data?.analytics?.totalCustomersServed}`
  );

  // Test 10: Dashboard Routes
  console.log(colors.bold('\n🖥️  Testing Dashboard Routes\n'));
  
  const dashboardResult = await makeRequest(`${BASE_URL}/dashboard`);
  logTest(
    'Dashboard page loads (GET /dashboard)',
    dashboardResult.ok && dashboardResult.status === 200,
    dashboardResult.error || 'Dashboard HTML rendered'
  );

  // Test 11: Public Routes - Queue info
  console.log(colors.bold('\n🌐 Testing Public Routes\n'));
  
  if (TEST_QUEUE_ID) {
    const queueInfoResult = await makeRequest(`${BASE_URL}/queue/${TEST_QUEUE_ID}`);
    logTest(
      'Public queue info page (GET /queue/:queueId)',
      queueInfoResult.ok && queueInfoResult.status === 200,
      queueInfoResult.error || 'Queue info page rendered'
    );
  } else {
    logTest('Public queue info page (GET /queue/:queueId)', false, 'No queues available to test');
  }

  // Test 12: Auth Routes - Login page
  console.log(colors.bold('\n🔐 Testing Auth Routes\n'));
  
  const loginPageResult = await makeRequest(`${BASE_URL}/auth/login`);
  logTest(
    'Login page loads (GET /auth/login)',
    loginPageResult.ok && loginPageResult.status === 200,
    loginPageResult.error || 'Login page rendered'
  );

  // Test 13: Queue Stats
  console.log(colors.bold('\n📈 Testing Queue Statistics\n'));
  
  if (TEST_QUEUE_ID) {
    const queueStatsResult = await makeRequest(`${BASE_URL}/api/queue/${TEST_QUEUE_ID}`);
    if (queueStatsResult.ok) {
      const queue = queueStatsResult.data?.queue;
      logTest(
        'Queue statistics calculated correctly',
        queue && typeof queue.currentLength === 'number' && typeof queue.nextPosition === 'number',
        `Current: ${queue?.currentLength}, Next: ${queue?.nextPosition}`
      );
    }
  } else {
    logTest('Queue statistics calculated correctly', false, 'No queues available to test');
  }

  // Test 14: Merchant Settings
  console.log(colors.bold('\n⚙️  Testing Merchant Settings\n'));
  
  const settingsResult = await makeRequest(`${BASE_URL}/api/merchant/settings/queue`, {
    method: 'PUT',
    body: JSON.stringify({
      maxQueueSize: 100,
      averageServiceTime: 20
    })
  });
  
  logTest(
    'Update merchant queue settings (PUT /api/merchant/settings/queue)',
    settingsResult.ok && settingsResult.data?.success,
    settingsResult.error || 'Settings updated'
  );

  // Test 15: Database Relationships
  console.log(colors.bold('\n🔗 Testing Database Relationships\n'));
  
  const merchantWithQueuesResult = await makeRequest(`${BASE_URL}/api/merchant/profile`);
  logTest(
    'Merchant includes related data (queues, settings, etc.)',
    merchantWithQueuesResult.ok && 
    merchantWithQueuesResult.data?.merchant && 
    (merchantWithQueuesResult.data.merchant.queues || 
     merchantWithQueuesResult.data.merchant.settings ||
     merchantWithQueuesResult.data.merchant.businessHours),
    'Related data loaded via Prisma includes'
  );

  // Summary
  console.log(colors.bold('\n📊 Test Summary\n'));
  console.log(`Total Tests: ${passedTests + failedTests}`);
  console.log(colors.green(`Passed: ${passedTests}`));
  console.log(colors.red(`Failed: ${failedTests}`));
  
  if (failedTests === 0) {
    console.log(colors.bold.green('\n✨ All tests passed! MongoDB to Prisma migration successful!'));
  } else {
    console.log(colors.bold.red('\n⚠️  Some tests failed. Please check the errors above.'));
    console.log('\nFailed tests:');
    testResults.filter(r => !r.passed).forEach(r => {
      console.log(colors.red(`- ${r.testName}`));
      if (r.details) console.log(colors.yellow(`  ${r.details}`));
    });
  }
}

// Server health check
async function checkServerHealth() {
  console.log('Checking server health...');
  try {
    const response = await fetch(BASE_URL);
    if (response.ok) {
      console.log(colors.green('✅ Server is running\n'));
      return true;
    } else {
      console.log(colors.red(`❌ Server returned status ${response.status}`));
      return false;
    }
  } catch (error) {
    console.log(colors.red(`❌ Server is not responding at ${BASE_URL}`));
    console.log(colors.yellow('Please make sure the server is running with: npm run dev'));
    return false;
  }
}

// Main execution
async function main() {
  console.log(colors.bold.blue('MongoDB to Prisma Migration Test Suite'));
  console.log(colors.blue('=====================================\n'));
  
  const serverHealthy = await checkServerHealth();
  if (!serverHealthy) {
    process.exit(1);
  }
  
  await runTests();
  
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests
main().catch(error => {
  console.error(colors.red('Fatal error:'), error);
  process.exit(1);
});