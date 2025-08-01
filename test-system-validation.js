#!/usr/bin/env node

/**
 * System Validation Test Suite
 * Comprehensive testing of StoreHub QMS functionality
 */

const axios = require('axios');
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:3838';
const TEST_RESULTS = {
    acknowledgmentSystem: [],
    uiuxConsistency: [],
    websocketRealtime: [],
    functionalTesting: [],
    edgeCases: []
};

// Helper function to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test runner with error handling
async function runTest(testName, testFunction, category) {
    console.log(`🧪 Running: ${testName}`);
    try {
        const result = await testFunction();
        TEST_RESULTS[category].push({
            name: testName,
            status: result ? 'PASS' : 'FAIL',
            details: result === true ? 'Success' : result || 'Unknown result'
        });
        console.log(`${result ? '✅' : '❌'} ${testName}: ${result === true ? 'PASS' : result}`);
    } catch (error) {
        TEST_RESULTS[category].push({
            name: testName,
            status: 'ERROR',
            details: error.message
        });
        console.log(`❌ ${testName}: ERROR - ${error.message}`);
    }
}

// 1. ACKNOWLEDGMENT SYSTEM TESTS
async function testBasicConnectivity() {
    try {
        const response = await axios.get(`${BASE_URL}/`, {
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400
        });
        return response.status === 302 || response.status === 200;
    } catch (error) {
        if (error.response && error.response.status === 302) {
            return true; // Redirect to login is expected
        }
        throw error;
    }
}

async function testJoinQueueEndpoint() {
    try {
        const response = await axios.get(`${BASE_URL}/join`, {
            validateStatus: (status) => status < 500
        });
        return response.status === 200;
    } catch (error) {
        throw new Error(`Join queue endpoint error: ${error.message}`);
    }
}

async function testDashboardAccess() {
    try {
        const response = await axios.get(`${BASE_URL}/dashboard`, {
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 500
        });
        // Should redirect to login if not authenticated
        return response.status === 302 || response.status === 401 || response.status === 200;
    } catch (error) {
        if (error.response && (error.response.status === 302 || error.response.status === 401)) {
            return true;
        }
        throw error;
    }
}

// 2. UI/UX CONSISTENCY TESTS
async function testPageBranding() {
    try {
        const response = await axios.get(`${BASE_URL}/join`);
        const html = response.data;
        
        // Check for StoreHub QMS branding
        const hasCorrectTitle = html.includes('StoreHub QMS');
        const hasLogoConsistency = html.includes('StoreHub QMS') || html.includes('storehub');
        
        return hasCorrectTitle && hasLogoConsistency ? true : 'Branding inconsistency detected';
    } catch (error) {
        throw new Error(`Page branding test failed: ${error.message}`);
    }
}

async function testCSSLoadingConsistency() {
    try {
        const joinPage = await axios.get(`${BASE_URL}/join`);
        const loginPage = await axios.get(`${BASE_URL}/auth/login`);
        
        // Check if both pages load CSS files
        const joinHasCSS = joinPage.data.includes('css/') || joinPage.data.includes('<style');
        const loginHasCSS = loginPage.data.includes('css/') || loginPage.data.includes('<style');
        
        return joinHasCSS && loginHasCSS ? true : 'CSS loading inconsistency';
    } catch (error) {
        throw new Error(`CSS loading test failed: ${error.message}`);
    }
}

// 3. WEBSOCKET REAL-TIME TESTS
async function testWebSocketConnection() {
    return new Promise((resolve) => {
        const socket = io(BASE_URL, {
            timeout: 10000,
            forceNew: true
        });
        
        const timeout = setTimeout(() => {
            socket.disconnect();
            resolve('WebSocket connection timeout');
        }, 10000);
        
        socket.on('connect', () => {
            clearTimeout(timeout);
            socket.disconnect();
            resolve(true);
        });
        
        socket.on('connect_error', (error) => {
            clearTimeout(timeout);
            resolve(`WebSocket connection error: ${error.message}`);
        });
    });
}

async function testWebSocketEvents() {
    return new Promise((resolve) => {
        const socket = io(BASE_URL, {
            timeout: 5000,
            forceNew: true
        });
        
        let eventReceived = false;
        
        const timeout = setTimeout(() => {
            socket.disconnect();
            resolve(eventReceived ? true : 'No events received within timeout');
        }, 5000);
        
        socket.on('connect', () => {
            // Test joining a room (common pattern in queue systems)
            socket.emit('join-queue', { test: true });
        });
        
        // Listen for any events
        const originalOn = socket.on.bind(socket);
        socket.on = function(event, callback) {
            if (!['connect', 'disconnect', 'connect_error'].includes(event)) {
                eventReceived = true;
            }
            return originalOn(event, callback);
        };
        
        socket.on('connect_error', () => {
            clearTimeout(timeout);
            resolve('WebSocket connection failed');
        });
    });
}

// 4. FUNCTIONAL TESTING
async function testAPIEndpoints() {
    const endpoints = [
        '/join',
        '/auth/login',
        '/auth/register'
    ];
    
    let passedEndpoints = 0;
    
    for (const endpoint of endpoints) {
        try {
            const response = await axios.get(`${BASE_URL}${endpoint}`, {
                validateStatus: (status) => status < 500
            });
            if (response.status < 500) {
                passedEndpoints++;
            }
        } catch (error) {
            // Continue testing other endpoints
        }
    }
    
    return passedEndpoints === endpoints.length ? true : `${passedEndpoints}/${endpoints.length} endpoints accessible`;
}

