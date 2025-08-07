#!/usr/bin/env node

/**
 * Direct BackOffice Authentication Test
 * Test authentication via HTTP requests to identify working credentials
 */

const axios = require('axios');
const cheerio = require('cheerio');

class BackOfficeAuthTest {
    constructor() {
        this.baseUrl = 'http://localhost:3838';
        this.testCredentials = [
            { email: 'backoffice@storehubqms.local', password: 'backoffice123' },
            { email: 'superadmin@storehubqms.local', password: 'superadmin123' },
            { email: 'admin@storehub.com', password: 'admin123' },
            { email: 'test-superadmin@storehubqms.com', password: 'test123' },
            { email: 'admin@example.com', password: 'admin123' },
            { email: 'admin', password: 'admin' }
        ];
        this.cookies = {};
    }

    async getCsrfToken() {
        try {
            console.log('🔑 Getting CSRF token...');
            const response = await axios.get(`${this.baseUrl}/backoffice/auth/login`);
            
            const $ = cheerio.load(response.data);
            const csrfToken = $('input[name="_csrf"]').val();
            
            if (csrfToken) {
                console.log(`   ✅ CSRF token obtained: ${csrfToken.substring(0, 16)}...`);
                return csrfToken;
            } else {
                console.log('   ❌ No CSRF token found');
                return null;
            }
        } catch (error) {
            console.log(`   ❌ Failed to get CSRF token: ${error.message}`);
            return null;
        }
    }

    async testAuthentication() {
        console.log('🔐 Testing BackOffice Authentication...\n');
        
        const csrfToken = await this.getCsrfToken();
        if (!csrfToken) {
            console.log('❌ Cannot proceed without CSRF token');
            return;
        }

        for (const creds of this.testCredentials) {
            console.log(`🧪 Testing credentials: ${creds.email}`);
            
            try {
                const loginData = {
                    email: creds.email,
                    password: creds.password,
                    _csrf: csrfToken,
                    redirect: '/backoffice/dashboard'
                };

                const response = await axios.post(
                    `${this.baseUrl}/backoffice/auth/login`,
                    new URLSearchParams(loginData),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        maxRedirects: 0, // Don't follow redirects so we can see them
                        validateStatus: () => true // Accept all status codes
                    }
                );

                console.log(`   📊 Response: ${response.status} ${response.statusText}`);
                
                if (response.status === 302) {
                    const location = response.headers.location;
                    console.log(`   📍 Redirect to: ${location}`);
                    
                    if (location && location.includes('/dashboard')) {
                        console.log(`   ✅ SUCCESS! Credentials work: ${creds.email}`);
                        
                        // Test accessing dashboard with session
                        await this.testDashboardAccess(response.headers['set-cookie']);
                        return creds;
                    } else if (location && location.includes('/login')) {
                        console.log(`   ❌ Redirected back to login - invalid credentials`);
                    }
                } else if (response.status === 200) {
                    // Check if we got an error message on the login page
                    const $ = cheerio.load(response.data);
                    const errorMessage = $('.error, .alert-error, .alert-danger').text().trim();
                    if (errorMessage) {
                        console.log(`   ❌ Login error: ${errorMessage}`);
                    } else {
                        console.log(`   ❌ Stayed on login page - likely invalid credentials`);
                    }
                } else {
                    console.log(`   ❌ Unexpected response: ${response.status}`);
                }

            } catch (error) {
                console.log(`   ❌ Request failed: ${error.message}`);
            }
            
            console.log(); // Empty line for readability
        }
        
        console.log('❌ No working credentials found');
        return null;
    }

    async testDashboardAccess(sessionCookies) {
        console.log('📊 Testing dashboard access with session...');
        
        try {
            const response = await axios.get(
                `${this.baseUrl}/backoffice/dashboard`,
                {
                    headers: {
                        'Cookie': sessionCookies ? sessionCookies.join('; ') : ''
                    },
                    maxRedirects: 0,
                    validateStatus: () => true
                }
            );

            console.log(`   📊 Dashboard response: ${response.status} ${response.statusText}`);
            
            if (response.status === 200) {
                const hasContent = response.data.includes('dashboard') || 
                                 response.data.includes('Welcome back') ||
                                 response.data.includes('stats-card');
                                 
                if (hasContent) {
                    console.log('   ✅ Dashboard loads successfully with content');
                    return true;
                } else {
                    console.log('   ⚠️ Dashboard loads but missing expected content');
                }
            } else if (response.status === 302) {
                const location = response.headers.location;
                if (location && location.includes('/login')) {
                    console.log('   ❌ Dashboard redirects to login - authentication failed');
                } else {
                    console.log(`   📍 Dashboard redirects to: ${location}`);
                }
            } else {
                console.log(`   ❌ Dashboard access failed: ${response.status}`);
            }

        } catch (error) {
            console.log(`   ❌ Dashboard test failed: ${error.message}`);
        }
        
        return false;
    }

    async testSystemStatus() {
        console.log('🔍 Testing system status...\n');
        
        try {
            // Test if server is responding
            const response = await axios.get(`${this.baseUrl}/`);
            console.log(`✅ Server responding: ${response.status}`);
            
            // Test BackOffice routes
            const routes = [
                '/backoffice',
                '/backoffice/auth/login',
                '/backoffice/auth/setup-check'
            ];
            
            for (const route of routes) {
                try {
                    const routeResponse = await axios.get(`${this.baseUrl}${route}`, { 
                        maxRedirects: 0,
                        validateStatus: () => true 
                    });
                    console.log(`✅ ${route}: ${routeResponse.status}`);
                } catch (error) {
                    console.log(`❌ ${route}: ${error.message}`);
                }
            }
            
        } catch (error) {
            console.log(`❌ Server not responding: ${error.message}`);
        }
        
        console.log();
    }

    async runTest() {
        console.log('🚀 Starting Direct BackOffice Authentication Test...\n');
        
        await this.testSystemStatus();
        const workingCreds = await this.testAuthentication();
        
        if (workingCreds) {
            console.log('🎉 SUMMARY: Authentication system is working!');
            console.log(`✅ Working credentials: ${workingCreds.email} / ${workingCreds.password}`);
            console.log('\n💡 Use these credentials for Puppeteer tests');
        } else {
            console.log('❌ SUMMARY: No working credentials found');
            console.log('\n💡 NEXT STEPS:');
            console.log('   1. Check if BackOffice users exist in database');
            console.log('   2. Verify password hashing is working correctly');
            console.log('   3. Check authentication middleware');
            console.log('   4. Review error logs');
        }
    }
}

// Run the test
async function main() {
    const tester = new BackOfficeAuthTest();
    await tester.runTest();
}

if (require.main === module) {
    main();
}

module.exports = BackOfficeAuthTest;