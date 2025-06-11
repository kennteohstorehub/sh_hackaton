// Dashboard route
router.get('/dashboard', setMockUser, async (req, res) => {
  try {
    const Queue = require('../models/Queue');
    const queues = await Queue.find({ merchantId: req.user.id });
    
    res.render('dashboard/index', {
      user: req.user,
      queues: queues
    });
  } catch (error) {
    logger.error('Error loading dashboard:', error);
    res.status(500).render('error', { 
      message: 'Error loading dashboard',
      error: error
    });
  }
});

// WhatsApp connection page
router.get('/whatsapp', setMockUser, (req, res) => {
  res.render('dashboard/whatsapp', {
    user: req.user
  });
}); 