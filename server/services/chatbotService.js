const logger = require('../utils/logger');
const queueService = require('./queueService');
const merchantService = require('./merchantService');
const prisma = require('../utils/prisma');

class ChatbotService {
  constructor() {
    this.userSessions = new Map(); // Store user conversation state
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  /**
   * Main message processing entry point
   */
  async processMessage(platform, phoneNumber, message, merchantId = null) {
    try {
      // Clean up expired sessions
      this.cleanupExpiredSessions();
      
      const userSession = this.getUserSession(phoneNumber);
      const response = await this.generateBotResponse(message, userSession, merchantId, platform);
      
      // Update user session
      this.updateUserSession(phoneNumber, response.sessionUpdate || {});
      
      return {
        success: true,
        message: response.message,
        options: response.options || null,
        sessionState: response.sessionUpdate?.state || userSession.state
      };
    } catch (error) {
      logger.error('Error processing chatbot message:', error);
      return {
        success: false,
        error: error.message,
        message: "Sorry, I'm having trouble right now. Please try again in a moment."
      };
    }
  }

  /**
   * Generate bot response based on message and context
   */
  async generateBotResponse(message, userSession, merchantId, platform) {
    const lowerMessage = message.toLowerCase().trim();
    
    // Check if message contains QR token
    const tokenMatch = message.match(/token:\s*([a-f0-9]+)/i);
    if (tokenMatch) {
      return await this.handleQRToken(tokenMatch[1], userSession, merchantId);
    }

    // Handle different conversation states
    switch (userSession.state) {
      case 'waiting_for_name':
        return await this.handleNameInput(message, userSession);
      
      case 'waiting_for_phone':
        return await this.handlePhoneInput(message, userSession);
      
      case 'waiting_for_queue_selection':
        return await this.handleQueueSelection(message, userSession);
      
      case 'waiting_for_service_selection':
        return await this.handleServiceSelection(message, userSession);
      
      case 'waiting_for_status_check':
        return await this.handleStatusCheck(message, userSession);
      
      case 'in_queue':
        return await this.handleInQueueCommands(lowerMessage, userSession);
      
      default:
        return await this.handleInitialMessage(lowerMessage, userSession, merchantId);
    }
  }

  /**
   * Handle QR code token (simplified - no token validation)
   */
  async handleQRToken(token, userSession, merchantId) {
    try {
      // For now, just show the main menu when QR code is scanned
      return await this.showMainMenu(merchantId || '507f1f77bcf86cd799439011');
    } catch (error) {
      logger.error('Error handling QR token:', error);
      return {
        message: "❌ Error processing QR code. Please try again or type 'menu'.",
        sessionUpdate: { state: 'initial' }
      };
    }
  }

  /**
   * Handle initial message
   */
  async handleInitialMessage(message, userSession, merchantId) {
    // Auto-detect merchant if not provided
    if (!merchantId) {
      merchantId = '507f1f77bcf86cd799439011'; // Demo merchant
    }

    if (message.includes('hi') || message.includes('hello') || message.includes('menu') || message.includes('start')) {
      return await this.showMainMenu(merchantId);
    }
    
    if (message.includes('join') || message.includes('queue')) {
      return await this.showAvailableQueues(merchantId);
    }
    
    if (message.includes('status') || message.includes('check')) {
      return {
        message: "📱 To check your queue status, please provide your phone number:",
        sessionUpdate: { state: 'waiting_for_status_check', merchantId }
      };
    }

    if (message.includes('cancel') || message.includes('leave')) {
      return await this.handleCancelRequest(userSession, merchantId);
    }

    // Default response
    return await this.showMainMenu(merchantId);
  }

  /**
   * Show main menu
   */
  async showMainMenu(merchantId) {
    try {
      const merchant = await merchantService.findById(merchantId);
      const businessName = merchant ? merchant.businessName : 'Our Business';
      
      return {
        message: `🏪 Welcome to ${businessName}!\n\nHow can I help you today?\n\n1️⃣ Join Queue\n2️⃣ Check Status\n3️⃣ Cancel Booking\n4️⃣ Business Hours\n5️⃣ Contact Info\n\nReply with a number or type your request.`,
        sessionUpdate: { state: 'main_menu', merchantId },
        options: {
          buttons: [
            { id: 'join', title: '🎯 Join Queue' },
            { id: 'status', title: '📊 Check Status' },
            { id: 'cancel', title: '❌ Cancel' },
            { id: 'hours', title: '🕒 Hours' }
          ]
        }
      };
    } catch (error) {
      return {
        message: "🏪 Welcome! How can I help you?\n\n1️⃣ Join Queue\n2️⃣ Check Status\n3️⃣ Cancel Booking\n\nReply with a number or type your request.",
        sessionUpdate: { state: 'main_menu', merchantId }
      };
    }
  }

  /**
   * Show available queues
   */
  async showAvailableQueues(merchantId) {
    try {
      const queues = await queueService.findByMerchant(merchantId);
      const activeQueues = queues.filter(q => q.isActive);
      
      if (queues.length === 0) {
        return {
          message: "😔 No active queues available right now. Please check back later or contact us directly.",
          sessionUpdate: { state: 'main_menu', merchantId }
        };
      }

      let message = "🍽️ Available Queues:\n\n";
      const queueOptions = [];
      
      activeQueues.forEach((queue, index) => {
        const waitTime = queue.averageServiceTime || 15;
        const waitingCount = queue.entries?.filter(e => e.status === 'waiting').length || 0;
        message += `${index + 1}️⃣ ${queue.name}\n`;
        message += `   ⏱️ Wait: ~${waitTime} min\n`;
        message += `   👥 Waiting: ${waitingCount}/${queue.maxCapacity}\n`;
        if (queue.description) {
          message += `   📝 ${queue.description}\n`;
        }
        message += `\n`;
        
        queueOptions.push({
          id: `queue_${queue._id}`,
          title: `${queue.name} (~${waitTime}min)`
        });
      });
      
      message += "Reply with the queue number to join:";

      return {
        message,
        sessionUpdate: { 
          state: 'waiting_for_queue_selection',
          availableQueues: queues.map(q => ({
            id: q.id,
            name: q.name,
            waitTime: q.averageServiceTime || 15,
            currentLength: q.entries?.filter(e => e.status === 'waiting').length || 0,
            maxCapacity: q.maxCapacity
          })),
          merchantId 
        },
        options: {
          buttons: queueOptions.slice(0, 3) // Limit to 3 buttons for better UX
        }
      };
    } catch (error) {
      logger.error('Error fetching queues:', error);
      return {
        message: "❌ Error loading queues. Please try again later.",
        sessionUpdate: { state: 'main_menu', merchantId }
      };
    }
  }

  /**
   * Handle queue selection
   */
  async handleQueueSelection(message, userSession) {
    const input = message.trim();
    const queues = userSession.availableQueues || [];
    
    // Handle numeric selection
    const queueNumber = parseInt(input);
    if (queueNumber > 0 && queueNumber <= queues.length) {
      const selectedQueue = queues[queueNumber - 1];
      return {
        message: `✅ You selected: ${selectedQueue.name}\n\nCurrent wait: ~${selectedQueue.waitTime} minutes\nPeople waiting: ${selectedQueue.currentLength}\n\nPlease provide your name:`,
        sessionUpdate: {
          state: 'waiting_for_name',
          selectedQueueId: selectedQueue.id,
          selectedQueueName: selectedQueue.name
        }
      };
    }

    // Handle button/text selection
    const selectedQueue = queues.find(q => 
      q.name.toLowerCase().includes(input.toLowerCase()) ||
      input.includes(q.id)
    );
    
    if (selectedQueue) {
      return {
        message: `✅ You selected: ${selectedQueue.name}\n\nCurrent wait: ~${selectedQueue.waitTime} minutes\nPeople waiting: ${selectedQueue.currentLength}\n\nPlease provide your name:`,
        sessionUpdate: {
          state: 'waiting_for_name',
          selectedQueueId: selectedQueue.id,
          selectedQueueName: selectedQueue.name
        }
      };
    }

    return {
      message: "❌ Invalid selection. Please choose a valid queue number or name:",
      sessionUpdate: { state: 'waiting_for_queue_selection' }
    };
  }

  /**
   * Handle name input
   */
  async handleNameInput(message, userSession) {
    const name = message.trim();
    if (name.length < 2 || name.length > 50) {
      return {
        message: "Please provide a valid name (2-50 characters):",
        sessionUpdate: { state: 'waiting_for_name' }
      };
    }

    // Check for invalid characters
    if (!/^[a-zA-Z\s'-]+$/.test(name)) {
      return {
        message: "Please provide a name using only letters, spaces, hyphens, and apostrophes:",
        sessionUpdate: { state: 'waiting_for_name' }
      };
    }

    return {
      message: `Thank you, ${name}! 📱\n\nPlease provide your phone number (for notifications):`,
      sessionUpdate: {
        state: 'waiting_for_phone',
        customerName: name
      }
    };
  }

  /**
   * Handle phone input and complete queue joining
   */
  async handlePhoneInput(message, userSession) {
    const phone = message.trim().replace(/\D/g, ''); // Remove non-digits
    
    if (phone.length < 10 || phone.length > 15) {
      return {
        message: "Please provide a valid phone number (10-15 digits):",
        sessionUpdate: { state: 'waiting_for_phone' }
      };
    }

    try {
      // Add customer to queue
      const queue = await queueService.findById(userSession.selectedQueueId);
      if (!queue || !queue.isActive) {
        return {
          message: "❌ Sorry, this queue is no longer available. Please start over.",
          sessionUpdate: { state: 'initial' }
        };
      }

      const customerId = `bot_${phone}_${Date.now()}`;
      
      // Check if customer is already in queue
      const existingCustomer = queue.entries.find(entry => 
        entry.customerPhone === phone && entry.status === 'waiting'
      );
      
      if (existingCustomer) {
        return {
          message: `You're already in the ${queue.name} queue!\n\n📍 Position: #${existingCustomer.position}\n⏱️ Estimated wait: ${existingCustomer.estimatedWaitTime} minutes`,
          sessionUpdate: {
            state: 'in_queue',
            queueId: queue._id,
            customerId: existingCustomer.customerId,
            position: existingCustomer.position
          }
        };
      }

      // Add to queue
      const newEntry = await queueService.addCustomer(queue.id, {
        customerId,
        customerName: userSession.customerName,
        customerPhone: phone,
        platform: 'chatbot',
        serviceType: userSession.selectedQueueName || queue.name,
        partySize: 1
      });

      // Emit real-time update
      if (this.io) {
        this.io.to(`merchant-${userSession.merchantId}`).emit('queue-updated', {
          queueId: queue.id,
          action: 'customer-joined',
          customer: newEntry
        });
      }

      return {
        message: `🎉 Success! You've joined ${queue.name}\n\n📋 Details:\n👤 Name: ${userSession.customerName}\n📱 Phone: ${phone}\n📍 Position: #${newEntry.position}\n⏱️ Estimated wait: ${newEntry.estimatedWaitTime} minutes\n\n💬 I'll notify you when it's almost your turn!\n\nCommands:\n• Type 'status' to check position\n• Type 'cancel' to leave queue`,
        sessionUpdate: {
          state: 'in_queue',
          queueId: queue._id,
          customerId: newEntry.customerId,
          customerName: userSession.customerName,
          customerPhone: phone,
          position: newEntry.position
        }
      };
    } catch (error) {
      logger.error('Error adding customer to queue:', error);
      return {
        message: "❌ Sorry, there was an error joining the queue. Please try again.",
        sessionUpdate: { state: 'initial' }
      };
    }
  }

  /**
   * Handle status check
   */
  async handleStatusCheck(message, userSession) {
    const phone = message.trim().replace(/\D/g, '');
    
    if (phone.length < 10) {
      return {
        message: "Please provide a valid phone number:",
        sessionUpdate: { state: 'waiting_for_status_check' }
      };
    }

    try {
      const queues = await queueService.findByMerchant(userSession.merchantId);
      
      for (const queue of queues) {
        const customer = queue.entries.find(entry => 
          entry.customerPhone === phone && entry.status === 'waiting'
        );

        if (customer) {
          const waitingCustomers = queue.entries
            .filter(entry => entry.status === 'waiting')
            .sort((a, b) => a.position - b.position);
          
          const currentPosition = waitingCustomers.findIndex(entry => entry.customerId === customer.customerId) + 1;
          
          return {
            message: `📊 Queue Status for ${queue.name}:\n\n📍 Your position: #${currentPosition}\n⏱️ Estimated wait: ${customer.estimatedWaitTime} minutes\n👥 People ahead: ${currentPosition - 1}\n\n💬 You'll be notified when it's your turn!`,
            sessionUpdate: { 
              state: 'in_queue',
              queueId: queue._id,
              customerId: customer.customerId,
              position: currentPosition
            }
          };
        }
      }

      return {
        message: "📱 No active bookings found for this number.\n\nWould you like to join a queue?",
        sessionUpdate: { state: 'main_menu' }
      };
    } catch (error) {
      logger.error('Error checking status:', error);
      return {
        message: "❌ Error checking status. Please try again.",
        sessionUpdate: { state: 'main_menu' }
      };
    }
  }

  /**
   * Handle commands when customer is in queue
   */
  async handleInQueueCommands(message, userSession) {
    if (message.includes('status') || message.includes('position')) {
      return await this.getQueueStatus(userSession);
    }
    
    if (message.includes('cancel') || message.includes('leave')) {
      return await this.handleCancelRequest(userSession);
    }
    
    if (message.includes('menu') || message.includes('help')) {
      return {
        message: "You're currently in queue. Available commands:\n\n📊 'status' - Check your position\n❌ 'cancel' - Leave the queue\n🏠 'menu' - Main menu",
        sessionUpdate: { state: 'in_queue' }
      };
    }

    // Default response for in-queue state
    return await this.getQueueStatus(userSession);
  }

  /**
   * Get current queue status
   */
  async getQueueStatus(userSession) {
    try {
      const queue = await queueService.findById(userSession.queueId);
      if (!queue) {
        return {
          message: "❌ Queue not found. Please start over.",
          sessionUpdate: { state: 'initial' }
        };
      }

      const customer = queue.entries.find(entry => entry.customerId === userSession.customerId);
      if (!customer || customer.status !== 'waiting') {
        return {
          message: "You're no longer in the queue. Type 'join' to join again.",
          sessionUpdate: { state: 'main_menu' }
        };
      }

      const waitingCustomers = queue.entries
        .filter(entry => entry.status === 'waiting')
        .sort((a, b) => a.position - b.position);
      
      const currentPosition = waitingCustomers.findIndex(entry => entry.customerId === customer.customerId) + 1;

      return {
        message: `📊 Current Status - ${queue.name}:\n\n📍 Position: #${currentPosition}\n⏱️ Estimated wait: ${customer.estimatedWaitTime} minutes\n👥 People ahead: ${currentPosition - 1}\n\n💬 Hang tight! We'll notify you soon.`,
        sessionUpdate: { 
          state: 'in_queue',
          position: currentPosition
        }
      };
    } catch (error) {
      logger.error('Error getting queue status:', error);
      return {
        message: "❌ Error checking status. Please try again.",
        sessionUpdate: { state: 'in_queue' }
      };
    }
  }

  /**
   * Handle cancel request
   */
  async handleCancelRequest(userSession, merchantId = null) {
    try {
      if (userSession.state === 'in_queue' && userSession.queueId) {
        const queue = await queueService.findById(userSession.queueId);
        if (queue) {
          await queueService.removeCustomer(userSession.queueId, userSession.customerId, 'cancelled');

          // Emit real-time update
          if (this.io) {
            this.io.to(`merchant-${merchantId || userSession.merchantId}`).emit('queue-updated', {
              queueId: queue._id,
              action: 'customer-cancelled',
              customerId: userSession.customerId
            });
          }
          
          return {
            message: `✅ You've been removed from ${queue.name}.\n\nThank you for using our service! Feel free to join again anytime.`,
            sessionUpdate: { state: 'main_menu' }
          };
        }
      }

      return {
        message: "You're not currently in any queue.\n\nType 'join' to join a queue or 'menu' for options.",
        sessionUpdate: { state: 'main_menu', merchantId: merchantId || userSession.merchantId }
      };
    } catch (error) {
      logger.error('Error handling cancel request:', error);
      return {
        message: "❌ Error cancelling. Please try again.",
        sessionUpdate: { state: 'main_menu' }
      };
    }
  }

  /**
   * Get user session
   */
  getUserSession(phoneNumber) {
    if (!this.userSessions.has(phoneNumber)) {
      this.userSessions.set(phoneNumber, {
        state: 'initial',
        createdAt: new Date(),
        lastActivity: new Date()
      });
    }
    
    const session = this.userSessions.get(phoneNumber);
    session.lastActivity = new Date();
    return session;
  }

  /**
   * Update user session
   */
  updateUserSession(phoneNumber, updates) {
    const session = this.getUserSession(phoneNumber);
    Object.assign(session, updates, { 
      lastUpdated: new Date(),
      lastActivity: new Date()
    });
    this.userSessions.set(phoneNumber, session);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = new Date();
    for (const [phoneNumber, session] of this.userSessions.entries()) {
      if (now - session.lastActivity > this.sessionTimeout) {
        this.userSessions.delete(phoneNumber);
      }
    }
  }

  /**
   * Send notification to customer
   */
  async notifyCustomer(phoneNumber, message, platform = 'webchat') {
    try {
      // This would integrate with actual messaging services
      logger.info(`Notification sent to ${phoneNumber} via ${platform}: ${message}`);
      return true;
    } catch (error) {
      logger.error('Error sending notification:', error);
      return false;
    }
  }
}

module.exports = new ChatbotService(); 