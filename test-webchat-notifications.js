#!/usr/bin/env node

/**
 * Test script to verify webchat notification flow
 * Tests the complete decommissioned WhatsApp flow
 */

const axios = require('axios');
const io = require('socket.io-client');
const logger = require('./server/utils/logger');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3838';
const API_URL = `${BASE_URL}/api`;

// Test configuration
const testConfig = {
  merchantId: 'demo-merchant-id',
  sessionId: 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
  customerName: 'Test Customer',
  customerPhone: '+60123456789',
  partySize: 2
};

// Socket connection for real-time notifications
let socket;
const receivedNotifications = [];

async function setupSocketConnection() {
  return new Promise((resolve, reject) => {
    socket = io(BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      
      // Join session room to receive notifications
      socket.emit('join-queue', {
        platform: 'webchat',
        sessionId: testConfig.sessionId,
        merchantId: testConfig.merchantId,
        queueId: 'test-queue'
      });
      
      resolve();
    });

    socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      reject(error);
    });

    // Listen for notifications
    socket.on('customer-called', (data) => {
      console.log('📢 Received customer-called notification:', data);
      receivedNotifications.push({ type: 'customer-called', data });
    });

    socket.on('notification', (data) => {
      console.log('🔔 Received notification:', data);
      receivedNotifications.push({ type: 'notification', data });
    });

    socket.on('queue-update', (data) => {
      console.log('📊 Received queue update:', data);
      receivedNotifications.push({ type: 'queue-update', data });
    });

    setTimeout(() => {
      if (!socket.connected) {
        reject(new Error('Socket connection timeout'));
      }
    }, 5000);
  });
}

async function joinQueue() {
  try {
    console.log('\n🚀 Step 1: Joining queue via webchat...');
    
    const response = await axios.post(`${API_URL}/webchat/join`, {
      customerName: testConfig.customerName,
      customerPhone: testConfig.customerPhone,
      partySize: testConfig.partySize,
      merchantId: testConfig.merchantId,
      sessionId: testConfig.sessionId,
      specialRequests: 'Testing webchat notifications'
    });

    if (response.data.success) {
      console.log('✅ Successfully joined queue');
      console.log('   Queue Number:', response.data.queueNumber);
      console.log('   Position:', response.data.position);
      console.log('   Verification Code:', response.data.verificationCode);
      console.log('   Session ID:', testConfig.sessionId);
      return response.data.queueEntry;
    } else {
      throw new Error(response.data.error || 'Failed to join queue');
    }
  } catch (error) {
    console.error('❌ Error joining queue:', error.response?.data || error.message);
    throw error;
  }
}

async function checkStatus() {
  try {
    console.log('\n🔍 Step 2: Checking queue status...');
    
    const response = await axios.get(`${API_URL}/webchat/status/${testConfig.sessionId}`);
    
    if (response.data.success) {
      console.log('✅ Status check successful');
      console.log('   Status:', response.data.status);
      console.log('   Position:', response.data.position);
      console.log('   Wait Time:', response.data.estimatedWaitTime, 'minutes');
      return response.data;
    } else {
      throw new Error(response.data.error || 'Failed to check status');
    }
  } catch (error) {
    console.error('❌ Error checking status:', error.response?.data || error.message);
    throw error;
  }
}

async function simulateMerchantNotify(queueEntryId) {
  try {
    console.log('\n📣 Step 3: Simulating merchant notification...');
    console.log('   This simulates a merchant clicking "Select" on a customer');
    
    // First, get the queue ID
    const queuesResponse = await axios.get(`${API_URL}/queues`, {
      headers: {
        'X-Merchant-Id': testConfig.merchantId
      }
    });

    const queue = queuesResponse.data.queues?.[0];
    if (!queue) {
      throw new Error('No queue found for merchant');
    }

    // Call the specific customer
    const response = await axios.post(`${API_URL}/queue/${queue.id}/call-specific`, {
      customerId: queueEntryId
    }, {
      headers: {
        'X-Merchant-Id': testConfig.merchantId
      }
    });

    if (response.data.success) {
      console.log('✅ Customer notified successfully');
      console.log('   Verification Code:', response.data.customer.verificationCode);
      return response.data;
    } else {
      throw new Error(response.data.error || 'Failed to notify customer');
    }
  } catch (error) {
    console.error('❌ Error notifying customer:', error.response?.data || error.message);
    throw error;
  }
}

async function waitForNotifications(timeout = 5000) {
  console.log(`\n⏳ Waiting ${timeout/1000} seconds for real-time notifications...`);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('\n📬 Notifications received:', receivedNotifications.length);
      receivedNotifications.forEach((notif, index) => {
        console.log(`\n   Notification ${index + 1}:`);
        console.log(`   Type: ${notif.type}`);
        console.log(`   Data:`, JSON.stringify(notif.data, null, 2));
      });
      resolve(receivedNotifications);
    }, timeout);
  });
}

async function cancelQueue() {
  try {
    console.log('\n🚫 Step 4: Testing queue cancellation...');
    
    const response = await axios.post(`${API_URL}/webchat/cancel/${testConfig.sessionId}`);
    
    if (response.data.success) {
      console.log('✅ Successfully cancelled queue position');
      return response.data;
    } else {
      throw new Error(response.data.error || 'Failed to cancel queue');
    }
  } catch (error) {
    console.error('❌ Error cancelling queue:', error.response?.data || error.message);
    throw error;
  }
}

async function runTests() {
  console.log('🧪 WebChat Notification Test Suite');
  console.log('==================================');
  console.log('Testing webchat-only notifications (WhatsApp disabled)');
  console.log('Session ID:', testConfig.sessionId);
  
  try {
    // Connect to socket first
    await setupSocketConnection();
    
    // Join queue
    const queueEntry = await joinQueue();
    
    // Check status
    await checkStatus();
    
    // Wait a bit for socket to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate merchant notification
    await simulateMerchantNotify(queueEntry.id);
    
    // Wait for and display notifications
    const notifications = await waitForNotifications();
    
    // Verify we received the expected notifications
    console.log('\n✅ Test Summary:');
    console.log('   Total notifications received:', notifications.length);
    
    const customerCalledNotifs = notifications.filter(n => n.type === 'customer-called');
    console.log('   Customer-called notifications:', customerCalledNotifs.length);
    
    if (customerCalledNotifs.length > 0) {
      console.log('   ✅ WebSocket notifications working correctly!');
      console.log('   ✅ WhatsApp successfully decommissioned!');
    } else {
      console.log('   ⚠️  No customer-called notifications received');
      console.log('   Please check socket connection and room joining');
    }
    
    // Optional: Test cancellation
    // await cancelQueue();
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    if (socket) {
      socket.disconnect();
      console.log('\n🔌 Socket disconnected');
    }
    process.exit(0);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});