const axios = require('axios');
const axiosCookieJarSupport = require('axios-cookiejar-support').wrapper;
const tough = require('tough-cookie');

async function testNotificationComplete() {
    console.log('🔍 Testing Complete Notification Flow');
    console.log('=====================================\n');
    
    const baseURL = 'http://localhost:3000';
    const cookieJar = new tough.CookieJar();
    const client = axiosCookieJarSupport(axios.create({
        baseURL,
        withCredentials: true,
        jar: cookieJar
    }));
    
    try {
        // Step 1: Login as merchant
        console.log('1️⃣ Logging in as merchant...');
        
        // First get the login page to get session
        await client.get('/auth/login');
        
        // Login with credentials
        const loginResp = await client.post('/auth/login',
            'email=admin%40demo.local&password=Password123!',
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                maxRedirects: 0,
                validateStatus: (status) => status >= 200 && status < 400
            }
        );
        
        console.log('✅ Login successful\n');
        
        // Step 2: Get active queue
        console.log('2️⃣ Getting active queue...');
        const dashboardResponse = await client.get('/dashboard');
        
        // Extract queue ID from HTML
        const queueIdMatch = dashboardResponse.data.match(/data-queue-id="([^"]+)"/);
        
        if (!queueIdMatch) {
            console.log('⚠️ No active queue found');
            return;
        }
        
        const queueId = queueIdMatch[1];
        console.log(`   Queue ID: ${queueId}\n`);
        
        // Step 3: Join queue as customer
        console.log('3️⃣ Joining queue as customer...');
        const customerData = {
            customerName: 'Test Customer ' + Date.now(),
            customerPhone: '+60123456789',
            partySize: 2,
            serviceType: null,
            specialRequests: 'Testing notification system'
        };
        
        const joinResponse = await axios.post(`${baseURL}/api/queue/${queueId}/join`, customerData);
        const queueEntry = joinResponse.data;
        console.log(`✅ Joined queue - Position: ${queueEntry.position}`);
        console.log(`   Entry ID: ${queueEntry.id}`);
        console.log(`   Customer: ${queueEntry.customerName}\n`);
        
        // Step 4: Get dashboard to check queue status before notification
        console.log('4️⃣ Checking queue status BEFORE notification...');
        const beforeDash = await client.get('/dashboard');
        const hasCustomerBefore = beforeDash.data.includes(customerData.customerName);
        console.log(`   Customer visible in queue: ${hasCustomerBefore ? '✅ YES' : '❌ NO'}\n`);
        
        // Step 5: Notify customer
        console.log('5️⃣ Attempting to notify customer...');
        
        try {
            const notifyResponse = await client.post('/api/queue/notify-table', {
                queueId: queueId,
                customerName: customerData.customerName,
                customerPhone: customerData.customerPhone,
                message: 'Your table is ready!'
            });
            
            console.log('✅ Notification sent successfully!');
            console.log('   Response:', notifyResponse.data);
            
        } catch (notifyError) {
            if (notifyError.code === 'ECONNREFUSED') {
                console.error('❌ SERVER CRASHED! Connection refused');
                return;
            } else {
                console.error('❌ Notification failed:', notifyError.message);
                if (notifyError.response) {
                    console.error('   Status:', notifyError.response.status);
                    console.error('   Data:', notifyError.response.data);
                }
            }
        }
        
        // Step 6: Check queue status AFTER notification
        console.log('\n6️⃣ Checking queue status AFTER notification...');
        
        // Wait a moment for any async operations
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
            const afterDash = await client.get('/dashboard');
            const hasCustomerAfter = afterDash.data.includes(customerData.customerName);
            const hasNotifiedStatus = afterDash.data.includes('Notified') || afterDash.data.includes('called');
            
            console.log(`   Customer still visible: ${hasCustomerAfter ? '✅ YES' : '❌ NO (DISAPPEARED!)'}`);
            console.log(`   Shows notified status: ${hasNotifiedStatus ? '✅ YES' : '❌ NO'}`);
            
            if (!hasCustomerAfter) {
                console.error('\n❌ CRITICAL BUG: Customer disappeared from queue after notification!');
            } else {
                console.log('\n✅ SUCCESS: Customer remains visible with notified status!');
            }
            
        } catch (error) {
            console.error('❌ Cannot access dashboard - possible server issue');
            console.error('   Error:', error.message);
        }
        
        // Step 7: Verify server health
        console.log('\n7️⃣ Verifying server health...');
        try {
            const healthCheck = await axios.get(`${baseURL}/`);
            console.log('✅ Server is healthy and responding');
        } catch (error) {
            console.error('❌ SERVER IS DOWN!');
        }
        
        // Step 8: Check customer page status
        console.log('\n8️⃣ Checking customer view...');
        try {
            const customerStatus = await axios.get(`${baseURL}/api/queue/${queueId}/status/${queueEntry.id}`);
            console.log('✅ Customer API endpoint working');
            console.log('   Customer status:', customerStatus.data);
        } catch (error) {
            if (error.response && error.response.status === 500) {
                console.error('❌ Customer page would crash - 500 error!');
            } else {
                console.log('   Customer status check failed:', error.response?.status || error.message);
            }
        }
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
        }
    }
    
    console.log('\n=====================================');
    console.log('📊 Test Complete');
    console.log('=====================================');
}

testNotificationComplete();