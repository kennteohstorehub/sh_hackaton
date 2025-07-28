// Chatbot JavaScript
class QueueChatbot {
    constructor() {
        this.socket = null;
        this.sessionId = this.getOrCreateSessionId();
        this.merchantId = this.getMerchantId();
        this.chatState = 'idle';
        this.queueData = null;
        this.pushSubscription = null;
        this.conversationHistory = [];
        
        this.elements = {
            chatButton: document.getElementById('chatButton'),
            chatWidget: document.getElementById('chatWidget'),
            closeChat: document.getElementById('closeChat'),
            chatMessages: document.getElementById('chatMessages'),
            chatForm: document.getElementById('chatForm'),
            chatInput: document.getElementById('chatInput'),
            quickActions: document.getElementById('quickActions'),
            joinQueueModal: document.getElementById('joinQueueModal'),
            joinQueueForm: document.getElementById('joinQueueForm'),
            queueInfoCard: document.getElementById('queueInfoCard'),
            notificationBadge: document.getElementById('notificationBadge')
        };
        
        this.init();
    }
    
    init() {
        // Initialize Socket.IO
        this.socket = io();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize push notifications
        this.initializePushNotifications();
        
        // Load conversation history
        this.loadConversationHistory();
        
        // Check if redirected from queue form
        const queueJoined = sessionStorage.getItem('queueJoined');
        const queueInfo = sessionStorage.getItem('queueInfo');
        
        console.log('Chatbot init - queueJoined:', queueJoined);
        console.log('Chatbot init - queueInfo:', queueInfo);
        
        if (queueJoined === 'true' && queueInfo) {
            // Clear the flag
            sessionStorage.removeItem('queueJoined');
            
            // Parse queue info
            const info = JSON.parse(queueInfo);
            console.log('Parsed queue info:', info);
            
            // Auto-open chat widget
            if (!this.elements.chatWidget.classList.contains('active')) {
                this.elements.chatWidget.classList.add('active');
                this.elements.chatButton.classList.add('active');
            }
            
            // Display queue status
            setTimeout(() => {
                this.addMessage(`Welcome ${info.customerName}! 🎉`, 'bot');
                setTimeout(() => {
                    const queueMessage = `You've successfully joined the queue!\n\n` +
                        `📍 Queue Number: #${info.queueNumber}\n` +
                        `🎫 Verification Code: ${info.verificationCode || 'N/A'}\n` +
                        `👥 Position: ${info.position} in line\n` +
                        `⏱️ Estimated Wait: ${info.estimatedWait} minutes`;
                    
                    this.addMessage(queueMessage, 'bot');
                    
                    // Store queue data
                    this.queueData = info;
                    localStorage.setItem('queueData', JSON.stringify(info));
                    
                    // Update queue info display
                    this.updateQueueInfo(info);
                    this.showQueueInfo();
                    
                    setTimeout(() => {
                        this.addMessage(`I'll notify you when it's your turn. You can ask me:\n• "What's my status?"\n• "How long is the wait?"\n• "Cancel my queue"`, 'bot');
                        
                        // Enable notifications
                        if ('Notification' in window && Notification.permission === 'default') {
                            this.addMessage(`📢 Enable notifications to get alerts when it's your turn!`, 'bot');
                            Notification.requestPermission();
                        }
                    }, 1500);
                }, 1000);
            }, 500);
        } else {
            // Check if user has active queue
            this.checkActiveQueue();
            
            // Show welcome message
            setTimeout(() => {
                this.showWelcomeMessage();
            }, 1000);
        }
    }
    
