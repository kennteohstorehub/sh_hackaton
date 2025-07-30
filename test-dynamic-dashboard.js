#!/usr/bin/env node

/**
 * Test script for dynamic dashboard updates
 * This simulates multiple customers joining the queue rapidly
 */

const io = require('socket.io-client');
const { faker } = require('@faker-js/faker');

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3838';
const MERCHANT_ID = process.env.MERCHANT_ID || 'demo_merchant';
const QUEUE_ID = process.env.QUEUE_ID || null;

// Connect to Socket.IO server
const socket = io(SERVER_URL, {
    transports: ['websocket', 'polling']
});

socket.on('connect', () => {
    console.log('✅ Connected to Socket.IO server');
    console.log('   Socket ID:', socket.id);
    
    // Join merchant room
    socket.emit('join-merchant-room', MERCHANT_ID);
    console.log(`   Joined merchant room: ${MERCHANT_ID}`);
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
});

socket.on('error', (error) => {
    console.error('Socket error:', error);
});

// Listen for events to verify they're being received
socket.on('new-customer', (data) => {
    console.log('📥 New customer event received:', {
        customerName: data.customer?.customerName,
        queueId: data.queueId,
        platform: data.customer?.platform
    });
});

socket.on('queue-updated', (data) => {
    console.log('🔄 Queue updated event received');
});

// Function to generate random customer data
function generateCustomer() {
    const platforms = ['whatsapp', 'messenger', 'webchat'];
    const platform = faker.helpers.arrayElement(platforms);
    
    return {
        customerName: faker.person.fullName(),
        phoneNumber: platform === 'webchat' ? null : faker.phone.number('+60#########'),
        partySize: faker.number.int({ min: 1, max: 8 }),
        specialRequests: faker.datatype.boolean(0.3) ? faker.lorem.sentence() : null,
        platform: platform,
        sessionId: platform === 'webchat' ? faker.string.uuid() : null
    };
}

// Function to simulate adding a customer
async function addCustomer(queueId) {
    const customer = generateCustomer();
    
    console.log(`\n🚀 Simulating new customer: ${customer.customerName}`);
    console.log(`   Platform: ${customer.platform}`);
    console.log(`   Party size: ${customer.partySize}`);
    
    // Emit new customer event
    socket.emit('simulate-new-customer', {
        merchantId: MERCHANT_ID,
        queueId: queueId || QUEUE_ID,
        customer: customer
    });
}

// Test scenarios
async function runTests() {
    console.log('\n' + '='.repeat(50));
    console.log('🧪 Starting Dynamic Dashboard Tests');
    console.log('='.repeat(50));
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (!socket.connected) {
        console.error('❌ Not connected to server. Please ensure the server is running.');
        process.exit(1);
    }
    
    console.log('\n📋 Test Scenarios:');
    console.log('1. Single customer addition');
    console.log('2. Rapid multiple customers (5 in 2 seconds)');
    console.log('3. Burst test (10 customers instantly)');
    
    // Test 1: Single customer
    console.log('\n\n🔹 Test 1: Single Customer Addition');
    await addCustomer();
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 2: Rapid multiple customers
    console.log('\n\n🔹 Test 2: Rapid Multiple Customers');
    for (let i = 0; i < 5; i++) {
        await addCustomer();
        await new Promise(resolve => setTimeout(resolve, 400));
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 3: Burst test
    console.log('\n\n🔹 Test 3: Burst Test (10 customers)');
    const promises = [];
    for (let i = 0; i < 10; i++) {
        promises.push(addCustomer());
    }
    await Promise.all(promises);
    
    console.log('\n\n✅ All tests completed!');
    console.log('\nℹ️  Check your dashboard to verify:');
    console.log('   - New customers appear without page reload');
    console.log('   - Smooth animations for each addition');
    console.log('   - Queue positions update correctly');
    console.log('   - Notification popups appear');
    console.log('   - Sound plays (if enabled)');
    console.log('   - Mobile view updates properly');
    
    // Keep connection alive for monitoring
    console.log('\n⏸️  Keeping connection alive. Press Ctrl+C to exit.');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down...');
    socket.disconnect();
    process.exit(0);
});

// Run tests
runTests().catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
});

// Note: This test script requires the server to handle 'simulate-new-customer' events
// or you can modify it to make actual HTTP POST requests to /api/queue/:id/join