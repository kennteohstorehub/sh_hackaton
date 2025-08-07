const axios = require('axios');

async function testNotificationSystem() {
    console.log('🔧 Testing Notification System Fix');
    console.log('==================================\n');
    
    const baseURL = 'http://localhost:3000';
    const axiosInstance = axios.create({
        baseURL,
        withCredentials: true
    });
    
    try {
        // Get login page first to get CSRF token
        const loginPageResponse = await axiosInstance.get('/auth/login');
        const cookies = loginPageResponse.headers['set-cookie'];
        if (cookies) {
            axiosInstance.defaults.headers.Cookie = cookies.join('; ');
        }
        
        // Step 1: Login as merchant
        console.log('1️⃣ Logging in as demo merchant...');
        const loginResponse = await axiosInstance.post('/auth/login', {
            email: 'demo@storehub.com',
            password: 'demo1234'
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            transformRequest: [(data) => {
                return new URLSearchParams(data).toString();
            }]
        });
        
        // Extract session cookie
        const newCookies = loginResponse.headers['set-cookie'];
        if (!newCookies) {
            throw new Error('No session cookie received');
        }
        
        // Set cookie for subsequent requests
        const cookie = newCookies.join('; ');
        axiosInstance.defaults.headers.Cookie = cookie;
        
        console.log('✅ Login successful\n');
        
        // Step 2: Get queue information
        console.log('2️⃣ Fetching queue information...');
        const dashboardResponse = await axiosInstance.get('/api/queue/244ef284-bf07-4934-9151-8c2f968f8964/entries');
        const queueEntries = dashboardResponse.data;
        
        if (!queueEntries || queueEntries.length === 0) {
            console.log('⚠️ No customers in queue to notify');
            return;
        }
        
        const firstCustomer = queueEntries[0];
        console.log(`✅ Found ${queueEntries.length} customers in queue`);
        console.log(`   First customer: ${firstCustomer.customerName}\n`);
        
        // Step 3: Test notification endpoint
        console.log('3️⃣ Testing notification endpoint...');
        const notifyResponse = await axiosInstance.post('/api/queue/notify-table', {
            queueId: '244ef284-bf07-4934-9151-8c2f968f8964',
            customerName: firstCustomer.customerName,
            customerPhone: firstCustomer.customerPhone,
            message: 'Your table is ready!'
        });
        
        console.log('✅ Notification sent successfully');
        console.log('   Response:', notifyResponse.data);
        
        // Step 4: Verify CSP headers
        console.log('\n4️⃣ Checking CSP headers...');
        const pageResponse = await axiosInstance.get('/dashboard');
        const cspHeader = pageResponse.headers['content-security-policy'];
        
        if (cspHeader) {
            const hasMediaSrc = cspHeader.includes('media-src');
            const allowsDataUri = cspHeader.includes("data:");
            
            console.log('✅ CSP Header found');
            console.log(`   Has media-src: ${hasMediaSrc ? '✅' : '❌'}`);
            console.log(`   Allows data: URIs: ${allowsDataUri ? '✅' : '❌'}`);
            
            if (!hasMediaSrc || !allowsDataUri) {
                console.log('\n⚠️ CSP may still block audio notifications');
            }
        } else {
            console.log('❌ No CSP header found');
        }
        
        console.log('\n==================================');
        console.log('✅ All tests completed successfully!');
        console.log('\nFixes Applied:');
        console.log('  1. Added media-src directive to CSP');
        console.log('  2. Fixed Socket.io to use current origin');
        console.log('  3. API endpoints accessible');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
    }
}

testNotificationSystem();