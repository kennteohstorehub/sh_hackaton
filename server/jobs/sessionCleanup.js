const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

// Session cleanup job - runs every hour
async function cleanupExpiredSessions() {
    try {
        logger.info('[SESSION CLEANUP] Starting expired session cleanup...');
        
        const now = new Date();
        
        // 1. Mark expired WebChatSessions as inactive
        const expiredSessions = await prisma.webChatSession.updateMany({
            where: {
                sessionExpiresAt: { lt: now },
                isActive: true
            },
            data: {
                isActive: false
            }
        });
        
        logger.info(`[SESSION CLEANUP] Marked ${expiredSessions.count} sessions as inactive`);
        
        // 2. Clean up old inactive sessions (older than 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const deletedSessions = await prisma.webChatSession.deleteMany({
            where: {
                isActive: false,
                updatedAt: { lt: sevenDaysAgo }
            }
        });
        
        logger.info(`[SESSION CLEANUP] Deleted ${deletedSessions.count} old inactive sessions`);
        
        // 3. Update queue entries with expired sessions
        const expiredQueueEntries = await prisma.queueEntry.updateMany({
            where: {
                sessionExpiresAt: { lt: now },
                status: 'waiting',
                platform: 'webchat'
            },
            data: {
                notes: prisma.raw(`COALESCE(notes, '') || ' [Session expired at ' || NOW() || ']'`)
            }
        });
        
        logger.info(`[SESSION CLEANUP] Updated ${expiredQueueEntries.count} queue entries with expired sessions`);
        
        // 4. Clean up orphaned queue entries (no activity for 24 hours)
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        
        const orphanedEntries = await prisma.queueEntry.updateMany({
            where: {
                lastActivityAt: { lt: oneDayAgo },
                status: 'waiting',
                platform: 'webchat'
            },
            data: {
                status: 'no_show',
                completedAt: now,
                notes: prisma.raw(`COALESCE(notes, '') || ' [Auto-removed due to inactivity]'`)
            }
        });
        
        logger.info(`[SESSION CLEANUP] Marked ${orphanedEntries.count} inactive entries as no-show`);
        
        return {
            expiredSessions: expiredSessions.count,
            deletedSessions: deletedSessions.count,
            expiredQueueEntries: expiredQueueEntries.count,
            orphanedEntries: orphanedEntries.count
        };
        
    } catch (error) {
        logger.error('[SESSION CLEANUP] Error during cleanup:', error);
        throw error;
    }
}

// Export for use in scheduler
module.exports = {
    cleanupExpiredSessions
};

// If run directly, execute the cleanup
if (require.main === module) {
    cleanupExpiredSessions()
        .then(result => {
            console.log('Session cleanup completed:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('Session cleanup failed:', error);
            process.exit(1);
        });
}