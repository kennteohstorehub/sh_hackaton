#!/usr/bin/env node

const axios = require('axios');
const io = require('socket.io-client');
const logger = require('./server/utils/logger');

const BASE_URL = 'http://localhost:3838';
const API_BASE = `${BASE_URL}/api`;

// Test configuration
const TEST_MERCHANT_ID = '7a99f35e-0f73-4f8e-831c-fde8fc3a5532'; // Your merchant ID
const TEST_SESSIONS = ['test-session-1', 'test-session-2', 'test-session-3'];

async function testQueueFlow() {
    console.log('\n🔍 Starting Real-time Queue Test\n');
    
    try {
        // 1. Connect to Socket.IO as merchant
        console.log('1️⃣ Connecting to Socket.IO as merchant...');
        const merchantSocket = io(BASE_URL, {
            transports: ['polling', 'websocket'],
            reconnection: false
        });
        
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Socket.IO connection timeout'));
            }, 5000);
            
            merchantSocket.on('connect', () => {
                clearTimeout(timeout);
                console.log('   ✅ Merchant connected to Socket.IO');
                merchantSocket.emit('join-merchant-room', TEST_MERCHANT_ID);
                resolve();
            });
            
            merchantSocket.on('connect_error', (error) => {
                clearTimeout(timeout);
                console.error('   ❌ Socket.IO connection error:', error.message);
                reject(error);
            });
        });
        
        // Track events
        const events = [];
        merchantSocket.on('new-customer', (data) => {
            console.log('   📢 New customer event received:', {
                customerName: data.entry?.customerName,
                position: data.entry?.position
            });
            events.push({ type: 'new-customer', data });
        });
        
        merchantSocket.on('queue-update', (data) => {
            console.log('   📢 Queue update event received');
            events.push({ type: 'queue-update', data });
        });
        
        // 2. Join queue with multiple customers
        console.log('\n2️⃣ Adding customers to queue...');
        const customers = [];
        
        for (let i = 0; i < TEST_SESSIONS.length; i++) {
            const sessionId = TEST_SESSIONS[i];
            const customerData = {
                customerName: `Test Customer ${i + 1}`,
                customerPhone: `+6012345678${i}`,
                partySize: 2,
                merchantId: TEST_MERCHANT_ID,
                sessionId: sessionId,
                specialRequests: `Test request ${i + 1}`
            };
            
            console.log(`\n   Adding customer ${i + 1}...`);
            const response = await axios.post(`${API_BASE}/webchat/join`, customerData);
            
            console.log(`   ✅ Customer ${i + 1} joined:`, {
                position: response.data.position,
                queueNumber: response.data.queueNumber,
                verificationCode: response.data.verificationCode
            });
            
            customers.push({
                ...response.data.queueEntry,
                sessionId
            });
            
            // Wait a bit between customers
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // 3. Check queue positions
        console.log('\n3️⃣ Verifying queue positions...');
        let positionError = false;
        customers.forEach((customer, index) => {
            const expectedPosition = index + 1;
            if (customer.position !== expectedPosition) {
                console.log(`   ❌ Position error: Customer ${customer.customerName} has position ${customer.position}, expected ${expectedPosition}`);
                positionError = true;
            } else {
                console.log(`   ✅ Customer ${customer.customerName} has correct position: ${customer.position}`);
            }
        });
        
        // 4. Check real-time events
        console.log('\n4️⃣ Checking real-time events...');
        console.log(`   Received ${events.length} real-time events`);
        const newCustomerEvents = events.filter(e => e.type === 'new-customer');
        console.log(`   New customer events: ${newCustomerEvents.length} (expected: ${TEST_SESSIONS.length})`);
        
        // 5. Test notification
        console.log('\n5️⃣ Testing customer notification...');
        const customerToNotify = customers[0];
        
        // Connect as customer
        const customerSocket = io(BASE_URL, {
            transports: ['websocket']
        });
        
        await new Promise((resolve) => {
            customerSocket.on('connect', () => {
                console.log('   ✅ Customer connected to Socket.IO');
                customerSocket.emit('join-queue', {
                    platform: 'webchat',
                    sessionId: customerToNotify.sessionId,
                    queueId: customerToNotify.queueId
                });
                resolve();
            });
        });
        
        // Listen for notification
        let notificationReceived = false;
        customerSocket.on('customer-called', (data) => {
            console.log('   🔔 Customer received notification!', {
                verificationCode: data.verificationCode,
                message: data.message
            });
            notificationReceived = true;
        });
        
        // Send notification
        console.log('   Sending notification to customer...');
        const notifyResponse = await axios.post(`${API_BASE}/queue/${customerToNotify.queueId}/call-specific`, {
            customerId: customerToNotify.id
        });
        
        console.log('   Notification response:', notifyResponse.data.message);
        
        // Wait for notification
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 6. Summary
        console.log('\n📊 Test Summary:');
        console.log('   ✅ Connected to Socket.IO successfully');
        console.log(`   ${positionError ? '❌' : '✅'} Queue positions are ${positionError ? 'incorrect' : 'correct'}`);
        console.log(`   ${newCustomerEvents.length === TEST_SESSIONS.length ? '✅' : '❌'} Real-time events: ${newCustomerEvents.length}/${TEST_SESSIONS.length}`);
        console.log(`   ${notificationReceived ? '✅' : '❌'} Customer notification ${notificationReceived ? 'received' : 'NOT received'}`);
        
        // Cleanup
        merchantSocket.disconnect();
        customerSocket.disconnect();
        
        console.log('\n✅ Test completed!\n');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
    
    process.exit(0);
}

// Run test
testQueueFlow();