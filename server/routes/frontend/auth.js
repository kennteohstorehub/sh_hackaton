const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const merchantService = require('../../services/merchantService');
const prisma = require('../../utils/prisma');
const logger = require('../../utils/logger');
// Use appropriate auth middleware based on environment
const useAuthBypass = process.env.USE_AUTH_BYPASS === 'true';

const { requireGuest } = useAuthBypass ? 
  require('../../middleware/auth-bypass') : 
  require('../../middleware/auth');
const { validateLogin, validateRegister } = require('../../middleware/validators');
const { handleValidationErrors, authLimiter } = require('../../middleware/security');

const router = express.Router();

// Login page
router.get('/login', requireGuest, (req, res) => {
  const redirect = req.query.redirect || '/dashboard';
  
  // Ensure messages object exists
  const messages = res.locals.messages || { error: null, success: null };
  
  // Debug CSRF token
  console.log('[AUTH] Login GET - CSRF Token available:', !!res.locals.csrfToken);
  console.log('[AUTH] Login GET - Session exists:', !!req.session);
  
  res.render('auth/login', {
    title: 'Login - StoreHub Queue Management System',
    redirect,
    messages: messages,
    csrfToken: res.locals.csrfToken || ''
  });
});

// Register page
router.get('/register', requireGuest, (req, res) => {
  // Ensure messages object exists
  const messages = res.locals.messages || { error: null, success: null };
  
  res.render('auth/register', {
    title: 'Register - StoreHub Queue Management System',
    messages: messages,
    csrfToken: res.locals.csrfToken || ''
  });
});

// Login POST
router.post('/login', 
  authLimiter, // Apply rate limiting to POST only
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
    console.log('[AUTH] About to call merchantService.findByEmail with email:', email);
    let merchant;
    try {
      merchant = await merchantService.findByEmail(email);
      console.log('[AUTH] merchantService.findByEmail returned:', merchant ? 'found' : 'not found');
    } catch (findError) {
      console.error('[AUTH] Error during merchantService.findByEmail:', findError);
      console.error('[AUTH] Error stack:', findError.stack);
      throw findError; // Let the outer catch handle it
    }
    
    if (!merchant) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/auth/login');
    }
    
    // DEBUG: Log merchant object structure
    logger.info('Merchant object found:', {
      hasId: !!merchant.id,
      has_id: !!merchant._id,
      idValue: merchant.id,
      _idValue: merchant._id?.toString(),
      email: merchant.email,
      businessName: merchant.businessName,
      merchantKeys: Object.keys(merchant).slice(0, 10) // First 10 keys
    });

    // Check password - use authenticate method
    const authenticatedMerchant = await merchantService.authenticate(email, password);
    if (!authenticatedMerchant) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/auth/login');
    }

    // Store data we need to preserve
    const merchantId = merchant.id;
    const redirectUrl = req.body.redirect || req.query.redirect || '/dashboard';
    const successMessage = `Welcome back, ${merchant.businessName}!`;
    
    // Store the CSRF token before regeneration
    const csrfToken = req.session.csrfToken;
    const csrfTokenExpiry = req.session.csrfTokenExpiry;
    
    // Regenerate session to prevent fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration error:', err);
        req.flash('error', 'Login error. Please try again.');
        return res.redirect('/auth/login');
      }
      
      // Restore CSRF token after regeneration
      if (csrfToken) {
        req.session.csrfToken = csrfToken;
        req.session.csrfTokenExpiry = csrfTokenExpiry;
      }
      
      // Create session with userId - use consistent ID
      req.session.userId = merchantId;
      req.session.user = {
        id: merchantId,
        email: merchant.email,
        businessName: merchant.businessName,
        merchantId: merchantId
      };
      
      logger.info('Setting session data:', {
        merchantId,
        sessionId: req.sessionID,
        userId: req.session.userId,
        userObj: req.session.user,
        csrfTokenRestored: !!csrfToken
      });

      logger.info(`Merchant logged in: ${merchant.email}`);
      logger.debug('Session after login:', {
        sessionId: req.sessionID,
        userId: req.session.userId,
        user: req.session.user
      });
      
      // Set flash message after regeneration
      req.flash('success', successMessage);
      
      // Save session before redirect
      req.session.save((err) => {
        if (err) {
          logger.error('Session save error:', err);
        }
        
        // Redirect to original URL if provided
        logger.info(`Login successful, redirecting to: ${redirectUrl}`);
        res.redirect(redirectUrl);
      });
    }); // End of regenerate

  } catch (error) {
    logger.error('Login error:', error);
    logger.error('Error stack:', error.stack);
    req.flash('error', 'An error occurred during login. Please try again.');
    res.redirect('/auth/login');
  }
});

// Register POST
router.post('/register', 
  authLimiter, // Apply rate limiting to POST only
  validateRegister,
  handleValidationErrors,
  async (req, res) => {
  try {

    const { businessName, email, password, phone, businessType } = req.body;

    // Check if merchant already exists
    const existingMerchant = await merchantService.findByEmail(email);
    if (existingMerchant) {
      req.flash('error', 'An account with this email already exists.');
      return res.redirect('/auth/register');
    }

    // Create merchant
    const merchant = await merchantService.create({
      businessName,
      email,
      password,
      phone,
      businessType
    });
    
    // Initialize merchant defaults
    await merchantService.initializeDefaults(merchant.id);

    // Store the CSRF token before regeneration
    const csrfToken = req.session.csrfToken;
    const csrfTokenExpiry = req.session.csrfTokenExpiry;

    // Regenerate session to prevent fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration error:', err);
        req.flash('error', 'Registration error. Please try again.');
        return res.redirect('/auth/register');
      }
      
      // Restore CSRF token after regeneration
      if (csrfToken) {
        req.session.csrfToken = csrfToken;
        req.session.csrfTokenExpiry = csrfTokenExpiry;
      }
      
      // Create session with userId
      req.session.userId = merchant.id;
      req.session.user = {
        id: merchant.id,
        email: merchant.email,
        businessName: merchant.businessName,
        merchantId: merchant.id
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

// Demo user check endpoint
router.get('/check-demo', async (req, res) => {
  try {
    const demoUser = await Merchant.findOne({ email: 'demo@smartqueue.com' });
    res.json({
      demoUserExists: !!demoUser,
      email: demoUser ? demoUser.email : null,
      businessName: demoUser ? demoUser.businessName : null,
      message: demoUser ? 'Demo user found' : 'Demo user not found - needs seeding'
    });
  } catch (error) {
    res.json({
      error: 'Failed to check demo user',
      message: error.message
    });
  }
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