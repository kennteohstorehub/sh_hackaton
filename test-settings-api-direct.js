/**
 * Direct Settings API Test
 * 
 * Simple test script to test the settings API endpoints directly
 * without browser automation - focuses on backend API issues
 */

const http = require('http');
const querystring = require('querystring');

class DirectAPITester {
    constructor() {
        this.host = 'localhost';
        this.port = 3838;
        this.cookies = '';
    }

    makeRequest(options, data = null) {
        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    // Store cookies from login
                    if (res.headers['set-cookie']) {
                        this.cookies = res.headers['set-cookie'].join('; ');
                    }
                    
                    try {
                        const jsonBody = body ? JSON.parse(body) : null;
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            body: jsonBody || body
                        });
                    } catch (e) {
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            body: body
                        });
                    }
                });
            });

            req.on('error', reject);
            
            if (data) {
                req.write(data);
            }
            req.end();
        });
    }

    async login() {
        console.log('🔐 Attempting login...');
        
        const loginData = querystring.stringify({
            email: 'demo@smartqueue.com',
            password: 'demo123456'
        });

        const options = {
            hostname: this.host,
            port: this.port,
            path: '/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(loginData)
            }
        };

        try {
            const response = await this.makeRequest(options, loginData);
            console.log(`📊 Login Status: ${response.statusCode}`);
            
            if (response.statusCode === 302 || response.statusCode === 200) {
                console.log('✅ Login successful');
                return true;
            } else {
                console.log('❌ Login failed');
                console.log('Response:', response.body);
                return false;
            }
        } catch (error) {
            console.error('❌ Login error:', error.message);
            return false;
        }
    }

    async testMerchantProfile() {
        console.log('📋 Testing merchant profile endpoints...');
        
        // Test GET profile
        const getOptions = {
            hostname: this.host,
            port: this.port,
            path: '/api/merchant/profile',
            method: 'GET',
            headers: {
                'Cookie': this.cookies,
                'Content-Type': 'application/json'
            }
        };

        try {
            const getResponse = await this.makeRequest(getOptions);
            console.log(`📊 GET Profile Status: ${getResponse.statusCode}`);
            
            if (getResponse.statusCode === 200) {
                console.log('✅ GET Profile successful');
                console.log('📋 Current merchant data:', JSON.stringify(getResponse.body, null, 2));
            } else {
                console.log('❌ GET Profile failed');
                console.log('Error:', getResponse.body);
            }

            // Test PUT profile update
            const updateData = JSON.stringify({
                businessName: 'Test Restaurant API Update',
                phone: '+1-555-DIRECT-API'
            });

            const putOptions = {
                hostname: this.host,
                port: this.port,
                path: '/api/merchant/profile',
                method: 'PUT',
                headers: {
                    'Cookie': this.cookies,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(updateData)
                }
            };

            console.log('📤 Attempting profile update...');
            const putResponse = await this.makeRequest(putOptions, updateData);
            console.log(`📊 PUT Profile Status: ${putResponse.statusCode}`);
            
            if (putResponse.statusCode === 200) {
                console.log('✅ PUT Profile successful');
                console.log('📋 Update response:', JSON.stringify(putResponse.body, null, 2));
            } else {
                console.log('❌ PUT Profile failed');
                console.log('Error:', JSON.stringify(putResponse.body, null, 2));
                
                // This is likely where we'll see the server-side errors
                if (putResponse.body && putResponse.body.error) {
                    if (putResponse.body.error.includes('editableFields') || 
                        putResponse.body.error.includes('merchantId')) {
                        console.log('🎯 CONFIRMED: Server-side variable issues detected!');
                    }
                }
            }

        } catch (error) {
            console.error('❌ Profile test error:', error.message);
        }
    }

    async runTest() {
        console.log('🚀 Starting direct API test...');
        console.log('==============================');
        
        const loginSuccess = await this.login();
        
        if (loginSuccess) {
            await this.testMerchantProfile();
        } else {
            console.log('⚠️ Skipping profile tests due to login failure');
        }
        
        console.log('\n✅ Direct API test completed');
    }
}

// Run the test
async function main() {
    const tester = new DirectAPITester();
    
    try {
        await tester.runTest();
        process.exit(0);
    } catch (error) {
        console.error('💥 Test failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = DirectAPITester;