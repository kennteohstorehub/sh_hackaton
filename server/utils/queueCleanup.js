const prisma = require('./prisma');
const logger = require('./logger');

/**
 * Clean up stale queue entries that are older than 24 hours
 * and still in 'waiting' or 'called' status
 */
async function cleanupStaleQueueEntries() {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Find and update stale entries
    const result = await prisma.queueEntry.updateMany({
      where: {
        OR: [
          {
            status: 'waiting',
            joinedAt: { lt: oneDayAgo }
          },
          {
            status: 'called',
            joinedAt: { lt: oneDayAgo }
          }
        ]
      },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
        notes: 'Auto-cancelled due to inactivity (24+ hours)'
      }
    });
    
    if (result.count > 0) {
      logger.info(`Queue cleanup: Auto-cancelled ${result.count} stale entries`);
    }
    
    return result.count;
  } catch (error) {
    logger.error('Queue cleanup error:', error);
    return 0;
  }
}

/**
 * Run cleanup on a schedule (every hour)
 */
function startQueueCleanupSchedule() {
  // Run immediately on startup
  cleanupStaleQueueEntries();
  
  // Then run every hour
  setInterval(() => {
    cleanupStaleQueueEntries();
  }, 60 * 60 * 1000); // 1 hour
  
  logger.info('Queue cleanup schedule started - will run every hour');
}

module.exports = {
  cleanupStaleQueueEntries,
  startQueueCleanupSchedule
};