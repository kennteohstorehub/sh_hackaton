// Queue Chat - Full Screen Mobile Interface
class QueueChat {
    constructor() {
        this.socket = null;
        this.sessionId = this.getOrCreateSessionId();
        this.queueData = null;
        this.isTyping = false;
        this.elements = {};
        
        this.init();
    }
    
    init() {
        // Initialize DOM elements
        this.initializeElements();
        
        // Initialize Socket.IO
        this.initializeSocket();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Check for queue data from redirect
        this.checkQueueRedirect();
        
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
    }
    
    initializeSocket() {
        this.socket = io({
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus(true);
            
            // Join queue room if we have queue data
            if (this.queueData && this.queueData.queueId) {
                this.socket.emit('join-queue', {
                    queueId: this.queueData.queueId,
                    sessionId: this.sessionId,
                    platform: 'webchat'
                });
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
        
        console.log('Queue redirect check:', { queueJoined, hasQueueInfo: !!queueInfo });
        
        if (queueJoined === 'true' && queueInfo) {
            sessionStorage.removeItem('queueJoined');
            
            const info = JSON.parse(queueInfo);
            this.queueData = info;
            
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
            
            // Send automatic welcome message
            setTimeout(() => {
                this.addMessage(`Welcome ${info.customerName}! 🎉`, 'bot');
                
                setTimeout(() => {
                    this.addMessage(
                        `You've successfully joined the queue!\n\n` +
                        `📍 Queue Number: #${info.queueNumber}\n` +
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
            }, 500);
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
        
        // Only display verification code in header if elements exist
        if (!this.elements.verificationDisplay || !this.elements.headerVerifyCode) {
            console.log('Verification display elements not found');
            return;
        }
        
        if (data.verificationCode) {
            this.elements.verificationDisplay.style.display = 'block';
            this.elements.headerVerifyCode.textContent = data.verificationCode;
        } else {
            this.elements.verificationDisplay.style.display = 'none';
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
            const response = await fetch(`/api/webchat/status/${this.sessionId}`);
            const data = await response.json();
            
            console.log('Validation response:', response.status, data);
            
            if (response.ok && data.queueEntry && data.queueEntry.status === 'waiting') {
                // Update with fresh data from server
                this.queueData = {
                    ...this.queueData,
                    ...data.queueEntry,
                    position: data.position,
                    estimatedWaitTime: data.estimatedWaitTime,
                    verificationCode: data.verificationCode
                };
                this.displayQueueBanner(this.queueData);
                this.addMessage(`Welcome back! You're currently #${data.position} in the queue.`, 'bot');
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
        this.elements.messageInput.style.height = 'auto';
        
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
        // Try to restore queueData from localStorage if not present
        if (!this.queueData) {
            const savedData = localStorage.getItem('queueData');
            if (savedData) {
                this.queueData = JSON.parse(savedData);
                console.log('Restored queueData from localStorage');
            }
        }
        
        if (!this.queueData) {
            this.addMessage('You\'re not currently in any queue. Would you like to join one?', 'bot');
            return;
        }
        
        console.log('=== Status Check Debug ===');
        console.log('this.sessionId:', this.sessionId);
        console.log('localStorage sessionId:', localStorage.getItem('queueChatSessionId'));
        console.log('this.queueData:', this.queueData);
        
        try {
            const statusUrl = `/api/webchat/status/${this.sessionId}`;
            console.log('Fetching URL:', statusUrl);
            const response = await fetch(statusUrl);
            const data = await response.json();
            
            console.log('Status response:', response.status, data);
            
            if (response.ok && data.queueEntry) {
                // Update local data with latest from server
                this.queueData = {
                    ...this.queueData,
                    ...data.queueEntry,
                    position: data.position,
                    estimatedWaitTime: data.estimatedWaitTime
                };
                this.displayQueueBanner(this.queueData);
                
                // Calculate more detailed wait time info
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
        if (code) {
            this.addMessage(
                `🎫 Your verification code is: ${code}\n\n` +
                `Please show this code to the staff when called.`,
                'bot'
            );
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
            const cancelUrl = `/api/webchat/cancel/${this.sessionId}`;
            console.log('Cancel URL:', cancelUrl);
            
            const response = await fetch(cancelUrl, {
                method: 'POST'
            });
            
            if (response.ok) {
                this.addMessage(
                    '✅ You\'ve been successfully removed from the queue.\n\n' +
                    'Thank you for letting us know! We hope to serve you another time.',
                    'bot'
                );
                this.clearQueueData();
                
                // Notify backend
                this.notifyBackend('customer_cancelled', {
                    queueId: this.queueData?.queueId,
                    customerName: this.queueData?.customerName
                });
            } else {
                const error = await response.json();
                this.addMessage(
                    '❌ Sorry, I couldn\'t cancel your queue position.\n\n' +
                    'Please try again or approach our staff for assistance.',
                    'bot'
                );
            }
        } catch (error) {
            console.error('Cancellation error:', error);
            this.addMessage(
                '❌ Sorry, something went wrong while cancelling.\n\n' +
                'Please try again or contact our staff.',
                'bot'
            );
        }
    }
    
    
    addMessage(text, sender = 'bot') {
        console.log('Adding message:', { text: text.substring(0, 50), sender });
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
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
        
        if (this.elements.messagesContainer) {
            this.elements.messagesContainer.appendChild(messageDiv);
            
            // Scroll to bottom
            this.scrollToBottom();
        }
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
    
    updateConnectionStatus(connected) {
        if (this.elements.connectionStatus) {
            this.elements.connectionStatus.textContent = connected ? 'Connected' : 'Reconnecting...';
            this.elements.connectionStatus.style.color = connected ? 'var(--success)' : 'var(--error)';
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
        console.log('=== Customer Called Event ===');
        console.log('Event data:', data);
        console.log('My customerId:', this.queueData?.customerId);
        console.log('My sessionId:', this.sessionId);
        
        // Check multiple ways to match the customer
        const isMyCall = data.customerId === this.queueData?.customerId ||
                         data.customerId === this.sessionId ||
                         data.customerId === `webchat_${this.sessionId}`;
        
        if (isMyCall) {
            // Update verification code if provided
            if (data.verificationCode) {
                this.queueData.verificationCode = data.verificationCode;
                this.displayQueueBanner(this.queueData);
            }
            
            this.addMessage(
                `🎉 IT'S YOUR TURN!\n\n` +
                `Please proceed to the counter.\n` +
                `Verification code: ${this.queueData.verificationCode}\n\n` +
                `Show this code to the staff.`,
                'bot'
            );
            
            // Show persistent notification
            this.showNotification(
                '🎉 Your Turn!',
                `Please proceed to counter with code: ${this.queueData.verificationCode}`,
                { requireInteraction: true }
            );
            
            // Visual alert
            this.flashScreen();
        }
    }
    
    handleQueueCancelled(data) {
        if (data.customerId === this.queueData?.customerId) {
            this.addMessage('Your queue has been cancelled.', 'system');
            this.clearQueueData();
        }
    }
    
    // Helper methods
    async notifyBackend(event, data) {
        try {
            await fetch('/api/webchat/notify', {
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
    
    clearQueueData() {
        console.log('!!! clearQueueData called - Stack trace:');
        console.trace();
        
        this.queueData = null;
        localStorage.removeItem('queueData');
        if (this.elements.verificationDisplay) {
            this.elements.verificationDisplay.style.display = 'none';
        }
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
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.queueChat = new QueueChat();
    });
} else {
    // DOM is already loaded (happens when script is loaded dynamically)
    window.queueChat = new QueueChat();
}