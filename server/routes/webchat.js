const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const queueService = require('../services/queueService');
const merchantService = require('../services/merchantService');
const pushNotificationService = require('../services/pushNotificationService');
const webChatService = require('../services/webChatService');

const router = express.Router();

// POST /api/webchat/join - Join queue via webchat
router.post('/join', [
    body('customerName').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required'),
    body('customerPhone').matches(/^\+?[1-9]\d{1,14}$/).withMessage('Valid phone number is required'),
    body('partySize').isInt({ min: 1, max: 20 }).withMessage('Party size must be between 1 and 20'),
    body('merchantId').notEmpty().withMessage('Merchant ID is required'),
    body('sessionId').notEmpty().withMessage('Session ID is required'),
    body('specialRequests').optional().isLength({ max: 500 }).withMessage('Special requests too long'),
    body('pushSubscription').optional()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                message: errors.array()[0].msg,
                details: errors.array() 
            });
        }

        const { 
            customerName, 
            customerPhone, 
            partySize, 
            merchantId, 
            sessionId,
            specialRequests, 
            pushSubscription 
        } = req.body;

        // Find merchant and active queue
        const merchant = await merchantService.findById(merchantId);
        if (!merchant || !merchant.isActive) {
            return res.status(404).json({ error: 'Business not found or inactive' });
        }

        // Find active queue for merchant
        const queues = await queueService.findByMerchant(merchantId);
        const queue = queues.find(q => q.isActive);

        if (!queue) {
            return res.status(404).json({ error: 'No active queue available' });
        }

        if (!queue.acceptingCustomers) {
            return res.status(400).json({ error: 'Queue is not accepting new customers at the moment' });
        }

        // Check if queue is at capacity
        const stats = await queueService.getQueueStats(queue.id);
        if (queue.maxCapacity && stats.waitingCount >= queue.maxCapacity) {
            return res.status(400).json({ error: 'Queue is at full capacity' });
        }

        // Check if session already has an active queue entry
        const existingEntry = await prisma.queueEntry.findFirst({
            where: {
                sessionId: sessionId,
                status: 'waiting'
            }
        });

        if (existingEntry) {
            return res.status(400).json({ 
                error: 'You already have an active queue entry',
                queueEntry: existingEntry 
            });
        }

        // Generate unique verification code
        const verificationCode = webChatService.generateVerificationCode();

        // Create queue entry
        const entry = await queueService.addCustomer(queue.id, {
            customerId: `webchat_${sessionId}`,
            customerName,
            customerPhone,
            platform: 'webchat',
            sessionId,
            partySize: parseInt(partySize),
            specialRequests,
            verificationCode
        });

        // Generate queue number
        const queueNumber = webChatService.generateQueueNumber(entry.position);

        // Save push subscription if provided
        if (pushSubscription && pushSubscription.endpoint) {
            try {
                await pushNotificationService.saveSubscription(entry.id, pushSubscription);
                logger.info(`Push subscription saved for webchat queue entry ${entry.id}`);
                
                // Send welcome push notification
                await pushNotificationService.notifyQueueJoined(
                    entry.id,
                    queueNumber,
                    entry.position,
                    entry.estimatedWaitTime,
                    merchant.businessName
                );
            } catch (subError) {
                logger.error('Error saving push subscription:', subError);
                // Don't fail the request if push subscription fails
            }
        }

        // Emit socket event for real-time update
        req.io.to(`merchant-${merchantId}`).emit('new-customer', {
            queueId: queue.id,
            entry: {
                ...entry,
                queueNumber,
                verificationCode
            }
        });

        // Store session data
        webChatService.createSession(sessionId, {
            queueEntryId: entry.id,
            merchantId,
            queueId: queue.id,
            status: 'in_queue'
        });

        res.json({
            success: true,
            queueNumber,
            position: entry.position,
            estimatedWaitTime: entry.estimatedWaitTime,
            verificationCode,
            queueEntry: {
                ...entry,
                queueNumber,
                merchantName: merchant.businessName,
                businessPhone: merchant.phone || '+60123456789'
            }
        });

    } catch (error) {
        logger.error('Error joining queue via webchat:', error);
        res.status(500).json({ 
            error: 'Failed to join queue',
            message: error.message 
        });
    }
});

