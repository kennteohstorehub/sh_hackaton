const express = require('express');
const Queue = require('../../models/Queue');
const Merchant = require('../../models/Merchant');
const logger = require('../../utils/logger');

const router = express.Router();

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.flash('error', 'Please log in to access the dashboard.');
    return res.redirect('/auth/login');
  }
  next();
};

// GET /dashboard - Main dashboard
router.get('/', requireAuth, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
    
    // Get merchant's queues
    const queues = await Queue.find({ merchantId, isActive: true })
      .sort({ createdAt: -1 });
    
    // Calculate dashboard statistics
    const stats = {
      totalQueues: queues.length,
      totalCustomersWaiting: 0,
      totalCustomersServed: 0,
      averageWaitTime: 0
    };
    
    queues.forEach(queue => {
      stats.totalCustomersWaiting += queue.currentLength;
      stats.totalCustomersServed += queue.analytics.totalServed;
      stats.averageWaitTime += queue.analytics.averageWaitTime;
    });
    
    if (queues.length > 0) {
      stats.averageWaitTime = Math.round(stats.averageWaitTime / queues.length);
    }
    
    // Get recent activity (last 10 queue entries)
    const recentActivity = [];
    queues.forEach(queue => {
      queue.entries
        .filter(entry => entry.status !== 'waiting')
        .sort((a, b) => new Date(b.completedAt || b.calledAt) - new Date(a.completedAt || a.calledAt))
        .slice(0, 5)
        .forEach(entry => {
          recentActivity.push({
            queueName: queue.name,
            customerName: entry.customerName,
            status: entry.status,
            timestamp: entry.completedAt || entry.calledAt || entry.joinedAt,
            platform: entry.platform
          });
        });
    });
    
    recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    recentActivity.splice(10); // Keep only top 10
    
    res.render('dashboard/index', {
      title: 'Dashboard - Smart Queue Manager',
      queues,
      stats,
      recentActivity
    });
    
  } catch (error) {
    logger.error('Dashboard error:', error);
    req.flash('error', 'Error loading dashboard. Please try again.');
    res.render('dashboard/index', {
      title: 'Dashboard - Smart Queue Manager',
      queues: [],
      stats: { totalQueues: 0, totalCustomersWaiting: 0, totalCustomersServed: 0, averageWaitTime: 0 },
      recentActivity: []
    });
  }
});

// GET /dashboard/queues - Queue management
router.get('/queues', requireAuth, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
    const queues = await Queue.find({ merchantId }).sort({ createdAt: -1 });
    
    res.render('dashboard/queues', {
      title: 'Queue Management - Smart Queue Manager',
      queues
    });
    
  } catch (error) {
    logger.error('Queues page error:', error);
    req.flash('error', 'Error loading queues. Please try again.');
    res.render('dashboard/queues', {
      title: 'Queue Management - Smart Queue Manager',
      queues: []
    });
  }
});

// GET /dashboard/queues/new - Create new queue
router.get('/queues/new', requireAuth, async (req, res) => {
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
router.get('/queues/:id', requireAuth, async (req, res) => {
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
router.get('/queues/:id/edit', requireAuth, async (req, res) => {
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

// GET /dashboard/settings - Settings page
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
    const merchant = await Merchant.findById(merchantId);
    
    if (!merchant) {
      req.flash('error', 'Merchant not found.');
      return res.redirect('/dashboard');
    }
    
    res.render('dashboard/settings', {
      title: 'Settings - Smart Queue Manager',
      merchant
    });
    
  } catch (error) {
    logger.error('Settings page error:', error);
    req.flash('error', 'Error loading settings. Please try again.');
    res.redirect('/dashboard');
  }
});

// GET /dashboard/integrations - Integrations page
router.get('/integrations', requireAuth, async (req, res) => {
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

// GET /dashboard/analytics - Analytics page
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
    
    // Check if merchant has analytics feature
    if (!req.session.user.subscription.features.analytics) {
      req.flash('error', 'Analytics feature is not available in your current plan.');
      return res.redirect('/dashboard');
    }
    
    const queues = await Queue.find({ merchantId });
    
    // Calculate analytics data
    const analyticsData = {
      totalCustomersServed: 0,
      averageWaitTime: 0,
      customerSatisfaction: 0,
      noShowRate: 0,
      peakHours: {},
      dailyStats: {},
      serviceTypeStats: {}
    };
    
    queues.forEach(queue => {
      analyticsData.totalCustomersServed += queue.analytics.totalServed;
      analyticsData.averageWaitTime += queue.analytics.averageWaitTime;
      analyticsData.customerSatisfaction += queue.analytics.customerSatisfaction;
      analyticsData.noShowRate += queue.analytics.noShowRate;
    });
    
    if (queues.length > 0) {
      analyticsData.averageWaitTime = Math.round(analyticsData.averageWaitTime / queues.length);
      analyticsData.customerSatisfaction = Math.round(analyticsData.customerSatisfaction / queues.length * 10) / 10;
      analyticsData.noShowRate = Math.round(analyticsData.noShowRate / queues.length * 100) / 100;
    }
    
    res.render('dashboard/analytics', {
      title: 'Analytics - Smart Queue Manager',
      analyticsData,
      queues
    });
    
  } catch (error) {
    logger.error('Analytics page error:', error);
    req.flash('error', 'Error loading analytics. Please try again.');
    res.redirect('/dashboard');
  }
});

module.exports = router; 