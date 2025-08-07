/**
 * Authentication Stress Testing
 * Tests system limits and recovery behavior
 */

const axios = require('axios');
const { performance } = require('perf_hooks');
const os = require('os');
const v8 = require('v8');
const { Pool } = require('pg');
const logger = require('../../server/utils/logger');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL;

// Stress test configurations
const STRESS_TESTS = {
  maxConcurrentSessions: {
    increment: 100,
    max: 5000,
    testDuration: 60000 // 1 minute per level
  },
  dbConnectionExhaustion: {
    connections: 200, // Try to exceed pool limit
    duration: 30000
  },
  memoryLeak: {
    iterations: 1000,
    checkInterval: 100
  },
  sustainedLoad: {
    rps: 100, // Requests per second
    duration: 300000 // 5 minutes
  }
};

// Create axios instance
const createAxiosInstance = () => axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  maxRedirects: 0,
  validateStatus: (status) => true
});

// Generate test user
function generateTestUser(index) {
  return {
    email: `stress_${Date.now()}_${index}@example.com`,
    password: 'StressTest123!',
    businessName: `Stress Test ${index}`,
    phone: `555${String(index).padStart(7, '0')}`,
    businessType: 'restaurant'
  };
}

// System metrics collector
class SystemMetrics {
  constructor() {
    this.samples = [];
    this.startMemory = process.memoryUsage();
    this.startCpu = process.cpuUsage();
  }
  
  sample() {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    const heap = v8.getHeapStatistics();
    
    this.samples.push({
      timestamp: Date.now(),
      memory: {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
        arrayBuffers: memory.arrayBuffers
      },
      heap: {
        totalHeapSize: heap.total_heap_size,
        totalHeapSizeExecutable: heap.total_heap_size_executable,
        totalPhysicalSize: heap.total_physical_size,
        totalAvailableSize: heap.total_available_size,
        usedHeapSize: heap.used_heap_size,
        heapSizeLimit: heap.heap_size_limit
      },
      cpu: {
        user: cpu.user,
        system: cpu.system
      },
      system: {
        loadAvg: os.loadavg(),
        freeMemory: os.freemem(),
        totalMemory: os.totalmem()
      }
    });
  }
  
