const express = require('express');
const queueService = require('../../services/queueService');
const merchantService = require('../../services/merchantService');
const logger = require('../../utils/logger');
const prisma = require('../../utils/prisma');

// Use appropriate auth middleware based on environment
let requireAuth, loadUser;
if (process.env.NODE_ENV !== 'production') {
  ({ requireAuth, loadUser } = require('../../middleware/auth-bypass'));
} else {
  ({ requireAuth, loadUser } = require('../../middleware/auth'));
}

const router = express.Router();

// Apply authentication to all dashboard routes
router.use(requireAuth);
router.use(loadUser);

// Dashboard home
router.get('/', async (req, res) => {
  try {
    logger.info('Dashboard access attempt', {
      hasUser: !!req.user,
      userId: req.user?.id || req.user?._id,
      sessionId: req.sessionID,
      sessionUserId: req.session?.userId,
      csrfAvailable: !!res.locals.csrfToken
    });
    
    if (!req.user || (!req.user.id && !req.user._id)) {
      logger.error('No user object found in dashboard route');
      throw new Error('User not found in request');
    }
    
    const merchantId = req.user.id || req.user._id;
    
    // PERFORMANCE OPTIMIZATION: Only fetch active queues with recent entries
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const queues = await queueService.findActiveWithRecentEntries(merchantId, oneDayAgo);
    
    // Calculate basic stats efficiently
    const stats = {
      totalQueues: queues.length,
      activeQueues: queues.filter(q => q.isActive).length,
      totalWaiting: 0,
      totalCustomersToday: 0,
      averageWaitTime: 0
    };

    // Calculate stats from already filtered data
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    
    let totalActualWaitTime = 0;
    let waitingCustomersCount = 0;
    
    // Get all Prisma webchat entries for stats
    const queueIds = queues.map(q => (q._id || q.id)?.toString()).filter(id => id !== undefined);
    const prismaEntries = queueIds.length > 0 ? await prisma.queueEntry.findMany({
      where: {
        queueId: { in: queueIds },
        platform: 'webchat',
        joinedAt: { gte: today }
      }
    }) : [];
    
    queues.forEach(queue => {
      // Count ONLY waiting customers (not called) for accurate count
      const currentWaitingEntries = (queue.entries || []).filter(entry => entry.status === 'waiting');
      
      // Add Prisma webchat entries for this queue
      const queueIdStr = (queue._id || queue.id)?.toString();
      const queuePrismaEntries = queueIdStr ? prismaEntries.filter(e => e.queueId === queueIdStr) : [];
      const waitingPrismaEntries = queuePrismaEntries.filter(e => e.status === 'waiting');
      
      stats.totalWaiting += currentWaitingEntries.length + waitingPrismaEntries.length;
      
      // Count today's customers
      const todayEntries = (queue.entries || []).filter(entry => 
        new Date(entry.joinedAt) >= today
      );
      stats.totalCustomersToday += todayEntries.length + queuePrismaEntries.length;
      
      // Calculate actual wait time
      [...currentWaitingEntries, ...waitingPrismaEntries].forEach(entry => {
        const waitTimeMinutes = Math.floor((now - new Date(entry.joinedAt)) / (1000 * 60));
        totalActualWaitTime += waitTimeMinutes;
        waitingCustomersCount++;
      });
    });
    
    // Calculate average actual wait time
    stats.averageWaitTime = waitingCustomersCount > 0 ? Math.round(totalActualWaitTime / waitingCustomersCount) : 0;

    // Prepare waiting customers for the template (only recent entries)
    let templateWaitingCustomers = [];
    // Find the active queue with the most waiting customers
    const activeQueue = queues
      .filter(queue => queue.isActive)
      .sort((a, b) => {
        const aWaiting = (a.entries || []).filter(e => e.status === 'waiting').length;
        const bWaiting = (b.entries || []).filter(e => e.status === 'waiting').length;
        return bWaiting - aWaiting;
      })[0];
    if (activeQueue) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Get MongoDB entries
      const mongoEntries = (activeQueue.entries || [])
        .filter(entry => {
          // Only show waiting customers in the active queue section
          const isWaiting = entry.status === 'waiting';
          const isRecent = new Date(entry.joinedAt) >= oneDayAgo;
          return isWaiting && isRecent;
        });
      
      // Get Prisma webchat entries
      const activeQueueId = (activeQueue._id || activeQueue.id)?.toString();
      const prismaEntries = activeQueueId ? await prisma.queueEntry.findMany({
        where: {
          queueId: activeQueueId,
          status: 'waiting',
          platform: 'webchat',
          joinedAt: {
            gte: oneDayAgo
          }
        }
      }) : [];
      
      // Merge and format entries
      const allEntries = [
        ...mongoEntries.map(entry => ({
          ...entry,
          customerId: entry.customerId || entry._id,  // Ensure customerId exists
          phoneNumber: entry.phoneNumber || entry.customerPhone || entry.phone  // Ensure phoneNumber exists
        })),
        ...prismaEntries.map(entry => ({
          _id: entry.id,
          customerId: entry.id,  // Use the Prisma ID as customerId for template consistency
          customerName: entry.customerName,
          customerPhone: entry.customerPhone,
          phoneNumber: entry.customerPhone,  // Add phoneNumber for template compatibility
          platform: entry.platform,
          sessionId: entry.sessionId,
          position: entry.position,
          partySize: entry.partySize,
          specialRequests: entry.specialRequests,
          verificationCode: entry.verificationCode,
          status: entry.status,
          joinedAt: entry.joinedAt,
          estimatedWaitTime: entry.estimatedWaitTime,
          actualCustomerId: entry.customerId  // Keep the actual customerId for reference
        }))
      ];
      
      // Sort by position
      templateWaitingCustomers = allEntries.sort((a, b) => a.position - b.position);
      
      // Get called customers separately if needed
      const calledCustomers = (activeQueue.entries || [])
        .filter(entry => entry.status === 'called' && new Date(entry.joinedAt) >= oneDayAgo);
    }

    res.render('dashboard/index', {
      title: 'Dashboard - StoreHub Queue Management System',
      queues,
      stats,
      waitingCustomers: templateWaitingCustomers,
      activeQueue,
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Dashboard error:', error);
    logger.error('Error details:', {
      message: error.message,
      stack: error.stack,
      user: req.user,
      merchantId: req.user?.id || req.user?._id
    });
    
    // For now, render an error page instead of redirecting
    res.status(500).render('error', {
      title: 'Dashboard Error',
      status: 500,
      message: `Error loading dashboard: ${error.message}`,
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Queue management page removed - no longer needed

// WhatsApp setup redirect - handle legacy /dashboard/whatsapp route
router.get('/whatsapp', (req, res) => {
  res.redirect('/dashboard/whatsapp-setup');
});

// Queue create/edit routes removed - no longer needed

// Settings
router.get('/settings', async (req, res) => {
  try {
    const merchantId = req.user.id || req.user._id;
    const merchant = await merchantService.getFullDetails(merchantId);
    const queues = await queueService.findByMerchant(merchantId);

    res.render('dashboard/settings-improved', {
      title: 'Settings - StoreHub Queue Management System',
      merchant,
      queues,
      csrfToken: req.csrfToken ? req.csrfToken() : (req.cookies && req.cookies['csrf-token']) || ''
    });

  } catch (error) {
    logger.error('Settings error:', error);
    req.flash('error', 'Error loading settings.');
    res.redirect('/dashboard');
  }
});

// GET /dashboard/integrations - Integrations page
router.get('/integrations', async (req, res) => {
  try {
    const merchantId = req.user.id || req.user._id;
    const merchant = await merchantService.findById(merchantId);
    
    if (!merchant) {
      req.flash('error', 'Merchant not found.');
      return res.redirect('/dashboard');
    }
    
    res.render('dashboard/integrations', {
      title: 'Integrations - StoreHub Queue Management System',
      merchant
    });
    
  } catch (error) {
    logger.error('Integrations page error:', error);
    req.flash('error', 'Error loading integrations. Please try again.');
    res.redirect('/dashboard');
  }
});

// WhatsApp Setup page
router.get('/whatsapp-setup', async (req, res) => {
  try {
    const merchantId = req.user.id || req.user._id;
    const queues = await queueService.findByMerchant(merchantId);
    
    res.render('dashboard/whatsapp-setup', {
      title: 'WhatsApp Setup - StoreHub Queue Management System',
      queues
    });
  } catch (error) {
    logger.error('WhatsApp setup page error:', error);
    res.render('error', {
      title: 'Error',
      status: 500,
      message: 'Failed to load WhatsApp setup page'
    });
  }
});

// Analytics
router.get('/analytics', async (req, res) => {
  try {
    const merchantId = req.user.id || req.user._id;
    const merchant = await merchantService.findById(merchantId);
    
    // PERFORMANCE: Only fetch minimal queue data for analytics
    const queues = await prisma.queue.findMany({
      where: { merchantId },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true
      }
    });
    
    res.render('dashboard/analytics', {
      title: 'Analytics - StoreHub Queue Management System',
      merchant,
      queues
    });
  } catch (error) {
    logger.error('Analytics error:', error);
    req.flash('error', 'Error loading analytics.');
    res.redirect('/dashboard');
  }
});

// Help/FAQ page
router.get('/help', async (req, res) => {
  try {
    const merchantId = req.user.merchantId || req.user.id || req.user._id;
    const queues = await queueService.findByMerchant(merchantId);
    
    res.render('dashboard/help', {
      title: 'Help & FAQ - StoreHub Queue Management System',
      queues
    });
  } catch (error) {
    logger.error('Help page error:', error);
    req.flash('error', 'Error loading help page.');
    res.redirect('/dashboard');
  }
});

module.exports = router; 