// GET /api/webchat/status/:sessionId - Check queue status
router.get('/status/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        logger.info(`Status check for sessionId: ${sessionId}`);
        
        let queueEntry = null;

        // First try to get session data from memory
        const session = webChatService.getSession(sessionId);
        logger.info(`Session from memory:`, { 
            found: !!session, 
            hasQueueEntryId: !!(session && session.queueEntryId) 
        });
        
        if (session && session.queueEntryId) {
            // Get queue entry from session
            queueEntry = await prisma.queueEntry.findUnique({
                where: { id: session.queueEntryId },
                include: {
                    queue: {
                        include: {
                            merchant: true
                        }
                    }
                }
            });
            logger.info(`Queue entry from session lookup:`, { 
                found: !!queueEntry,
                status: queueEntry?.status 
            });
        }
        
        // Always try database lookup as fallback
        if (!queueEntry) {
            logger.info(`Attempting database lookup for sessionId: ${sessionId}`);
            
            // Try to find by sessionId in database
            queueEntry = await prisma.queueEntry.findFirst({
                where: {
                    sessionId: sessionId,
                    status: 'waiting'
                },
                include: {
                    queue: {
                        include: {
                            merchant: true
                        }
                    }
                },
                orderBy: {
                    joinedAt: 'desc'
                }
            });
            
            logger.info(`Database lookup result:`, { 
                found: !!queueEntry,
                id: queueEntry?.id,
                status: queueEntry?.status 
            });
            
            // If found, recreate session for future requests
            if (queueEntry) {
                webChatService.createSession(sessionId, {
                    queueEntryId: queueEntry.id,
                    merchantId: queueEntry.queue.merchantId,
                    queueId: queueEntry.queueId,
                    status: 'in_queue'
                });
            }
        }

        if (!queueEntry) {
            return res.status(404).json({ 
                error: 'No active queue found for this session' 
            });
        }

        // Calculate current position and wait time
        let currentPosition = queueEntry.position;
        let estimatedWaitTime = queueEntry.estimatedWaitTime;

        if (queueEntry.status === 'waiting') {
            // Get all waiting entries before this one
            const entriesAhead = await prisma.queueEntry.count({
                where: {
                    queueId: queueEntry.queueId,
                    status: 'waiting',
                    position: { lt: queueEntry.position }
                }
            });

            currentPosition = entriesAhead + 1;
            estimatedWaitTime = currentPosition * (queueEntry.queue.averageServiceTime || 15);
        }

        res.json({
            success: true,
            status: queueEntry.status,
            position: currentPosition,
            estimatedWaitTime,
            verificationCode: queueEntry.verificationCode,
            queueEntry: {
                ...queueEntry,
                queueNumber: webChatService.generateQueueNumber(queueEntry.position),
                currentPosition,
                merchantName: queueEntry.queue.merchant?.businessName,
                businessPhone: queueEntry.queue.merchant?.phone || '+60123456789'
            }
        });

    } catch (error) {
        logger.error('Error checking webchat status:', error);
        res.status(500).json({ 
            error: 'Failed to check status',
            message: error.message 
        });
    }
});

