const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const Queue = require('../models/Queue');
const Merchant = require('../models/Merchant');
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
        const merchant = await Merchant.findById(merchantId);
        if (!merchant || !merchant.isActive) {
            return res.status(404).json({ error: 'Business not found or inactive' });
        }

        // Find active queue for merchant
        const queue = await Queue.findOne({ 
            merchantId: merchant.id || merchant._id, 
            isActive: true 
        });

        if (!queue) {
            return res.status(404).json({ error: 'No active queue available' });
        }

        if (!queue.acceptingCustomers) {
            return res.status(400).json({ error: 'Queue is not accepting new customers at the moment' });
        }

        // Check if queue is at capacity
        const currentCount = queue.entries?.filter(e => e.status === 'waiting').length || 0;
        if (queue.maxCapacity && currentCount >= queue.maxCapacity) {
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
        const entry = await prisma.queueEntry.create({
            data: {
                queueId: queue.id,
                customerId: `webchat_${sessionId}`,
                customerName,
                customerPhone,
                platform: 'webchat',
                sessionId,
                partySize: parseInt(partySize),
                specialRequests,
                position: currentCount + 1,
                estimatedWaitTime: (currentCount + 1) * (queue.averageServiceTime || 15),
                verificationCode
            }
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
        const io = req.app.get('io');
        if (io) {
            io.to(merchantId).emit('new-customer', {
                queueId: queue.id,
                entry: {
                    ...entry,
                    queueNumber,
                    verificationCode
                }
            });
        }

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
                merchantName: merchant.businessName
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

        // Get session data
        const session = webChatService.getSession(sessionId);
        if (!session || !session.queueEntryId) {
            return res.status(404).json({ 
                error: 'No active queue found for this session' 
            });
        }

        // Get queue entry with queue data
        const queueEntry = await prisma.queueEntry.findUnique({
            where: { id: session.queueEntryId },
            include: {
                queue: {
                    include: {
                        merchant: true
                    }
                }
            }
        });

        if (!queueEntry) {
            webChatService.clearSession(sessionId);
            return res.status(404).json({ 
                error: 'Queue entry not found' 
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
                merchantName: queueEntry.queue.merchant?.businessName
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

        // Get session data
        const session = webChatService.getSession(sessionId);
        if (!session || !session.queueEntryId) {
            return res.status(404).json({ 
                error: 'No active queue found for this session' 
            });
        }

        // Find and update queue entry
        const queueEntry = await prisma.queueEntry.findUnique({
            where: { id: session.queueEntryId },
            include: { queue: true }
        });

        if (!queueEntry || queueEntry.status !== 'waiting') {
            return res.status(400).json({ 
                error: 'Cannot cancel - entry not found or not in waiting status' 
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
        const io = req.app.get('io');
        if (io) {
            io.to(queueEntry.queue.merchantId).emit('queue-updated', {
                queueId: queueEntry.queueId,
                action: 'customer-cancelled',
                customerId: queueEntry.customerId
            });
        }

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

module.exports = router;