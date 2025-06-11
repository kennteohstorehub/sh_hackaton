const express = require('express');
const Queue = require('../../models/Queue');
const Merchant = require('../../models/Merchant');
const logger = require('../../utils/logger');

const router = express.Router();

// Home page
router.get('/', (req, res) => {
  res.render('index', {
    title: 'Smart Queue Manager - Reduce Customer Wait Times'
  });
});

// Demo page
router.get('/demo', (req, res) => {
  res.render('demo', {
    title: 'Demo - Smart Queue Manager'
  });
});

// WhatsApp setup redirect - redirect to dashboard setup
router.get('/whatsapp', (req, res) => {
  res.redirect('/dashboard/whatsapp-setup');
});

// Chatbot demo page
router.get('/chatbot-demo', (req, res) => {
  res.render('chatbot-demo', {
    title: 'Chatbot Demo - Smart Queue Manager'
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

    const merchant = await Merchant.findById(queue.merchantId);
    if (!merchant) {
      return res.status(404).render('error', {
        title: 'Business Not Found',
        status: 404,
        message: 'The business information could not be found.'
      });
    }

    // Calculate queue statistics
    const totalAhead = queue.currentLength;
    
    // Calculate actual average wait time of currently waiting customers (same as dashboard)
    const now = new Date();
    const waitingEntries = queue.entries.filter(entry => entry.status === 'waiting');
    let averageWaitTime = 0;
    
    if (waitingEntries.length > 0) {
      const totalActualWaitTime = waitingEntries.reduce((total, entry) => {
        const waitTimeMinutes = Math.floor((now - new Date(entry.joinedAt)) / (1000 * 60));
        return total + waitTimeMinutes;
      }, 0);
      averageWaitTime = Math.round(totalActualWaitTime / waitingEntries.length);
    }

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

module.exports = router; 