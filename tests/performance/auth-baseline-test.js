/**
 * Authentication Baseline Performance Test
 * Measures single-user performance metrics for authentication operations
 */

const axios = require('axios');
const { performance } = require('perf_hooks');
const bcrypt = require('bcryptjs');
const logger = require('../../server/utils/logger');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3838';
const TEST_USER = {
  email: 'perftest@example.com',
  password: 'TestPassword123!',
  businessName: 'Performance Test Business',
  phone: '1234567890',
  businessType: 'restaurant'
};

// Axios instance with cookie jar
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  },
  // Disable automatic redirects to measure exact timings
  maxRedirects: 0,
  validateStatus: (status) => status < 500
});

// Store cookies manually
let cookies = {};

// Helper to parse cookies from response
function parseCookies(setCookieHeaders) {
  if (!setCookieHeaders) return;
  
  const cookieArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  cookieArray.forEach(cookie => {
    const [nameValue] = cookie.split(';');
    const [name, value] = nameValue.split('=');
    cookies[name] = value;
  });
}

// Helper to format cookies for request
function getCookieString() {
  return Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; ');
}

// Timing helper
function measureTime(fn) {
  return async (...args) => {
    const start = performance.now();
    try {
      const result = await fn(...args);
      const end = performance.now();
      return {
        result,
        duration: end - start,
        success: true
      };
    } catch (error) {
      const end = performance.now();
      return {
        error,
        duration: end - start,
        success: false
      };
    }
  };
}

// Test functions
async function testBcryptPerformance() {
  console.log('\n=== Bcrypt Performance Test ===');
  
  const password = TEST_USER.password;
  const rounds = [8, 10, 12, 14];
  
  for (const round of rounds) {
    const hashStart = performance.now();
    const hash = await bcrypt.hash(password, round);
    const hashEnd = performance.now();
    
    const compareStart = performance.now();
    await bcrypt.compare(password, hash);
    const compareEnd = performance.now();
    
    console.log(`Rounds: ${round}`);
    console.log(`  Hash time: ${(hashEnd - hashStart).toFixed(2)}ms`);
    console.log(`  Compare time: ${(compareEnd - compareStart).toFixed(2)}ms`);
  }
}

async function testRegistration() {
  console.log('\n=== Registration Performance Test ===');
  
  // Clean up any existing test user
  // Note: In production, you'd have a proper cleanup endpoint
  
  const registerData = {
    ...TEST_USER,
    email: `perftest${Date.now()}@example.com` // Unique email
  };
  
  const measured = measureTime(async () => {
    const response = await axiosInstance.post('/auth/register', registerData);
    parseCookies(response.headers['set-cookie']);
    return response;
  });
  
  const result = await measured();
  
  console.log(`Registration time: ${result.duration.toFixed(2)}ms`);
  console.log(`Status: ${result.result?.status || 'Error'}`);
  
  if (!result.success) {
    console.error('Registration failed:', result.error?.response?.data || result.error?.message);
  } else {
    // Logout after registration
    await axiosInstance.post('/auth/logout', {}, {
      headers: { Cookie: getCookieString() }
    });
    cookies = {};
  }
  
  return result;
}

async function testLogin() {
  console.log('\n=== Login Performance Test ===');
  
  const loginData = {
    email: TEST_USER.email,
    password: TEST_USER.password
  };
  
  const measured = measureTime(async () => {
    const response = await axiosInstance.post('/auth/login', loginData);
    parseCookies(response.headers['set-cookie']);
    return response;
  });
  
  const result = await measured();
  
  console.log(`Login time: ${result.duration.toFixed(2)}ms`);
  console.log(`Status: ${result.result?.status || 'Error'}`);
  
  if (!result.success) {
    console.error('Login failed:', result.error?.response?.data || result.error?.message);
  }
  
  return result;
}

