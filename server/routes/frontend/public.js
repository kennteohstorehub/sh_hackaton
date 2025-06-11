const express = require('express');
const Queue = require('../../models/Queue');
const Merchant = require('../../models/Merchant');
const logger = require('../../utils/logger');

const router = express.Router();

// GET / - Landing page
router.get('/', (req, res) => {
  res.render('public/index', {
    title: 'Smart Queue Manager - Reduce Wait Times with AI-Powered Queue Management'
  });
});

// GET /about - About page
router.get('/about', (req, res) => {
  res.render('public/about', {
    title: 'About - Smart Queue Manager'
  });
});

// GET /features - Features page
router.get('/features', (req, res) => {
  res.render('public/features', {
    title: 'Features - Smart Queue Manager'
  });
});

// GET /pricing - Pricing page
router.get('/pricing', (req, res) => {
  res.render('public/pricing', {
    title: 'Pricing - Smart Queue Manager'
  });
});

// GET /join/:merchantId - Customer queue joining page
router.get('/join/:merchantId', async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.params.merchantId);
    
    if (!merchant || !merchant.isActive) {
      return res.render('public/error', {
        title: 'Business Not Found',
        message: 'The business you are looking for is not available.',
        showBackButton: false
      });
    }
    
    // Check if business is open
    const isOpen = merchant.isBusinessOpen();
    
    // Get active queues
    const queues = await Queue.find({ 
      merchantId: merchant._id, 
      isActive: true 
    }).sort({ createdAt: -1 });
    
    res.render('public/join-queue', {
      title: `Join Queue - ${merchant.businessName}`,
      merchant,
      queues,
      isOpen,
      serviceTypes: merchant.getActiveServices()
    });
    
  } catch (error) {
    logger.error('Join queue page error:', error);
    res.render('public/error', {
      title: 'Error',
      message: 'An error occurred while loading the queue. Please try again.',
      showBackButton: true
    });
  }
});

// GET /queue-status/:queueId/:customerId - Customer queue status page
router.get('/queue-status/:queueId/:customerId', async (req, res) => {
  try {
    const { queueId, customerId } = req.params;
    
    const queue = await Queue.findById(queueId).populate('merchantId');
    
    if (!queue) {
      return res.render('public/error', {
        title: 'Queue Not Found',
        message: 'The queue you are looking for does not exist.',
        showBackButton: false
      });
    }
    
    const customer = queue.getCustomer(customerId);
    
    if (!customer) {
      return res.render('public/error', {
        title: 'Customer Not Found',
        message: 'You are not in this queue or your session has expired.',
        showBackButton: false
      });
    }
    
    // Calculate position in queue for waiting customers
    let currentPosition = customer.position;
    if (customer.status === 'waiting') {
      const waitingCustomers = queue.entries
        .filter(entry => entry.status === 'waiting')
        .sort((a, b) => a.position - b.position);
      
      const customerIndex = waitingCustomers.findIndex(entry => entry.customerId === customerId);
      currentPosition = customerIndex + 1;
    }
    
    res.render('public/queue-status', {
      title: `Queue Status - ${queue.merchantId.businessName}`,
      queue,
      customer,
      currentPosition,
      merchant: queue.merchantId
    });
    
  } catch (error) {
    logger.error('Queue status page error:', error);
    res.render('public/error', {
      title: 'Error',
      message: 'An error occurred while loading your queue status. Please try again.',
      showBackButton: true
    });
  }
});

// GET /contact - Contact page
router.get('/contact', (req, res) => {
  res.render('public/contact', {
    title: 'Contact Us - Smart Queue Manager'
  });
});

// GET /privacy - Privacy policy
router.get('/privacy', (req, res) => {
  res.render('public/privacy', {
    title: 'Privacy Policy - Smart Queue Manager'
  });
});

// GET /terms - Terms of service
router.get('/terms', (req, res) => {
  res.render('public/terms', {
    title: 'Terms of Service - Smart Queue Manager'
  });
});

module.exports = router; 