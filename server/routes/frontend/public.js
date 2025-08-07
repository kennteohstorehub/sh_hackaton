const express = require('express');
const queueService = require('../../services/queueService');
const merchantService = require('../../services/merchantService');
const logger = require('../../utils/logger');
const prisma = require('../../utils/prisma');

// Use appropriate auth middleware based on environment
const useAuthBypass = process.env.USE_AUTH_BYPASS === 'true';
const { requireAuth, loadUser } = useAuthBypass ? 
  require('../../middleware/auth-bypass') : 
  require('../../middleware/auth');

const router = express.Router();

// Debug route for Socket.io
router.get('/debug-socket', (req, res) => {
  res.sendFile('debug-socket-origin.html', { root: process.cwd() });
});

// Home page - show landing page
router.get('/', (req, res) => {
  // Check if this is the admin subdomain
  if (req.isBackOffice) {
    // Check if BackOffice user is already logged in
    if (req.session && req.session.backOfficeUserId) {
      // BackOffice user is logged in, redirect to BackOffice dashboard
      return res.redirect('/backoffice/dashboard');
    }
    // BackOffice user is not logged in, redirect to BackOffice login page
    return res.redirect('/backoffice/auth/login');
  }
  
  // Show landing page
  res.render('landing');
});

// Dashboard - Protected merchant dashboard route
router.get('/dashboard', requireAuth, loadUser, async (req, res) => {
  try {
    // Skip if this is admin subdomain
    if (req.isBackOffice) {
      return res.redirect('/backoffice/dashboard');
    }

    const merchantId = req.user.id || req.user._id;
    logger.info(`Dashboard access for merchant: ${merchantId}`);

    // Get merchant data with tenant context
    const merchant = await merchantService.findById(merchantId, {}, req.tenantId);
    if (!merchant) {
      req.flash('error', 'Merchant not found.');
      return res.redirect('/auth/login');
    }

    // Get merchant's queues with tenant context
    const queues = await queueService.findByMerchant(merchantId, req.tenantId);
    const activeQueue = queues.find(q => q.isActive);

    // Get queue statistics and entries if there's an active queue
    let queueStats = null;
    let waitingCustomers = [];
    let servingCustomers = [];
    let completedCustomers = [];
    let recentEntries = [];
    
    if (activeQueue) {
      queueStats = await queueService.getQueueStats(activeQueue.id, req.tenantId);
      
      // Get queue with entries for dashboard display
      const queueWithEntries = await queueService.getQueueWithEntries(activeQueue.id, req.tenantId);
      // Filter entries by status
      const allEntries = queueWithEntries?.entries || [];
      // Include both 'waiting' and 'called' status in waitingCustomers for dashboard display
      // Customers should remain visible until they are seated (completed)
      waitingCustomers = allEntries.filter(e => e.status === 'waiting' || e.status === 'called');
      servingCustomers = allEntries.filter(e => e.status === 'serving' || e.status === 'called');
      completedCustomers = allEntries.filter(e => e.status === 'completed');
      
      recentEntries = waitingCustomers.slice(0, 10);
    }

    // Transform queueStats to match template expectations
    const stats = queueStats ? {
      totalWaiting: queueStats.waitingCount || 0,
      averageWaitTime: Math.round(queueStats.averageWaitTime || 0),
      totalServed: queueStats.servedToday || 0
    } : {
      totalWaiting: 0,
      averageWaitTime: 0,
      totalServed: 0
    };

    // Prepare user object to match template expectations
    const dashboardUser = {
      id: merchant.id,
      merchantId: merchant.id,
      businessName: merchant.businessName,
      email: merchant.email || req.user.email || 'Not available',
      primaryColor: merchant.primaryColor || '#ff8c00',
      secondaryColor: merchant.secondaryColor || '#ff6b35'
    };

    // Render the merchant dashboard
    res.render('dashboard/index-storehub-new', {
      title: `Dashboard - ${merchant.businessName}`,
      merchant: {
        id: merchant.id,
        businessName: merchant.businessName,
        primaryColor: merchant.primaryColor || '#ff8c00',
        secondaryColor: merchant.secondaryColor || '#ff6b35',
        logoUrl: merchant.logoUrl
      },
      merchantSettings: merchant.settings || {}, // Add merchant settings for party size limits
      activeQueue, // Dashboard template expects activeQueue, not queue
      queue: activeQueue, // Keep for backward compatibility
      queueId: activeQueue ? activeQueue.id : null, // Add the missing queueId variable
      currentQueueId: activeQueue ? activeQueue.id : null, // Add currentQueueId for header template
      showViewPublic: true, // Enable the View Public button
      queues,
      waitingCustomers, // Dashboard template expects this
      activeCount: waitingCustomers.length, // Add missing activeCount variable
      waitingCount: waitingCustomers.length, // Add missing waitingCount variable
      servingCount: servingCustomers.length, // Add missing servingCount variable
      completedCount: completedCustomers.length, // Add missing completedCount variable
      stats,
      queueStats,
      recentEntries,
      user: dashboardUser, // Use the properly formatted user object
      csrfToken: res.locals.csrfToken || '',
      currentQueueId: activeQueue ? activeQueue.id : null,
      showViewPublic: true
    });

  } catch (error) {
    logger.error('Dashboard error:', error);
    req.flash('error', 'Error loading dashboard. Please try again.');
    res.redirect('/');
  }
});

