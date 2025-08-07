const axios = require('axios');

async function testNotificationCrash() {
    console.log('🔍 Testing Queue Join → Notification → Crash Flow');
    console.log('=================================================\n');
    
    const baseURL = 'http://localhost:3000';
    const cookieJar = require('axios-cookiejar-support').wrapper(axios.create({
        baseURL,
        withCredentials: true,
        jar: new (require('tough-cookie').CookieJar)()
    }));
    
    try {
        // Step 1: Login as merchant
        console.log('1️⃣ Logging in as merchant...');
        await cookieJar.get('/auth/login'); // Get CSRF token
        
        const loginResponse = await cookieJar.post('/auth/login', 
            new URLSearchParams({
                email: 'admin@demo.local',
                password: 'Password123!'
            }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        console.log('✅ Login successful\n');
        
        // Step 2: Get active queue
        console.log('2️⃣ Getting active queue...');
        const dashboardResponse = await cookieJar.get('/dashboard');
        
        // Extract queue ID from HTML (hacky but works)
        const queueIdMatch = dashboardResponse.data.match(/data-queue-id="([^"]+)"/);
        const queueId = queueIdMatch ? queueIdMatch[1] : '244ef284-bf07-4934-9151-8c2f968f8964';
        console.log(`   Queue ID: ${queueId}\n`);
        
        // Step 3: Join queue as customer
        console.log('3️⃣ Joining queue as customer...');
        const customerData = {
            customerName: 'Test Customer ' + Date.now(),
            customerPhone: '+60123456789',
            partySize: 2,
            serviceType: null,
            specialRequests: 'Testing notification crash'
        };
        
        const joinResponse = await axios.post(`${baseURL}/api/queue/${queueId}/join`, customerData);
        const queueEntry = joinResponse.data;
        console.log(`✅ Joined queue - Position: ${queueEntry.position}`);
        console.log(`   Entry ID: ${queueEntry.id}\n`);
        
        // Step 4: Try to notify customer
        console.log('4️⃣ Attempting to notify customer...');
        console.log('   This is where the crash happens...\n');
        
        try {
            const notifyResponse = await cookieJar.post('/api/queue/notify-table', {
                queueId: queueId,
                customerName: customerData.customerName,
                customerPhone: customerData.customerPhone,
                message: 'Your table is ready!'
            });
            
            console.log('✅ Notification sent successfully');
            console.log('   Response:', notifyResponse.data);
            
        } catch (notifyError) {
            console.error('❌ Notification failed:', notifyError.message);
            if (notifyError.response) {
                console.error('   Status:', notifyError.response.status);
                console.error('   Data:', notifyError.response.data);
            }
        }
        
        // Step 5: Check if server is still running
        console.log('\n5️⃣ Checking server health...');
        try {
            await axios.get(`${baseURL}/`);
            console.log('✅ Server is still running');
        } catch (error) {
            console.error('❌ SERVER CRASHED! Cannot reach server');
        }
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
        }
    }
}

testNotificationCrash();