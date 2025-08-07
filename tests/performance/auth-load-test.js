/**
 * Authentication Load Testing
 * Simulates concurrent users and measures system behavior under load
 */

const axios = require('axios');
const { performance } = require('perf_hooks');
const os = require('os');
const logger = require('../../server/utils/logger');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100; // As per security.js

// Test scenarios
const LOAD_SCENARIOS = [
  { name: 'Light Load', concurrent: 10, totalRequests: 50 },
  { name: 'Medium Load', concurrent: 50, totalRequests: 200 },
  { name: 'Heavy Load', concurrent: 100, totalRequests: 500 },
  { name: 'Burst Load', concurrent: 200, totalRequests: 200 }, // All at once
  { name: 'Sustained Load', concurrent: 50, totalRequests: 1000, delay: 100 } // With delay
];

// Create axios instance
const createAxiosInstance = () => axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  maxRedirects: 0,
  validateStatus: (status) => true // Accept all status codes
});

// Generate unique test users
function generateTestUser(index) {
  return {
    email: `loadtest_${Date.now()}_${index}@example.com`,
    password: 'LoadTest123!',
    businessName: `Load Test Business ${index}`,
    phone: `555${String(index).padStart(7, '0')}`,
    businessType: 'restaurant'
  };
}

// Metrics collector
class MetricsCollector {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.cpuUsage = process.cpuUsage();
    this.memoryBaseline = process.memoryUsage();
  }
  
  addResult(operation, duration, status, error = null) {
    this.results.push({
      operation,
      duration,
      status,
      error: error ? error.message : null,
      timestamp: Date.now() - this.startTime
    });
  }
  
  getStats() {
    const successful = this.results.filter(r => r.status < 400);
    const failed = this.results.filter(r => r.status >= 400);
    const durations = successful.map(r => r.duration);
    
    const stats = {
      total: this.results.length,
      successful: successful.length,
      failed: failed.length,
      failureRate: (failed.length / this.results.length * 100).toFixed(2) + '%',
      avgDuration: durations.length > 0 ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2) : 0,
      minDuration: durations.length > 0 ? Math.min(...durations).toFixed(2) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations).toFixed(2) : 0,
      p95Duration: this.percentile(durations, 95).toFixed(2),
      p99Duration: this.percentile(durations, 99).toFixed(2),
      statusCodes: this.groupByStatus(),
      errorTypes: this.groupByError(),
      cpuUsage: process.cpuUsage(this.cpuUsage),
      memoryDelta: this.getMemoryDelta(),
      duration: Date.now() - this.startTime
    };
    
    return stats;
  }
  
  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }
  
  groupByStatus() {
    const groups = {};
    this.results.forEach(r => {
      groups[r.status] = (groups[r.status] || 0) + 1;
    });
    return groups;
  }
  
  groupByError() {
    const groups = {};
    this.results.filter(r => r.error).forEach(r => {
      groups[r.error] = (groups[r.error] || 0) + 1;
    });
    return groups;
  }
  
  getMemoryDelta() {
    const current = process.memoryUsage();
    return {
      heapUsed: ((current.heapUsed - this.memoryBaseline.heapUsed) / 1024 / 1024).toFixed(2) + ' MB',
      external: ((current.external - this.memoryBaseline.external) / 1024 / 1024).toFixed(2) + ' MB',
      rss: ((current.rss - this.memoryBaseline.rss) / 1024 / 1024).toFixed(2) + ' MB'
    };
  }
}

// Load test operations
async function performLogin(axiosInstance, user, metrics) {
  const start = performance.now();
  try {
    const response = await axiosInstance.post('/auth/login', {
      email: user.email,
      password: user.password
    });
    const duration = performance.now() - start;
    metrics.addResult('login', duration, response.status);
    return { success: response.status < 400, cookies: response.headers['set-cookie'] };
  } catch (error) {
    const duration = performance.now() - start;
    metrics.addResult('login', duration, 500, error);
    return { success: false, error };
  }
}

