const logger = require('../utils/logger');
const prisma = require('../utils/prisma');
const { TenantAwarePrisma, TenantSecurityLogger } = require('../middleware/tenant-isolation');

class WebChatService {
    constructor() {
        this.sessions = new Map();
        this.conversationStates = new Map();
        
        // Clean up old sessions every hour
        setInterval(() => this.cleanupSessions(), 60 * 60 * 1000);
    }

    /**
     * Get tenant-aware Prisma client
     */
    _getTenantPrisma(tenantId) {
        if (!tenantId) {
            TenantSecurityLogger.warn('WEBCHAT_SERVICE_NO_TENANT_CONTEXT', {
                message: 'Using regular Prisma client without tenant filtering - backward compatibility mode'
            });
            return prisma;
        }
        return TenantAwarePrisma.create(tenantId);
    }

    /**
     * Create or update a chat session
     */
    createSession(sessionId, data) {
        const session = {
            ...data,
            createdAt: new Date(),
            lastActivity: new Date()
        };
        
        this.sessions.set(sessionId, session);
        logger.info(`WebChat session created: ${sessionId}`);
        return session;
    }

    /**
     * Get session data
     */
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            // Update last activity
            session.lastActivity = new Date();
            this.sessions.set(sessionId, session);
        }
        return session;
    }

    /**
     * Clear session data
     */
    clearSession(sessionId) {
        this.sessions.delete(sessionId);
        this.conversationStates.delete(sessionId);
        logger.info(`WebChat session cleared: ${sessionId}`);
    }

    /**
     * Process chat message and return response
     */
    async processMessage(sessionId, message) {
        const session = this.getSession(sessionId);
        const lowerMessage = message.toLowerCase().trim();
        
        // Check conversation state
        const conversationState = this.conversationStates.get(sessionId) || { state: 'idle' };
        
        // Handle confirmation states
        if (conversationState.state === 'confirming-cancel') {
            if (lowerMessage === 'yes' || lowerMessage === 'y') {
                return await this.confirmCancellation(sessionId);
            } else if (lowerMessage === 'no' || lowerMessage === 'n') {
                this.conversationStates.set(sessionId, { state: 'idle' });
                return {
                    text: "Great! You'll remain in the queue. I'll notify you when it's your turn.",
                    action: 'cancel-aborted'
                };
            }
        }
        
        // Process commands
        if (lowerMessage.includes('join') || lowerMessage.includes('queue')) {
            return {
                text: "Please fill in the form to join the queue.",
                action: 'show-join-form'
            };
        }
        
        if (lowerMessage.includes('status') || lowerMessage.includes('position')) {
            if (!session || !session.queueEntryId) {
                return {
                    text: "You're not currently in any queue. Would you like to join?",
                    action: 'not-in-queue'
                };
            }
            
            return {
                text: "Let me check your queue status...",
                action: 'check-status',
                data: { sessionId }
            };
        }
        
        if (lowerMessage.includes('cancel') || lowerMessage.includes('leave')) {
            if (!session || !session.queueEntryId) {
                return {
                    text: "You're not currently in any queue.",
                    action: 'not-in-queue'
                };
            }
            
            // Set conversation state
            this.conversationStates.set(sessionId, { 
                state: 'confirming-cancel',
                queueEntryId: session.queueEntryId
            });
            
            return {
                text: "Are you sure you want to leave the queue? Reply with YES to confirm or NO to stay.",
                action: 'confirm-cancel'
            };
        }
        
        if (lowerMessage.includes('help')) {
            return {
                text: `Here's what I can help you with:
                
🔹 **Join Queue** - Join the virtual queue
🔹 **Check Status** - See your current position
🔹 **Cancel Queue** - Leave the queue
🔹 **Help** - Show this menu

Just type or click the buttons!`,
                action: 'help'
            };
        }
        
        // Default response
        return {
            text: "I can help you join the queue, check your status, or cancel your booking. What would you like to do?",
            action: 'default'
        };
    }

    /**
     * Confirm cancellation
     */
    async confirmCancellation(sessionId, tenantId = null) {
        const session = this.getSession(sessionId);
        const conversationState = this.conversationStates.get(sessionId);
        
        if (!session || !conversationState || !conversationState.queueEntryId) {
            return {
                text: "I couldn't find your queue entry. You may have already been removed.",
                action: 'error'
            };
        }
        
        const db = this._getTenantPrisma(tenantId);
        
        TenantSecurityLogger.info('WEBCHAT_CANCEL_QUEUE_ENTRY', {
            sessionId,
            queueEntryId: conversationState.queueEntryId,
            tenantId
        });
        
        try {
            // Update queue entry status
            await db.queueEntry.update({
                where: { id: conversationState.queueEntryId },
                data: {
                    status: 'cancelled',
                    completedAt: new Date()
                }
            });
            
            // Clear session
            this.clearSession(sessionId);
            
            return {
                text: "✅ You've been successfully removed from the queue. Thank you for letting us know!",
                action: 'cancelled'
            };
        } catch (error) {
            logger.error('Error cancelling queue entry:', error);
            return {
                text: "Sorry, I couldn't cancel your queue position. Please try again or contact staff.",
                action: 'error'
            };
        }
    }

    /**
     * Generate unique verification code
     */
    generateVerificationCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing characters
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    /**
     * Generate queue number format
     */
    generateQueueNumber(position) {
        return `W${String(position).padStart(3, '0')}`;
    }

    /**
     * Clean up old sessions
     */
    cleanupSessions() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        let cleanedCount = 0;
        
        for (const [sessionId, session] of this.sessions) {
            if (session.lastActivity < oneHourAgo) {
                this.sessions.delete(sessionId);
                this.conversationStates.delete(sessionId);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            logger.info(`Cleaned up ${cleanedCount} old webchat sessions`);
        }
    }

    /**
     * Get all active sessions count
     */
    getActiveSessionsCount() {
        return this.sessions.size;
    }

    /**
     * Check if session has active queue
     */
    async hasActiveQueue(sessionId) {
        const session = this.getSession(sessionId);
        if (!session || !session.queueEntryId) {
            return false;
        }
        
        const queueEntry = await prisma.queueEntry.findUnique({
            where: { id: session.queueEntryId }
        });
        
        return queueEntry && queueEntry.status === 'waiting';
    }
}

module.exports = new WebChatService();