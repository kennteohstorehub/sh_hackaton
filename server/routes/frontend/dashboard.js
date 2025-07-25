const express = require('express');
const Queue = require('../../models/Queue');
const Merchant = require('../../models/Merchant');
const logger = require('../../utils/logger');

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
    // Queue.find already returns sorted results from Prisma
    const queues = await Queue.find({ merchantId });
    
    // Calculate basic stats
    const stats = {
      totalQueues: queues.length,
      activeQueues: queues.filter(q => q.isActive).length,
      totalWaiting: 0,
      totalCustomersToday: 0,
      averageWaitTime: 0
    };

    // Calculate today's customers and current waiting
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    
    let totalActualWaitTime = 0;
    let waitingCustomersCount = 0;
    
    queues.forEach(queue => {
      // Count ONLY current waiting customers (filter out old entries)
      const currentWaitingEntries = queue.entries.filter(entry => {
        const isWaiting = entry.status === 'waiting';
        const isRecent = new Date(entry.joinedAt) >= new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
        return isWaiting && isRecent;
      });
      
      stats.totalWaiting += currentWaitingEntries.length;
      
      // Count today's customers
      const todayEntries = queue.entries.filter(entry => 
        new Date(entry.joinedAt) >= today
      );
      stats.totalCustomersToday += todayEntries.length;
      
      // Calculate actual wait time for currently waiting customers
      currentWaitingEntries.forEach(entry => {
        const waitTimeMinutes = Math.floor((now - new Date(entry.joinedAt)) / (1000 * 60));
        totalActualWaitTime += waitTimeMinutes;
        waitingCustomersCount++;
      });
    });
    
    // Calculate average actual wait time
    stats.averageWaitTime = waitingCustomersCount > 0 ? Math.round(totalActualWaitTime / waitingCustomersCount) : 0;

    // Prepare waiting customers for the template (only recent entries)
    let templateWaitingCustomers = [];
    const activeQueue = queues.find(queue => queue.isActive);
    if (activeQueue) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      templateWaitingCustomers = activeQueue.entries
        .filter(entry => {
          const isActiveStatus = entry.status === 'waiting' || entry.status === 'called';
          const isRecent = new Date(entry.joinedAt) >= oneDayAgo;
          return isActiveStatus && isRecent;
        })
        .sort((a, b) => {
          if (a.status === 'called' && b.status === 'waiting') return -1;
          if (a.status === 'waiting' && b.status === 'called') return 1;
          return a.position - b.position;
        });
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

// Queue management - redirect to main dashboard since functionality is integrated there
router.get('/queues', async (req, res) => {
  // Redirect to main dashboard since queue management is now integrated there
  res.redirect('/dashboard');
});

// WhatsApp setup redirect - handle legacy /dashboard/whatsapp route
router.get('/whatsapp', (req, res) => {
  res.redirect('/dashboard/whatsapp-setup');
});

// GET /dashboard/queues/new - Create new queue
router.get('/queues/new', async (req, res) => {
  try {
    const merchantId = req.user.id || req.user._id;
    const merchant = await Merchant.findById(merchantId);
    
    if (!merchant) {
      req.flash('error', 'Merchant not found.');
      return res.redirect('/dashboard');
    }
    
    res.render('dashboard/queue-form', {
      title: 'Create New Queue - StoreHub Queue Management System',
      queue: null,
      serviceTypes: merchant.getActiveServices(),
      isEdit: false
    });
    
  } catch (error) {
    logger.error('New queue page error:', error);
    req.flash('error', 'Error loading form. Please try again.');
    res.redirect('/dashboard');
  }
});



// GET /dashboard/queues/:id/edit - Edit queue
router.get('/queues/:id/edit', async (req, res) => {
  try {
    const merchantId = req.user.id || req.user._id;
    const queue = await Queue.findOne({ _id: req.params.id, merchantId });
    const merchant = await Merchant.findById(merchantId);
    
    if (!queue) {
      req.flash('error', 'Queue not found.');
      return res.redirect('/dashboard');
    }
    
    res.render('dashboard/queue-form', {
      title: `Edit ${queue.name} - StoreHub Queue Management System`,
      queue,
      serviceTypes: merchant.getActiveServices(),
      isEdit: true
    });
    
  } catch (error) {
    logger.error('Edit queue page error:', error);
    req.flash('error', 'Error loading queue for editing. Please try again.');
    res.redirect('/dashboard');
  }
});

// Settings
router.get('/settings', async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.user.id || req.user._id);
    const merchantId = req.user.merchantId || req.user.id || req.user._id;
    const queues = await Queue.find({ merchantId });

    res.render('dashboard/settings-improved', {
      title: 'Settings - StoreHub Queue Management System',
      merchant,
      queues,
      csrfToken: req.csrfToken ? req.csrfToken() : req.cookies['csrf-token'] || ''
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
    const merchant = await Merchant.findById(merchantId);
    
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
    res.render('dashboard/whatsapp-setup', {
      title: 'WhatsApp Setup - StoreHub Queue Management System'
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
    const merchant = await Merchant.findById(req.user.id || req.user._id);
    
    res.render('dashboard/analytics', {
      title: 'Analytics - StoreHub Queue Management System',
      merchant
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
    const queues = await Queue.find({ merchantId });
    
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