async function performRegistration(axiosInstance, user, metrics) {
  const start = performance.now();
  try {
    const response = await axiosInstance.post('/auth/register', user);
    const duration = performance.now() - start;
    metrics.addResult('register', duration, response.status);
    return { success: response.status < 400, cookies: response.headers['set-cookie'] };
  } catch (error) {
    const duration = performance.now() - start;
    metrics.addResult('register', duration, 500, error);
    return { success: false, error };
  }
}

async function performSessionLookup(axiosInstance, cookies, metrics) {
  const start = performance.now();
  try {
    const response = await axiosInstance.get('/dashboard', {
      headers: { Cookie: cookies?.join('; ') || '' }
    });
    const duration = performance.now() - start;
    metrics.addResult('session_lookup', duration, response.status);
    return { success: response.status < 400 };
  } catch (error) {
    const duration = performance.now() - start;
    metrics.addResult('session_lookup', duration, 500, error);
    return { success: false, error };
  }
}

// Worker function for concurrent execution
async function worker(workerId, operations, metrics, delay = 0) {
  const axiosInstance = createAxiosInstance();
  const user = generateTestUser(workerId);
  
  for (const operation of operations) {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    switch (operation) {
      case 'register':
        await performRegistration(axiosInstance, user, metrics);
        break;
      case 'login':
        const loginResult = await performLogin(axiosInstance, user, metrics);
        if (loginResult.success && loginResult.cookies) {
          // Follow up with session lookup
          await performSessionLookup(axiosInstance, loginResult.cookies, metrics);
        }
        break;
      case 'mixed':
        // Simulate realistic mixed traffic
        await performRegistration(axiosInstance, user, metrics);
        const mixedLogin = await performLogin(axiosInstance, user, metrics);
        if (mixedLogin.success && mixedLogin.cookies) {
          // Multiple session lookups
          for (let i = 0; i < 3; i++) {
            await performSessionLookup(axiosInstance, mixedLogin.cookies, metrics);
          }
        }
        break;
    }
  }
}

