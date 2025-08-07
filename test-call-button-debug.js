#!/usr/bin/env node

/**
 * Test script to debug Call button issues on dashboard
 * This script will help identify all problems preventing the Call button from working
 */

const http = require('http');
const https = require('https');

console.log('🔍 DEBUG: Call Button Issues Analysis');
console.log('=====================================');

// Test 1: Check if server is running
function testServerRunning() {
    return new Promise((resolve) => {
        console.log('\n1. Checking if server is running on port 3838...');
        
        const req = http.request({
            hostname: 'localhost',
            port: 3838,
            path: '/',
            method: 'GET',
            timeout: 5000
        }, (res) => {
            console.log('✅ Server is running - Status:', res.statusCode);
            resolve(true);
        });

        req.on('error', (err) => {
            console.log('❌ Server not running or not accessible:', err.message);
            resolve(false);
        });

        req.on('timeout', () => {
            console.log('❌ Server request timed out');
            resolve(false);
        });

        req.end();
    });
}

// Test 2: Check API endpoint with CSRF token
function testAPIEndpoint() {
    return new Promise((resolve) => {
        console.log('\n2. Testing API endpoint /api/queue/test-id/call-specific...');
        
        // First get a session and CSRF token by accessing dashboard
        const req1 = http.request({
            hostname: 'localhost',
            port: 3838,
            path: '/dashboard',
            method: 'GET',
        }, (res1) => {
            let cookies = '';
            if (res1.headers['set-cookie']) {
                cookies = res1.headers['set-cookie'].join('; ');
            }
            
            let data = '';
            res1.on('data', chunk => data += chunk);
            res1.on('end', () => {
                // Try to extract CSRF token from response
                const csrfMatch = data.match(/const csrfToken = '([^']+)'/);
                const csrfToken = csrfMatch ? csrfMatch[1] : null;
                
                console.log('Dashboard access status:', res1.statusCode);
                console.log('Has cookies:', !!cookies);
                console.log('CSRF token found:', !!csrfToken);
                console.log('CSRF token:', csrfToken?.substring(0, 10) + '...');

                if (!csrfToken) {
                    console.log('❌ No CSRF token found in dashboard');
                    return resolve(false);
                }

                // Now test the API endpoint
                const postData = JSON.stringify({ customerId: 'test-customer-id' });
                
                const req2 = http.request({
                    hostname: 'localhost',
                    port: 3838,
                    path: '/api/queue/test-queue-id/call-specific',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData),
                        'Cookie': cookies,
                        'X-CSRF-Token': csrfToken  // Testing with capital letters first
                    }
                }, (res2) => {
                    let responseData = '';
                    res2.on('data', chunk => responseData += chunk);
                    res2.on('end', () => {
                        console.log('API call status:', res2.statusCode);
                        console.log('API response:', responseData);
                        
                        if (res2.statusCode === 403) {
                            console.log('❌ 403 Forbidden - likely CSRF token issue');
                            
                            // Try with lowercase header
                            console.log('Trying with lowercase x-csrf-token header...');
                            const req3 = http.request({
                                hostname: 'localhost',
                                port: 3838,
                                path: '/api/queue/test-queue-id/call-specific',
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Content-Length': Buffer.byteLength(postData),
                                    'Cookie': cookies,
                                    'x-csrf-token': csrfToken  // Lowercase version
                                }
                            }, (res3) => {
                                let responseData3 = '';
                                res3.on('data', chunk => responseData3 += chunk);
                                res3.on('end', () => {
                                    console.log('API call with lowercase header status:', res3.statusCode);
                                    console.log('API response:', responseData3);
                                    resolve(res3.statusCode !== 403);
                                });
                            });
                            req3.write(postData);
                            req3.end();
                        } else {
                            resolve(res2.statusCode < 400);
                        }
                    });
                });

                req2.on('error', (err) => {
                    console.log('❌ API request failed:', err.message);
                    resolve(false);
                });

                req2.write(postData);
                req2.end();
            });
        });

        req1.on('error', (err) => {
            console.log('❌ Dashboard access failed:', err.message);
            resolve(false);
        });

        req1.end();
    });
}

async function runTests() {
    console.log('Starting Call button debug tests...\n');
    
    const serverRunning = await testServerRunning();
    if (!serverRunning) {
        console.log('\n❌ Server is not running. Please start the server first.');
        return;
    }
    
    const apiWorking = await testAPIEndpoint();
    
    console.log('\n=====================================');
    console.log('🔍 DIAGNOSIS SUMMARY');
    console.log('=====================================');
    
    if (serverRunning && apiWorking) {
        console.log('✅ All basic tests passed');
        console.log('✅ Issue might be in frontend JavaScript implementation');
    } else if (serverRunning && !apiWorking) {
        console.log('✅ Server is running');
        console.log('❌ API endpoint has issues (likely CSRF header case mismatch)');
        console.log('💡 SOLUTION: Change X-CSRF-Token to x-csrf-token in dashboard JavaScript');
    } else {
        console.log('❌ Server issues detected');
    }
    
    console.log('\n=====================================');
    console.log('🛠️ RECOMMENDED FIXES');
    console.log('=====================================');
    console.log('1. Fix CSRF header case: Change "X-CSRF-Token" to "x-csrf-token" in callCustomer function');
    console.log('2. Ensure proper error handling in frontend');
    console.log('3. Add better debugging logs to callCustomer function');
}

// Run the tests
runTests().catch(console.error);