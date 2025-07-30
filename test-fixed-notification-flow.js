#!/usr/bin/env node

/**
 * Test script to verify fixed webchat notification flow
 * This tests the complete flow from customer joining queue to receiving notification
 */

const axios = require('axios');
const io = require('socket.io-client');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3838';
const MERCHANT_ID = '7a99f35e-0f73-4f8e-831c-fde8fc3a5532'; // StoreHub Demo Restaurant (auth bypass)

// Test data
const testCustomer = {
    customerName: 'Test Customer ' + Date.now(),
    customerPhone: '+60' + Math.floor(1000000000 + Math.random() * 9000000000),
    partySize: 2,
    merchantId: MERCHANT_ID,
    sessionId: 'qc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    specialRequests: 'Testing notification flow'
};

let socket;
let queueEntryData;

console.log('🧪 Testing Fixed Webchat Notification Flow');
console.log('==========================================');
console.log('Test Customer:', testCustomer);
console.log('');

async function setupSocketConnection() {
    return new Promise((resolve, reject) => {
        console.log('1️⃣ Setting up Socket.IO connection...');
        
        socket = io(BASE_URL, {
            transports: ['websocket'],
            reconnection: true
        });
        
        socket.on('connect', () => {
            console.log('✅ Socket connected:', socket.id);
            resolve();
        });
        
        socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error.message);
            reject(error);
        });
        
        // Listen for customer-called event
        socket.on('customer-called', (data) => {
            console.log('\n🎉 NOTIFICATION RECEIVED! 🎉');
            console.log('=====================================');
            console.log('Notification data:', JSON.stringify(data, null, 2));
            console.log('');
            
            // Check if this is our notification
            if (data.entryId === queueEntryData?.id || 
                data.customerId === queueEntryData?.customerId ||
                data.verificationCode === queueEntryData?.verificationCode) {
                console.log('✅ This is our notification!');
                console.log('✅ Verification code:', data.verificationCode);
                console.log('\n🎊 TEST PASSED - Customer received notification successfully! 🎊');
                process.exit(0);
            } else {
                console.log('⚠️ Notification received but not for our customer');
            }
        });
        
        // Listen for other relevant events
        socket.on('queue-update', (data) => {
            console.log('📊 Queue update:', data);
        });
        
        socket.on('position-update', (data) => {
            console.log('📍 Position update:', data);
        });
        
        socket.on('disconnect', () => {
            console.log('❌ Socket disconnected');
        });
    });
}

async function joinQueue() {
    console.log('\n2️⃣ Joining queue via webchat API...');
    
    try {
        const response = await axios.post(`${BASE_URL}/api/webchat/join`, testCustomer);
        
        if (response.data.success) {
            queueEntryData = response.data.queueEntry;
            console.log('✅ Successfully joined queue!');
            console.log('Queue Number:', response.data.queueNumber);
            console.log('Position:', response.data.position);
            console.log('Entry ID:', queueEntryData.id || queueEntryData.entryId);
            console.log('Customer ID:', queueEntryData.customerId);
            console.log('Verification Code:', response.data.verificationCode);
            
            // Join the appropriate socket rooms
            console.log('\n3️⃣ Joining socket rooms...');
            
            // Join using the entry-based method
            socket.emit('join-customer-room', {
                entryId: queueEntryData.id || queueEntryData.entryId,
                sessionId: testCustomer.sessionId
            });
            
            // Also emit join-queue for additional setup
            socket.emit('join-queue', {
                queueId: queueEntryData.queueId,
                sessionId: testCustomer.sessionId,
                entryId: queueEntryData.id || queueEntryData.entryId,
                platform: 'webchat',
                merchantId: MERCHANT_ID
            });
            
            console.log('✅ Socket room join requests sent');
            
            return queueEntryData;
        } else {
            throw new Error('Failed to join queue: ' + JSON.stringify(response.data));
        }
    } catch (error) {
        console.error('❌ Error joining queue:', error.response?.data || error.message);
        throw error;
    }
}

async function notifyCustomer() {
    console.log('\n4️⃣ Simulating merchant calling customer...');
    console.log('Entry ID to notify:', queueEntryData.id);
    console.log('Customer ID:', queueEntryData.customerId);
    console.log('Queue ID:', queueEntryData.queueId);
    
    try {
        // In bypass mode, we don't need authentication
        // Call the specific customer
        const notifyResponse = await axios.post(
            `${BASE_URL}/api/queue/${queueEntryData.queueId}/call-specific`,
            { customerId: queueEntryData.id },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Notification API called successfully');
        console.log('Response:', notifyResponse.data.success ? 'Success' : 'Failed');
        
        // Wait for the socket notification to arrive
        console.log('\n⏳ Waiting for socket notification (10 seconds timeout)...');
        
        setTimeout(() => {
            console.error('\n❌ TIMEOUT - No notification received after 10 seconds');
            console.log('\nDebugging information:');
            console.log('- Entry ID:', queueEntryData.id);
            console.log('- Customer ID:', queueEntryData.customerId);
            console.log('- Session ID:', testCustomer.sessionId);
            console.log('- Socket ID:', socket.id);
            console.log('- Socket connected:', socket.connected);
            process.exit(1);
        }, 10000);
        
    } catch (error) {
        console.error('❌ Error calling customer:', error.response?.data || error.message);
        throw error;
    }
}

async function runTest() {
    try {
        await setupSocketConnection();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Give socket time to stabilize
        
        await joinQueue();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Give time for room joins
        
        await notifyCustomer();
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
runTest();

// Cleanup on exit
process.on('SIGINT', () => {
    console.log('\n\nCleaning up...');
    if (socket) socket.close();
    process.exit(0);
});