#!/usr/bin/env node

/**
 * Direct Login Test for admin@demo.local
 * Tests the authentication endpoint directly
 */

const axios = require('axios');

async function testLogin() {
    const baseUrl = 'http://demo.lvh.me:3838';
    
    console.log('🔍 Testing login endpoint directly...');
    console.log('='.repeat(50));
    
    try {
        // Test with correct password
        console.log('\n1. Testing with correct password (Demo123!@#)...');
        const correctResponse = await axios.post(`${baseUrl}/auth/login`, {
            email: 'admin@demo.local',
            password: 'Demo123!@#'
        }, {
            validateStatus: () => true, // Don't throw on redirects
            maxRedirects: 0 // Don't follow redirects
        });
        
        console.log(`   Status: ${correctResponse.status}`);
        console.log(`   Headers: ${JSON.stringify(correctResponse.headers, null, 2)}`);
        if (correctResponse.status === 302) {
            console.log(`   ✅ Redirect to: ${correctResponse.headers.location}`);
        }
        
        // Test with wrong password
        console.log('\n2. Testing with wrong password (Password123!)...');
        const wrongResponse = await axios.post(`${baseUrl}/auth/login`, {
            email: 'admin@demo.local',
            password: 'Password123!'
        }, {
            validateStatus: () => true,
            maxRedirects: 0
        });
        
        console.log(`   Status: ${wrongResponse.status}`);
        if (wrongResponse.status === 302) {
            console.log(`   ❌ Redirect to: ${wrongResponse.headers.location}`);
        }
        
        // Test merchant service directly
        console.log('\n3. Testing merchant service authenticate method...');
        const merchantService = require('./server/services/merchantService');
        
        const authResult1 = await merchantService.authenticate('admin@demo.local', 'Demo123!@#', null);
        console.log(`   Correct password result: ${authResult1 ? '✅ SUCCESS' : '❌ FAILED'}`);
        
        const authResult2 = await merchantService.authenticate('admin@demo.local', 'Password123!', null);
        console.log(`   Wrong password result: ${authResult2 ? '✅ SUCCESS' : '❌ FAILED'}`);
        
    } catch (error) {
        console.error('❌ Test error:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Make sure the server is running on port 3838');
            console.log('   Run: npm start or ./quick-start.sh');
        }
    }
}

testLogin();