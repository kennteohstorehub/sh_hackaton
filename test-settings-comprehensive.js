#!/usr/bin/env node

/**
 * Comprehensive test for all settings configurations
 * Tests restaurant name, phone, address, business hours, and queue settings
 */

const axios = require('axios');

const BASE_URL = 'http://demo.lvh.me:3838';
const LOGIN_CREDENTIALS = {
  username: 'admin@demo.local',
  password: 'Demo123!@#'
};

let cookies = '';

// Color utilities
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`
};

// Test results tracker
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

async function login() {
  try {
    console.log(colors.blue('\n🔐 Logging in...'));
    const response = await axios.post(`${BASE_URL}/api/auth/login`, LOGIN_CREDENTIALS, {
      validateStatus: null,
      maxRedirects: 0
    });

    if (response.headers['set-cookie']) {
      cookies = response.headers['set-cookie'].join('; ');
      console.log(colors.green('✅ Login successful'));
      return true;
    }
    console.log(colors.red('❌ Login failed - no cookies received'));
    return false;
  } catch (error) {
    console.log(colors.red('❌ Login error:'), error.message);
    return false;
  }
}

async function testSettingsUpdate(testName, updateData, expectedSuccess = true) {
  try {
    console.log(colors.blue(`\n📝 Testing: ${testName}`));
    console.log('Update data:', JSON.stringify(updateData, null, 2));
    
    const response = await axios.put(`${BASE_URL}/api/merchant/profile`, updateData, {
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json'
      },
      validateStatus: null
    });

    const success = response.status === 200;
    
    if (success === expectedSuccess) {
      console.log(colors.green(`✅ ${testName}: PASSED`));
      console.log('Response:', response.data);
      testResults.passed++;
      testResults.tests.push({ name: testName, status: 'PASSED' });
      return true;
    } else {
      console.log(colors.red(`❌ ${testName}: FAILED`));
      console.log(`Expected ${expectedSuccess ? 'success' : 'failure'}, got status ${response.status}`);
      console.log('Response:', response.data);
      testResults.failed++;
      testResults.tests.push({ name: testName, status: 'FAILED', error: response.data });
      return false;
    }
  } catch (error) {
    console.log(colors.red(`❌ ${testName}: ERROR`));
    console.log('Error:', error.message);
    testResults.failed++;
    testResults.tests.push({ name: testName, status: 'ERROR', error: error.message });
    return false;
  }
}

async function runAllTests() {
  console.log(colors.yellow('\n🚀 Starting Comprehensive Settings Tests\n'));

  // Login first
  if (!await login()) {
    console.log(colors.red('\n❌ Cannot proceed without login'));
    return;
  }

  // Test 1: Restaurant Name Update
  await testSettingsUpdate(
    'Restaurant Name Update',
    { businessName: 'Test Restaurant ' + Date.now() }
  );

  // Test 2: Phone Number Update
  await testSettingsUpdate(
    'Phone Number Update',
    { phone: '+60123456789' }
  );

  // Test 3: Combined Business Info Update
  await testSettingsUpdate(
    'Combined Business Info Update',
    { 
      businessName: 'Combined Test ' + Date.now(),
      phone: '+60198765432',
      email: 'test@restaurant.com',
      businessType: 'Restaurant'
    }
  );

  // Test 4: Address Update
  await testSettingsUpdate(
    'Address Update',
    { 
      address: {
        line1: '123 Test Street',
        line2: 'Suite 456',
        city: 'Kuala Lumpur',
        state: 'WP',
        postalCode: '50000',
        country: 'Malaysia'
      }
    }
  );

  // Test 5: Business Hours Update
  await testSettingsUpdate(
    'Business Hours Update',
    { 
      businessHours: {
        monday: { start: '09:00', end: '22:00', closed: false },
        tuesday: { start: '09:00', end: '22:00', closed: false },
        wednesday: { start: '09:00', end: '22:00', closed: false },
        thursday: { start: '09:00', end: '22:00', closed: false },
        friday: { start: '09:00', end: '23:00', closed: false },
        saturday: { start: '10:00', end: '23:00', closed: false },
        sunday: { start: '10:00', end: '21:00', closed: false }
      }
    }
  );

  // Test 6: Queue Settings Update
  await testSettingsUpdate(
    'Queue Settings Update',
    { 
      settings: {
        queue: {
          enabled: true,
          defaultWaitTime: 15,
          maxPartySize: 10,
          minPartySize: 1
        }
      }
    }
  );

  // Test 7: Everything at Once
  await testSettingsUpdate(
    'Complete Settings Update',
    { 
      businessName: 'Complete Test ' + Date.now(),
      phone: '+60123456000',
      address: {
        line1: '789 Complete Street',
        city: 'Petaling Jaya',
        state: 'Selangor',
        postalCode: '46000'
      },
      businessHours: {
        monday: { start: '08:00', end: '20:00', closed: false }
      },
      settings: {
        queue: {
          enabled: true,
          defaultWaitTime: 20
        }
      }
    }
  );

  // Test 8: Test with invalid data (should fail)
  await testSettingsUpdate(
    'Invalid Phone Format (should fail)',
    { phone: 'invalid-phone' },
    false // expecting failure
  );

  // Test 9: Test that tenantId is properly excluded
  await testSettingsUpdate(
    'Update with tenantId in payload (should still work)',
    { 
      businessName: 'TenantId Test ' + Date.now(),
      tenantId: 'should-be-ignored' // This should be filtered out
    }
  );

  // Print summary
  console.log(colors.yellow('\n📊 Test Summary:'));
  console.log(colors.green(`✅ Passed: ${testResults.passed}`));
  console.log(colors.red(`❌ Failed: ${testResults.failed}`));
  console.log(`Total: ${testResults.passed + testResults.failed}`);
  
  console.log(colors.yellow('\n📋 Detailed Results:'));
  testResults.tests.forEach(test => {
    const statusColor = test.status === 'PASSED' ? colors.green : colors.red;
    console.log(`${statusColor(test.status)} - ${test.name}`);
    if (test.error) {
      console.log(`  Error: ${JSON.stringify(test.error)}`);
    }
  });
}

// Run the tests
runAllTests().then(() => {
  console.log(colors.blue('\n✨ All tests completed!\n'));
}).catch(error => {
  console.error(colors.red('\n❌ Test suite error:'), error);
});