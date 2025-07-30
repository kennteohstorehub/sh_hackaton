const io = require('socket.io-client');
const axios = require('axios');

const BASE_URL = 'http://localhost:3838';
const QUEUE_ID = '453b1b29-7d3b-4c0e-92d6-d86cc9952f8e';

async function testNotifications() {
    console.log('=== Testing Socket.IO Notifications ===\n');
    
    // Generate unique phone
    const phone = `+6012345${Math.floor(Math.random() * 90000) + 10000}`;
    console.log('Test phone:', phone);
    
    // Step 1: Join queue as customer
    console.log('\n1. Joining queue...');
    try {
        const joinResponse = await axios.post(`${BASE_URL}/api/customer/join/${QUEUE_ID}`, {
            name: 'Test Customer',
            phone: phone,
            partySize: 2,
            specialRequests: 'Socket test'
        });
        
        const customer = joinResponse.data.customer;
        console.log('✅ Joined queue:', {
            position: customer.position,
            customerId: customer.customerId,
            verificationCode: customer.verificationCode
        });
        
        // Step 2: Connect Socket.IO as customer
        console.log('\n2. Connecting Socket.IO as customer...');
        const customerSocket = io(BASE_URL);
        
        customerSocket.on('connect', () => {
            console.log('✅ Customer socket connected:', customerSocket.id);
            
            // Join customer rooms
            const rooms = [
                customer.customerId,
                `webchat_${customer.sessionId || Date.now()}`,
                `web_${phone}_*`
            ];
            
            console.log('Joining rooms:', rooms);
            rooms.forEach(room => {
                customerSocket.emit('join-customer-room', room);
            });
        });
        
        // Listen for notifications
        customerSocket.on('customer-called', (data) => {
            console.log('\n🎉 NOTIFICATION RECEIVED:', data);
            process.exit(0);
        });
        
        // Step 3: After 2 seconds, notify customer as admin
        setTimeout(async () => {
            console.log('\n3. Notifying customer as admin...');
            
            try {
                // First login as admin
                const loginResponse = await axios.get(`${BASE_URL}/auth/login`);
                const cookies = loginResponse.headers['set-cookie'];
                
                // Get CSRF token
                const dashboardResponse = await axios.get(`${BASE_URL}/dashboard`, {
                    headers: { Cookie: cookies.join('; ') }
                });
                
                const csrfMatch = dashboardResponse.data.match(/csrfToken['"]\s*:\s*['"]([^'"]+)/);
                const csrfToken = csrfMatch ? csrfMatch[1] : '';
                
                console.log('CSRF token obtained:', csrfToken ? '✅' : '❌');
                
                // Call specific customer
                const notifyResponse = await axios.post(
                    `${BASE_URL}/api/queue/${QUEUE_ID}/call-specific`,
                    { customerId: customer.id || customer._id },
                    {
                        headers: {
                            'Cookie': cookies.join('; '),
                            'X-CSRF-Token': csrfToken,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                console.log('Notify response:', notifyResponse.data.success ? '✅ Success' : '❌ Failed');
                
                // Wait 5 seconds for notification
                setTimeout(() => {
                    console.log('\n❌ Timeout: No notification received after 5 seconds');
                    customerSocket.disconnect();
                    process.exit(1);
                }, 5000);
                
            } catch (error) {
                console.error('Error notifying:', error.response?.data || error.message);
                process.exit(1);
            }
        }, 2000);
        
    } catch (error) {
        console.error('Error joining queue:', error.response?.data || error.message);
        process.exit(1);
    }
}

testNotifications();