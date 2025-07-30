/**
 * Test merchant dashboard notification to webchat customer
 */

const axios = require('axios');
const io = require('socket.io-client');
const logger = require('./server/utils/logger');

const BASE_URL = 'http://localhost:3838';
const DEMO_QUEUE_ID = '453b1b29-7d3b-4c0e-92d6-d86cc9952f8e';
const MERCHANT_ID = '673e1b6b6c02d5a31502ba17';

class MerchantNotificationTester {
  constructor() {
    this.customerSocket = null;
    this.queueEntry = null;
    this.notificationReceived = false;
  }

  async test() {
    try {
      logger.info('=== Testing Merchant Dashboard to WebChat Notifications ===\n');
      
      // Step 1: Create a customer in the queue
      logger.info('Step 1: Creating test customer...');
      await this.createCustomer();
      
      // Step 2: Connect customer to Socket.IO
      logger.info('\nStep 2: Connecting customer to Socket.IO...');
      await this.connectCustomerSocket();
      
      // Step 3: Get current queue state
      logger.info('\nStep 3: Getting queue state...');
      await this.getQueueState();
      
      // Step 4: Notify specific customer
      logger.info('\nStep 4: Testing specific customer notification...');
      await this.notifySpecificCustomer();
      
      // Wait for notification
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (this.notificationReceived) {
        logger.info('\n✅ SUCCESS: Customer received notification via WebSocket!');
      } else {
        logger.error('\n❌ FAILED: Customer did not receive notification');
      }
      
    } catch (error) {
      logger.error('Test failed:', error);
    } finally {
      if (this.customerSocket) {
        this.customerSocket.close();
      }
      process.exit(this.notificationReceived ? 0 : 1);
    }
  }

  async createCustomer() {
    try {
      const joinData = {
        name: 'Notification Test ' + Date.now(),
        phone: '+601' + Math.floor(Math.random() * 100000000),
        partySize: 2,
        specialRequests: 'Testing merchant notifications'
      };
      
      const response = await axios.post(
        `${BASE_URL}/api/customer/join/${DEMO_QUEUE_ID}`,
        joinData
      );
      
      if (!response.data.success) {
        throw new Error('Failed to join queue');
      }
      
      this.queueEntry = response.data.customer;
      this.sessionId = this.queueEntry.sessionId || this.queueEntry.customerId.split('_')[2];
      
      logger.info('Customer created:', {
        entryId: this.queueEntry.id,
        customerId: this.queueEntry.customerId,
        sessionId: this.sessionId,
        position: response.data.position,
        verificationCode: this.queueEntry.verificationCode
      });
      
    } catch (error) {
      logger.error('Failed to create customer:', error.response?.data || error.message);
      throw error;
    }
  }

  async connectCustomerSocket() {
    return new Promise((resolve, reject) => {
      this.customerSocket = io(BASE_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true
      });
      
      // Set up event listeners before connecting
      this.customerSocket.on('customer-called', (data) => {
        logger.info('\n🎉 CUSTOMER-CALLED EVENT RECEIVED!');
        logger.info('Notification data:', JSON.stringify(data, null, 2));
        this.notificationReceived = true;
      });
      
      this.customerSocket.on('notification', (data) => {
        logger.info('\n📢 NOTIFICATION EVENT RECEIVED!');
        logger.info('Notification data:', JSON.stringify(data, null, 2));
        this.notificationReceived = true;
      });
      
      this.customerSocket.on('connect', () => {
        logger.info('Customer socket connected:', this.customerSocket.id);
        
        // Join all possible rooms
        const rooms = [
          { entryId: this.queueEntry.id, sessionId: this.sessionId },
          this.queueEntry.customerId,
          `webchat_${this.sessionId}`,
          `phone-${this.queueEntry.customerPhone}`
        ];
        
        // Try different room join methods
        logger.info('Joining rooms:');
        
        // Method 1: join-customer-room with object
        this.customerSocket.emit('join-customer-room', {
          entryId: this.queueEntry.id,
          sessionId: this.sessionId
        });
        logger.info(`  - Joined via join-customer-room (object)`);
        
        // Method 2: join-customer-room with string
        this.customerSocket.emit('join-customer-room', this.queueEntry.id);
        logger.info(`  - Joined via join-customer-room (entry ID)`);
        
        // Method 3: join-queue
        this.customerSocket.emit('join-queue', {
          queueId: this.queueEntry.queueId,
          sessionId: this.sessionId,
          entryId: this.queueEntry.id,
          platform: 'webchat',
          merchantId: MERCHANT_ID
        });
        logger.info(`  - Joined via join-queue`);
        
        resolve();
      });
      
      this.customerSocket.on('connect_error', (error) => {
        logger.error('Customer socket connection error:', error);
        reject(error);
      });
    });
  }

  async getQueueState() {
    try {
      const response = await axios.get(`${BASE_URL}/api/queue/${DEMO_QUEUE_ID}`);
      
      const waitingCustomers = response.data.entries.filter(e => e.status === 'waiting');
      logger.info(`Queue has ${waitingCustomers.length} waiting customers`);
      
      // Find our customer
      const ourCustomer = response.data.entries.find(e => e.id === this.queueEntry.id);
      if (ourCustomer) {
        logger.info('Our customer in queue:', {
          position: ourCustomer.position,
          status: ourCustomer.status
        });
      }
      
    } catch (error) {
      logger.error('Failed to get queue state:', error.response?.data || error.message);
    }
  }

  async notifySpecificCustomer() {
    try {
      logger.info(`Sending notification to customer ${this.queueEntry.id}...`);
      
      // Use call-specific endpoint to notify this customer
      const response = await axios.post(
        `${BASE_URL}/api/queue/${DEMO_QUEUE_ID}/call-specific`,
        {
          customerId: this.queueEntry.id
        }
      );
      
      logger.info('Notification API response:', response.data);
      
    } catch (error) {
      logger.error('Failed to send notification:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
    }
  }
}

// Run the test
const tester = new MerchantNotificationTester();
tester.test();