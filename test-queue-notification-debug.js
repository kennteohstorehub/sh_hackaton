const axios = require('axios');

async function debugNotificationFlow() {
    console.log('🔍 DEEP DEBUGGING: Queue Notification System');
    console.log('============================================\n');
    
    const baseURL = 'http://localhost:3000';
    let cookies = '';
    
    try {
        // Step 1: Get CSRF and login
        console.log('1️⃣ Getting CSRF token...');
        const loginPageResp = await axios.get(`${baseURL}/auth/login`);
        if (loginPageResp.headers['set-cookie']) {
            cookies = loginPageResp.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
        }
        
        console.log('2️⃣ Logging in...');
        const loginResp = await axios.post(`${baseURL}/auth/login`,
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
            cookies.split('; ').forEach(c => {
                const [key, val] = c.split('=');
                if (key) cookieObj[key] = val;
            });
            newCookies.forEach(c => {
                const [key, val] = c.split('=');
                if (key) cookieObj[key] = val;
            });
            cookies = Object.entries(cookieObj).map(([k, v]) => `${k}=${v}`).join('; ');
        }
        
        console.log('✅ Login successful\n');
        
        // Step 3: Get active queue
        console.log('3️⃣ Getting active queue...');
        const dashResp = await axios.get(`${baseURL}/dashboard`, {
            headers: { 'Cookie': cookies }
        });
        
        const queueMatch = dashResp.data.match(/data-queue-id="([^"]+)"/);
        if (!queueMatch) {
            console.log('❌ No active queue found');
            return;
        }
        
        const queueId = queueMatch[1];
        console.log(`   Queue ID: ${queueId}\n`);
        
        // Step 4: Join queue
        console.log('4️⃣ Joining queue...');
        const customerData = {
            customerName: 'Debug Test ' + Date.now(),
            customerPhone: '+60123456789',
            partySize: 2
        };
        
        const joinResp = await axios.post(`${baseURL}/api/queue/${queueId}/join`, customerData);
        console.log(`✅ Joined - Entry ID: ${joinResp.data.id}\n`);
        
        // Step 5: Check database BEFORE notification
        console.log('5️⃣ Checking database state BEFORE notification...');
        // We'll check this through the dashboard HTML
        const beforeDash = await axios.get(`${baseURL}/dashboard`, {
            headers: { 'Cookie': cookies }
        });
        const hasBefore = beforeDash.data.includes(customerData.customerName);
        console.log(`   Customer in queue: ${hasBefore ? '✅' : '❌'}\n`);
        
        // Step 6: NOTIFY
        console.log('6️⃣ NOTIFYING CUSTOMER...');
        console.log('   Endpoint: /api/queue/notify-table');
        console.log('   Payload:', {
            queueId,
            customerName: customerData.customerName,
            customerPhone: customerData.customerPhone
        });
        
        try {
            const notifyResp = await axios.post(`${baseURL}/api/queue/notify-table`, {
                queueId: queueId,
                customerName: customerData.customerName,
                customerPhone: customerData.customerPhone,
                message: 'Your table is ready!'
            }, {
                headers: { 'Cookie': cookies }
            });
            
            console.log('✅ Notification response:', notifyResp.status);
            console.log('   Data:', JSON.stringify(notifyResp.data, null, 2));
            
        } catch (notifyErr) {
            console.error('❌ NOTIFICATION FAILED!');
            console.error('   Status:', notifyErr.response?.status);
            console.error('   Error:', notifyErr.response?.data);
            
            if (notifyErr.response?.status === 500) {
                console.error('\n🔴 500 ERROR DETAILS:');
                console.error(JSON.stringify(notifyErr.response.data, null, 2));
            }
        }
        
        // Step 7: Check database AFTER notification
        console.log('\n7️⃣ Checking database state AFTER notification...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const afterDash = await axios.get(`${baseURL}/dashboard`, {
            headers: { 'Cookie': cookies }
        });
        const hasAfter = afterDash.data.includes(customerData.customerName);
        const hasNotified = afterDash.data.includes('Notified') || afterDash.data.includes('called');
        
        console.log(`   Customer still in queue: ${hasAfter ? '✅' : '❌ DISAPPEARED!'}`);
        console.log(`   Shows notified status: ${hasNotified ? '✅' : '❌'}`);
        
        // Step 8: Check customer API
        console.log('\n8️⃣ Checking customer API endpoint...');
        try {
            const statusResp = await axios.get(`${baseURL}/api/queue/${queueId}/status/${joinResp.data.id}`);
            console.log('✅ Customer API working');
            console.log('   Status:', statusResp.data.status);
        } catch (err) {
            console.error('❌ Customer API error:', err.response?.status, err.response?.data?.error);
        }
        
        // Step 9: Analysis
        console.log('\n🔬 ANALYSIS:');
        if (!hasAfter) {
            console.log('❌ CRITICAL: Customer disappears after notification');
            console.log('   Possible causes:');
            console.log('   - Database transaction rollback');
            console.log('   - Cascading delete');
            console.log('   - Socket event removing entry');
        } else if (!hasNotified) {
            console.log('⚠️ Customer visible but status not updated');
            console.log('   Possible causes:');
            console.log('   - Database update failed');
            console.log('   - Frontend not receiving socket event');
        } else {
            console.log('✅ System working correctly');
        }
        
    } catch (error) {
        console.error('\n❌ Test error:', error.message);
    }
}

debugNotificationFlow();