// Dashboard Analytics - Protected route for analytics
router.get('/dashboard/analytics', requireAuth, loadUser, async (req, res) => {
  try {
    // Skip if this is admin subdomain
    if (req.isBackOffice) {
      return res.redirect('/backoffice/dashboard');
    }

    const merchantId = req.user.id || req.user._id;
    logger.info(`Analytics access for merchant: ${merchantId}`);

    // Get merchant data with tenant context
    const merchant = await merchantService.findById(merchantId, {}, req.tenantId);
    if (!merchant) {
      req.flash('error', 'Merchant not found.');
      return res.redirect('/auth/login');
    }

    // Get merchant's queues with tenant context
    const queues = await queueService.findByMerchant(merchantId, req.tenantId);
    const activeQueue = queues.find(q => q.isActive);

    // Prepare user object to match template expectations
    const dashboardUser = {
      id: merchant.id,
      merchantId: merchant.id,
      businessName: merchant.businessName,
      email: merchant.email || req.user.email || 'Not available',
      primaryColor: merchant.primaryColor || '#ff8c00',
      secondaryColor: merchant.secondaryColor || '#ff6b35'
    };

    // Render the analytics page with StoreHub design
    res.render('dashboard/analytics-storehub', {
      title: `Analytics - ${merchant.businessName}`,
      merchant: {
        id: merchant.id,
        businessName: merchant.businessName,
        primaryColor: merchant.primaryColor || '#ff8c00',
        secondaryColor: merchant.secondaryColor || '#ff6b35',
        logoUrl: merchant.logoUrl,
        businessHours: merchant.businessHours || {}
      },
      activeQueue,
      queue: activeQueue,
      currentQueueId: activeQueue ? activeQueue.id : null, // Add currentQueueId for header template
      showViewPublic: true, // Enable the View Public button
      queues,
      user: dashboardUser,
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Analytics page error:', error);
    req.flash('error', 'Error loading analytics. Please try again.');
    res.redirect('/dashboard');
  }
});

// Dashboard Settings - Protected route for settings
router.get('/dashboard/settings', requireAuth, loadUser, async (req, res) => {
  try {
    // Skip if this is admin subdomain
    if (req.isBackOffice) {
      return res.redirect('/backoffice/dashboard');
    }

    const merchantId = req.user.id || req.user._id;
    logger.info(`Settings access for merchant: ${merchantId}`);

    // Get merchant data with tenant context
    const merchant = await merchantService.findById(merchantId, {}, req.tenantId);
    if (!merchant) {
      req.flash('error', 'Merchant not found.');
      return res.redirect('/auth/login');
    }

    // Get merchant's queues with tenant context
    const queues = await queueService.findByMerchant(merchantId, req.tenantId);
    const activeQueue = queues.find(q => q.isActive);

    // Prepare user object to match template expectations
    const dashboardUser = {
      id: merchant.id,
      merchantId: merchant.id,
      businessName: merchant.businessName,
      email: merchant.email || req.user.email || 'Not available',
      primaryColor: merchant.primaryColor || '#ff8c00',
      secondaryColor: merchant.secondaryColor || '#ff6b35'
    };

    // Render the settings page
    res.render('dashboard/settings-storehub', {
      title: `Settings - ${merchant.businessName}`,
      merchant: {
        id: merchant.id,
        businessName: merchant.businessName,
        primaryColor: merchant.primaryColor || '#ff8c00',
        secondaryColor: merchant.secondaryColor || '#ff6b35',
        logoUrl: merchant.logoUrl,
        businessHours: merchant.businessHours || {},
        settings: merchant.settings || {}
      },
      activeQueue,
      queue: activeQueue,
      currentQueueId: activeQueue ? activeQueue.id : null, // Add currentQueueId for header template
      showViewPublic: true, // Enable the View Public button
      queues,
      user: dashboardUser,
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Settings page error:', error);
    req.flash('error', 'Error loading settings. Please try again.');
    res.redirect('/dashboard');
  }
});

// Dashboard Help - Protected route for help
router.get('/dashboard/help', requireAuth, loadUser, async (req, res) => {
  try {
    // Skip if this is admin subdomain
    if (req.isBackOffice) {
      return res.redirect('/backoffice/dashboard');
    }

    const merchantId = req.user.id || req.user._id;
    logger.info(`Help access for merchant: ${merchantId}`);

    // Get merchant data with tenant context
    const merchant = await merchantService.findById(merchantId, {}, req.tenantId);
    if (!merchant) {
      req.flash('error', 'Merchant not found.');
      return res.redirect('/auth/login');
    }

    // Get merchant's queues with tenant context
    const queues = await queueService.findByMerchant(merchantId, req.tenantId);
    const activeQueue = queues.find(q => q.isActive);

    // Prepare user object to match template expectations
    const dashboardUser = {
      id: merchant.id,
      merchantId: merchant.id,
      businessName: merchant.businessName,
      email: merchant.email || req.user.email || 'Not available',
      primaryColor: merchant.primaryColor || '#ff8c00',
      secondaryColor: merchant.secondaryColor || '#ff6b35'
    };

    // Render the help page
    res.render('dashboard/help-storehub', {
      title: `Help - ${merchant.businessName}`,
      merchant: {
        id: merchant.id,
        businessName: merchant.businessName,
        primaryColor: merchant.primaryColor || '#ff8c00',
        secondaryColor: merchant.secondaryColor || '#ff6b35',
        logoUrl: merchant.logoUrl
      },
      activeQueue,
      queue: activeQueue,
      currentQueueId: activeQueue ? activeQueue.id : null, // Add currentQueueId for header template
      showViewPublic: true, // Enable the View Public button
      queues,
      user: dashboardUser,
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Help page error:', error);
    req.flash('error', 'Error loading help. Please try again.');
    res.redirect('/dashboard');
  }
});

// Join redirect - helps users who access /join without a merchant ID
router.get('/join', async (req, res) => {
  try {
    // Find the first active merchant for demo purposes
    const demoMerchant = await prisma.merchant.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
    
    if (demoMerchant) {
      // Redirect to the merchant's join queue page
      res.redirect(`/queue/join/${demoMerchant.id}`);
    } else {
      res.render('error', {
        title: 'No Active Merchants',
        message: 'There are no active merchants available. Please contact support.',
        showBackButton: false
      });
    }
  } catch (error) {
    logger.error('Join redirect error:', error);
    res.redirect('/');
  }
});

// Demo page
router.get('/demo', (req, res) => {
  res.render('demo', {
    title: 'Demo - StoreHub Queue Management System'
  });
});

// WhatsApp route - REMOVED
// WhatsApp integration has been removed from the system

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
    const merchant = await merchantService.findById(req.params.merchantId);
    
    if (!merchant || !merchant.isActive) {
      return res.status(404).render('error', {
        title: 'Business Not Found',
        status: 404,
        message: 'The business you are looking for does not exist or is not active.'
      });
    }
    
    // Get current wait time estimate
    const queues = await queueService.findByMerchant(merchant.id);
    const queue = queues.find(q => q.isActive);
    
    const stats = queue ? await queueService.getQueueStats(queue.id) : null;
    const currentWaitTime = stats ? stats.averageWaitTime : 15;
    
    res.render('customer-queue', {
      merchant: {
        id: merchant.id,
        businessName: merchant.businessName,
        primaryColor: merchant.primaryColor || '#ff8c00',
        secondaryColor: merchant.secondaryColor || '#ff6b35',
        logoUrl: merchant.logoUrl,
        currentWaitTime,
        phone: merchant.phone || '+60123456789'
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
    const merchant = await merchantService.getFullDetails(req.params.merchantId);
    
    if (!merchant || !merchant.isActive) {
      return res.render('public/error', {
        title: 'Business Not Found',
        message: 'The business you are looking for is not available.',
        showBackButton: false
      });
    }
    
    // Check if business is open
    const now = new Date();
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
    const todayHours = merchant.businessHours?.find(h => h.dayOfWeek === dayOfWeek);
    const isOpen = todayHours && !todayHours.closed;
    
    // Get active queues - pass merchant's tenantId
    const queues = await queueService.findByMerchant(merchant.id, true, merchant.tenantId);
    const activeQueues = queues.filter(q => q.isActive);
    
    res.render('public/join-queue', {
      title: `Join Queue - ${merchant.businessName}`,
      merchant,
      queues: activeQueues,
      isOpen,
      serviceTypes: merchant.serviceTypes?.filter(s => s.isActive) || []
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

// GET /join-queue/:merchantId - New minimalist customer queue joining page
router.get('/join-queue/:merchantId', async (req, res) => {
  try {
    const merchant = await merchantService.getFullDetails(req.params.merchantId);
    
    if (!merchant || !merchant.isActive) {
      return res.render('public/error', {
        title: 'Business Not Found',
        message: 'The business you are looking for is not available.',
        showBackButton: false
      });
    }
    
    // Get active queues - pass merchant's tenantId
    const queues = await queueService.findByMerchant(merchant.id, true, merchant.tenantId);
    const activeQueue = queues.find(q => q.isActive);
    
    res.render('public/join-queue-v2', {
      title: `Join Queue - ${merchant.businessName}`,
      merchantId: merchant.id,
      merchantName: merchant.businessName,
      queue: activeQueue
    });
    
  } catch (error) {
    logger.error('Join queue v2 page error:', error);
    res.render('public/error', {
      title: 'Error',
      message: 'An error occurred while loading the queue. Please try again.',
      showBackButton: true
    });
  }
});

// GET /queue/:queueId/join - Queue join page for customers
router.get('/queue/:queueId/join', async (req, res) => {
  try {
    const { queueId } = req.params;
    
    const queue = await queueService.getQueueWithEntries(queueId);
    
    if (!queue) {
      return res.render('public/error', {
        title: 'Queue Not Found',
        message: 'The queue you are looking for does not exist.',
        showBackButton: false
      });
    }
    
    const merchantData = queue.merchant || queue.merchantId;
    const waitingCustomers = queue.entries?.filter(e => e.status === 'waiting').length || 0;
    const averageWaitTime = Math.round(waitingCustomers * (queue.averageServiceTime || 15));
    
    res.render('queue-join-storehub', {
      queueId: queue.id || queue._id,
      queueName: queue.name,
      merchantId: merchantData?.id || merchantData?._id || queue.merchantId,
      merchantName: merchantData?.businessName || 'Business',
      logoUrl: merchantData?.logoUrl,
      totalWaiting: waitingCustomers,
      avgWaitTime: averageWaitTime,
      queueActive: queue.isActive !== false,
      acceptingCustomers: queue.acceptingCustomers !== false,
      serviceTypes: merchantData?.serviceTypes || [],
      maxPartySize: merchantData?.settings?.partySizeRegularMax || 5,
      csrfToken: res.locals.csrfToken || ''
    });
    
  } catch (error) {
    logger.error('Queue join page error:', error);
    res.status(500).render('public/error', {
      title: 'Server Error',
      message: 'An error occurred while loading the queue page. Please try again later.'
    });
  }
});

// GET /queue/:queueId/minimal - Minimalist queue join page (demo)
router.get('/queue/:queueId/minimal', async (req, res) => {
  try {
    const { queueId } = req.params;
    
    const queue = await queueService.getQueueWithEntries(queueId);
    
    if (!queue) {
      return res.render('public/error', {
        title: 'Queue Not Found',
        message: 'The queue you are looking for does not exist.',
        showBackButton: false
      });
    }
    
    const merchantData = queue.merchantId || queue.merchant;
    const waitingCustomers = queue.entries?.filter(e => e.status === 'waiting').length || 0;
    const averageWaitTime = Math.round(waitingCustomers * (queue.averageServiceTime || 15));
    
    res.render('queue-info-minimal', {
      queueId: queue.id || queue._id,
      queueName: queue.name,
      businessName: merchantData?.businessName || 'Restaurant',
      businessPhone: merchantData?.phone || '+60123456789',
      totalAhead: waitingCustomers,
      averageWaitTime: averageWaitTime,
      queueActive: queue.isActive !== false,
      acceptingCustomers: queue.acceptingCustomers !== false,
      merchantId: merchantData?.id || merchantData?._id || 'demo'
    });
    
  } catch (error) {
    logger.error('Queue info page error:', error);
    res.status(500).render('public/error', {
      title: 'Server Error',
      message: 'An error occurred while loading the page. Please try again later.'
    });
  }
});

// GET /queue-status/:queueId/:customerId - Customer queue status page
router.get('/queue-status/:queueId/:customerId', async (req, res) => {
  try {
    const { queueId, customerId } = req.params;
    
    const queue = await queueService.getQueueWithEntries(queueId);
    
    if (!queue) {
      return res.render('public/error', {
        title: 'Queue Not Found',
        message: 'The queue you are looking for does not exist.',
        showBackButton: false
      });
    }
    
    const customer = await prisma.queueEntry.findFirst({
      where: {
        queueId: queueId,
        OR: [
          { id: customerId },
          { customerId: customerId }
        ]
      }
    });
    
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
      title: `Queue Status - ${queue.merchant.businessName}`,
      queue,
      customer,
      currentPosition,
      merchant: queue.merchant
    });
    
  } catch (error) {
    logger.error('Queue status page error:', {
      error: error.message,
      stack: error.stack,
      queueId: req.params.queueId,
      customerId: req.params.customerId
    });
    res.status(500).render('error', {
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
    const queues = await queueService.findByMerchant(demoMerchantId);
    const activeQueues = queues.filter(q => q.isActive);
    
    if (activeQueues.length === 0) {
      return res.status(404).render('error', {
        title: 'No Active Queues',
        status: 404,
        message: 'There are no active queues available at this time.'
      });
    }
    
    // If there's only one queue, redirect directly to it
    if (activeQueues.length === 1) {
      return res.redirect(`/queue/${activeQueues[0].id}`);
    }
    
    // Otherwise, show a list of available queues
    const merchant = await merchantService.findById(demoMerchantId);
    
    res.render('public/queue-list', {
      title: 'Available Queues - StoreHub Queue Management System',
      queues: activeQueues,
      merchant
    });
    
  } catch (error) {
    logger.error('Queue listing error:', error);
    // If error or no queues, try to find and redirect to first active queue
    try {
      const firstQueue = await prisma.queue.findFirst({ 
        where: { isActive: true } 
      });
      if (firstQueue) {
        return res.redirect(`/queue/${firstQueue.id}`);
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
    let queue;
    const queueId = req.params.queueId;
    
    // Try to find queue using Prisma first (for UUID format)
    if (queueId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      const prismaQueue = await prisma.queue.findUnique({
        where: { id: queueId },
        include: {
          merchant: true,
          entries: {
            where: {
              status: 'waiting'
            },
            orderBy: {
              joinedAt: 'asc'
            }
          }
        }
      });
      
      if (prismaQueue) {
        // Convert Prisma format to MongoDB-like format for compatibility
        queue = {
          _id: prismaQueue.id,
          id: prismaQueue.id,
          name: prismaQueue.name,
          merchantId: prismaQueue.merchantId,
          isActive: prismaQueue.isActive,
          acceptingCustomers: prismaQueue.acceptingCustomers,
          entries: prismaQueue.entries,
          merchant: prismaQueue.merchant
        };
      }
    }
    
    // If not found with Prisma, use queue service
    if (!queue) {
      const queueData = await queueService.getQueueWithEntries(queueId);
      if (queueData) {
        queue = {
          _id: queueData.id,
          id: queueData.id,
          name: queueData.name,
          merchantId: queueData.merchantId,
          isActive: queueData.isActive,
          acceptingCustomers: queueData.acceptingCustomers,
          entries: queueData.entries,
          merchant: queueData.merchant
        };
      }
    }
    
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

    // Get merchant - either from queue include or service lookup
    let merchant = queue.merchant;
    if (!merchant) {
      merchant = await merchantService.findById(queue.merchantId);
    }
    
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

    // Generate Messenger links
    const baseMessage = `Hi! I'm interested in joining the queue for ${queue.name} at ${merchant.businessName}. Can you help me with the current wait time and queue status?`;
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

    res.render('queue-info-storehub', {
      queueId: queue.id || queue._id,
      queueName: queue.name,
      businessName: merchant.businessName,
      businessType: businessTypeDisplay,
      businessPhone: merchant.phone || 'Not available',
      businessEmail: merchant.email || 'Not available',
      queueActive: queue.isActive,
      acceptingCustomers: queue.acceptingCustomers,
      totalAhead,
      averageWaitTime,
      messengerLink,
      businessHours,
      businessAddress,
      lastUpdated: new Date().toLocaleTimeString(),
      merchantId: merchant.id || merchant._id || queue.merchantId,
      logoUrl: merchant.logoUrl,
      merchantSettings: merchant.settings || {}, // Add merchant settings for party size limits
      csrfToken: res.locals.csrfToken || ''
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
    const merchant = await merchantService.findById(req.params.merchantId);
    
    if (!merchant || !merchant.isActive) {
      return res.status(404).render('error', {
        title: 'Business Not Found',
        status: 404,
        message: 'The business you are looking for does not exist or is not active.'
      });
    }
    
    // Get current wait time estimate
    const queues = await queueService.findByMerchant(merchant.id);
    const queue = queues.find(q => q.isActive);
    
    const stats = queue ? await queueService.getQueueStats(queue.id) : null;
    const currentWaitTime = stats ? stats.averageWaitTime : 15;
    
    res.render('simple-join', {
      merchantId: merchant.id,
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

// GET /queue-chat/:sessionId - Dynamic webchat route with session ID
router.get('/queue-chat/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Validate session ID format
    if (!sessionId || !sessionId.startsWith('qc_')) {
      return res.status(400).render('error', {
        title: 'Invalid Session',
        status: 400,
        message: 'Invalid session ID. Please join the queue again.'
      });
    }
    
    // Check if session has a queue entry
    const queueEntry = await prisma.queueEntry.findFirst({
      where: {
        sessionId: sessionId,
        status: 'waiting'
      },
      include: {
        queue: {
          include: {
            merchant: true
          }
        }
      }
    });
    
    // Prepare queue data for the frontend
    let queueData = null;
    if (queueEntry) {
      queueData = {
        entryId: queueEntry.id,
        queueId: queueEntry.queueId,
        customerId: queueEntry.customerId,
        customerName: queueEntry.customerName,
        customerPhone: queueEntry.customerPhone,
        position: queueEntry.position,
        queueNumber: queueEntry.position,
        verificationCode: queueEntry.verificationCode,
        estimatedWait: queueEntry.estimatedWaitTime,
        sessionId: queueEntry.sessionId,
        merchantId: queueEntry.queue.merchantId,
        status: queueEntry.status
      };
    }
    
    // Render the queue chat HTML page
    // The actual chat functionality is handled by the client-side JavaScript
    res.render('queue-chat', {
      title: 'Queue Status - StoreHub',
      sessionId: sessionId,
      hasQueueEntry: !!queueEntry,
      merchantName: queueEntry?.queue?.merchant?.businessName || 'StoreHub',
      queueData: queueData ? JSON.stringify(queueData) : null
    });
    
  } catch (error) {
    logger.error('Queue chat page error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      status: 500,
      message: 'An error occurred while loading the chat. Please try again later.'
    });
  }
});

// GET /queue-chat - Static fallback for direct access (redirects to session-based URL)
router.get('/queue-chat', (req, res) => {
  // Generate a new session ID and redirect to the dynamic URL
  const sessionId = 'qc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  res.redirect(`/queue-chat/${sessionId}`);
});

// New StoreHub Design System Demo
router.get('/design-demo', (req, res) => {
  res.render('dashboard/index-storehub', {
    title: 'Dashboard - StoreHub Design System Demo',
    user: req.user || { businessName: 'Demo Business', email: 'demo@storehub.com' },
    tenant: { name: 'Demo Tenant' },
    showViewPublic: true,
    currentQueueId: 'demo-queue-123',
    activePage: 'dashboard'
  });
});

// StoreHub Design System - Queue Join Demo
router.get('/queue-join-demo/:queueId', async (req, res) => {
  try {
    const queue = await queueService.getQueueWithEntries(req.params.queueId);
    if (!queue) {
      return res.status(404).render('error', { title: 'Queue Not Found' });
    }
    
    const stats = await queueService.getQueueStats(req.params.queueId);
    
    // Get merchant with settings for party size limits
    const merchant = queue.merchant || {};
    const merchantSettings = merchant.settings || {};
    
    res.render('queue-join-storehub', {
      queueId: queue.id,
      queueName: queue.name,
      merchantId: queue.merchantId,
      merchantName: merchant.businessName || 'Demo Business',
      logoUrl: merchant.logoUrl,
      totalWaiting: stats?.waitingCount || 0,
      avgWaitTime: stats?.averageWaitTime || 15,
      queueActive: queue.isActive,
      acceptingCustomers: queue.acceptingCustomers,
      serviceTypes: merchant.serviceTypes || [],
      maxPartySize: merchantSettings.partySizeRegularMax || 5, // Add party size limit
      csrfToken: res.locals.csrfToken || ''
    });
  } catch (error) {
    logger.error('Queue join demo error:', error);
    res.status(500).render('error', { title: 'Server Error' });
  }
});

// StoreHub Design System - Queue Status Demo
router.get('/queue-status-demo/:queueId/:customerId', async (req, res) => {
  try {
    const { queueId, customerId } = req.params;
    const queue = await queueService.getQueueWithEntries(queueId);
    
    if (!queue) {
      return res.status(404).render('error', { title: 'Queue Not Found' });
    }
    
    const customer = await prisma.queueEntry.findUnique({
      where: { id: customerId }
    });
    
    if (!customer) {
      return res.status(404).render('error', { title: 'Entry Not Found' });
    }
    
    // Calculate position
    let currentPosition = customer.position;
    if (customer.status === 'waiting') {
      const customersAhead = queue.entries
        .filter(entry => entry.status === 'waiting' && entry.position < customer.position)
        .length;
      currentPosition = customersAhead + 1;
    }
    
    res.render('queue-status-storehub', {
      queue,
      customer,
      currentPosition,
      merchant: queue.merchant || { businessName: 'Demo Business', phone: '+60123456789' }
    });
  } catch (error) {
    logger.error('Queue status demo error:', error);
    res.status(500).render('error', { title: 'Server Error' });
  }
});

// StoreHub Design System - Queue Info Demo  
router.get('/queue-info-demo/:queueId', async (req, res) => {
  try {
    const queue = await queueService.getQueueWithEntries(req.params.queueId);
    if (!queue) {
      return res.status(404).render('error', { title: 'Queue Not Found' });
    }
    
    const stats = await queueService.getQueueStats(req.params.queueId);
    const merchant = queue.merchant || {};
    
    res.render('queue-info-storehub', {
      queueId: queue.id,
      queueName: queue.name,
      businessName: merchant.businessName || 'Demo Business',
      businessType: merchant.businessType === 'restaurant' ? 'Food & Beverage' : 'Retail',
      businessPhone: merchant.phone || '+60123456789',
      businessEmail: merchant.email || 'contact@demo.com',
      businessAddress: 'Main Street, City Center',
      businessHours: '9:00 AM - 10:00 PM',
      queueActive: queue.isActive,
      acceptingCustomers: queue.acceptingCustomers,
      totalAhead: stats?.waitingCount || 0,
      averageWaitTime: stats?.averageWaitTime || 15,
      merchantId: queue.merchantId,
      logoUrl: merchant.logoUrl,
      merchantSettings: merchant.settings || {}, // Add merchant settings for party size limits
      csrfToken: res.locals.csrfToken || ''
    });
  } catch (error) {
    logger.error('Queue info demo error:', error);
    res.status(500).render('error', { title: 'Server Error' });
  }
});

module.exports = router; 