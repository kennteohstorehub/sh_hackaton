const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const Merchant = require('../../models/Merchant');
const logger = require('../../utils/logger');
const { requireGuest } = require('../../middleware/auth');
const { validateLogin, validateRegister } = require('../../middleware/validators');
const { handleValidationErrors } = require('../../middleware/security');

const router = express.Router();

// Login page
router.get('/login', requireGuest, (req, res) => {
  const redirect = req.query.redirect || '/dashboard';
  
  // Ensure messages object exists
  const messages = res.locals.messages || { error: null, success: null };
  
  res.render('auth/login', {
    title: 'Login - StoreHub Queue Management System',
    redirect,
    messages: messages
  });
});

// Register page
router.get('/register', requireGuest, (req, res) => {
  // Ensure messages object exists
  const messages = res.locals.messages || { error: null, success: null };
  
  res.render('auth/register', {
    title: 'Register - StoreHub Queue Management System',
    messages: messages
  });
});

// Login POST
router.post('/login', 
  (req, res, next) => {
    console.log('[AUTH] Login POST - Raw request received');
    console.log('[AUTH] Body:', req.body);
    next();
  },
  validateLogin,
  handleValidationErrors,
  async (req, res) => {
  try {
    console.log('[AUTH] Login POST route hit - email:', req.body.email);
    logger.info(`Login attempt for email: ${req.body.email}`);
    logger.debug('Session state before login:', {
      sessionId: req.sessionID,
      hasSession: !!req.session,
      sessionData: req.session
    });

    const { email, password } = req.body;

    // Find merchant
    const merchant = await Merchant.findOne({ email });
    if (!merchant) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/auth/login');
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, merchant.password);
    if (!isValidPassword) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/auth/login');
    }

    // Regenerate session to prevent fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration error:', err);
        req.flash('error', 'Login error. Please try again.');
        return res.redirect('/auth/login');
      }
      
      // Create session with userId
      req.session.userId = merchant._id.toString();
      req.session.user = {
        id: merchant._id.toString(),
        email: merchant.email,
        businessName: merchant.businessName,
        merchantId: merchant._id.toString()
      };

      logger.info(`Merchant logged in: ${merchant.email}`);
      logger.debug('Session after login:', {
        sessionId: req.sessionID,
        userId: req.session.userId,
        user: req.session.user
      });
      req.flash('success', `Welcome back, ${merchant.businessName}!`);
      
      // Save session before redirect
      req.session.save((err) => {
        if (err) {
          logger.error('Session save error:', err);
        }
        
        // Redirect to original URL if provided
        const redirectUrl = req.body.redirect || req.query.redirect || '/dashboard';
        logger.info(`Login successful, redirecting to: ${redirectUrl}`);
        res.redirect(redirectUrl);
      });
    });

  } catch (error) {
    logger.error('Login error:', error);
    logger.error('Error stack:', error.stack);
    req.flash('error', 'An error occurred during login. Please try again.');
    res.redirect('/auth/login');
  }
});

// Register POST
router.post('/register', 
  validateRegister,
  handleValidationErrors,
  async (req, res) => {
  try {

    const { businessName, email, password, phone, businessType } = req.body;

    // Check if merchant already exists
    const existingMerchant = await Merchant.findOne({ email });
    if (existingMerchant) {
      req.flash('error', 'An account with this email already exists.');
      return res.redirect('/auth/register');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create merchant
    const merchant = new Merchant({
      businessName,
      email,
      password: hashedPassword,
      phone,
      businessType
    });

    await merchant.save();

    // Regenerate session to prevent fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration error:', err);
        req.flash('error', 'Registration error. Please try again.');
        return res.redirect('/auth/register');
      }
      
      // Create session with userId
      req.session.userId = merchant._id.toString();
      req.session.user = {
        id: merchant._id.toString(),
        email: merchant.email,
        businessName: merchant.businessName,
        merchantId: merchant._id.toString()
      };

      logger.info(`New merchant registered: ${merchant.email}`);
      req.flash('success', `Welcome to StoreHub Queue Management System, ${merchant.businessName}!`);
      
      // Save session before redirect
      req.session.save((err) => {
        if (err) {
          logger.error('Session save error:', err);
        }
        res.redirect('/dashboard');
      });
    });

  } catch (error) {
    logger.error('Registration error:', error);
    req.flash('error', 'An error occurred during registration. Please try again.');
    res.redirect('/auth/register');
  }
});

// Logout (support both GET and POST)
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

// Debug endpoint (remove in production)
router.get('/debug', (req, res) => {
  res.json({
    session: {
      exists: !!req.session,
      hasFlash: typeof req.flash === 'function',
      userId: req.session?.userId || null
    },
    locals: {
      hasMessages: !!res.locals.messages,
      messages: res.locals.messages || {}
    },
    env: {
      NODE_ENV: process.env.NODE_ENV,
      hasSessionSecret: !!process.env.SESSION_SECRET,
      hasDbUrl: !!process.env.DATABASE_URL
    }
  });
});

// Test login endpoint
router.post('/test-login', async (req, res) => {
  try {
    console.log('[TEST] Test login endpoint hit');
    res.json({ 
      success: true, 
      message: 'Test endpoint working',
      body: req.body
    });
  } catch (error) {
    console.error('[TEST] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 