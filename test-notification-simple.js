const axios = require('axios');

async function testNotificationSimple() {
    console.log('🔍 Testing Notification Endpoint (Simple Version)');
    console.log('================================================\n');
    
    const baseURL = 'http://localhost:3000';
    
    try {
        // Step 1: Create a simple axios instance with cookie support
        const client = axios.create({
            baseURL,
            headers: {
                'Cookie': '' // We'll build this as we go
            }
        });
        
        let cookies = '';
        
        // Step 2: Login
        console.log('1️⃣ Logging in...');
        
        // Get login page first (for session)
        const loginPageResp = await client.get('/auth/login');
        if (loginPageResp.headers['set-cookie']) {
            cookies = loginPageResp.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
            client.defaults.headers['Cookie'] = cookies;
        }
        
        // Now login
        const loginResp = await client.post('/auth/login',
            'email=admin%40demo.local&password=Password123!',
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': cookies
                },
                maxRedirects: 0,
                validateStatus: (status) => status >= 200 && status < 400
            }
        );
        
        // Update cookies
        if (loginResp.headers['set-cookie']) {
            const newCookies = loginResp.headers['set-cookie'].map(c => c.split(';')[0]);
            const cookieObj = {};
            
            // Parse existing cookies
            cookies.split('; ').forEach(c => {
                const [key, val] = c.split('=');
                if (key) cookieObj[key] = val;
            });
            
            // Add new cookies
            newCookies.forEach(c => {
                const [key, val] = c.split('=');
                if (key) cookieObj[key] = val;
            });
            
            cookies = Object.entries(cookieObj).map(([k, v]) => `${k}=${v}`).join('; ');
            client.defaults.headers['Cookie'] = cookies;
        }
        
        console.log('✅ Login successful\n');
        
        // Step 3: Get dashboard to find queue
        console.log('2️⃣ Getting queue info...');
        const dashResp = await client.get('/dashboard', {
            headers: { 'Cookie': cookies }
        });
        
        const queueMatch = dashResp.data.match(/data-queue-id="([^"]+)"/);
        if (!queueMatch) {
            console.log('❌ No active queue found');
            return;
        }
        
        const queueId = queueMatch[1];
        console.log(`   Queue ID: ${queueId}\n`);
        
        // Step 4: Join queue as customer
        console.log('3️⃣ Joining queue...');
        const customerData = {
            customerName: 'Test User ' + Date.now(),
            customerPhone: '+60123456789',
            partySize: 2
        };
        
        const joinResp = await axios.post(`${baseURL}/api/queue/${queueId}/join`, customerData);
        console.log(`✅ Joined - Position: ${joinResp.data.position}\n`);
        
        // Step 5: THE CRITICAL TEST - Notify customer
        console.log('4️⃣ TESTING NOTIFICATION (Previously crashed here)...');
        
        try {
            const notifyResp = await client.post('/api/queue/notify-table', {
                queueId: queueId,
                customerName: customerData.customerName,
                customerPhone: customerData.customerPhone,
                message: 'Your table is ready!'
            }, {
                headers: { 'Cookie': cookies }
            });
            
            console.log('✅✅✅ NOTIFICATION SENT - SERVER DID NOT CRASH!');
            console.log('   Response:', notifyResp.data);
            
        } catch (notifyErr) {
            if (notifyErr.code === 'ECONNREFUSED') {
                console.log('❌❌❌ SERVER CRASHED!!!');
            } else {
                console.log('❌ Notification failed but server alive');
                console.log('   Error:', notifyErr.response?.data || notifyErr.message);
            }
        }
        
        // Step 6: Health check
        console.log('\n5️⃣ Server health check...');
        try {
            await axios.get(baseURL);
            console.log('✅ Server is still running!\n');
            console.log('🎉 SUCCESS: The crash bug has been fixed!');
        } catch (e) {
            console.log('❌ Server is down - crash bug persists');
        }
        
    } catch (error) {
        console.error('Test error:', error.message);
    }
}

testNotificationSimple();