#!/usr/bin/env node

/**
 * Demo Functionality Test
 * Tests actual demo functionality with proper merchant ID
 */

const axios = require('axios');
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:3838';

async function testDemoFunctionality() {
    console.log('🚀 Testing StoreHub QMS Demo Functionality\n');
    
    try {
        // 1. Test demo merchant access
        console.log('1️⃣ Testing demo merchant setup...');
        const demoResponse = await axios.get(`${BASE_URL}/demo`);
        console.log(`✅ Demo page accessible: ${demoResponse.status === 200}`);
        
        // 2. Test join queue with demo merchant ID (using likely demo ID)
        console.log('\n2️⃣ Testing customer queue join...');
        const merchantId = '0f97ed6c-7240-4f05-98f9-5f47571bd6b3'; // StoreHub Restaurant demo merchant
        
        try {
            const joinResponse = await axios.get(`${BASE_URL}/join/${merchantId}`);
            console.log(`✅ Join queue page accessible: ${joinResponse.status === 200}`);
            
            // Check if page contains expected elements
            const html = joinResponse.data;
            const hasCustomerForm = html.includes('customerName') || html.includes('name');
            const hasPhoneField = html.includes('phone') || html.includes('Phone');
            const hasPartySizeField = html.includes('partySize') || html.includes('Party');
            
            console.log(`✅ Customer form present: ${hasCustomerForm}`);
            console.log(`✅ Phone field present: ${hasPhoneField}`);
            console.log(`✅ Party size field present: ${hasPartySizeField}`);
            
        } catch (error) {
            console.log(`❌ Join queue test failed: ${error.response?.status} - ${error.message}`);
            
            // Try alternative endpoint
            try {
                const altResponse = await axios.get(`${BASE_URL}/join-queue/${merchantId}`);
                console.log(`✅ Alternative join queue endpoint works: ${altResponse.status === 200}`);
            } catch (altError) {
                console.log(`❌ Alternative join queue also failed: ${altError.response?.status}`);
            }
        }
        
        // 3. Test WebSocket functionality
        console.log('\n3️⃣ Testing WebSocket real-time features...');
        
        const socket = io(BASE_URL, {
            timeout: 5000,
            forceNew: true
        });
        
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                socket.disconnect();
                reject(new Error('WebSocket connection timeout'));
            }, 5000);
            
            socket.on('connect', () => {
                console.log('✅ WebSocket connected successfully');
                clearTimeout(timeout);
                
                // Test joining a queue room
                socket.emit('join-queue', { 
                    queueId: 'test-queue-id',
                    customerId: 'test-customer-id'
                });
                
                // Test if we can receive events
                socket.on('queue-update', (data) => {
                    console.log('✅ Received queue update event');
                });
                
                socket.on('position-update', (data) => {
                    console.log('✅ Received position update event');
                });
                
                setTimeout(() => {
                    socket.disconnect();
                    resolve();
                }, 2000);
            });
            
            socket.on('connect_error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        }).catch(error => {
            console.log(`❌ WebSocket test failed: ${error.message}`);
        });
        
        // 4. Test authentication system
        console.log('\n4️⃣ Testing authentication system...');
        
        const authResponse = await axios.get(`${BASE_URL}/auth/login`);
        const authHtml = authResponse.data;
        
        const hasLoginForm = authHtml.includes('email') && authHtml.includes('password');
        const hasCSRFToken = authHtml.includes('csrf') || authHtml.includes('_token');
        const hasStoreHubBranding = authHtml.includes('StoreHub');
        
        console.log(`✅ Login form present: ${hasLoginForm}`);
        console.log(`✅ CSRF protection present: ${hasCSRFToken}`);
        console.log(`✅ StoreHub branding present: ${hasStoreHubBranding}`);
        
        // 5. Test static assets
        console.log('\n5️⃣ Testing static assets...');
        
        const assets = [
            '/css/queue-chat.css',
            '/js/queue-chat.js',
            '/css/main.css'
        ];
        
        for (const asset of assets) {
            try {
                const assetResponse = await axios.get(`${BASE_URL}${asset}`);
                console.log(`✅ ${asset}: ${assetResponse.status === 200 ? 'loaded' : 'failed'}`);
            } catch (error) {
                console.log(`❌ ${asset}: failed to load`);
            }
        }
        
        // 6. Test error handling
        console.log('\n6️⃣ Testing error handling...');
        
        try {
            const errorResponse = await axios.get(`${BASE_URL}/nonexistent-page`);
        } catch (error) {
            if (error.response && error.response.status === 404) {
                const errorHtml = error.response.data;
                const hasCustomError = errorHtml.includes('StoreHub QMS');
                console.log(`✅ Custom 404 page: ${hasCustomError ? 'present' : 'missing'}`);
            }
        }
        
        // 7. Test queue chat functionality
        console.log('\n7️⃣ Testing queue chat interface...');
        
        try {
            const chatResponse = await axios.get(`${BASE_URL}/queue-chat`);
            const chatHtml = chatResponse.data;
            
            const hasMessagesContainer = chatHtml.includes('messagesContainer') || chatHtml.includes('messages');
            const hasInputField = chatHtml.includes('messageInput') || chatHtml.includes('input');
            const hasSendButton = chatHtml.includes('Send') || chatHtml.includes('send');
            
            console.log(`✅ Messages container: ${hasMessagesContainer ? 'present' : 'missing'}`);
            console.log(`✅ Input field: ${hasInputField ? 'present' : 'missing'}`);
            console.log(`✅ Send functionality: ${hasSendButton ? 'present' : 'missing'}`);
            
        } catch (error) {
            console.log(`❌ Queue chat test failed: ${error.response?.status}`);
        }
        
        console.log('\n✨ Demo functionality testing completed!');
        
    } catch (error) {
        console.error('❌ Demo functionality test failed:', error.message);
    }
}

// Run the test
testDemoFunctionality();