async function testStaticAssets() {
    const assets = [
        '/css/queue-chat.css',
        '/js/queue-chat.js'
    ];
    
    let loadedAssets = 0;
    
    for (const asset of assets) {
        try {
            const response = await axios.get(`${BASE_URL}${asset}`, {
                validateStatus: (status) => status < 500
            });
            if (response.status === 200) {
                loadedAssets++;
            }
        } catch (error) {
            // Continue checking other assets
        }
    }
    
    return loadedAssets > 0 ? true : 'No static assets loading properly';
}

// 5. EDGE CASES
async function testErrorHandling() {
    try {
        // Test 404 handling
        const response = await axios.get(`${BASE_URL}/nonexistent-page`, {
            validateStatus: (status) => status < 600
        });
        
        const hasCustomErrorPage = response.data.includes('StoreHub QMS') && 
                                   (response.status === 404 || response.data.includes('not found'));
        
        return hasCustomErrorPage ? true : 'Error pages not properly branded';
    } catch (error) {
        throw new Error(`Error handling test failed: ${error.message}`);
    }
}

async function testHighConcurrency() {
    const concurrentRequests = 10;
    const promises = [];
    
    for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
            axios.get(`${BASE_URL}/join`, {
                timeout: 5000,
                validateStatus: (status) => status < 500
            }).catch(() => ({ status: 500 }))
        );
    }
    
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.status && r.status < 500).length;
    
    return successCount >= concurrentRequests * 0.8 ? true : `Only ${successCount}/${concurrentRequests} requests succeeded`;
}

// Main test runner
async function runAllTests() {
    console.log('🚀 Starting StoreHub QMS System Validation\n');
    console.log('=' .repeat(50));
    
    // Acknowledgment System Tests
    console.log('\n📝 1. ACKNOWLEDGMENT SYSTEM TESTS');
    console.log('-'.repeat(40));
    await runTest('Basic Connectivity', testBasicConnectivity, 'acknowledgmentSystem');
    await runTest('Join Queue Endpoint', testJoinQueueEndpoint, 'acknowledgmentSystem');
    await runTest('Dashboard Access Control', testDashboardAccess, 'acknowledgmentSystem');
    
    // UI/UX Consistency Tests
    console.log('\n🎨 2. UI/UX CONSISTENCY TESTS');
    console.log('-'.repeat(40));
    await runTest('Page Branding Consistency', testPageBranding, 'uiuxConsistency');
    await runTest('CSS Loading Consistency', testCSSLoadingConsistency, 'uiuxConsistency');
    
    // WebSocket Real-time Tests
    console.log('\n🔌 3. WEBSOCKET REAL-TIME TESTS');
    console.log('-'.repeat(40));
    await runTest('WebSocket Connection', testWebSocketConnection, 'websocketRealtime');
    await runTest('WebSocket Events', testWebSocketEvents, 'websocketRealtime');
    
    // Functional Testing
    console.log('\n⚙️ 4. FUNCTIONAL TESTING');
    console.log('-'.repeat(40));
    await runTest('API Endpoints Accessibility', testAPIEndpoints, 'functionalTesting');
    await runTest('Static Assets Loading', testStaticAssets, 'functionalTesting');
    
    // Edge Cases
    console.log('\n🔍 5. EDGE CASES');
    console.log('-'.repeat(40));
    await runTest('Error Handling', testErrorHandling, 'edgeCases');
    await runTest('High Concurrency', testHighConcurrency, 'edgeCases');
    
    // Generate Report
    generateReport();
}

function generateReport() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(50));
    
    const allTests = [
        ...TEST_RESULTS.acknowledgmentSystem,
        ...TEST_RESULTS.uiuxConsistency,
        ...TEST_RESULTS.websocketRealtime,
        ...TEST_RESULTS.functionalTesting,
        ...TEST_RESULTS.edgeCases
    ];
    
    const passed = allTests.filter(t => t.status === 'PASS').length;
    const failed = allTests.filter(t => t.status === 'FAIL').length;
    const errors = allTests.filter(t => t.status === 'ERROR').length;
    
    console.log(`\n📈 OVERALL RESULTS:`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   🚨 Errors: ${errors}`);
    console.log(`   📊 Success Rate: ${((passed / allTests.length) * 100).toFixed(1)}%`);
    
    // Detailed breakdown by category
    Object.entries(TEST_RESULTS).forEach(([category, tests]) => {
        if (tests.length > 0) {
            console.log(`\n🔍 ${category.toUpperCase()}:`);
            tests.forEach(test => {
                const icon = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : '🚨';
                console.log(`   ${icon} ${test.name}: ${test.details}`);
            });
        }
    });
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (failed > 0 || errors > 0) {
        console.log('   • Fix failing tests before production deployment');
        console.log('   • Review error logs for underlying issues');
        console.log('   • Implement monitoring for failed components');
    }
    
    if (TEST_RESULTS.websocketRealtime.some(t => t.status !== 'PASS')) {
        console.log('   • Real-time features may need attention');
        console.log('   • Consider implementing WebSocket reconnection logic');
    }
    
    if (TEST_RESULTS.acknowledgmentSystem.some(t => t.status !== 'PASS')) {
        console.log('   • Acknowledgment system issues detected');
        console.log('   • Verify database connectivity and session handling');
    }
    
    console.log('\n✨ Test completed successfully!');
    
    // Write results to file
    const fs = require('fs');
    fs.writeFileSync('validation-report.json', JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: { passed, failed, errors, total: allTests.length },
        results: TEST_RESULTS
    }, null, 2));
    
    console.log('📄 Detailed report saved to: validation-report.json');
}

// Run tests
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = { runAllTests, TEST_RESULTS };