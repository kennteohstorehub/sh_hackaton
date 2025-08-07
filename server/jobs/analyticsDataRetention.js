const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const moment = require('moment');

// Analytics data retention job - runs daily
async function cleanupOldAnalyticsData() {
    try {
        logger.info('[ANALYTICS RETENTION] Starting analytics data cleanup...');
        
        // Set retention period to 6 months
        const sixMonthsAgo = moment().subtract(6, 'months').toDate();
        
        // 1. Delete old queue entries beyond 6 months
        const deletedEntries = await prisma.queueEntry.deleteMany({
            where: {
                joinedAt: { lt: sixMonthsAgo },
                status: {
                    in: ['completed', 'cancelled', 'no_show']
                }
            }
        });
        
        logger.info(`[ANALYTICS RETENTION] Deleted ${deletedEntries.count} queue entries older than 6 months`);
        
        // 2. Clean up orphaned WebChat messages
        const deletedMessages = await prisma.webChatMessage.deleteMany({
            where: {
                createdAt: { lt: sixMonthsAgo }
            }
        });
        
        logger.info(`[ANALYTICS RETENTION] Deleted ${deletedMessages.count} old WebChat messages`);
        
        // 3. Clean up old notification logs
        const deletedNotifications = await prisma.notificationLog.deleteMany({
            where: {
                sentAt: { lt: sixMonthsAgo }
            }
        });
        
        logger.info(`[ANALYTICS RETENTION] Deleted ${deletedNotifications.count} old notification logs`);
        
        // 4. Clean up old audit logs (keep backoffice audit logs longer)
        const deletedAuditLogs = await prisma.auditLog.deleteMany({
            where: {
                createdAt: { lt: sixMonthsAgo },
                userType: {
                    not: 'SUPERADMIN'
                }
            }
        });
        
        logger.info(`[ANALYTICS RETENTION] Deleted ${deletedAuditLogs.count} old audit logs`);
        
        // 5. Clean up old push subscriptions from deleted entries
        const deletedSubscriptions = await prisma.pushSubscription.deleteMany({
            where: {
                createdAt: { lt: sixMonthsAgo }
            }
        });
        
        logger.info(`[ANALYTICS RETENTION] Deleted ${deletedSubscriptions.count} old push subscriptions`);
        
        // 6. Update queue analytics to reflect current data
        const queues = await prisma.queue.findMany({
            where: { isActive: true }
        });
        
        for (const queue of queues) {
            // Recalculate analytics based on data within 6 months
            const recentEntries = await prisma.queueEntry.findMany({
                where: {
                    queueId: queue.id,
                    joinedAt: { gte: sixMonthsAgo }
                }
            });
            
            const completedEntries = recentEntries.filter(e => e.status === 'completed');
            const totalServed = completedEntries.length;
            
            let averageWaitTime = null;
            let averageServiceTime = null;
            
            if (completedEntries.length > 0) {
                const waitTimes = completedEntries
                    .filter(e => e.completedAt)
                    .map(e => moment(e.completedAt).diff(moment(e.joinedAt), 'minutes'));
                
                if (waitTimes.length > 0) {
                    averageWaitTime = waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length;
                }
                
                const serviceTimes = completedEntries
                    .filter(e => e.servedAt && e.completedAt)
                    .map(e => moment(e.completedAt).diff(moment(e.servedAt), 'minutes'));
                
                if (serviceTimes.length > 0) {
                    averageServiceTime = serviceTimes.reduce((a, b) => a + b, 0) / serviceTimes.length;
                }
            }
            
            // Update or create queue analytics
            await prisma.queueAnalytics.upsert({
                where: { queueId: queue.id },
                update: {
                    totalServed,
                    averageWaitTime,
                    averageServiceTime,
                    lastUpdated: new Date()
                },
                create: {
                    queueId: queue.id,
                    totalServed,
                    averageWaitTime,
                    averageServiceTime
                }
            });
        }
        
        logger.info(`[ANALYTICS RETENTION] Updated analytics for ${queues.length} queues`);
        
        return {
            deletedEntries: deletedEntries.count,
            deletedMessages: deletedMessages.count,
            deletedNotifications: deletedNotifications.count,
            deletedAuditLogs: deletedAuditLogs.count,
            deletedSubscriptions: deletedSubscriptions.count,
            updatedQueues: queues.length
        };
        
    } catch (error) {
        logger.error('[ANALYTICS RETENTION] Error during cleanup:', error);
        throw error;
    }
}

// Export for use in scheduler
module.exports = {
    cleanupOldAnalyticsData
};

// If run directly, execute the cleanup
if (require.main === module) {
    cleanupOldAnalyticsData()
        .then(result => {
            console.log('Analytics data retention cleanup completed:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('Analytics data retention cleanup failed:', error);
            process.exit(1);
        });
}