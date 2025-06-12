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
      // Count current waiting customers
      const currentWaiting = queue.entries.filter(entry => entry.status === 'waiting').length;
      stats.totalWaiting += currentWaiting;
      
      // Count today's customers
      const todayEntries = queue.entries.filter(entry => 
        new Date(entry.joinedAt) >= today
      );
      stats.totalCustomersToday += todayEntries.length;
      
      // Calculate actual wait time for currently waiting customers
      const waitingEntries = queue.entries.filter(entry => entry.status === 'waiting');
      waitingEntries.forEach(entry => {
        const waitTimeMinutes = Math.floor((now - new Date(entry.joinedAt)) / (1000 * 60));
        totalActualWaitTime += waitTimeMinutes;
        waitingCustomersCount++;
      });
    });
    
    // Calculate average actual wait time
    stats.averageWaitTime = waitingCustomersCount > 0 ? Math.round(totalActualWaitTime / waitingCustomersCount) : 0;

    // Prepare waiting customers for the template
    let templateWaitingCustomers = [];
    const activeQueue = queues.find(queue => queue.isActive);
    if (activeQueue) {
      templateWaitingCustomers = activeQueue.entries
        .filter(entry => entry.status === 'waiting' || entry.status === 'called')
        .sort((a, b) => {
          if (a.status === 'called' && b.status === 'waiting') return -1;
          if (a.status === 'waiting' && b.status === 'called') return 1;
          return a.position - b.position;
        });
    }

    res.render('dashboard/index', {
      title: 'Dashboard - Smart Queue Manager',
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
      return res.redirect('/dashboard/queues');
    }
    
    res.render('dashboard/queue-form', {
      title: 'Create New Queue - Smart Queue Manager',
      queue: null,
      serviceTypes: merchant.getActiveServices(),
      isEdit: false
    });
    
  } catch (error) {
    logger.error('New queue page error:', error);
    req.flash('error', 'Error loading form. Please try again.');
    res.redirect('/dashboard/queues');
  }
});

// GET /dashboard/queues/:id - View specific queue
router.get('/queues/:id', setMockUser, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
    const queue = await Queue.findOne({ _id: req.params.id, merchantId });
    
    if (!queue) {
      req.flash('error', 'Queue not found.');
      return res.redirect('/dashboard/queues');
    }
    
    // Sort entries by position for waiting customers, then by status change time for others
    const waitingCustomers = queue.entries
      .filter(entry => entry.status === 'waiting')
      .sort((a, b) => a.position - b.position);
      
    const otherCustomers = queue.entries
      .filter(entry => entry.status !== 'waiting')
      .sort((a, b) => new Date(b.completedAt || b.calledAt || b.joinedAt) - new Date(a.completedAt || a.calledAt || a.joinedAt));
    
    res.render('dashboard/queue-detail', {
      title: `${queue.name} - Queue Management`,
      queue,
      waitingCustomers,
      otherCustomers
    });
    
  } catch (error) {
    logger.error('Queue detail error:', error);
    req.flash('error', 'Error loading queue details. Please try again.');
    res.redirect('/dashboard/queues');
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
      return res.redirect('/dashboard/queues');
    }
    
    res.render('dashboard/queue-form', {
      title: `Edit ${queue.name} - Smart Queue Manager`,
      queue,
      serviceTypes: merchant.getActiveServices(),
      isEdit: true
    });
    
  } catch (error) {
    logger.error('Edit queue page error:', error);
    req.flash('error', 'Error loading queue for editing. Please try again.');
    res.redirect('/dashboard/queues');
  }
});

// Settings
router.get('/settings', setMockUser, async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.session.user.id);

    res.render('dashboard/settings', {
      title: 'Settings - Smart Queue Manager',
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
      title: 'Integrations - Smart Queue Manager',
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
      title: 'WhatsApp Setup - Smart Queue Manager'
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
router.get('/analytics', setMockUser, (req, res) => {
  res.render('dashboard/analytics', {
    title: 'Analytics - Smart Queue Manager'
  });
});

module.exports = router; 