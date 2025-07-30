/**
 * Test script for the new card-based acknowledgment system
 * This script simulates the customer being called and shows the new card UI
 */

const http = require('http');
const socketIO = require('socket.io');
const express = require('express');

// Create a simple test server
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Test data
const testEntryId = 'test-entry-123';
const testSessionId = 'qc_test_session_123';
const testVerificationCode = 'ABC123';

console.log('Card-Based Acknowledgment Test Script');
console.log('=====================================');
console.log('');
console.log('This script will simulate a customer being called');
console.log('and demonstrate the new card-based acknowledgment UI.');
console.log('');
console.log('Instructions:');
console.log('1. Start the main server: npm run dev');
console.log('2. Open the webchat in a browser');
console.log('3. Run this script: node test-card-acknowledgment.js');
console.log('4. The script will trigger the "customer called" event');
console.log('');
console.log('Test Flow:');
console.log('- Initial notification with verification code card');
console.log('- Two action cards: "I\'m headed to restaurant" and "Cancel"');
console.log('- Warning at 4 minutes');
console.log('- Final warning at 5 minutes');
console.log('- Auto-cancellation at 7 minutes');
console.log('');

// Connect to the main server as a client
const ioClient = require('socket.io-client');
const client = ioClient('http://localhost:3838');

client.on('connect', () => {
    console.log('Connected to main server');
    
    // Wait a moment then trigger the customer called event
    setTimeout(() => {
        console.log('Triggering customer called event...');
        
        // Emit the event that would normally come from the dashboard
        client.emit('test-customer-called', {
            entryId: testEntryId,
            customerId: `webchat_${testSessionId}`,
            verificationCode: testVerificationCode,
            queueName: 'Test Restaurant Queue',
            position: 1
        });
        
        console.log('Event sent! Check the webchat UI to see:');
        console.log('- Inline card notification (not popup)');
        console.log('- Large verification code display');
        console.log('- Action buttons below the message');
        console.log('- Message input hidden during interaction');
        console.log('');
        console.log('Try the following:');
        console.log('1. Click "I\'m headed to restaurant" - see confirmation');
        console.log('2. Click "Cancel my spot" - see confirmation flow');
        console.log('3. Wait for timeout warnings to appear');
        console.log('');
        
        // Simulate timeout warnings
        setTimeout(() => {
            console.log('>>> 4 minute warning should appear now');
        }, 4000); // 4 seconds for demo (normally 4 minutes)
        
        setTimeout(() => {
            console.log('>>> 5 minute final warning should appear now');
        }, 5000); // 5 seconds for demo (normally 5 minutes)
        
        setTimeout(() => {
            console.log('>>> 7 minute auto-cancellation should happen now');
            process.exit(0);
        }, 7000); // 7 seconds for demo (normally 7 minutes)
        
    }, 2000);
});

client.on('error', (error) => {
    console.error('Connection error:', error);
    console.log('Make sure the main server is running on port 3838');
    process.exit(1);
});

// Keep the script running
process.on('SIGINT', () => {
    console.log('\nTest script terminated');
    client.close();
    process.exit(0);
});