  getReport() {
    if (this.samples.length === 0) return null;
    
    const latest = this.samples[this.samples.length - 1];
    const memoryGrowth = latest.memory.heapUsed - this.startMemory.heapUsed;
    const duration = latest.timestamp - this.samples[0].timestamp;
    
    // Check for memory leak patterns
    const heapGrowthRate = this.calculateGrowthRate('memory.heapUsed');
    const isLeaking = heapGrowthRate > 0.1; // 10% growth rate indicates potential leak
    
    return {
      duration: duration,
      samples: this.samples.length,
      memory: {
        current: (latest.memory.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        growth: (memoryGrowth / 1024 / 1024).toFixed(2) + ' MB',
        growthRate: (heapGrowthRate * 100).toFixed(2) + '%',
        heapUtilization: ((latest.heap.usedHeapSize / latest.heap.heapSizeLimit) * 100).toFixed(2) + '%',
        potentialLeak: isLeaking
      },
      cpu: {
        userTime: (latest.cpu.user / 1000000).toFixed(2) + 's',
        systemTime: (latest.cpu.system / 1000000).toFixed(2) + 's',
        loadAverage: latest.system.loadAvg.map(l => l.toFixed(2))
      },
      system: {
        freeMemory: (latest.system.freeMemory / 1024 / 1024 / 1024).toFixed(2) + ' GB',
        memoryPressure: ((1 - latest.system.freeMemory / latest.system.totalMemory) * 100).toFixed(2) + '%'
      }
    };
  }
  
  calculateGrowthRate(path) {
    if (this.samples.length < 2) return 0;
    
    const values = this.samples.map(s => {
      const parts = path.split('.');
      let value = s;
      for (const part of parts) {
        value = value[part];
      }
      return value;
    });
    
    // Simple linear regression
    const n = values.length;
    const sumX = n * (n - 1) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = n * (n - 1) * (2 * n - 1) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgValue = sumY / n;
    
    return avgValue > 0 ? slope / avgValue : 0;
  }
}

// Test: Maximum concurrent sessions
async function testMaxConcurrentSessions() {
  console.log('\n=== Maximum Concurrent Sessions Test ===');
  
  const { increment, max, testDuration } = STRESS_TESTS.maxConcurrentSessions;
  const sessions = [];
  const metrics = new SystemMetrics();
  let maxSuccessful = 0;
  let failurePoint = null;
  
  const monitorInterval = setInterval(() => metrics.sample(), 1000);
  
  try {
    for (let level = increment; level <= max; level += increment) {
      console.log(`\nTesting ${level} concurrent sessions...`);
      
      const newSessions = [];
      const promises = [];
      
      // Create new sessions
      for (let i = sessions.length; i < level; i++) {
        const promise = (async () => {
          const axiosInstance = createAxiosInstance();
          const user = generateTestUser(10000 + i);
          
          try {
            // Register
            const regResponse = await axiosInstance.post('/auth/register', user);
            if (regResponse.status >= 400) return null;
            
            // Login
            const loginResponse = await axiosInstance.post('/auth/login', {
              email: user.email,
              password: user.password
            });
            
            if (loginResponse.status < 400 && loginResponse.headers['set-cookie']) {
              return {
                axiosInstance,
                cookies: loginResponse.headers['set-cookie'],
                user
              };
            }
          } catch (error) {
            return null;
          }
        })();
        
        promises.push(promise);
      }
      
      const results = await Promise.all(promises);
      const successful = results.filter(r => r !== null);
      newSessions.push(...successful);
      sessions.push(...successful);
      
      console.log(`Successfully created: ${successful.length}/${promises.length}`);
      console.log(`Total active sessions: ${sessions.length}`);
      
      if (successful.length === promises.length) {
        maxSuccessful = level;
      } else if (!failurePoint) {
        failurePoint = level;
        console.log(`System started failing at ${level} concurrent sessions`);
      }
      
      // Test session lookups with current load
      const lookupStart = Date.now();
      const lookupPromises = sessions.slice(0, Math.min(100, sessions.length)).map(session =>
        session.axiosInstance.get('/dashboard', {
          headers: { Cookie: session.cookies.join('; ') }
        }).catch(() => null)
      );
      
      const lookupResults = await Promise.all(lookupPromises);
      const lookupDuration = Date.now() - lookupStart;
      const successfulLookups = lookupResults.filter(r => r && r.status < 400).length;
      
      console.log(`Session lookup success rate: ${(successfulLookups / lookupPromises.length * 100).toFixed(2)}%`);
      console.log(`Average lookup time: ${(lookupDuration / lookupPromises.length).toFixed(2)}ms`);
      
      // Check system health
      const report = metrics.getReport();
      console.log(`Memory usage: ${report.memory.current}, Growth rate: ${report.memory.growthRate}`);
      console.log(`Heap utilization: ${report.memory.heapUtilization}`);
      
      if (parseFloat(report.memory.heapUtilization) > 90) {
        console.log('Heap utilization critical - stopping test');
        break;
      }
      
      if (failurePoint) {
        console.log('Failure point reached - stopping test');
        break;
      }
      
      // Hold sessions for test duration
      await new Promise(resolve => setTimeout(resolve, Math.min(testDuration, 5000)));
    }
  } finally {
    clearInterval(monitorInterval);
  }
  
  const finalReport = metrics.getReport();
  console.log('\nFinal Results:');
  console.log(`Maximum successful concurrent sessions: ${maxSuccessful}`);
  console.log(`Failure point: ${failurePoint || 'Not reached'}`);
  console.log(`Memory growth: ${finalReport.memory.growth}`);
  console.log(`Potential memory leak: ${finalReport.memory.potentialLeak ? 'YES' : 'NO'}`);
  
  return { maxSuccessful, failurePoint, metrics: finalReport };
}

// Test: Database connection exhaustion
async function testDatabaseConnectionExhaustion() {
  console.log('\n=== Database Connection Exhaustion Test ===');
  
  if (!DATABASE_URL) {
    console.log('DATABASE_URL not set - skipping database tests');
    return;
  }
  
  const { connections, duration } = STRESS_TESTS.dbConnectionExhaustion;
  const pools = [];
  const metrics = new SystemMetrics();
  
  const monitorInterval = setInterval(() => metrics.sample(), 1000);
  
  try {
    console.log(`Creating ${connections} database connections...`);
    
    // Create many connection pools
    for (let i = 0; i < connections; i++) {
      try {
        const pool = new Pool({
          connectionString: DATABASE_URL,
          max: 1,
          idleTimeoutMillis: duration,
          connectionTimeoutMillis: 5000
        });
        
        // Try to acquire a connection
        const client = await pool.connect();
        pools.push({ pool, client });
        
        if ((i + 1) % 10 === 0) {
          console.log(`Created ${i + 1} connections`);
        }
      } catch (error) {
        console.log(`Failed at connection ${i + 1}: ${error.message}`);
        break;
      }
    }
    
    console.log(`Successfully created ${pools.length} connections`);
    
    // Test authentication while connections are exhausted
    console.log('\nTesting authentication with exhausted connection pool...');
    const authTests = [];
    const testStart = Date.now();
    
    for (let i = 0; i < 10; i++) {
      const axiosInstance = createAxiosInstance();
      const user = generateTestUser(20000 + i);
      
      authTests.push((async () => {
        const start = performance.now();
        try {
          await axiosInstance.post('/auth/register', user);
          const response = await axiosInstance.post('/auth/login', {
            email: user.email,
            password: user.password
          });
          return {
            success: response.status < 400,
            duration: performance.now() - start,
            status: response.status
          };
        } catch (error) {
          return {
            success: false,
            duration: performance.now() - start,
            error: error.message
          };
        }
      })());
    }
    
    const results = await Promise.all(authTests);
    const testDuration = Date.now() - testStart;
    
    const successful = results.filter(r => r.success).length;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    
    console.log(`\nAuthentication success rate: ${(successful / results.length * 100).toFixed(2)}%`);
    console.log(`Average response time: ${avgDuration.toFixed(2)}ms`);
    console.log(`Total test duration: ${testDuration}ms`);
    
  } finally {
    // Cleanup connections
    console.log('\nCleaning up connections...');
    for (const { pool, client } of pools) {
      try {
        client.release();
        await pool.end();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    clearInterval(monitorInterval);
  }
  
  const report = metrics.getReport();
  console.log('\nSystem metrics during test:');
  console.log(`CPU usage: User ${report.cpu.userTime}, System ${report.cpu.systemTime}`);
  console.log(`Memory pressure: ${report.system.memoryPressure}`);
}

// Test: Memory leak detection
async function testMemoryLeakDetection() {
  console.log('\n=== Memory Leak Detection Test ===');
  
  const { iterations, checkInterval } = STRESS_TESTS.memoryLeak;
  const metrics = new SystemMetrics();
  const axiosInstance = createAxiosInstance();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  const monitorInterval = setInterval(() => metrics.sample(), 1000);
  
  try {
    for (let i = 0; i < iterations; i++) {
      const user = generateTestUser(30000 + i);
      
      // Register
      await axiosInstance.post('/auth/register', user);
      
      // Login multiple times (session regeneration)
      for (let j = 0; j < 3; j++) {
        await axiosInstance.post('/auth/login', {
          email: user.email,
          password: user.password
        });
      }
      
      // Check memory every N iterations
      if ((i + 1) % checkInterval === 0) {
        if (global.gc) global.gc();
        
        const report = metrics.getReport();
        console.log(`Iteration ${i + 1}: Heap ${report.memory.current}, Growth rate: ${report.memory.growthRate}`);
        
        if (report.memory.potentialLeak) {
          console.log('⚠️  Potential memory leak detected!');
        }
      }
    }
  } finally {
    clearInterval(monitorInterval);
  }
  
  const finalReport = metrics.getReport();
  console.log('\nMemory Leak Test Results:');
  console.log(`Total memory growth: ${finalReport.memory.growth}`);
  console.log(`Growth rate: ${finalReport.memory.growthRate}`);
  console.log(`Heap utilization: ${finalReport.memory.heapUtilization}`);
  console.log(`Memory leak detected: ${finalReport.memory.potentialLeak ? 'YES' : 'NO'}`);
  
  return finalReport;
}

// Test: Sustained load
async function testSustainedLoad() {
  console.log('\n=== Sustained Load Test ===');
  
  const { rps, duration } = STRESS_TESTS.sustainedLoad;
  const metrics = new SystemMetrics();
  const startTime = Date.now();
  const requestInterval = 1000 / rps;
  
  let totalRequests = 0;
  let successfulRequests = 0;
  let errors = {};
  let responseTimes = [];
  
  const monitorInterval = setInterval(() => {
    metrics.sample();
    const elapsed = Date.now() - startTime;
    const currentRps = totalRequests / (elapsed / 1000);
    console.log(`[${(elapsed / 1000).toFixed(0)}s] RPS: ${currentRps.toFixed(2)}, Success: ${(successfulRequests / totalRequests * 100).toFixed(2)}%`);
  }, 5000);
  
  // Request worker
  const makeRequest = async () => {
    const axiosInstance = createAxiosInstance();
    const user = generateTestUser(40000 + totalRequests);
    
    const start = performance.now();
    try {
      // Alternate between register and login
      const operation = totalRequests % 2 === 0 ? 'register' : 'login';
      
      if (operation === 'register') {
        const response = await axiosInstance.post('/auth/register', user);
        if (response.status < 400) successfulRequests++;
      } else {
        // Use a previously registered user
        const existingUser = generateTestUser(40000 + totalRequests - 1);
        const response = await axiosInstance.post('/auth/login', {
          email: existingUser.email,
          password: existingUser.password
        });
        if (response.status < 400) successfulRequests++;
      }
      
      responseTimes.push(performance.now() - start);
    } catch (error) {
      errors[error.message] = (errors[error.message] || 0) + 1;
    }
    
    totalRequests++;
  };
  
  // Start sustained load
  const requestIntervalId = setInterval(makeRequest, requestInterval);
  
  // Run for specified duration
  await new Promise(resolve => setTimeout(resolve, duration));
  
  clearInterval(requestIntervalId);
  clearInterval(monitorInterval);
  
  // Calculate final statistics
  const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const sortedTimes = responseTimes.sort((a, b) => a - b);
  const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
  const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
  
  const report = metrics.getReport();
  
  console.log('\nSustained Load Test Results:');
  console.log(`Duration: ${(duration / 1000).toFixed(0)}s`);
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Successful requests: ${successfulRequests} (${(successfulRequests / totalRequests * 100).toFixed(2)}%)`);
  console.log(`Average RPS: ${(totalRequests / (duration / 1000)).toFixed(2)}`);
  console.log(`Response times: Avg ${avgResponseTime.toFixed(2)}ms, P95 ${p95.toFixed(2)}ms, P99 ${p99.toFixed(2)}ms`);
  console.log('\nErrors:');
  Object.entries(errors).forEach(([error, count]) => {
    console.log(`  ${error}: ${count}`);
  });
  console.log('\nSystem impact:');
  console.log(`  Memory growth: ${report.memory.growth}`);
  console.log(`  CPU time: User ${report.cpu.userTime}, System ${report.cpu.systemTime}`);
  console.log(`  Load average: ${report.cpu.loadAverage.join(', ')}`);
}

// Recovery test after overload
async function testRecoveryBehavior() {
  console.log('\n=== Recovery Behavior Test ===');
  
  const metrics = new SystemMetrics();
  const baselineResponseTimes = [];
  const overloadResponseTimes = [];
  const recoveryResponseTimes = [];
  
  // Helper function to measure response time
  const measureResponseTime = async () => {
    const axiosInstance = createAxiosInstance();
    const user = generateTestUser(50000 + Math.random() * 1000);
    
    const start = performance.now();
    try {
      await axiosInstance.post('/auth/register', user);
      const response = await axiosInstance.post('/auth/login', {
        email: user.email,
        password: user.password
      });
      return {
        duration: performance.now() - start,
        success: response.status < 400
      };
    } catch (error) {
      return {
        duration: performance.now() - start,
        success: false
      };
    }
  };
  
  // Phase 1: Baseline
  console.log('Phase 1: Measuring baseline performance...');
  for (let i = 0; i < 20; i++) {
    const result = await measureResponseTime();
    if (result.success) baselineResponseTimes.push(result.duration);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const baselineAvg = baselineResponseTimes.reduce((a, b) => a + b, 0) / baselineResponseTimes.length;
  console.log(`Baseline average response time: ${baselineAvg.toFixed(2)}ms`);
  
  // Phase 2: Create overload
  console.log('\nPhase 2: Creating overload condition...');
  const overloadPromises = [];
  for (let i = 0; i < 500; i++) {
    overloadPromises.push(measureResponseTime());
  }
  
  const overloadResults = await Promise.all(overloadPromises);
  overloadResults.forEach(r => {
    if (r.success) overloadResponseTimes.push(r.duration);
  });
  
  const overloadAvg = overloadResponseTimes.length > 0
    ? overloadResponseTimes.reduce((a, b) => a + b, 0) / overloadResponseTimes.length
    : 0;
  const overloadSuccess = overloadResults.filter(r => r.success).length / overloadResults.length * 100;
  
  console.log(`Overload average response time: ${overloadAvg.toFixed(2)}ms`);
  console.log(`Overload success rate: ${overloadSuccess.toFixed(2)}%`);
  
  // Phase 3: Recovery
  console.log('\nPhase 3: Monitoring recovery...');
  const recoveryStart = Date.now();
  let recovered = false;
  let recoveryTime = 0;
  
  while (Date.now() - recoveryStart < 60000) { // Monitor for up to 1 minute
    const result = await measureResponseTime();
    if (result.success) {
      recoveryResponseTimes.push(result.duration);
      
      // Check if recovered (response time within 20% of baseline)
      if (!recovered && result.duration < baselineAvg * 1.2) {
        recovered = true;
        recoveryTime = Date.now() - recoveryStart;
        console.log(`System recovered after ${(recoveryTime / 1000).toFixed(2)}s`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const recoveryAvg = recoveryResponseTimes.length > 0
    ? recoveryResponseTimes.reduce((a, b) => a + b, 0) / recoveryResponseTimes.length
    : 0;
  
  console.log('\nRecovery Test Results:');
  console.log(`Baseline performance: ${baselineAvg.toFixed(2)}ms`);
  console.log(`Performance during overload: ${overloadAvg.toFixed(2)}ms (${(overloadAvg / baselineAvg).toFixed(2)}x slower)`);
  console.log(`Recovery time: ${recovered ? (recoveryTime / 1000).toFixed(2) + 's' : 'Did not recover'}`);
  console.log(`Performance after recovery: ${recoveryAvg.toFixed(2)}ms`);
}

// Main test runner
async function runStressTests() {
  console.log('Starting Authentication Stress Tests');
  console.log(`Target: ${BASE_URL}`);
  console.log(`System: ${os.cpus().length} CPUs, ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB RAM`);
  console.log('=====================================');
  
  // Check if running with --expose-gc for accurate memory testing
  if (!global.gc) {
    console.log('⚠️  Warning: Run with --expose-gc flag for accurate memory leak detection');
    console.log('   node --expose-gc auth-stress-test.js');
  }
  
  try {
    // Run stress tests
    await testMaxConcurrentSessions();
    await testDatabaseConnectionExhaustion();
    await testMemoryLeakDetection();
    await testSustainedLoad();
    await testRecoveryBehavior();
    
    console.log('\n=====================================');
    console.log('Stress tests completed');
    
  } catch (error) {
    console.error('Test suite failed:', error);
  }
  
  process.exit(0);
}

// Run tests
runStressTests();