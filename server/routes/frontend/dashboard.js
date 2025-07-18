const express = require('express');
const Queue = require('../../models/Queue');
const Merchant = require('../../models/Merchant');
const logger = require('../../utils/logger');

const router = express.Router();

// Mock user for demo purposes
const mockUser = {
  id: '507f1f77bcf86cd799439011',
  email: 'demo@smartqueue.com',
  businessName: 'Demo Restaurant',
  businessType: 'restaurant'
};

// Middleware to set mock user
const setMockUser = (req, res, next) => {
  req.session.user = mockUser;
  res.locals.user = mockUser;
  next();
};

// Dashboard home
router.get('/', setMockUser, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
    const queues = await Queue.find({ merchantId }).sort({ createdAt: -1 });
    
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
      activeQueue
    });

  } catch (error) {
    logger.error('Dashboard error:', error);
    req.flash('error', 'Error loading dashboard.');
    res.redirect('/');
  }
});

// Queue management - redirect to main dashboard since functionality is integrated there
router.get('/queues', setMockUser, async (req, res) => {
  // Redirect to main dashboard since queue management is now integrated there
  res.redirect('/dashboard');
});

// WhatsApp setup redirect - handle legacy /dashboard/whatsapp route
router.get('/whatsapp', setMockUser, (req, res) => {
  res.redirect('/dashboard/whatsapp-setup');
});

// GET /dashboard/queues/new - Create new queue
router.get('/queues/new', setMockUser, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
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
router.get('/queues/:id/edit', setMockUser, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
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
router.get('/settings', setMockUser, async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.session.user.id);

    res.render('dashboard/settings-improved', {
      title: 'Settings - StoreHub Queue Management System',
      merchant
    });

  } catch (error) {
    logger.error('Settings error:', error);
    req.flash('error', 'Error loading settings.');
    res.redirect('/dashboard');
  }
});

// GET /dashboard/integrations - Integrations page
router.get('/integrations', setMockUser, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
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
router.get('/whatsapp-setup', setMockUser, async (req, res) => {
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
router.get('/analytics', setMockUser, async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.session.user.id);
    
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

module.exports = router; 