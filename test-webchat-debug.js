const io = require('socket.io-client');
const fetch = require('node-fetch');

console.log('=== WEBCHAT NOTIFICATION DEBUG TEST ===\n');

// Configuration
const BASE_URL = 'http://localhost:3838';
const MERCHANT_ID = '6540e8d5861e79dc6ef4f88e'; // Demo merchant

// Generate test data
const sessionId = 'qc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
const customerData = {
    customerName: 'Debug Test User',
    customerPhone: '+60123456789',
    partySize: 2,
    sessionId: sessionId
};

console.log('Test Configuration:');
console.log('- Session ID:', sessionId);
console.log('- Customer:', customerData.customerName);
console.log('- Phone:', customerData.customerPhone);
console.log('\n');

// Step 1: Submit queue form
async function joinQueue() {
    console.log('Step 1: Joining queue via form submission...');
    
    try {
        const response = await fetch(`${BASE_URL}/api/customer/join-queue`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...customerData,
                queueId: '6540e907861e79dc6ef4f895', // Demo queue
                platform: 'webchat'
            })
        });
        
        const result = await response.json();
        console.log('Queue join response:', result);
        
        if (result.success) {
            console.log('✅ Successfully joined queue');
            console.log('- Entry ID:', result.entryId);
            console.log('- Position:', result.position);
            console.log('- Verification Code:', result.verificationCode);
            return result;
        } else {
            console.error('❌ Failed to join queue:', result.message);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Error joining queue:', error);
        process.exit(1);
    }
}

// Step 2: Connect socket and join rooms
function connectSocket(queueData) {
    console.log('\nStep 2: Connecting to WebSocket...');
    
    const socket = io(BASE_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true
    });
    
    socket.on('connect', () => {
        console.log('✅ Connected to server');
        console.log('- Socket ID:', socket.id);
        
        // Join customer room using entry ID (primary method)
        console.log('\nStep 3: Joining customer rooms...');
        socket.emit('join-customer-room', {
            entryId: queueData.entryId,
            sessionId: sessionId
        });
        
        // Also emit join-queue for additional setup
        socket.emit('join-queue', {
            queueId: queueData.queueId,
            sessionId: sessionId,
            entryId: queueData.entryId,
            platform: 'webchat',
            merchantId: MERCHANT_ID
        });
        
        console.log('✅ Room join requests sent');
        console.log('- Entry ID:', queueData.entryId);
        console.log('- Session ID:', sessionId);
        
        // Log all events for debugging
        const events = ['customer-called', 'queue-update', 'position-update', 'notification-revoked'];
        events.forEach(event => {
            socket.on(event, (data) => {
                console.log(`\n🔔 Event: ${event}`);
                console.log('Data:', JSON.stringify(data, null, 2));
                
                if (event === 'customer-called') {
                    console.log('\n✅ NOTIFICATION RECEIVED SUCCESSFULLY!');
                    console.log('Verification code:', data.verificationCode);
                    setTimeout(() => process.exit(0), 1000);
                }
            });
        });
        
        console.log('\n✅ Listening for notifications...');
        console.log('\n📋 NEXT STEPS:');
        console.log('1. Go to dashboard: http://localhost:3838/dashboard');
        console.log('2. Find this customer:', customerData.customerName);
        console.log('3. Click "Notify" button');
        console.log('4. Watch for notification here');
        console.log('\nEntry ID to look for:', queueData.entryId);
    });
    
    socket.on('disconnect', () => {
        console.log('\n❌ Disconnected from server');
    });
    
    socket.on('error', (error) => {
        console.log('\n❌ Socket error:', error);
    });
    
    // Debug: Log raw socket events
    const originalEmit = socket.emit;
    socket.emit = function(...args) {
        console.log('[DEBUG] Emitting:', args[0], args.slice(1));
        return originalEmit.apply(this, args);
    };
    
    return socket;
}

// Run the test
async function runTest() {
    try {
        // Join queue first
        const queueData = await joinQueue();
        
        // Then connect socket
        const socket = connectSocket(queueData);
        
        // Keep running for 5 minutes
        setTimeout(() => {
            console.log('\n⏱️ Test timeout after 5 minutes');
            process.exit(0);
        }, 300000);
        
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

runTest();