// POST /api/webchat/cancel/:sessionId - Cancel queue entry
router.post('/cancel/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        logger.info(`Cancel request for sessionId: ${sessionId}`);

        // Get session data from memory
        const session = webChatService.getSession(sessionId);
        logger.info(`Session from memory:`, { 
            found: !!session, 
            hasQueueEntryId: !!(session && session.queueEntryId) 
        });
        
        let queueEntry = null;
        
        if (session && session.queueEntryId) {
            // Find queue entry using session
            queueEntry = await prisma.queueEntry.findUnique({
                where: { id: session.queueEntryId },
                include: { queue: true }
            });
        }
        
        // Fallback: Try to find by sessionId in database
        if (!queueEntry) {
            logger.info(`Attempting database lookup for cancel`);
            queueEntry = await prisma.queueEntry.findFirst({
                where: {
                    sessionId: sessionId,
                    status: 'waiting'
                },
                include: { queue: true },
                orderBy: {
                    joinedAt: 'desc'
                }
            });
            
            logger.info(`Database lookup result:`, { 
                found: !!queueEntry,
                id: queueEntry?.id,
                status: queueEntry?.status 
            });
        }

        if (!queueEntry || queueEntry.status !== 'waiting') {
            return res.status(400).json({ 
                error: 'Cannot cancel - no active queue entry found' 
            });
        }

        // Update status to cancelled
        await prisma.queueEntry.update({
            where: { id: queueEntry.id },
            data: {
                status: 'cancelled',
                completedAt: new Date()
            }
        });

        // Clear session
        webChatService.clearSession(sessionId);

        // Emit real-time update
        req.io.to(`merchant-${queueEntry.queue.merchantId}`).emit('queue-updated', {
            queueId: queueEntry.queueId,
            action: 'customer-cancelled',
            customerId: queueEntry.customerId
        });

        logger.info(`Webchat customer ${queueEntry.customerName} cancelled their queue position`);

        res.json({
            success: true,
            message: 'Successfully cancelled your queue position'
        });

    } catch (error) {
        logger.error('Error cancelling webchat queue:', error);
        res.status(500).json({ 
            error: 'Failed to cancel queue',
            message: error.message 
        });
    }
});

// POST /api/webchat/message - Process chat messages
router.post('/message', [
    body('sessionId').notEmpty().withMessage('Session ID is required'),
    body('message').notEmpty().withMessage('Message is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: errors.array() 
            });
        }

        const { sessionId, message } = req.body;

        // Process message through chatbot service
        const response = await webChatService.processMessage(sessionId, message);

        res.json({
            success: true,
            response: response.text,
            action: response.action,
            data: response.data
        });

    } catch (error) {
        logger.error('Error processing webchat message:', error);
        res.status(500).json({ 
            error: 'Failed to process message',
            message: error.message 
        });
    }
});

// GET /api/webchat/session/:sessionId - Get session info
router.get('/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = webChatService.getSession(sessionId);

        if (!session) {
            return res.json({
                success: true,
                exists: false,
                session: null
            });
        }

        res.json({
            success: true,
            exists: true,
            session: {
                status: session.status,
                createdAt: session.createdAt,
                lastActivity: session.lastActivity,
                hasActiveQueue: !!session.queueEntryId
            }
        });

    } catch (error) {
        logger.error('Error getting webchat session:', error);
        res.status(500).json({ 
            error: 'Failed to get session',
            message: error.message 
        });
    }
});

// POST /api/webchat/notify - Backend notification endpoint
router.post('/notify', async (req, res) => {
    try {
        const { sessionId, event, data } = req.body;
        
        // Log the notification
        logger.info('Webchat notification:', {
            sessionId,
            event,
            data
        });
        
        // Handle different event types
        switch (event) {
            case 'customer_joined':
                // Could send notifications to staff dashboard
                if (req.io && data.merchantId) {
                    req.io.to(`merchant-${data.merchantId}`).emit('customer-joined-webchat', {
                        customerName: data.customerName,
                        position: data.position,
                        queueId: data.queueId
                    });
                }
                break;
                
            case 'staff_requested':
                // Alert staff that customer needs help
                if (req.io && data.merchantId) {
                    req.io.to(`merchant-${data.merchantId}`).emit('staff-assistance-requested', {
                        queueId: data.queueId,
                        position: data.position,
                        customerName: data.customerName,
                        timestamp: new Date()
                    });
                }
                break;
                
            default:
                logger.info('Unknown webchat event:', event);
        }
        
        res.json({ success: true });
    } catch (error) {
        logger.error('Webchat notify error:', error);
        res.status(500).json({ error: 'Failed to process notification' });
    }
});

module.exports = router;