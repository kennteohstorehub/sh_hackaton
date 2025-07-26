const express = require('express');
const Queue = require('../../models/Queue');
const Merchant = require('../../models/Merchant');
const logger = require('../../utils/logger');

const router = express.Router();

// Home page - redirect to login if not authenticated
router.get('/', (req, res) => {
  // Check if user is already logged in
  if (req.session && req.session.userId) {
    // User is logged in, redirect to dashboard
    return res.redirect('/dashboard');
  }
  // User is not logged in, redirect to login page
  res.redirect('/auth/login');
});

// Demo page
router.get('/demo', (req, res) => {
  res.render('demo', {
    title: 'Demo - StoreHub Queue Management System'
  });
});

// WhatsApp setup redirect - redirect to dashboard setup
router.get('/whatsapp', (req, res) => {
  res.redirect('/dashboard/whatsapp-setup');
});

// Chatbot demo page
router.get('/chatbot-demo', (req, res) => {
  res.render('chatbot-demo', {
    title: 'Chatbot Demo - StoreHub Queue Management System'
  });
});

// Chatbot page
router.get('/chatbot', (req, res) => {
  const merchantId = req.query.merchantId || '3ecceb82-fb33-42c8-9d84-19eb69417e16';
  res.render('chatbot', { 
    title: 'Queue Assistant - StoreHub',
    merchantId: merchantId
  });
});

// GET /about - About page
router.get('/about', (req, res) => {
  res.render('public/about', {
    title: 'About - StoreHub Queue Management System'
  });
});

// GET /features - Features page
router.get('/features', (req, res) => {
  res.render('public/features', {
    title: 'Features - StoreHub Queue Management System'
  });
});

// GET /pricing - Pricing page
router.get('/pricing', (req, res) => {
  res.render('public/pricing', {
    title: 'Pricing - StoreHub Queue Management System'
  });
});

// GET /queue/join/:merchantId - Simple customer queue page
router.get('/queue/join/:merchantId', async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.params.merchantId);
    
    if (!merchant || !merchant.isActive) {
      return res.status(404).render('error', {
        title: 'Business Not Found',
        status: 404,
        message: 'The business you are looking for does not exist or is not active.'
      });
    }
    
    // Get current wait time estimate
    const queue = await Queue.findOne({ 
      merchantId: merchant.id || merchant._id, 
      isActive: true 
    });
    
    const currentWaitTime = queue ? queue.getAverageWaitTime() : 15;
    
    res.render('customer-queue', {
      merchant: {
        id: merchant.id || merchant._id,
        businessName: merchant.businessName,
        primaryColor: merchant.primaryColor || '#ff8c00',
        secondaryColor: merchant.secondaryColor || '#ff6b35',
        logoUrl: merchant.logoUrl,
        currentWaitTime
      }
    });
    
  } catch (error) {
    logger.error('Customer queue page error:', error);
    console.error('Full error details:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).render('error', {
      title: 'Server Error',
      status: 500,
      message: 'An error occurred while loading the queue page. Please try again later.'
    });
  }
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
      // Count how many customers with 'waiting' status have a lower position
      const customersAhead = queue.entries
        .filter(entry => 
          entry.status === 'waiting' && 
          entry.position < customer.position
        ).length;
      
      currentPosition = customersAhead + 1;
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
    title: 'Contact Us - StoreHub Queue Management System'
  });
});

// GET /privacy - Privacy policy
router.get('/privacy', (req, res) => {
  res.render('public/privacy', {
    title: 'Privacy Policy - StoreHub Queue Management System'
  });
});

// GET /terms - Terms of service
router.get('/terms', (req, res) => {
  res.render('public/terms', {
    title: 'Terms of Service - StoreHub Queue Management System'
  });
});

// Public queue listing page (when no specific queue ID is provided)
router.get('/queue/', async (req, res) => {
  try {
    // Since we're using auth bypass, get the demo merchant's queues
    const demoMerchantId = '7a99f35e-0f73-4f8e-831c-fde8fc3a5532';
    
    // Find active queues for the demo merchant
    const queues = await Queue.find({ 
      merchantId: demoMerchantId,
      isActive: true 
    });
    
    if (queues.length === 0) {
      return res.status(404).render('error', {
        title: 'No Active Queues',
        status: 404,
        message: 'There are no active queues available at this time.'
      });
    }
    
    // If there's only one queue, redirect directly to it
    if (queues.length === 1) {
      return res.redirect(`/queue/${queues[0]._id || queues[0].id}`);
    }
    
    // Otherwise, show a list of available queues
    const merchant = await Merchant.findById(demoMerchantId);
    
    res.render('public/queue-list', {
      title: 'Available Queues - StoreHub Queue Management System',
      queues,
      merchant
    });
    
  } catch (error) {
    logger.error('Queue listing error:', error);
    // If error or no queues, try to find and redirect to first active queue
    try {
      const firstQueue = await Queue.findOne({ isActive: true });
      if (firstQueue) {
        return res.redirect(`/queue/${firstQueue._id || firstQueue.id}`);
      }
    } catch (innerError) {
      logger.error('Fallback queue search error:', innerError);
    }
    
    res.status(500).render('error', {
      title: 'Server Error',
      status: 500,
      message: 'Unable to load queue information. Please try again later.'
    });
  }
});

