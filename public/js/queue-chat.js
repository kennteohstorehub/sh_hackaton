// Queue Chat - Full Screen Mobile Interface
class QueueChat {
    constructor() {
        this.socket = null;
        this.sessionId = this.getOrCreateSessionId();
        this.queueData = null;
        this.isTyping = false;
        this.elements = {};
        this.initialized = false;
        
        // EMERGENCY FIX: Defer initialization to ensure DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            // Even if DOM is "ready", defer to next tick for safety
            setTimeout(() => this.init(), 0);
        }
    }
    
    init() {
        // Prevent double initialization
        if (this.initialized) {
            console.log('[INIT] Already initialized');
            return;
        }
        
        console.log('[INIT] Starting QueueChat initialization...');
        
        // Initialize DOM elements first
        this.initializeElements();
        
        // Check if all critical elements are present
        if (!this.elements.messagesContainer) {
            console.error('[INIT] Critical DOM elements missing, retrying in 100ms...');
            setTimeout(() => this.init(), 100);
            return;
        }
        
        // Mark as initialized
        this.initialized = true;
        
        // Initialize Socket.IO
        this.initializeSocket();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Check for queue data from redirect
        // EMERGENCY FIX: Ensure DOM is fully ready before checking queue data
        // Use requestAnimationFrame to ensure next paint cycle
        requestAnimationFrame(() => {
            // Double-check critical elements exist
            if (document.getElementById('messagesContainer')) {
                this.checkQueueRedirect();
            } else {
                console.warn('[INIT] Messages container not ready, delaying queue check...');
                // Try again after a longer delay
                setTimeout(() => {
                    this.checkQueueRedirect();
                }, 200);
            }
        });
        
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        
        // Auto-resize textarea
        this.setupAutoResize();
    }
    
    initializeElements() {
        this.elements = {
            messagesContainer: document.getElementById('messagesContainer'),
            messageForm: document.getElementById('messageForm'),
            messageInput: document.getElementById('messageInput'),
            sendButton: document.getElementById('sendButton'),
            connectionStatus: document.getElementById('connectionStatus'),
            headerVerifyCode: document.getElementById('headerVerifyCode'),
            verificationDisplay: document.getElementById('verificationDisplay')
        };
        
        // Log which elements were found/not found for debugging
        const elementStatus = {};
        for (const [key, element] of Object.entries(this.elements)) {
            elementStatus[key] = element ? 'found' : 'not found';
        }
        console.log('[DOM] Element initialization status:', elementStatus);
        
        // Warn about critical missing elements
        if (!this.elements.messagesContainer) {
            console.error('[DOM] Critical element missing: messagesContainer');
        }
        if (!this.elements.messageForm || !this.elements.messageInput) {
            console.warn('[DOM] Message input elements missing - chat input will be disabled');
        }
    }
    
    initializeSocket() {
        console.log('[SOCKET] Initializing Socket.IO connection...');
        this.socket = io({
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        
        // Log all socket events for debugging
        const originalEmit = this.socket.emit;
        this.socket.emit = function(...args) {
            console.log('[SOCKET] Emitting:', args[0], args.slice(1));
            return originalEmit.apply(this, args);
        };
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus(true);
            
            // Join queue room if we have queue data
            if (this.queueData && this.queueData.queueId) {
                console.log('[SOCKET] Joining queue with data:', {
                    queueId: this.queueData.queueId,
                    sessionId: this.sessionId,
                    entryId: this.queueData.entryId || this.queueData.id,
                    customerId: this.queueData.customerId,
                    customerPhone: this.queueData.customerPhone
                });
                
                // Get the entry ID - prefer explicit entryId, fall back to id
                const entryId = this.queueData.entryId || this.queueData.id;
                
                if (entryId) {
                    // Join using entry-based room (primary method)
                    this.socket.emit('join-customer-room', {
                        entryId: entryId,
                        sessionId: this.sessionId
                    });
                    
                    // Also emit join-queue for additional setup
                    this.socket.emit('join-queue', {
                        queueId: this.queueData.queueId,
                        sessionId: this.sessionId,
                        entryId: entryId,
                        platform: 'webchat',
                        merchantId: this.queueData.merchantId
                    });
                    
                    console.log('[SOCKET] Joined rooms for entry:', entryId);
                } else {
                    console.warn('[SOCKET] No entry ID found in queue data');
                }
            }
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus(false);
        });
        
        // Listen for queue updates
        this.socket.on('queue-update', (data) => this.handleQueueUpdate(data));
        this.socket.on('position-update', (data) => this.handlePositionUpdate(data));
        this.socket.on('customer-called', (data) => this.handleCustomerCalled(data));
        this.socket.on('queue-cancelled', (data) => this.handleQueueCancelled(data));
        this.socket.on('notification-revoked', (data) => this.handleNotificationRevoked(data));
    }
    
    setupEventListeners() {
        // Message form submission
        if (this.elements.messageForm) {
            this.elements.messageForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }
        
        // Enter key handling (shift+enter for new line)
        if (this.elements.messageInput) {
            this.elements.messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
    }
    
    setupAutoResize() {
        const textarea = this.elements.messageInput;
        if (textarea) {
            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
            });
        }
    }
    
    checkQueueRedirect() {
        const queueJoined = sessionStorage.getItem('queueJoined');
        const queueInfo = sessionStorage.getItem('queueInfo');
        
        console.log('[INIT] Queue redirect check:', { 
            queueJoined, 
            hasQueueInfo: !!queueInfo,
            sessionId: this.sessionId,
            localStorage: {
                queueData: !!localStorage.getItem('queueData'),
                sessionId: localStorage.getItem('queueChatSessionId')
            }
        });
        
        if (queueJoined === 'true' && queueInfo) {
            sessionStorage.removeItem('queueJoined');
            
            const info = JSON.parse(queueInfo);
            this.queueData = info;
            
            // Ensure we have the entry ID
            if (!this.queueData.entryId && this.queueData.id) {
                this.queueData.entryId = this.queueData.id;
            }
            
            // Ensure we're using the same sessionId
            if (info.sessionId && info.sessionId !== this.sessionId) {
                console.warn('SessionId mismatch detected!');
                console.log('Form sessionId:', info.sessionId);
                console.log('Current sessionId:', this.sessionId);
                // Use the sessionId from the form submission
                this.sessionId = info.sessionId;
                localStorage.setItem('queueChatSessionId', this.sessionId);
            }
            
            // Store in localStorage for persistence
            localStorage.setItem('queueData', JSON.stringify(info));
            
            // Display queue information
            this.displayQueueBanner(info);
            
            console.log('[QUEUE] Displaying queue info:', {
                customerName: info.customerName,
                position: info.position,
                queueNumber: info.queueNumber,
                verificationCode: info.verificationCode,
                entryId: info.entryId
            });
            
            // Send automatic welcome message
            // Ensure messages container is ready before adding messages
            const sendWelcomeMessages = () => {
                if (!this.elements.messagesContainer) {
                    console.warn('[WELCOME] Messages container not ready, retrying...');
                    setTimeout(sendWelcomeMessages, 100);
                    return;
                }
                
                this.addMessage(`Welcome ${info.customerName}! 🎉`, 'bot');
                
                setTimeout(() => {
                    this.addMessage(
                        `You've successfully joined the queue!\n\n` +
                        `📍 Queue Number: #${info.queueNumber || info.position}\n` +
                        `👥 You're number ${info.position} in line\n` +
                        `⏱️ Estimated wait: ${info.estimatedWait} minutes\n` +
                        `🎫 Verification code: ${info.verificationCode || 'Will be provided when called'}`,
                        'bot'
                    );
                    
                    // Send backend notification
                    this.notifyBackend('customer_joined', info);
                }, 1000);
                
                setTimeout(() => {
                    this.addMessage(
                        'I\'ll notify you when it\'s your turn. Feel free to ask me about:\n' +
                        '• Your current status\n' +
                        '• Wait time updates\n' +
                        '• Cancelling your queue',
                        'bot'
                    );
                }, 2500);
            };
            
            // Start sending welcome messages
            setTimeout(sendWelcomeMessages, 500);
        } else {
            // Check for existing queue data
            const savedData = localStorage.getItem('queueData');
            console.log('Checking localStorage:', { hasSavedData: !!savedData });
            
            if (savedData) {
                this.queueData = JSON.parse(savedData);
                // Validate the saved queue data is still valid
                this.validateSavedQueueData();
            } else {
                // No queue data - show welcome
                console.log('No queue data found - showing welcome');
                this.showWelcomeMessage();
            }
        }
    }
    
    displayQueueBanner(data) {
        // Store queue data for status checks
        this.queueData = data;
        
        // EMERGENCY FIX: Add comprehensive null checks
        try {
            // Get elements safely
            const verificationDisplay = document.getElementById('verificationDisplay');
            const headerVerifyCode = document.getElementById('headerVerifyCode');
            
            if (!verificationDisplay || !headerVerifyCode) {
                console.warn('[DISPLAY] Verification elements not ready, queueing for later...');
                // Queue this operation for when DOM is ready
                if (!this.pendingBannerDisplay) {
                    this.pendingBannerDisplay = data;
                    // Retry in next animation frame
                    requestAnimationFrame(() => {
                        if (this.pendingBannerDisplay) {
                            this.displayQueueBanner(this.pendingBannerDisplay);
                            this.pendingBannerDisplay = null;
                        }
                    });
                }
                return;
            }
            
            // Safe property access
            if (data && data.verificationCode) {
                console.log('[DISPLAY] Showing verification code:', data.verificationCode);
                if (verificationDisplay && verificationDisplay.style) {
                    verificationDisplay.style.display = 'block';
                }
                if (headerVerifyCode) {
                    headerVerifyCode.textContent = data.verificationCode;
                }
            } else {
                console.log('[DISPLAY] No verification code to display');
                if (verificationDisplay && verificationDisplay.style) {
                    verificationDisplay.style.display = 'none';
                }
            }
            
            // Update element references for future use
            if (this.elements) {
                this.elements.verificationDisplay = verificationDisplay;
                this.elements.headerVerifyCode = headerVerifyCode;
            }
            
        } catch (error) {
            console.error('[DISPLAY] Error in displayQueueBanner:', error);
            // Don't throw - system should continue working
        }
    }
    
    showWelcomeMessage() {
        this.addMessage('👋 Welcome to our queue system! How can I help you today?', 'bot');
        this.addMessage('You can join a queue, check your status, or ask me any questions.', 'bot');
    }
    
    async validateSavedQueueData() {
        console.log('=== Validating Saved Queue Data ===');
        console.log('Saved queueData:', this.queueData);
        console.log('SessionId:', this.sessionId);
        
        try {
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/api/webchat/status/${this.sessionId}`);
            const data = await response.json();
            
            console.log('Validation response:', response.status, data);
            
            if (response.ok && data.queueEntry) {
                // Update with fresh data from server
                this.queueData = {
                    ...this.queueData,
                    ...data.queueEntry,
                    position: data.position,
                    estimatedWaitTime: data.estimatedWaitTime,
                    verificationCode: data.verificationCode,
                    entryId: data.queueEntry.entryId || data.queueEntry.id,  // Ensure we have entry ID
                    id: data.queueEntry.id  // Also store id
                };
                this.displayQueueBanner(this.queueData);
                
                // Check if customer is already called
                if (data.queueEntry.status === 'called') {
                    // Customer is already called - show acknowledgment UI
                    this.addMessage(
                        `🎉 YOUR TABLE IS READY!\n\n` +
                        `Please proceed to the counter now.\n` +
                        `Verification code: ${data.verificationCode}\n\n` +
                        `Show this code to our staff to be seated.`,
                        'system'
                    );
                    
                    // Update UI to show called status
                    this.updateConnectionStatus('Your table is ready! 🎉', 'ready');
                    document.body.classList.add('customer-called');
                    
                    // Show acknowledgment cards if not already acknowledged
                    console.log('[STATUS] Customer is called, checking acknowledgment status:', this.queueData.acknowledged);
                    if (!this.queueData.acknowledged && !this.acknowledgmentCardsShown) {
                        console.log('[STATUS] Showing acknowledgment cards from validateSavedQueueData');
                        setTimeout(() => {
                            this.showAcknowledgmentCards({
                                verificationCode: data.verificationCode,
                                queueName: this.queueData.queueName || 'the restaurant'
                            });
                        }, 1000); // Small delay to ensure DOM is ready
                    } else {
                        console.log('[STATUS] Not showing cards - acknowledged:', this.queueData.acknowledged, 'cards shown:', this.acknowledgmentCardsShown);
                    }
                } else if (data.queueEntry.status === 'waiting') {
                    this.addMessage(`Welcome! You're currently #${data.position} in the queue.`, 'bot');
                } else {
                    this.addMessage(`Welcome! Your status: ${data.queueEntry.status}`, 'bot');
                }
            } else {
                // Clear invalid saved data
                console.log('Queue data invalid or not found, clearing...');
                this.clearQueueData();
                this.showWelcomeMessage();
            }
        } catch (error) {
            console.error('Error validating saved queue data:', error);
            this.clearQueueData();
            this.showWelcomeMessage();
        }
    }
    
    sendMessage() {
        if (!this.elements.messageInput) return;
        
        const message = this.elements.messageInput.value.trim();
        if (!message) return;
        
        // Add user message
        this.addMessage(message, 'user');
        
        // Clear input and reset height
        this.elements.messageInput.value = '';
        if (this.elements.messageInput) this.elements.messageInput.style.height = 'auto';
        
        // Process message
        this.processMessage(message);
    }
    
    sendQuickAction(action) {
        switch (action) {
            case 'status':
                this.addMessage('Check my queue status', 'user');
                this.checkQueueStatus();
                break;
            case 'cancel':
                this.addMessage('I want to cancel my queue', 'user');
                this.confirmCancellation();
                break;
            case 'help':
                this.addMessage('I need help', 'user');
                this.showHelpMessage();
                break;
            case 'contact':
                this.addMessage('How can I contact the business?', 'user');
                this.showContactInfo();
                break;
        }
    }
    
    async processMessage(message) {
        const lowerMessage = message.toLowerCase().trim();
        
        // Show typing indicator
        this.showTypingIndicator();
        
        // Simulate processing
        await this.delay(800);
        
        // Remove typing indicator
        this.hideTypingIndicator();
        
        // Check if we're awaiting confirmation
        if (this.awaitingConfirmation === 'cancel') {
            if (lowerMessage === 'yes' || lowerMessage === 'y') {
                this.awaitingConfirmation = null;
                this.executeCancellation();
                return;
            } else if (lowerMessage === 'no' || lowerMessage === 'n') {
                this.awaitingConfirmation = null;
                this.addMessage('Great! You\'ll remain in the queue. I\'ll notify you when it\'s your turn.', 'bot');
                return;
            } else {
                this.addMessage('Please reply "YES" to cancel or "NO" to stay in the queue.', 'bot');
                return;
            }
        }
        
        // Process based on intent
        if (lowerMessage.includes('status') || lowerMessage.includes('position') || lowerMessage.includes('where')) {
            this.checkQueueStatus();
        } else if (lowerMessage.includes('cancel') || lowerMessage.includes('leave')) {
            this.confirmCancellation();
        } else if (lowerMessage.includes('help')) {
            this.showHelpMessage();
        } else if (lowerMessage.includes('wait') || lowerMessage.includes('time')) {
            this.showWaitTime();
        } else if (lowerMessage.includes('code') || lowerMessage.includes('verification')) {
            this.showVerificationCode();
        } else if (lowerMessage.includes('thank')) {
            this.addMessage('You\'re welcome! Let me know if you need anything else. 😊', 'bot');
        } else {
            // Default response
            this.addMessage(
                'I can help you with:\n' +
                '• Checking your queue status\n' +
                '• Estimated wait time\n' +
                '• Cancelling your queue\n' +
                '• Getting your verification code\n\n' +
                'What would you like to know?',
                'bot'
            );
        }
    }
    
    async checkQueueStatus() {
        console.log('[STATUS] Starting queue status check...');
        
        // Try to restore queueData from localStorage if not present
        if (!this.queueData) {
            const savedData = localStorage.getItem('queueData');
            if (savedData) {
                this.queueData = JSON.parse(savedData);
                console.log('[STATUS] Restored queueData from localStorage:', this.queueData);
            }
        }
        
        if (!this.queueData) {
            console.log('[STATUS] No queue data found');
            this.addMessage('You\'re not currently in any queue. Would you like to join one?', 'bot');
            return;
        }
        
        console.log('[STATUS] === Status Check Debug ===');
        console.log('[STATUS] SessionId:', this.sessionId);
        console.log('[STATUS] LocalStorage sessionId:', localStorage.getItem('queueChatSessionId'));
        console.log('[STATUS] Queue data:', JSON.stringify(this.queueData, null, 2));
        
        try {
            const baseUrl = window.location.origin;
            const statusUrl = `${baseUrl}/api/webchat/status/${this.sessionId}`;
            console.log('[STATUS] Fetching URL:', statusUrl);
            
            const response = await fetch(statusUrl);
            const data = await response.json();
            
            console.log('[STATUS] Response:', {
                status: response.status,
                ok: response.ok,
                data: data
            });
            
            if (response.ok && data.queueEntry) {
                // Update local data with latest from server
                this.queueData = {
                    ...this.queueData,
                    ...data.queueEntry,
                    position: data.position,
                    estimatedWaitTime: data.estimatedWaitTime,
                    entryId: data.queueEntry.entryId || data.queueEntry.id,  // Ensure we have entry ID
                    id: data.queueEntry.id  // Also store id
                };
                this.displayQueueBanner(this.queueData);
                
                // Check status and display appropriate message
                if (data.queueEntry.status === 'called') {
                    // Customer has been called - show ready message
                    this.addMessage(
                        `🎉 YOUR TABLE IS READY!\n\n` +
                        `Please proceed to the counter now.\n` +
                        `Verification code: ${this.queueData.verificationCode || data.verificationCode}\n\n` +
                        `Show this code to our staff to be seated.`,
                        'system'
                    );
                    
                    // Update UI to show called status
                    this.updateConnectionStatus('Your table is ready! 🎉', 'ready');
                    
                    // Show acknowledgment cards if not already acknowledged
                    console.log('[STATUS CHECK] Customer is called, checking acknowledgment status:', this.queueData.acknowledged);
                    if (!this.queueData.acknowledged && !this.acknowledgmentCardsShown) {
                        console.log('[STATUS CHECK] Showing acknowledgment cards from checkQueueStatus');
                        this.showAcknowledgmentCards({
                            verificationCode: this.queueData.verificationCode || data.verificationCode,
                            queueName: this.queueData.queueName || 'the restaurant'
                        });
                    } else {
                        console.log('[STATUS CHECK] Not showing cards - acknowledged:', this.queueData.acknowledged, 'cards shown:', this.acknowledgmentCardsShown);
                    }
                } else if (data.queueEntry.status === 'waiting') {
                    // Still waiting - show wait info
                    const peopleAhead = Math.max(0, data.position - 1);
                    const avgServiceTime = data.averageServiceTime || 15;
                    const waitRange = {
                        min: Math.floor(peopleAhead * avgServiceTime * 0.8),
                        max: Math.ceil(peopleAhead * avgServiceTime * 1.2)
                    };
                    
                    this.addMessage(
                        `📊 Current Status:\n\n` +
                        `Position: #${data.position}\n` +
                        `People ahead: ${peopleAhead}\n` +
                        `Estimated wait: ${data.estimatedWaitTime} minutes (${waitRange.min}-${waitRange.max} min range)\n` +
                        `Status: ${this.getStatusEmoji(data.queueEntry.status)} ${data.queueEntry.status}\n\n` +
                        `💡 Tip: You'll receive a notification when you're next. Feel free to browse nearby while waiting!`,
                        'bot'
                    );
                } else {
                    // Other status (serving, completed, etc.)
                    this.addMessage(
                        `📊 Current Status:\n\n` +
                        `Status: ${this.getStatusEmoji(data.queueEntry.status)} ${data.queueEntry.status}`,
                        'bot'
                    );
                }
                
                // Store updated data
                localStorage.setItem('queueData', JSON.stringify(this.queueData));
            } else {
                this.addMessage('I couldn\'t find your queue status. You may have been removed from the queue.', 'bot');
                this.clearQueueData();
            }
        } catch (error) {
            console.error('Status check error:', error);
            this.addMessage('Sorry, I couldn\'t check your status right now. Please try again in a moment.', 'bot');
        }
    }
    
    confirmCancellation() {
        // Try to restore queueData from localStorage if not present
        if (!this.queueData) {
            const savedData = localStorage.getItem('queueData');
            if (savedData) {
                this.queueData = JSON.parse(savedData);
                console.log('Restored queueData from localStorage for cancellation');
            }
        }
        
        if (!this.queueData) {
            this.addMessage('You\'re not currently in any queue.', 'bot');
            return;
        }
        
        this.addMessage(
            `⚠️ Are you sure you want to cancel your queue?\n\n` +
            `Current position: #${this.queueData.position}\n` +
            `Wait time: ${this.queueData.estimatedWait || this.queueData.estimatedWaitTime} minutes\n\n` +
            `Reply "YES" to confirm or "NO" to stay in queue.`,
            'bot'
        );
        
        // Set up temporary listener for confirmation
        this.awaitingConfirmation = 'cancel';
    }
    
    showWaitTime() {
        if (!this.queueData) {
            this.addMessage('You\'re not currently in any queue.', 'bot');
            return;
        }
        
        const waitTime = this.queueData.estimatedWait || this.queueData.estimatedWaitTime || 0;
        this.addMessage(
            `⏱️ Your estimated wait time is ${waitTime} minutes.\n\n` +
            `This is based on current service times and may vary.`,
            'bot'
        );
    }
    
    showVerificationCode() {
        if (!this.queueData) {
            this.addMessage('You\'re not currently in any queue.', 'bot');
            return;
        }
        
        const code = this.queueData.verificationCode;
        const status = this.queueData.status;
        
        if (code) {
            if (status === 'called') {
                this.addMessage(
                    `🎫 Your verification code is: ${code}\n\n` +
                    `🎉 Your table is ready! Please show this code to the staff now.`,
                    'system'
                );
            } else {
                this.addMessage(
                    `🎫 Your verification code is: ${code}\n\n` +
                    `Please show this code to the staff when called.`,
                    'bot'
                );
            }
        } else {
            this.addMessage(
                'Your verification code will be provided when you\'re called. ' +
                'It will appear here and in your notifications.',
                'bot'
            );
        }
    }
    
    showHelpMessage() {
        this.addMessage(
            '💡 Here\'s what you can do:\n\n' +
            '**Queue Commands:**\n' +
            '• "Check status" - See your current position\n' +
            '• "Wait time" - Get estimated wait time\n' +
            '• "Cancel queue" - Leave the queue\n' +
            '• "Verification code" - Get your code\n\n' +
            '**Need Help?**\n' +
            '• Type "contact" for business phone number\n' +
            '• Use the quick action buttons below\n\n' +
            'I\'ll notify you automatically when your position changes!',
            'bot'
        );
    }
    
    showContactInfo() {
        // Get business phone from queue data or use default
        const businessPhone = this.queueData?.businessPhone || '+60123456789';
        
        this.addMessage(
            '📞 Need to speak with someone?\n\n' +
            `You can call the business directly at:\n` +
            `${businessPhone}\n\n` +
            'For immediate assistance, please call during business hours.',
            'bot'
        );
    }
    
    async executeCancellation() {
        console.log('=== Cancel Debug ===');
        console.log('this.sessionId:', this.sessionId);
        console.log('localStorage sessionId:', localStorage.getItem('queueChatSessionId'));
        
        try {
            const baseUrl = window.location.origin;
            const cancelUrl = `${baseUrl}/api/webchat/cancel/${this.sessionId}`;
            console.log('Cancel URL:', cancelUrl);
            
            const response = await fetch(cancelUrl, {
                method: 'POST'
            });
            
            if (response.ok) {
                // Remove all action cards first
                this.removeAllActionCards();
                this.clearNoResponseTimeout();
                
                this.addMessage(
                    '✅ You\'ve been successfully removed from the queue.\n\n' +
                    'Thank you for letting us know! We hope to serve you another time.',
                    'bot'
                );
                
                // Notify backend before clearing data
                this.notifyBackend('customer_cancelled', {
                    queueId: this.queueData?.queueId,
                    customerName: this.queueData?.customerName
                });
                
                this.clearQueueData();
                
                // Re-enable message input
                this.toggleMessageInput(true);
                this.acknowledgmentCardsShown = false;
            } else {
                const error = await response.json();
                this.addMessage(
                    '❌ Sorry, I couldn\'t cancel your queue position.\n\n' +
                    'Please try again or approach our staff for assistance.',
                    'bot'
                );
                // Re-enable the cards on error
                document.querySelectorAll('.action-card').forEach(card => {
                    card.disabled = false;
                    card.classList.remove('loading');
                });
            }
        } catch (error) {
            console.error('Cancellation error:', error);
            this.addMessage(
                '❌ Sorry, something went wrong while cancelling.\n\n' +
                'Please try again or contact our staff.',
                'bot'
            );
            // Re-enable the cards on error
            document.querySelectorAll('.action-card').forEach(card => {
                card.disabled = false;
                card.classList.remove('loading');
            });
        }
    }
    
    
    addMessage(text, sender = 'bot', options = {}) {
        console.log('Adding message:', { text: text.substring(0, 50), sender });
        
        // Check if messages container exists
        if (!this.elements.messagesContainer) {
            console.error('[MESSAGE] Messages container not found, attempting to reinitialize...');
            this.initializeElements();
            
            // If still not found, queue the message for later
            if (!this.elements.messagesContainer) {
                if (!this.queuedMessages) this.queuedMessages = [];
                this.queuedMessages.push({ text, sender, options });
                console.warn('[MESSAGE] Message queued for later display');
                return;
            }
        }
        
        // Process any queued messages first
        if (this.queuedMessages && this.queuedMessages.length > 0) {
            const queued = this.queuedMessages;
            this.queuedMessages = [];
            queued.forEach(msg => this.addMessage(msg.text, msg.sender, msg.options));
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        if (options.messageId) {
            messageDiv.id = options.messageId;
        }
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        
        // Handle line breaks and formatting
        if (text.includes('\n')) {
            bubbleDiv.innerHTML = text
                .split('\n')
                .map(line => this.escapeHtml(line))
                .join('<br>');
        } else {
            bubbleDiv.textContent = text;
        }
        
        messageDiv.appendChild(bubbleDiv);
        
        // Add timestamp
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        messageDiv.appendChild(timeDiv);
        
        this.elements.messagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        this.scrollToBottom();
        
        return messageDiv;
    }
    
    showTypingIndicator() {
        if (this.isTyping) return;
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typingIndicator';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'typing-dot';
            typingDiv.appendChild(dot);
        }
        
        if (this.elements.messagesContainer) {
            this.elements.messagesContainer.appendChild(typingDiv);
            this.isTyping = true;
            this.scrollToBottom();
        }
    }
    
    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
        this.isTyping = false;
    }
    
    scrollToBottom() {
        if (this.elements.messagesContainer) {
            setTimeout(() => {
                this.elements.messagesContainer.scrollTop = 
                    this.elements.messagesContainer.scrollHeight;
            }, 100);
        }
    }
    
    updateConnectionStatus(textOrConnected, status = null) {
        // Add null check for connectionStatus element
        if (!this.elements.connectionStatus) {
            console.warn('[CONNECTION] connectionStatus element not found');
            return;
        }
        
        // Support both old boolean style and new text/status style
        if (typeof textOrConnected === 'boolean') {
            this.elements.connectionStatus.textContent = textOrConnected ? 'Connected' : 'Reconnecting...';
            this.elements.connectionStatus.style.color = textOrConnected ? 'var(--success)' : 'var(--error)';
        } else {
            this.elements.connectionStatus.textContent = textOrConnected;
            
            // Remove previous status classes
            this.elements.connectionStatus.classList.remove('status-ready', 'status-connected');
            
            // Apply status-specific styling
            if (status === 'ready') {
                this.elements.connectionStatus.classList.add('status-ready');
                // Also update header to show called status
                const header = document.querySelector('.chat-header');
                if (header) {
                    header.classList.add('status-called');
                }
            } else if (status === 'connected') {
                this.elements.connectionStatus.classList.add('status-connected');
                this.elements.connectionStatus.style.color = 'var(--success)';
                // Remove called status from header
                const header = document.querySelector('.chat-header');
                if (header) {
                    header.classList.remove('status-called');
                }
            } else {
                this.elements.connectionStatus.style.color = 'var(--text)';
                // Remove called status from header
                const header = document.querySelector('.chat-header');
                if (header) {
                    header.classList.remove('status-called');
                }
            }
        }
    }
    
    // Socket event handlers
    handleQueueUpdate(data) {
        if (data.queueId === this.queueData?.queueId) {
            // Update local data
            if (data.position) this.queueData.position = data.position;
            if (data.estimatedWaitTime) this.queueData.estimatedWaitTime = data.estimatedWaitTime;
            
            // Update display
            this.displayQueueBanner(this.queueData);
            
            // Notify user
            this.showNotification('Queue Update', `You're now at position #${data.position}`);
        }
    }
    
    handlePositionUpdate(data) {
        if (data.customerId === this.queueData?.customerId) {
            const oldPosition = this.queueData.position;
            this.queueData.position = data.newPosition;
            this.queueData.estimatedWaitTime = data.estimatedWaitTime;
            
            this.displayQueueBanner(this.queueData);
            
            if (data.newPosition < oldPosition) {
                this.addMessage(
                    `📍 Good news! You've moved up to position #${data.newPosition}\n` +
                    `New wait time: ${data.estimatedWaitTime} minutes`,
                    'system'
                );
                
                this.showNotification(
                    'Moving Up!', 
                    `You're now at position #${data.newPosition}`
                );
            }
        }
    }
    
    handleCustomerCalled(data) {
        console.log('[NOTIFICATION] === Customer Called Event ===');
        console.log('[NOTIFICATION] Event data:', JSON.stringify(data, null, 2));
        console.log('[NOTIFICATION] My queueData:', JSON.stringify(this.queueData, null, 2));
        console.log('[NOTIFICATION] My sessionId:', this.sessionId);
        console.log('[NOTIFICATION] Received entryId:', data.entryId);
        console.log('[NOTIFICATION] Received customerId:', data.customerId);
        
        // Check if we've already been called (prevent duplicate processing)
        if (this.queueData?.status === 'called' && !data.force) {
            console.log('[NOTIFICATION] Already in called status, ignoring duplicate');
            return;
        }
        
        // Primary check: Match by entry ID (most reliable)
        const myEntryId = this.queueData?.entryId || this.queueData?.id;
        const isEntryMatch = data.entryId && myEntryId && data.entryId === myEntryId;
        
        // Secondary checks for backward compatibility
        const myPhone = this.queueData?.customerPhone;
        const isWebFormFormat = myPhone && data.customerId && data.customerId.startsWith(`web_${myPhone}_`);
        const isWebchatFormat = data.customerId === `webchat_${this.sessionId}`;
        const isDirectMatch = data.customerId === this.queueData?.customerId;
        const isSessionMatch = data.customerId === this.sessionId;
        const isVerificationMatch = data.verificationCode && data.verificationCode === this.queueData?.verificationCode;
        
        const isMyCall = isEntryMatch || isDirectMatch || isSessionMatch || isWebchatFormat || isWebFormFormat || isVerificationMatch;
        
        console.log('[NOTIFICATION] Match checks:', {
            myEntryId,
            isEntryMatch,
            myPhone,
            isWebFormFormat,
            isWebchatFormat,
            isDirectMatch,
            isSessionMatch,
            isVerificationMatch,
            isMyCall,
            myCustomerId: this.queueData?.customerId,
            receivedCustomerId: data.customerId
        });
        
        if (isMyCall) {
            // Update verification code if provided
            if (data.verificationCode) {
                this.queueData.verificationCode = data.verificationCode;
                this.displayQueueBanner(this.queueData);
            }
            
            // Update status BEFORE showing message to prevent duplicates
            if (this.queueData) {
                this.queueData.status = 'called';
                // Store updated status in localStorage
                localStorage.setItem('queueData', JSON.stringify(this.queueData));
            }
            
            this.addMessage(
                `🎉 IT'S YOUR TURN!\n\n` +
                `Please proceed to the counter.\n` +
                `Verification code: ${data.verificationCode || this.queueData.verificationCode}\n\n` +
                `Show this code to our staff to be seated.`,
                'system'
            );
            
            // Show acknowledgment cards
            console.log('[NOTIFICATION] About to show acknowledgment cards...');
            console.log('[NOTIFICATION] Card data:', {
                verificationCode: data.verificationCode || this.queueData.verificationCode,
                queueName: data.queueName || this.queueData.queueName || 'the restaurant',
                acknowledged: this.queueData?.acknowledged
            });
            
            // Ensure we have the data needed for the cards
            const cardData = {
                verificationCode: data.verificationCode || this.queueData.verificationCode,
                queueName: data.queueName || this.queueData.queueName || 'the restaurant'
            };
            
            this.showAcknowledgmentCards(cardData);
            
            // Update UI status
            this.updateConnectionStatus('Your table is ready! 🎉', 'ready');
            
            // Add body class for visual distinction
            document.body.classList.add('customer-called');
            
            // Visual alert
            this.flashScreen();
            
            // Play notification sound
            this.playNotificationSound();
            
            // Send browser notification
            this.showNotification('Your table is ready!', 'Please proceed to the counter with your verification code.');
        }
    }
    
    handleQueueCancelled(data) {
        if (data.customerId === this.queueData?.customerId) {
            this.addMessage('Your queue has been cancelled.', 'system');
            this.clearQueueData();
        }
    }
    
    handleNotificationRevoked(data) {
        console.log('Notification revoked event received:', data);
        
        // Reset status back to waiting
        if (this.queueData) {
            this.queueData.status = 'waiting';
            this.queueData.verificationCode = null; // Clear verification code
            this.queueData.acknowledged = false; // Reset acknowledgment status
            // Update localStorage
            localStorage.setItem('queueData', JSON.stringify(this.queueData));
        }
        
        // Remove all action cards first
        this.removeAllActionCards();
        this.clearNoResponseTimeout();
        
        // Stop notification sound if playing
        if (window.notificationSoundManager) {
            window.notificationSoundManager.stop();
        }
        
        // Show message to customer
        this.addMessage(
            `⚠️ ${data.message || 'Your notification has been revoked. You will be notified again when it\'s your turn.'}`,
            'system'
        );
        
        // Update UI status
        this.updateConnectionStatus('Waiting in queue', 'connected');
        
        // Remove visual indicators
        document.body.classList.remove('customer-called');
        
        // Hide verification display if present
        if (this.elements.verificationDisplay) {
            this.elements.verificationDisplay.style.display = 'none';
        }
        
        // Re-enable message input and quick actions
        this.toggleMessageInput(true);
        this.acknowledgmentCardsShown = false;
    }
    
    // Helper methods
    playNotificationSound() {
        try {
            // Create a simple beep sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            gainNode.gain.value = 0.3;
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (error) {
            console.error('Could not play notification sound:', error);
        }
    }
    
    async notifyBackend(event, data) {
        try {
            const baseUrl = window.location.origin;
            await fetch(`${baseUrl}/api/webchat/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    event,
                    data
                })
            });
        } catch (error) {
            console.error('Failed to notify backend:', error);
        }
    }
    
    showNotification(title, body, options = {}) {
        // Show in-app toast
        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        toast.textContent = body;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 5000);
        
        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: '/images/icon-144x144.svg',
                badge: '/images/icon-144x144.svg',
                vibrate: [200, 100, 200],
                ...options
            });
        }
    }
    
    flashScreen() {
        document.body.style.animation = 'flash 0.5s ease 3';
        setTimeout(() => {
            document.body.style.animation = '';
        }, 1500);
    }
    
    showAcknowledgmentCards(data) {
        console.log('[CARDS] === showAcknowledgmentCards called ===');
        console.log('[CARDS] Data received:', JSON.stringify(data, null, 2));
        console.log('[CARDS] Current queueData:', JSON.stringify(this.queueData, null, 2));
        
        // Check if cards already shown
        if (this.acknowledgmentCardsShown) {
            console.log('[CARDS] Acknowledgment cards already shown, skipping');
            return;
        }
        
        this.acknowledgmentCardsShown = true;
        
        // Hide text input and quick actions during critical flow
        this.toggleMessageInput(false);
        
        // Create notification card with verification code
        const verificationCode = data.verificationCode || this.queueData.verificationCode;
        this.addSystemMessageWithCards({
            header: '🎉 Your table is ready!',
            body: `<div class="verification-code-card-display">
                <div class="code-label">Verification Code</div>
                <div class="code-value">${verificationCode}</div>
            </div>
            <div class="queue-info">Queue: ${data.queueName || 'the restaurant'}</div>
            <div class="instructions">Please show this code to the staff</div>`,
            cards: [
                {
                    id: 'acknowledge-card',
                    text: "I'm headed to the restaurant",
                    icon: 'bi-person-walking',
                    type: 'primary',
                    action: () => this.handleCardAction('acknowledge')
                },
                {
                    id: 'cancel-card',
                    text: 'Cancel my spot',
                    icon: 'bi-x-circle',
                    type: 'danger',
                    action: () => this.handleCardAction('cancel')
                }
            ],
            footer: '⚠️ Please respond within 5 minutes or your spot may be released'
        });
        
        // Start playing notification sound
        if (window.notificationSoundManager) {
            window.notificationSoundManager.playNotificationSound();
        }
        
        // Start timeout for non-responsive handling
        this.startNoResponseTimeout(data);
        
        // Flash screen effect
        this.flashScreen();
    }
    
    async acknowledge(type) {
        try {
            const response = await fetch('/api/queue/acknowledge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    entryId: this.queueData.entryId || this.queueData.id,
                    type: type,
                    acknowledged: true
                })
            });
            
            if (response.ok) {
                // Stop notification sound
                if (window.notificationSoundManager) {
                    window.notificationSoundManager.stop();
                    await window.notificationSoundManager.playAcknowledgmentSound();
                }
                
                // Remove all action cards
                this.removeAllActionCards();
                this.clearNoResponseTimeout();
                
                // Update status
                if (this.queueData) {
                    this.queueData.acknowledged = true;
                    localStorage.setItem('queueData', JSON.stringify(this.queueData));
                }
                
                // Show confirmation message
                this.addMessage(
                    `✅ Great! We're expecting you. Your verification code is: ${this.queueData.verificationCode}`,
                    'system'
                );
                
                // Re-enable message input and quick actions
                this.toggleMessageInput(true);
                this.acknowledgmentCardsShown = false;
                
            } else {
                console.error('Failed to acknowledge notification');
                this.addMessage('Failed to send acknowledgment. Please try again.', 'system');
                // Re-enable the cards
                document.querySelectorAll('.action-card').forEach(card => {
                    card.disabled = false;
                    card.classList.remove('loading');
                });
            }
        } catch (error) {
            console.error('Error acknowledging:', error);
            this.addMessage('Error sending acknowledgment. Please proceed to the counter.', 'system');
            // Re-enable the cards
            document.querySelectorAll('.action-card').forEach(card => {
                card.disabled = false;
                card.classList.remove('loading');
            });
        }
    }
    
    startNoResponseTimeout(data) {
        // Clear any existing timeout
        this.clearNoResponseTimeout();
        
        // Set 4 minute warning timeout
        this.warningTimeout = setTimeout(() => {
            this.showTimeoutWarning(1);
        }, 4 * 60 * 1000); // 4 minutes
        
        // Set 5 minute final warning timeout
        this.finalWarningTimeout = setTimeout(() => {
            this.showFinalWarning();
        }, 5 * 60 * 1000); // 5 minutes
        
        // Set 7 minute auto-cancel timeout
        this.autoCancelTimeout = setTimeout(() => {
            this.autoCancelNoResponse();
        }, 7 * 60 * 1000); // 7 minutes
    }
    
    clearNoResponseTimeout() {
        if (this.warningTimeout) {
            clearTimeout(this.warningTimeout);
            this.warningTimeout = null;
        }
        if (this.finalWarningTimeout) {
            clearTimeout(this.finalWarningTimeout);
            this.finalWarningTimeout = null;
        }
        if (this.autoCancelTimeout) {
            clearTimeout(this.autoCancelTimeout);
            this.autoCancelTimeout = null;
        }
        this.timeoutWarningShown = false;
    }
    
    showFinalWarning() {
        // Remove all existing cards
        this.removeAllActionCards();
        
        // Show urgent notification
        this.addSystemMessageWithCards({
            messageId: 'final-warning',
            header: '🚨 Last chance!',
            body: 'Your table will be given away in 2 minutes',
            cards: [
                {
                    id: 'final-acknowledge-card',
                    text: "I'm coming!",
                    icon: 'bi-check-circle-fill',
                    type: 'primary',
                    action: () => this.acknowledge('on_way')
                },
                {
                    id: 'final-cancel-card',
                    text: 'Cancel',
                    icon: 'bi-x-circle',
                    type: 'danger',
                    action: () => this.executeCancellation()
                }
            ]
        });
    }
    
    async confirmStillComing() {
        // This method is now handled by the acknowledge method
        await this.acknowledge('on_way');
    }
    
    async cancelFromNoResponse() {
        // This method is now handled by the executeCancellation method
        await this.executeCancellation();
    }
    
    async autoCancelNoResponse() {
        // Remove all cards
        this.removeAllActionCards();
        this.clearNoResponseTimeout();
        
        // Stop notification sound
        if (window.notificationSoundManager) {
            window.notificationSoundManager.stop();
        }
        
        // Show cancellation notice
        this.addSystemMessageWithCards({
            messageId: 'auto-cancelled',
            header: '❌ Spot given away',
            body: 'Sorry, we had to give your table to the next customer',
            cards: this.queueData?.queueId ? [
                {
                    id: 'rejoin-card',
                    text: 'Join queue again',
                    icon: 'bi-arrow-clockwise',
                    type: 'primary',
                    action: () => window.location.href = `/queue/${this.queueData.queueId}/join`
                }
            ] : []
        });
        
        // Don't call executeCancellation as it would duplicate messages
        // Just clear the data and notify backend
        this.notifyBackend('auto_cancelled', {
            queueId: this.queueData?.queueId,
            customerName: this.queueData?.customerName,
            reason: 'no_response_timeout'
        });
        
        this.clearQueueData();
        
        // Re-enable message input
        this.toggleMessageInput(true);
        this.acknowledgmentCardsShown = false;
    }
    
    removeAcknowledgmentCards() {
        // Remove all acknowledgment cards and reset state
        this.removeAllActionCards();
        
        // Clear all timeouts
        this.clearNoResponseTimeout();
        
        // Stop sound if still playing
        if (window.notificationSoundManager) {
            window.notificationSoundManager.stop();
        }
        
        // Re-enable message input
        this.toggleMessageInput(true);
        this.acknowledgmentCardsShown = false;
    }
    
    clearQueueData() {
        console.log('!!! clearQueueData called - Stack trace:');
        console.trace();
        
        this.queueData = null;
        localStorage.removeItem('queueData');
        if (this.elements.verificationDisplay) {
            this.elements.verificationDisplay.style.display = 'none';
        }
        
        // Remove visual indicators
        document.body.classList.remove('customer-called');
        const header = document.querySelector('.chat-header');
        if (header) {
            header.classList.remove('status-called');
        }
        
        // Reset connection status
        this.updateConnectionStatus('Connected', 'connected');
    }
    
    getStatusEmoji(status) {
        const emojis = {
            waiting: '⏳',
            called: '📢',
            serving: '🍽️',
            completed: '✅',
            cancelled: '❌'
        };
        return emojis[status] || '📍';
    }
    
    getOrCreateSessionId() {
        let sessionId = localStorage.getItem('queueChatSessionId');
        console.log('Retrieved sessionId from localStorage:', sessionId);
        
        if (!sessionId) {
            sessionId = 'qc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('queueChatSessionId', sessionId);
            console.log('Generated new sessionId:', sessionId);
        }
        
        // Validate sessionId format
        if (!sessionId.startsWith('qc_')) {
            console.warn('Invalid sessionId format detected:', sessionId);
            // Generate a new valid sessionId
            sessionId = 'qc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('queueChatSessionId', sessionId);
            console.log('Regenerated sessionId:', sessionId);
        }
        
        return sessionId;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // New card-based system methods
    addSystemMessageWithCards(options) {
        const { header, body, cards, footer, messageId } = options;
        
        // Create container for the system message
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message system card-message';
        if (messageId) {
            messageContainer.id = messageId;
        }
        
        // Create the main message bubble
        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble card-bubble';
        
        // Add header if provided
        if (header) {
            const headerDiv = document.createElement('div');
            headerDiv.className = 'card-header';
            headerDiv.textContent = header;
            messageBubble.appendChild(headerDiv);
        }
        
        // Add body content
        if (body) {
            const bodyDiv = document.createElement('div');
            bodyDiv.className = 'card-body';
            bodyDiv.innerHTML = body;
            messageBubble.appendChild(bodyDiv);
        }
        
        messageContainer.appendChild(messageBubble);
        
        // Add timestamp
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        messageContainer.appendChild(timeDiv);
        
        // Add to messages container
        this.elements.messagesContainer.appendChild(messageContainer);
        
        // Add action cards if provided
        if (cards && cards.length > 0) {
            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'action-cards-container';
            cardsContainer.setAttribute('data-message-id', messageId || '');
            
            cards.forEach(card => {
                const cardElement = this.createActionCard(card);
                cardsContainer.appendChild(cardElement);
            });
            
            this.elements.messagesContainer.appendChild(cardsContainer);
        }
        
        // Add footer if provided
        if (footer) {
            const footerContainer = document.createElement('div');
            footerContainer.className = 'message system footer-message';
            
            const footerBubble = document.createElement('div');
            footerBubble.className = 'message-bubble footer-bubble';
            footerBubble.textContent = footer;
            
            footerContainer.appendChild(footerBubble);
            this.elements.messagesContainer.appendChild(footerContainer);
        }
        
        // Scroll to bottom
        this.scrollToBottom();
        
        return messageContainer;
    }
    
    createActionCard(cardOptions) {
        const { id, text, icon, type, action } = cardOptions;
        
        const card = document.createElement('button');
        card.className = `action-card action-card-${type || 'default'}`;
        if (id) {
            card.id = id;
        }
        
        // Add ARIA labels for accessibility
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', text);
        card.setAttribute('tabindex', '0');
        
        // Disable double-click
        card.addEventListener('click', (e) => {
            e.preventDefault();
            if (!card.disabled) {
                card.disabled = true;
                card.classList.add('loading');
                card.setAttribute('aria-busy', 'true');
                if (action) {
                    action();
                }
            }
        });
        
        // Add keyboard support
        card.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !card.disabled) {
                e.preventDefault();
                card.click();
            }
        });
        
        // Add icon if provided
        if (icon) {
            const iconElement = document.createElement('i');
            iconElement.className = `bi ${icon}`;
            iconElement.setAttribute('aria-hidden', 'true');
            card.appendChild(iconElement);
        }
        
        // Add text
        const textSpan = document.createElement('span');
        textSpan.textContent = text;
        card.appendChild(textSpan);
        
        return card;
    }
    
    async handleCardAction(action) {
        console.log('[CARD ACTION]', action);
        
        switch (action) {
            case 'acknowledge':
                await this.acknowledge('on_way');
                break;
                
            case 'cancel':
                this.showCancellationConfirmation();
                break;
                
            case 'confirm-cancel':
                await this.executeCancellation();
                this.acknowledgmentCardsShown = false;
                this.toggleMessageInput(true);
                break;
                
            case 'decline-cancel':
                // Remove confirmation cards and show original cards again
                this.removeCardsByMessageId('cancel-confirmation');
                this.acknowledgmentCardsShown = false;
                // Re-show the acknowledgment cards
                setTimeout(() => {
                    this.showAcknowledgmentCards({
                        verificationCode: this.queueData.verificationCode,
                        queueName: this.queueData.queueName || 'the restaurant'
                    });
                }, 300);
                break;
        }
    }
    
    showCancellationConfirmation() {
        // Remove existing cards
        this.removeAllActionCards();
        
        // Show confirmation message with new cards
        this.addSystemMessageWithCards({
            messageId: 'cancel-confirmation',
            header: 'Are you sure you want to cancel?',
            body: "You'll lose your spot in the queue",
            cards: [
                {
                    id: 'confirm-cancel-card',
                    text: 'Yes, cancel my spot',
                    icon: 'bi-check-circle',
                    type: 'danger',
                    action: () => this.handleCardAction('confirm-cancel')
                },
                {
                    id: 'decline-cancel-card',
                    text: 'No, keep my spot',
                    icon: 'bi-x-circle',
                    type: 'success',
                    action: () => this.handleCardAction('decline-cancel')
                }
            ]
        });
    }
    
    showTimeoutWarning(minutesLeft) {
        // Only show if we haven't already shown a warning
        if (this.timeoutWarningShown) return;
        this.timeoutWarningShown = true;
        
        // Add warning card inline
        this.addSystemMessageWithCards({
            messageId: 'timeout-warning',
            header: '⚠️ Are you on your way?',
            body: `Your table will be given away in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''} if not confirmed`,
            cards: []  // No action cards for the initial warning - keep existing cards active
        });
        
        // Apply warning styling to the message
        const warningMessage = document.getElementById('timeout-warning');
        if (warningMessage) {
            warningMessage.classList.add('warning-message');
            const bubble = warningMessage.querySelector('.message-bubble');
            if (bubble) {
                bubble.classList.add('warning-bubble');
            }
        }
        
        this.scrollToBottom();
    }
    
    toggleMessageInput(show) {
        if (this.elements.messageForm) {
            this.elements.messageForm.style.display = show ? 'flex' : 'none';
        }
        
        // Also hide/show quick actions if they exist
        const quickActions = document.querySelector('.quick-actions');
        if (quickActions) {
            quickActions.style.display = show ? 'flex' : 'none';
        }
        
        // Add/remove class on input area for styling
        const inputArea = document.querySelector('.input-area');
        if (inputArea) {
            if (show) {
                inputArea.classList.remove('input-hidden');
            } else {
                inputArea.classList.add('input-hidden');
            }
        }
    }
    
    removeAllActionCards() {
        const cardContainers = document.querySelectorAll('.action-cards-container');
        cardContainers.forEach(container => container.remove());
    }
    
    removeCardsByMessageId(messageId) {
        const message = document.getElementById(messageId);
        if (message) {
            // Remove the message
            message.remove();
            
            // Remove associated cards
            const cards = document.querySelector(`[data-message-id="${messageId}"]`);
            if (cards) {
                cards.remove();
            }
        }
    }
    
    // Removed automatic periodic updates - now using WebSocket events only
    // Updates will be pushed from server when actual queue changes occur
}

// Add flash animation to body
const style = document.createElement('style');
style.textContent = `
    @keyframes flash {
        0%, 100% { background-color: var(--bg-dark); }
        50% { background-color: rgba(255, 140, 0, 0.2); }
    }
`;
document.head.appendChild(style);

// Initialize on DOM ready or immediately if DOM is already loaded
function initializeQueueChat() {
    // Prevent double initialization
    if (window.queueChat) {
        console.log('[INIT] QueueChat already initialized');
        return;
    }
    
    try {
        console.log('[INIT] Initializing QueueChat, DOM state:', document.readyState);
        window.queueChat = new QueueChat();
    } catch (error) {
        console.error('[INIT] Failed to initialize QueueChat:', error);
        // Retry after a short delay if initialization fails
        setTimeout(() => {
            console.log('[INIT] Retrying QueueChat initialization...');
            try {
                if (!window.queueChat) {
                    window.queueChat = new QueueChat();
                }
            } catch (retryError) {
                console.error('[INIT] Retry failed:', retryError);
            }
        }, 500);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeQueueChat);
} else {
    // DOM is already loaded (happens when script is loaded dynamically)
    // Use setTimeout to ensure all scripts are fully executed
    setTimeout(initializeQueueChat, 0);
}