    setupEventListeners() {
        // Chat button toggle
        this.elements.chatButton.addEventListener('click', () => this.toggleChat());
        this.elements.closeChat.addEventListener('click', () => this.toggleChat());
        
        // Chat form submission
        this.elements.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleUserMessage();
        });
        
        // Quick actions
        this.elements.quickActions.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-action')) {
                const action = e.target.dataset.action;
                this.handleQuickAction(action);
            }
        });
        
        // Join queue form
        this.elements.joinQueueForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitJoinQueue();
        });
        
        // Socket events
        this.socket.on('queue-update', (data) => this.handleQueueUpdate(data));
        this.socket.on('customer-called', (data) => this.handleCustomerCalled(data));
        this.socket.on('position-update', (data) => this.handlePositionUpdate(data));
        
        // Service Worker messages
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'play-sound') {
                    if (event.data.soundType === 'table-ready') {
                        this.playTableReadySound();
                    } else {
                        this.playNotificationSound();
                    }
                }
            });
        }
    }
    
    toggleChat() {
        const isActive = this.elements.chatWidget.classList.toggle('active');
        this.elements.chatButton.classList.toggle('active');
        
        if (isActive) {
            this.elements.chatInput.disabled = false;
            this.elements.chatInput.focus();
            this.clearNotificationBadge();
        }
    }
    
    showWelcomeMessage() {
        const welcomeMsg = "👋 Welcome! I'm your queue assistant. How can I help you today?";
        this.addMessage(welcomeMsg, 'bot');
        
        // Enable input
        this.elements.chatInput.disabled = false;
        this.elements.chatForm.querySelector('button').disabled = false;
    }
    
    handleUserMessage() {
        const message = this.elements.chatInput.value.trim();
        if (!message) return;
        
        // Add user message to chat
        this.addMessage(message, 'user');
        
        // Clear input
        this.elements.chatInput.value = '';
        
        // Process message
        this.processUserMessage(message);
    }
    
    async processUserMessage(message) {
        const lowerMessage = message.toLowerCase().trim();
        
        // Show typing indicator
        this.showTypingIndicator();
        
        // Simulate processing delay
        await this.delay(800);
        
        // Remove typing indicator
        this.hideTypingIndicator();
        
        // Check for commands
        if (lowerMessage.includes('join') || lowerMessage.includes('queue')) {
            this.handleJoinQueue();
        } else if (lowerMessage.includes('status') || lowerMessage.includes('position')) {
            this.handleCheckStatus();
        } else if (lowerMessage.includes('cancel') || lowerMessage.includes('leave')) {
            this.handleCancelQueue();
        } else if (lowerMessage.includes('help')) {
            this.showHelpMessage();
        } else if (lowerMessage === 'yes' || lowerMessage === 'y') {
            this.confirmCancellation();
        } else if (lowerMessage === 'no' || lowerMessage === 'n') {
            this.cancelCancellation();
        } else {
            // Default response
            this.addMessage("I can help you join the queue, check your status, or cancel your booking. What would you like to do?", 'bot');
        }
    }
    
    handleQuickAction(action) {
        switch (action) {
            case 'join':
                this.handleJoinQueue();
                break;
            case 'status':
                this.handleCheckStatus();
                break;
            case 'cancel':
                this.handleCancelQueue();
                break;
            case 'help':
                this.showHelpMessage();
                break;
        }
    }
    
    handleJoinQueue() {
        if (this.queueData) {
            this.addMessage("You're already in the queue! Your position is #" + this.queueData.position, 'bot');
            this.showQueueInfo();
        } else {
            this.addMessage("Let me help you join the queue. Please fill in your details.", 'bot');
            this.showJoinQueueModal();
        }
    }
    
    showJoinQueueModal() {
        this.elements.joinQueueModal.style.display = 'flex';
        document.getElementById('customerName').focus();
    }
    
    closeJoinModal() {
        this.elements.joinQueueModal.style.display = 'none';
    }
    
    async submitJoinQueue() {
        const formData = {
            customerName: document.getElementById('customerName').value,
            customerPhone: document.getElementById('customerPhone').value,
            partySize: parseInt(document.getElementById('partySize').value),
            specialRequests: document.getElementById('specialRequests').value,
            merchantId: this.merchantId,
            platform: 'webchat',
            sessionId: this.sessionId,
            pushSubscription: this.pushSubscription
        };
        
        try {
            const response = await fetch('/api/webchat/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Store queue data
                this.queueData = data.queueEntry;
                localStorage.setItem('queueData', JSON.stringify(this.queueData));
                
                // Close modal
                this.closeJoinModal();
                
                // Show success message
                this.addMessage(`🎉 Success! You've joined the queue.`, 'bot');
                this.addMessage(`Your queue number is ${data.queueNumber} and your verification code is ${data.verificationCode}`, 'bot');
                this.addMessage(`Position: #${data.position} | Estimated wait: ${data.estimatedWaitTime} minutes`, 'bot');
                
                // Show queue info card
                this.showQueueInfo();
                
                // Play notification sound
                this.playNotificationSound();
                
                // Join socket room for updates
                this.socket.emit('join-queue', { queueId: this.queueData.queueId });
                
            } else {
                throw new Error(data.error || 'Failed to join queue');
            }
        } catch (error) {
            this.addMessage(`❌ Error: ${error.message}`, 'bot');
        }
    }
    
    handleCheckStatus() {
        if (!this.queueData) {
            this.addMessage("You're not currently in any queue. Would you like to join?", 'bot');
            return;
        }
        
        this.addMessage(`Checking your queue status...`, 'bot');
        this.checkQueueStatus();
    }
    
    async checkQueueStatus() {
        try {
            const response = await fetch(`/api/webchat/status/${this.sessionId}`);
            const data = await response.json();
            
            if (response.ok && data.queueEntry) {
                this.queueData = data.queueEntry;
                this.addMessage(`Your current position is #${data.position}. Estimated wait time: ${data.estimatedWaitTime} minutes.`, 'bot');
                this.showQueueInfo();
            } else {
                this.addMessage("I couldn't find your queue status. You may have been removed from the queue.", 'bot');
                this.clearQueueData();
            }
        } catch (error) {
            this.addMessage("Sorry, I couldn't check your status right now. Please try again.", 'bot');
        }
    }
    
    handleCancelQueue() {
        if (!this.queueData) {
            this.addMessage("You're not currently in any queue.", 'bot');
            return;
        }
        
        this.chatState = 'confirming-cancel';
        this.addMessage(`Are you sure you want to leave the queue? You're currently at position #${this.queueData.position}. Reply with YES to confirm or NO to stay.`, 'bot');
    }
    
    async confirmCancellation() {
        if (this.chatState !== 'confirming-cancel') {
            this.addMessage("I'm not sure what you're confirming. Can you tell me what you'd like to do?", 'bot');
            return;
        }
        
        try {
            const response = await fetch(`/api/webchat/cancel/${this.sessionId}`, {
                method: 'POST'
            });
            
            if (response.ok) {
                this.addMessage("✅ You've been removed from the queue. Thank you for letting us know!", 'bot');
                this.clearQueueData();
                this.chatState = 'idle';
            } else {
                throw new Error('Failed to cancel');
            }
        } catch (error) {
            this.addMessage("Sorry, I couldn't cancel your queue position. Please try again or contact staff.", 'bot');
        }
    }
    
    cancelCancellation() {
        if (this.chatState !== 'confirming-cancel') {
            this.addMessage("I'm not sure what you mean. How can I help you?", 'bot');
            return;
        }
        
        this.chatState = 'idle';
        this.addMessage("👍 Great! You'll remain in the queue. I'll notify you when it's your turn.", 'bot');
    }
    
    showHelpMessage() {
        const helpText = `Here's what I can help you with:
        
🔹 **Join Queue** - Join the virtual queue
🔹 **Check Status** - See your current position
🔹 **Cancel Queue** - Leave the queue
🔹 **Help** - Show this menu

Just type or click the buttons below!`;
        
        this.addMessage(helpText, 'bot');
    }
    
    showQueueInfo() {
        if (!this.queueData) return;
        
        document.getElementById('queueNumber').textContent = this.queueData.queueNumber || '-';
        document.getElementById('queuePosition').textContent = `#${this.queueData.position}`;
        document.getElementById('queueWaitTime').textContent = `${this.queueData.estimatedWaitTime || this.queueData.estimatedWait} min`;
        document.getElementById('verificationCode').textContent = this.queueData.verificationCode || '-';
        
        this.elements.queueInfoCard.style.display = 'block';
    }
    
    updateQueueInfo(info) {
        // Update the queue info display
        this.showQueueInfo();
        
        // Join socket room for real-time updates
        if (this.socket && info.queueId) {
            this.socket.emit('join-queue', { 
                queueId: info.queueId,
                sessionId: this.sessionId,
                platform: 'webchat'
            });
        }
    }
    
    hideQueueInfo() {
        this.elements.queueInfoCard.style.display = 'none';
    }
    
    addMessage(text, sender = 'bot') {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        
        const messageText = document.createElement('div');
        // Handle line breaks in text
        if (text.includes('\n')) {
            const lines = text.split('\n');
            messageText.innerHTML = lines.map(line => {
                if (line.trim() === '') return '<br>';
                return `<div style="margin: 2px 0;">${this.escapeHtml(line)}</div>`;
            }).join('');
        } else {
            messageText.textContent = text;
        }
        messageDiv.appendChild(messageText);
        
        const timeDiv = document.createElement('div');
        timeDiv.classList.add('message-time');
        timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageDiv.appendChild(timeDiv);
        
        this.elements.chatMessages.appendChild(messageDiv);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        
        // Save to history
        this.conversationHistory.push({ text, sender, time: new Date() });
        this.saveConversationHistory();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.classList.add('typing-indicator');
        typingDiv.id = 'typingIndicator';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.classList.add('typing-dot');
            typingDiv.appendChild(dot);
        }
        
        this.elements.chatMessages.appendChild(typingDiv);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }
    
    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    handleQueueUpdate(data) {
        if (data.queueEntry && data.queueEntry.sessionId === this.sessionId) {
            this.queueData = data.queueEntry;
            this.showQueueInfo();
            
            if (data.action === 'position-update') {
                this.addMessage(`📍 Update: You're now at position #${data.queueEntry.position}`, 'system');
                this.playNotificationSound();
            }
        }
    }
    
    handleCustomerCalled(data) {
        if (this.queueData && data.customerId === this.queueData.customerId) {
            this.addMessage(`🎉 It's your turn! Please proceed to the counter with your verification code: ${this.queueData.verificationCode}`, 'bot');
            this.playTableReadySound();
            this.showNotificationBadge();
            
            // Show browser notification
            this.showBrowserNotification('Your table is ready!', `Please proceed to the counter with code: ${this.queueData.verificationCode}`);
        }
    }
    
    handlePositionUpdate(data) {
        if (this.queueData && data.customerId === this.queueData.customerId) {
            this.queueData.position = data.newPosition;
            this.queueData.estimatedWaitTime = data.estimatedWaitTime;
            this.showQueueInfo();
        }
    }
    
    async initializePushNotifications() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('Push notifications not supported');
            return;
        }
        
        try {
            // Register service worker
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered');
            
            // Request notification permission
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                // Get push subscription
                this.pushSubscription = await this.subscribeToPush(registration);
            }
        } catch (error) {
            console.error('Error initializing push notifications:', error);
        }
    }
    
    async subscribeToPush(registration) {
        try {
            // Get VAPID public key
            const response = await fetch('/api/push/vapid-public-key');
            const { publicKey } = await response.json();
            
            const applicationServerKey = this.urlBase64ToUint8Array(publicKey);
            
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });
            
            return subscription;
        } catch (error) {
            console.error('Error subscribing to push:', error);
            return null;
        }
    }
    
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
    
    playNotificationSound() {
        // Use browser notification API instead of audio files
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Queue Update', {
                body: 'Your queue position has been updated',
                icon: '/images/icon-144x144.svg' // Use SVG which works
            });
        }
    }
    
    playTableReadySound() {
        // Use browser notification API with urgency
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🎉 Your Table is Ready!', {
                body: 'Please proceed to the counter with your verification code',
                icon: '/images/icon-144x144.svg',
                requireInteraction: true // Keep notification visible
            });
        }
        
        // Also use visual alert
        this.flashNotification();
    }
    
    flashNotification() {
        // Visual notification by flashing the chat button
        const button = this.elements.chatButton;
        if (button) {
            button.style.animation = 'pulse 1s ease-in-out 3';
            setTimeout(() => {
                button.style.animation = '';
            }, 3000);
        }
    }
    
    showBrowserNotification(title, body) {
        if (Notification.permission === 'granted') {
            new Notification(title, {
                body: body,
                icon: '/images/notification-icon.png',
                badge: '/images/notification-badge.png',
                requireInteraction: true
            });
        }
    }
    
    showNotificationBadge() {
        this.elements.notificationBadge.style.display = 'block';
        this.elements.notificationBadge.textContent = '1';
    }
    
    clearNotificationBadge() {
        this.elements.notificationBadge.style.display = 'none';
    }
    
    checkActiveQueue() {
        const savedQueueData = localStorage.getItem('queueData');
        if (savedQueueData) {
            this.queueData = JSON.parse(savedQueueData);
            this.checkQueueStatus();
        }
    }
    
    clearQueueData() {
        this.queueData = null;
        localStorage.removeItem('queueData');
        this.hideQueueInfo();
    }
    
    saveConversationHistory() {
        // Keep only last 50 messages
        const recent = this.conversationHistory.slice(-50);
        localStorage.setItem('chatHistory', JSON.stringify(recent));
    }
    
    loadConversationHistory() {
        const saved = localStorage.getItem('chatHistory');
        if (saved) {
            this.conversationHistory = JSON.parse(saved);
            // Don't display old messages, just keep in memory
        }
    }
    
    getOrCreateSessionId() {
        let sessionId = localStorage.getItem('chatSessionId');
        if (!sessionId) {
            sessionId = 'web_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('chatSessionId', sessionId);
        }
        return sessionId;
    }
    
    getMerchantId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('merchantId') || localStorage.getItem('merchantId') || '3ecceb82-fb33-42c8-9d84-19eb69417e16';
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize chatbot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.queueChatbot = new QueueChatbot();
});

// Make closeJoinModal function globally accessible
window.closeJoinModal = function() {
    document.getElementById('joinQueueModal').style.display = 'none';
};