// Queue information page for customers (accessed via QR code)
router.get('/queue/:queueId', async (req, res) => {
  try {
    const queue = await Queue.findById(req.params.queueId);
    if (!queue) {
      return res.status(404).render('error', {
        title: 'Queue Not Found',
        status: 404,
        message: 'The queue you are looking for does not exist.'
      });
    }
    
    // Filter out stale entries (older than 24 hours) to match dashboard behavior
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (queue.entries) {
      queue.entries = queue.entries.filter(entry => 
        new Date(entry.joinedAt) >= oneDayAgo ||
        entry.status === 'completed' || 
        entry.status === 'cancelled'
      );
    }

    const merchant = await Merchant.findById(queue.merchantId);
    if (!merchant) {
      return res.status(404).render('error', {
        title: 'Business Not Found',
        status: 404,
        message: 'The business information could not be found.'
      });
    }

    // Calculate queue statistics
    // Filter out stale entries (older than 24 hours) for accurate counts
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const activeWaitingEntries = queue.entries.filter(entry => 
      entry.status === 'waiting' && 
      new Date(entry.joinedAt) >= oneDayAgo
    );
    
    const totalAhead = activeWaitingEntries.length;
    
    // Calculate actual average wait time of currently waiting customers (same as dashboard)
    let averageWaitTime = 0;
    
    if (activeWaitingEntries.length > 0) {
      const totalActualWaitTime = activeWaitingEntries.reduce((total, entry) => {
        const waitTimeMinutes = Math.floor((now - new Date(entry.joinedAt)) / (1000 * 60));
        return total + waitTimeMinutes;
      }, 0);
      averageWaitTime = Math.round(totalActualWaitTime / activeWaitingEntries.length);
    }
    
    // Log for debugging
    logger.info('Queue info calculation:', {
      queueId: queue._id,
      totalEntries: queue.entries.length,
      waitingEntries: queue.entries.filter(e => e.status === 'waiting').length,
      activeWaitingEntries: activeWaitingEntries.length,
      averageWaitTime,
      oldestWaitingEntry: queue.entries
        .filter(e => e.status === 'waiting')
        .map(e => ({ joinedAt: e.joinedAt, minutesWaiting: Math.floor((now - new Date(e.joinedAt)) / (1000 * 60)) }))
        .sort((a, b) => b.minutesWaiting - a.minutesWaiting)[0]
    });

    // Generate WhatsApp and Messenger links
    const baseMessage = `Hi! I'm interested in joining the queue for ${queue.name} at ${merchant.businessName}. Can you help me with the current wait time and queue status?`;
    const whatsappLink = `https://wa.me/${merchant.phone || '1234567890'}?text=${encodeURIComponent(baseMessage)}`;
    const messengerLink = `https://m.me/${merchant.integrations?.messenger?.pageId || 'your-page'}?ref=${encodeURIComponent(`queue_${queue._id}`)}`;

    // Format business hours - show today's hours
    let businessHours = '9:00 AM - 6:00 PM'; // Default
    if (merchant.businessHours) {
      const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todayName = dayNames[today];
      const todayHours = merchant.businessHours[todayName];
      
      if (todayHours) {
        if (todayHours.closed) {
          businessHours = 'Closed Today';
        } else {
          const start = todayHours.start || '09:00';
          const end = todayHours.end || '18:00';
          // Convert 24-hour format to 12-hour format for display
          const formatTime = (time) => {
            const [hours, minutes] = time.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            return `${displayHour}:${minutes} ${ampm}`;
          };
          businessHours = `${formatTime(start)} - ${formatTime(end)}`;
        }
      }
    }

    // Format business type for display
    const businessTypeDisplay = merchant.businessType === 'restaurant' ? 'Food & Beverage' : 'Retail';

    // Format business address
    let businessAddress = 'Address not available';
    if (merchant.address && typeof merchant.address === 'object') {
      const addr = merchant.address;
      businessAddress = [addr.street, addr.city, addr.state, addr.zipCode, addr.country]
        .filter(Boolean)
        .join(', ');
    } else if (typeof merchant.address === 'string') {
      businessAddress = merchant.address;
    }

    res.render('queue-info', {
      queueId: queue._id,
      queueName: queue.name,
      businessName: merchant.businessName,
      businessType: businessTypeDisplay,
      businessPhone: merchant.phone || 'Not available',
      businessEmail: merchant.email || 'Not available',
      queueActive: queue.isActive,
      acceptingCustomers: queue.acceptingCustomers,
      totalAhead,
      averageWaitTime,
      whatsappLink,
      messengerLink,
      businessHours,
      businessAddress,
      lastUpdated: new Date().toLocaleTimeString()
    });

  } catch (error) {
    logger.error('Error loading queue info:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      status: 500,
      message: 'Unable to load queue information. Please try again later.'
    });
  }
});

// GET /join-queue/:merchantId - Simplified customer queue joining page
router.get('/join-queue/:merchantId', async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.params.merchantId);
    
    if (!merchant || !merchant.isActive) {
      return res.status(404).render('error', {
        title: 'Business Not Found',
        status: 404,
        message: 'The business you are looking for does not exist or is not active.'
      });
    }
    
    // Get current wait time estimate
    const queue = await Queue.findOne({ 
      merchantId: merchant.id || merchant._id, 
      isActive: true 
    });
    
    const waitingCount = queue?.entries?.filter(e => e.status === 'waiting').length || 0;
    const currentWaitTime = waitingCount * (queue?.averageServiceTime || 15);
    
    res.render('simple-join', {
      merchantId: merchant.id || merchant._id,
      businessName: merchant.businessName,
      currentWaitTime
    });
    
  } catch (error) {
    logger.error('Simple join page error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      status: 500,
      message: 'An error occurred while loading the page. Please try again later.'
    });
  }
});

module.exports = router; 