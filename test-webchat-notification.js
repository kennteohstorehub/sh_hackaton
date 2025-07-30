const io = require('socket.io-client');

console.log('Testing webchat notification system...\n');

// Test scenario:
// 1. Connect as webchat client
// 2. Join queue
// 3. Listen for notifications

const socket = io('http://localhost:3838', {
    transports: ['websocket', 'polling']
});

const testSessionId = 'test_' + Date.now();
const testPhone = '+60123456789';
const testCustomerId = `web_${testPhone}_${Date.now()}`;

socket.on('connect', () => {
    console.log('✅ Connected to server');
    console.log('Socket ID:', socket.id);
    
    // Join customer rooms
    console.log('\n📥 Joining customer rooms...');
    socket.emit('join-customer-room', testCustomerId);
    socket.emit('join-customer-room', `webchat_${testSessionId}`);
    socket.emit('join-customer-room', `web_${testPhone}`);
    
    console.log(`- Joined: customer-${testCustomerId}`);
    console.log(`- Joined: customer-webchat_${testSessionId}`);
    console.log(`- Joined: customer-web_${testPhone}`);
    
    // Join queue
    console.log('\n🔗 Joining queue...');
    socket.emit('join-queue', {
        queueId: 'test-queue',
        sessionId: testSessionId,
        customerId: testCustomerId,
        platform: 'webchat',
        merchantId: 'test-merchant'
    });
});

// Listen for notifications
socket.on('customer-called', (data) => {
    console.log('\n🎉 NOTIFICATION RECEIVED!');
    console.log('Data:', JSON.stringify(data, null, 2));
    console.log('\n✅ Notification system is working!');
    process.exit(0);
});

socket.on('notification-revoked', (data) => {
    console.log('\n⚠️ Notification revoked:', data);
});

socket.on('queue-update', (data) => {
    console.log('\n📊 Queue update:', data);
});

socket.on('position-update', (data) => {
    console.log('\n📍 Position update:', data);
});

socket.on('disconnect', () => {
    console.log('\n❌ Disconnected from server');
});

socket.on('error', (error) => {
    console.log('\n❌ Socket error:', error);
});

// Test instructions
console.log('\n📋 INSTRUCTIONS:');
console.log('1. Keep this script running');
console.log('2. Go to the backend dashboard');
console.log('3. Find a customer and click "Notify"');
console.log('4. This script should receive the notification');
console.log('\nTest Customer ID formats that should work:');
console.log(`- ${testCustomerId}`);
console.log(`- webchat_${testSessionId}`);
console.log(`- Any ID starting with web_${testPhone}_*`);
console.log('\nWaiting for notifications...\n');

// Keep the script running
setTimeout(() => {
    console.log('\n⏱️ Test timeout after 5 minutes');
    process.exit(0);
}, 300000);