// Run load scenario
async function runLoadScenario(scenario, operations = ['login']) {
  console.log(`\n=== ${scenario.name} ===`);
  console.log(`Concurrent users: ${scenario.concurrent}`);
  console.log(`Total requests: ${scenario.totalRequests}`);
  
  const metrics = new MetricsCollector();
  const requestsPerWorker = Math.ceil(scenario.totalRequests / scenario.concurrent);
  const workerOperations = Array(requestsPerWorker).fill(operations).flat();
  
  // Start monitoring
  const monitorInterval = setInterval(() => {
    const mem = process.memoryUsage();
    console.log(`[Monitor] Active requests: ${metrics.results.length}, Memory: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  }, 1000);
  
  // Launch workers
  const workers = [];
  const startTime = Date.now();
  
  for (let i = 0; i < scenario.concurrent; i++) {
    workers.push(worker(i, workerOperations, metrics, scenario.delay || 0));
  }
  
  // Wait for completion
  await Promise.all(workers);
  clearInterval(monitorInterval);
  
  const duration = Date.now() - startTime;
  const stats = metrics.getStats();
  
  // Display results
  console.log('\nResults:');
  console.log(`Total duration: ${(duration / 1000).toFixed(2)}s`);
  console.log(`Requests/second: ${(stats.total / (duration / 1000)).toFixed(2)}`);
  console.log(`Success rate: ${((stats.successful / stats.total) * 100).toFixed(2)}%`);
  console.log(`Average response time: ${stats.avgDuration}ms`);
  console.log(`Min response time: ${stats.minDuration}ms`);
  console.log(`Max response time: ${stats.maxDuration}ms`);
  console.log(`95th percentile: ${stats.p95Duration}ms`);
  console.log(`99th percentile: ${stats.p99Duration}ms`);
  console.log('\nStatus code distribution:');
  Object.entries(stats.statusCodes).forEach(([code, count]) => {
    console.log(`  ${code}: ${count} (${(count / stats.total * 100).toFixed(2)}%)`);
  });
  
  if (Object.keys(stats.errorTypes).length > 0) {
    console.log('\nError types:');
    Object.entries(stats.errorTypes).forEach(([error, count]) => {
      console.log(`  ${error}: ${count}`);
    });
  }
  
  console.log('\nResource usage:');
  console.log(`  CPU user: ${(stats.cpuUsage.user / 1000000).toFixed(2)}s`);
  console.log(`  CPU system: ${(stats.cpuUsage.system / 1000000).toFixed(2)}s`);
  console.log(`  Memory delta:`, stats.memoryDelta);
  
  return stats;
}

// Test rate limiting behavior
async function testRateLimiting() {
  console.log('\n=== Rate Limiting Test ===');
  console.log(`Rate limit: ${RATE_LIMIT_MAX} requests per ${RATE_LIMIT_WINDOW / 1000 / 60} minutes`);
  
  const metrics = new MetricsCollector();
  const axiosInstance = createAxiosInstance();
  const user = generateTestUser(9999);
  
  // First register the user
  await performRegistration(axiosInstance, user, metrics);
  
  // Attempt to exceed rate limit
  const attempts = RATE_LIMIT_MAX + 20;
  let rateLimitHit = false;
  let rateLimitedAt = 0;
  
  for (let i = 0; i < attempts; i++) {
    const result = await performLogin(axiosInstance, user, metrics);
    
    if (metrics.results[metrics.results.length - 1].status === 429) {
      if (!rateLimitHit) {
        rateLimitHit = true;
        rateLimitedAt = i + 1;
      }
    }
    
    // Small delay to avoid overwhelming
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  const stats = metrics.getStats();
  console.log(`\nRate limit hit: ${rateLimitHit ? 'Yes' : 'No'}`);
  if (rateLimitHit) {
    console.log(`Rate limited after ${rateLimitedAt} requests`);
  }
  console.log(`429 responses: ${stats.statusCodes[429] || 0}`);
  console.log(`Success rate before rate limit: ${rateLimitedAt > 0 ? ((rateLimitedAt - 1) / attempts * 100).toFixed(2) : 0}%`);
}

// Test session store under load
async function testSessionStore() {
  console.log('\n=== Session Store Load Test ===');
  
  const metrics = new MetricsCollector();
  const concurrentSessions = 100;
  const users = [];
  const sessions = [];
  
  // Create users and login to create sessions
  console.log(`Creating ${concurrentSessions} concurrent sessions...`);
  
  for (let i = 0; i < concurrentSessions; i++) {
    const axiosInstance = createAxiosInstance();
    const user = generateTestUser(1000 + i);
    users.push(user);
    
    // Register and login
    await performRegistration(axiosInstance, user, metrics);
    const loginResult = await performLogin(axiosInstance, user, metrics);
    
    if (loginResult.success && loginResult.cookies) {
      sessions.push({
        axiosInstance,
        cookies: loginResult.cookies,
        user
      });
    }
  }
  
  console.log(`Active sessions created: ${sessions.length}`);
  
  // Perform concurrent session lookups
  console.log('Performing concurrent session lookups...');
  const lookupPromises = sessions.map(session => 
    performSessionLookup(session.axiosInstance, session.cookies, metrics)
  );
  
  await Promise.all(lookupPromises);
  
  const stats = metrics.getStats();
  console.log(`\nSession lookup success rate: ${((stats.successful / stats.total) * 100).toFixed(2)}%`);
  console.log(`Average lookup time: ${stats.avgDuration}ms`);
  console.log(`95th percentile: ${stats.p95Duration}ms`);
}

// Main test runner
async function runLoadTests() {
  console.log('Starting Authentication Load Tests');
  console.log(`Target: ${BASE_URL}`);
  console.log(`System: ${os.cpus().length} CPUs, ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB RAM`);
  console.log('=====================================');
  
  try {
    // Run different load scenarios
    for (const scenario of LOAD_SCENARIOS) {
      await runLoadScenario(scenario, ['login']);
      
      // Cool down period between scenarios
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Test mixed operations
    await runLoadScenario(
      { name: 'Mixed Operations', concurrent: 50, totalRequests: 150 },
      ['mixed']
    );
    
    // Test rate limiting
    await testRateLimiting();
    
    // Test session store
    await testSessionStore();
    
    console.log('\n=====================================');
    console.log('Load tests completed');
    
  } catch (error) {
    console.error('Test suite failed:', error);
  }
  
  process.exit(0);
}

// Run tests
runLoadTests();