async function testSessionLookup() {
  console.log('\n=== Session Lookup Performance Test ===');
  
  // First login to get a session
  await testLogin();
  
  if (Object.keys(cookies).length === 0) {
    console.error('No session cookie available');
    return;
  }
  
  // Test authenticated request (dashboard)
  const measured = measureTime(async () => {
    return await axiosInstance.get('/dashboard', {
      headers: { Cookie: getCookieString() }
    });
  });
  
  const result = await measured();
  
  console.log(`Session lookup time: ${result.duration.toFixed(2)}ms`);
  console.log(`Status: ${result.result?.status || 'Error'}`);
  
  return result;
}

async function testLogout() {
  console.log('\n=== Logout Performance Test ===');
  
  // Ensure we're logged in
  if (Object.keys(cookies).length === 0) {
    await testLogin();
  }
  
  const measured = measureTime(async () => {
    const response = await axiosInstance.post('/auth/logout', {}, {
      headers: { Cookie: getCookieString() }
    });
    return response;
  });
  
  const result = await measured();
  
  console.log(`Logout time: ${result.duration.toFixed(2)}ms`);
  console.log(`Status: ${result.result?.status || 'Error'}`);
  
  // Clear cookies after logout
  cookies = {};
  
  return result;
}

async function testSessionRegeneration() {
  console.log('\n=== Session Regeneration Overhead Test ===');
  
  // Test login multiple times to measure session regeneration impact
  const iterations = 10;
  const timings = [];
  
  for (let i = 0; i < iterations; i++) {
    cookies = {}; // Clear cookies
    
    const start = performance.now();
    const response = await axiosInstance.post('/auth/login', {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    const end = performance.now();
    
    parseCookies(response.headers['set-cookie']);
    timings.push(end - start);
    
    // Logout
    await axiosInstance.post('/auth/logout', {}, {
      headers: { Cookie: getCookieString() }
    });
  }
  
  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  const min = Math.min(...timings);
  const max = Math.max(...timings);
  
  console.log(`Average login time (with session regeneration): ${avg.toFixed(2)}ms`);
  console.log(`Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);
}

async function testDatabaseConnectionPool() {
  console.log('\n=== Database Connection Pool Test ===');
  
  // Perform rapid sequential logins to test connection pool
  const iterations = 20;
  const timings = [];
  
  for (let i = 0; i < iterations; i++) {
    cookies = {};
    
    const start = performance.now();
    try {
      await axiosInstance.post('/auth/login', {
        email: TEST_USER.email,
        password: TEST_USER.password
      });
    } catch (error) {
      console.error(`Iteration ${i + 1} failed:`, error.message);
    }
    const end = performance.now();
    
    timings.push(end - start);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  console.log(`Average connection time over ${iterations} requests: ${avg.toFixed(2)}ms`);
}

// Create test user before running tests
async function setupTestUser() {
  try {
    // Try to register the test user
    const response = await axiosInstance.post('/auth/register', TEST_USER);
    if (response.status === 302 || response.status === 200) {
      console.log('Test user created successfully');
      // Logout after creation
      await axiosInstance.post('/auth/logout', {}, {
        headers: { Cookie: getCookieString() }
      });
      cookies = {};
    }
  } catch (error) {
    // User might already exist, that's okay
    if (error.response?.data?.error?.includes('already exists')) {
      console.log('Test user already exists');
    } else {
      console.error('Failed to create test user:', error.response?.data || error.message);
    }
  }
}

// Main test runner
async function runBaselineTests() {
  console.log('Starting Authentication Baseline Performance Tests');
  console.log(`Target: ${BASE_URL}`);
  console.log('=====================================\n');
  
  try {
    // Setup
    await setupTestUser();
    
    // Run tests
    await testBcryptPerformance();
    await testRegistration();
    await testLogin();
    await testSessionLookup();
    await testLogout();
    await testSessionRegeneration();
    await testDatabaseConnectionPool();
    
    console.log('\n=====================================');
    console.log('Baseline tests completed');
    
  } catch (error) {
    console.error('Test suite failed:', error);
  }
  
  process.exit(0);
}

// Run tests
runBaselineTests();