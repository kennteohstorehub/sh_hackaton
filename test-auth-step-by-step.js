#!/usr/bin/env node

/**
 * Step-by-step authentication debugging
 */

const axios = require('axios');
const cheerio = require('cheerio');

async function debugAuthStep() {
    const baseUrl = 'http://localhost:3838';
    
    console.log('🔍 Step-by-step Authentication Debug\n');

    try {
        // Step 1: Get login page
        console.log('📝 Step 1: Get login page');
        const loginPageResponse = await axios.get(`${baseUrl}/backoffice/auth/login`);
        console.log(`   Status: ${loginPageResponse.status}`);
        
        const $ = cheerio.load(loginPageResponse.data);
        const csrfToken = $('input[name="_csrf"]').val();
        console.log(`   CSRF Token: ${csrfToken ? csrfToken.substring(0, 16) + '...' : 'NOT FOUND'}`);
        
        // Step 2: Check form fields
        const emailField = $('input[name="email"]').length;
        const passwordField = $('input[name="password"]').length;
        console.log(`   Email field: ${emailField ? 'FOUND' : 'NOT FOUND'}`);
        console.log(`   Password field: ${passwordField ? 'FOUND' : 'NOT FOUND'}`);
        
        if (!csrfToken) {
            console.log('❌ No CSRF token found. Cannot proceed.');
            return;
        }

        // Step 3: Try login with each credential
        const testCredentials = [
            { email: 'testadmin@example.com', password: 'testpassword123' },
            { email: 'backoffice@storehubqms.local', password: 'backoffice123456' },
            { email: 'superadmin@storehubqms.local', password: 'superadmin123456' },
            { email: 'admin@storehub.com', password: 'admin123456789' },
        ];

        for (const creds of testCredentials) {
            console.log(`\n🧪 Step 2: Test login - ${creds.email}`);
            
            try {
                const loginData = new URLSearchParams({
                    email: creds.email,
                    password: creds.password,
                    _csrf: csrfToken,
                    redirect: '/backoffice/dashboard'
                });

                const loginResponse = await axios.post(
                    `${baseUrl}/backoffice/auth/login`,
                    loginData,
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Cookie': loginPageResponse.headers['set-cookie']?.join('; ') || ''
                        },
                        maxRedirects: 0,
                        validateStatus: () => true
                    }
                );

                console.log(`   Status: ${loginResponse.status} ${loginResponse.statusText}`);
                
                if (loginResponse.status === 400) {
                    console.log('   ❌ 400 Bad Request - likely validation error');
                    
                    // Check if it's JSON response
                    if (loginResponse.headers['content-type']?.includes('application/json')) {
                        try {
                            const errorData = loginResponse.data;
                            console.log('   📋 Error details:', JSON.stringify(errorData, null, 2));
                        } catch (e) {
                            console.log('   📋 Error response (not JSON):', loginResponse.data.substring(0, 200));
                        }
                    } else {
                        // Check for validation errors in HTML
                        const $error = cheerio.load(loginResponse.data);
                        const errorMsg = $error('.error, .alert-error, .validation-error').text().trim();
                        if (errorMsg) {
                            console.log(`   📋 Error message: ${errorMsg}`);
                        }
                    }
                } else if (loginResponse.status === 403) {
                    console.log('   ❌ 403 Forbidden - authentication/authorization issue');
                } else if (loginResponse.status === 302) {
                    const location = loginResponse.headers.location;
                    console.log(`   📍 Redirected to: ${location}`);
                    
                    if (location?.includes('/dashboard')) {
                        console.log('   ✅ SUCCESS! Login worked');
                        return creds;
                    } else if (location?.includes('/login')) {
                        console.log('   ❌ Redirected back to login');
                    }
                } else if (loginResponse.status === 429) {
                    console.log('   ❌ 429 Too Many Requests - rate limited');
                    break; // Stop trying if rate limited
                }

            } catch (error) {
                console.log(`   ❌ Request error: ${error.message}`);
            }
        }

        // Step 4: Check if users exist with proper passwords
        console.log('\n🔍 Step 3: Database verification needed');
        console.log('   Run: node check-backoffice-users.js');
        console.log('   Check if passwords meet validation requirements (8+ chars)');

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

debugAuthStep();