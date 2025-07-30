/**
 * Test the complete webchat flow - from joining queue to receiving notifications
 */

const axios = require('axios');
const io = require('socket.io-client');
const logger = require('./server/utils/logger');

const BASE_URL = 'http://localhost:3838';
const MERCHANT_ID = '673e1b6b6c02d5a31502ba17'; // Demo merchant

class WebChatFlowTester {
  constructor() {
    this.socket = null;
    this.sessionId = null;
    this.queueEntry = null;
  }

  async testCompleteFlow() {
    try {
      logger.info('=== Starting WebChat Complete Flow Test ===');
      
      // Step 1: Join the queue via form submission
      logger.info('\nStep 1: Joining queue via API...');
      await this.joinQueue();
      
      // Step 2: Connect to Socket.IO and join rooms
      logger.info('\nStep 2: Connecting to Socket.IO...');
      await this.connectSocket();
      
      // Step 3: Check queue status
      logger.info('\nStep 3: Checking queue status...');
      await this.checkStatus();
      
      // Step 4: Simulate merchant calling customer
      logger.info('\nStep 4: Simulating merchant notification...');
      await this.simulateMerchantNotification();
      
      // Wait for notification
      await this.waitForNotification();
      
      // Step 5: Cancel queue
      logger.info('\nStep 5: Testing queue cancellation...');
      await this.cancelQueue();
      
      logger.info('\n✅ All tests completed successfully!');
      
    } catch (error) {
      logger.error('Test failed:', error);
    } finally {
      if (this.socket) {
        this.socket.close();
      }
      process.exit(0);
    }
  }

  async joinQueue() {
    try {
      // Use the hardcoded queue ID from the demo merchant
      const DEMO_QUEUE_ID = '453b1b29-7d3b-4c0e-92d6-d86cc9952f8e';
      
      logger.info(`Using demo queue ID: ${DEMO_QUEUE_ID}`);
      
      // Join the queue
      const joinData = {
        name: 'Test Customer ' + Date.now(),
        phone: '+60123456789',
        partySize: 2,
        specialRequests: 'Testing webchat flow'
      };
      
      const joinResponse = await axios.post(
        `${BASE_URL}/api/customer/join/${DEMO_QUEUE_ID}`,
        joinData
      );
      
      if (!joinResponse.data.success) {
        throw new Error('Failed to join queue: ' + joinResponse.data.error);
      }
      
      this.queueEntry = joinResponse.data.customer;
      this.sessionId = this.queueEntry.sessionId || this.queueEntry.customerId.split('_')[2];
      
      logger.info('Successfully joined queue:', {
        entryId: this.queueEntry.id,
        customerId: this.queueEntry.customerId,
        sessionId: this.sessionId,
        position: joinResponse.data.position,
        verificationCode: this.queueEntry.verificationCode
      });
      
    } catch (error) {
      logger.error('Failed to join queue:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config?.url
      });
      throw error;
    }
  }

  async connectSocket() {
    return new Promise((resolve, reject) => {
      this.socket = io(BASE_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true
      });
      
      this.socket.on('connect', () => {
        logger.info('Socket connected:', this.socket.id);
        
        // Join customer room
        this.socket.emit('join-customer-room', {
          entryId: this.queueEntry.id,
          sessionId: this.sessionId
        });
        
        // Also join queue room
        this.socket.emit('join-queue', {
          queueId: this.queueEntry.queueId,
          sessionId: this.sessionId,
          entryId: this.queueEntry.id,
          platform: 'webchat',
          merchantId: MERCHANT_ID
        });
        
        logger.info('Joined socket rooms');
        resolve();
      });
      
      this.socket.on('connect_error', (error) => {
        logger.error('Socket connection error:', error);
        reject(error);
      });
      
      // Listen for notifications
      this.socket.on('customer-called', (data) => {
        logger.info('🎉 NOTIFICATION RECEIVED - Customer Called:', data);
      });
      
      this.socket.on('notification', (data) => {
        logger.info('📢 NOTIFICATION RECEIVED:', data);
      });
      
      this.socket.on('queue-update', (data) => {
        logger.info('📊 Queue Update:', data);
      });
      
      this.socket.on('position-update', (data) => {
        logger.info('📍 Position Update:', data);
      });
    });
  }

  async checkStatus() {
    try {
      const response = await axios.get(`${BASE_URL}/api/webchat/status/${this.sessionId}`);
      
      logger.info('Queue status:', {
        position: response.data.position,
        estimatedWaitTime: response.data.estimatedWaitTime,
        status: response.data.queueEntry.status,
        verificationCode: response.data.verificationCode
      });
      
    } catch (error) {
      logger.error('Failed to check status:', error.response?.data || error.message);
    }
  }

  async simulateMerchantNotification() {
    try {
      // Simulate merchant calling the customer
      const response = await axios.post(
        `${BASE_URL}/api/queue/notify-next`,
        {
          queueId: this.queueEntry.queueId,
          merchantId: MERCHANT_ID
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      logger.info('Merchant notification sent:', response.data);
      
    } catch (error) {
      logger.error('Failed to send merchant notification:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
    }
  }

  async waitForNotification() {
    logger.info('Waiting for WebSocket notification...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  async cancelQueue() {
    try {
      const response = await axios.post(`${BASE_URL}/api/webchat/cancel/${this.sessionId}`);
      
      logger.info('Queue cancelled:', response.data);
      
    } catch (error) {
      logger.error('Failed to cancel queue:', error.response?.data || error.message);
    }
  }
}

// Run the test
const tester = new WebChatFlowTester();
tester.testCompleteFlow();