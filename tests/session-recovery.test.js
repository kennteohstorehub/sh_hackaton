const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const { app } = require('../server/index');

const prisma = new PrismaClient();

describe('WebChat Session Recovery', () => {
    let testSessionId;
    let testEntryId;
    let testMerchantId = 'demo';
    
    beforeEach(() => {
        testSessionId = `test_session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    });
    
    afterEach(async () => {
        // Clean up test data
        await prisma.webChatSession.deleteMany({
            where: { sessionId: testSessionId }
        });
        
        if (testEntryId) {
            await prisma.queueEntry.delete({
                where: { id: testEntryId }
            }).catch(() => {}); // Ignore if already deleted
        }
    });
    
    afterAll(async () => {
        await prisma.$disconnect();
    });
    
    describe('POST /api/webchat/join', () => {
        it('should create a WebChatSession when joining queue', async () => {
            const response = await request(app)
                .post('/api/webchat/join')
                .send({
                    customerName: 'Test User',
                    customerPhone: '+60123456789',
                    partySize: 2,
                    merchantId: testMerchantId,
                    sessionId: testSessionId
                });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            
            testEntryId = response.body.queueEntry.id;
            
            // Verify WebChatSession was created
            const session = await prisma.webChatSession.findFirst({
                where: { sessionId: testSessionId }
            });
            
            expect(session).toBeTruthy();
            expect(session.queueEntryId).toBe(testEntryId);
            expect(session.isActive).toBe(true);
            expect(session.sessionExpiresAt).toBeTruthy();
        });
    });
    
    describe('POST /api/webchat/session/validate', () => {
        beforeEach(async () => {
            // Create a queue entry and session
            const entry = await prisma.queueEntry.create({
                data: {
                    customerId: `test_${Date.now()}`,
                    customerName: 'Test User',
                    customerPhone: '+60123456789',
                    status: 'waiting',
                    position: 1,
                    partySize: 2,
                    platform: 'webchat',
                    sessionId: testSessionId,
                    verificationCode: 'TEST123',
                    queueId: 'test-queue-id', // You'll need a valid queue ID
                    sessionExpiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours
                }
            });
            
            testEntryId = entry.id;
            
            await prisma.webChatSession.create({
                data: {
                    sessionId: testSessionId,
                    queueEntryId: testEntryId,
                    isActive: true,
                    sessionExpiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000)
                }
            });
        });
        
        it('should validate active session', async () => {
            const response = await request(app)
                .post('/api/webchat/session/validate')
                .send({ sessionId: testSessionId });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.recovered).toBe(true);
            expect(response.body.queueData).toBeTruthy();
            expect(response.body.queueData.sessionId).toBe(testSessionId);
        });
        
        it('should recover session within grace period', async () => {
            // Expire the session but keep within grace period
            await prisma.webChatSession.updateMany({
                where: { sessionId: testSessionId },
                data: { isActive: false }
            });
            
            // Update last activity to be within grace period (10 minutes ago)
            await prisma.queueEntry.update({
                where: { id: testEntryId },
                data: {
                    lastActivityAt: new Date(Date.now() - 10 * 60 * 1000)
                }
            });
            
            const response = await request(app)
                .post('/api/webchat/session/validate')
                .send({ sessionId: testSessionId });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.recovered).toBe(true);
            expect(response.body.withinGracePeriod).toBe(true);
        });
        
        it('should fail for expired session outside grace period', async () => {
            // Expire the session and move outside grace period
            await prisma.webChatSession.updateMany({
                where: { sessionId: testSessionId },
                data: {
                    isActive: false,
                    sessionExpiresAt: new Date(Date.now() - 1000)
                }
            });
            
            await prisma.queueEntry.update({
                where: { id: testEntryId },
                data: {
                    lastActivityAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
                }
            });
            
            const response = await request(app)
                .post('/api/webchat/session/validate')
                .send({ sessionId: testSessionId });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(false);
            expect(response.body.recovered).toBe(false);
        });
        
        it('should handle non-existent session', async () => {
            const response = await request(app)
                .post('/api/webchat/session/validate')
                .send({ sessionId: 'non_existent_session' });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(false);
            expect(response.body.recovered).toBe(false);
        });
    });
    
    describe('POST /api/webchat/session/extend', () => {
        beforeEach(async () => {
            // Create a session
            await prisma.webChatSession.create({
                data: {
                    sessionId: testSessionId,
                    queueEntryId: 'test-entry-id',
                    isActive: true,
                    sessionExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
                }
            });
        });
        
        it('should extend active session', async () => {
            const response = await request(app)
                .post('/api/webchat/session/extend')
                .send({ sessionId: testSessionId });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.sessionExpiresAt).toBeTruthy();
            
            // Verify session was extended
            const session = await prisma.webChatSession.findFirst({
                where: { sessionId: testSessionId }
            });
            
            const expiresAt = new Date(session.sessionExpiresAt);
            const now = new Date();
            const hoursDiff = (expiresAt - now) / (1000 * 60 * 60);
            
            expect(hoursDiff).toBeGreaterThan(3.5); // Should be close to 4 hours
            expect(hoursDiff).toBeLessThan(4.5);
        });
        
        it('should fail for non-existent session', async () => {
            const response = await request(app)
                .post('/api/webchat/session/extend')
                .send({ sessionId: 'non_existent_session' });
            
            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Session not found');
        });
        
        it('should fail for inactive session', async () => {
            // Mark session as inactive
            await prisma.webChatSession.updateMany({
                where: { sessionId: testSessionId },
                data: { isActive: false }
            });
            
            const response = await request(app)
                .post('/api/webchat/session/extend')
                .send({ sessionId: testSessionId });
            
            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Session not found');
        });
    });
    
    describe('Session Cleanup Job', () => {
        const { cleanupExpiredSessions } = require('../server/jobs/sessionCleanup');
        
        it('should mark expired sessions as inactive', async () => {
            // Create an expired session
            await prisma.webChatSession.create({
                data: {
                    sessionId: testSessionId,
                    queueEntryId: 'test-entry-id',
                    isActive: true,
                    sessionExpiresAt: new Date(Date.now() - 1000) // Expired
                }
            });
            
            const result = await cleanupExpiredSessions();
            
            expect(result.expiredSessions).toBeGreaterThan(0);
            
            // Verify session was marked inactive
            const session = await prisma.webChatSession.findFirst({
                where: { sessionId: testSessionId }
            });
            
            expect(session.isActive).toBe(false);
        });
        
        it('should delete old inactive sessions', async () => {
            // Create an old inactive session
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 8); // 8 days ago
            
            await prisma.webChatSession.create({
                data: {
                    sessionId: testSessionId,
                    queueEntryId: 'test-entry-id',
                    isActive: false,
                    sessionExpiresAt: oldDate,
                    updatedAt: oldDate
                }
            });
            
            const result = await cleanupExpiredSessions();
            
            expect(result.deletedSessions).toBeGreaterThan(0);
            
            // Verify session was deleted
            const session = await prisma.webChatSession.findFirst({
                where: { sessionId: testSessionId }
            });
            
            expect(session).toBeNull();
        });
    });
    
    describe('Grace Period Recovery', () => {
        it('should allow rejoin within grace period after cancellation', async () => {
            // Create and join queue
            const joinResponse = await request(app)
                .post('/api/webchat/join')
                .send({
                    customerName: 'Test User',
                    customerPhone: '+60123456789',
                    partySize: 2,
                    merchantId: testMerchantId,
                    sessionId: testSessionId
                });
            
            testEntryId = joinResponse.body.queueEntry.id;
            
            // Cancel the queue entry
            await request(app)
                .post(`/api/webchat/cancel/${testSessionId}`);
            
            // Update the entry to simulate being within grace period
            await prisma.queueEntry.update({
                where: { id: testEntryId },
                data: {
                    status: 'waiting',
                    completedAt: null,
                    lastActivityAt: new Date()
                }
            });
            
            // Try to validate session
            const validateResponse = await request(app)
                .post('/api/webchat/session/validate')
                .send({ sessionId: testSessionId });
            
            expect(validateResponse.status).toBe(200);
            expect(validateResponse.body.success).toBe(true);
            expect(validateResponse.body.recovered).toBe(true);
            expect(validateResponse.body.withinGracePeriod).toBe(true);
        });
    });
});