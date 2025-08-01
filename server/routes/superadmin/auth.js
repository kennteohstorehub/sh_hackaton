const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const superAdminService = require('../../services/superAdminService');
const logger = require('../../utils/logger');

// Use appropriate auth middleware based on environment
const useAuthBypass = process.env.USE_AUTH_BYPASS === 'true';

const { 
  requireSuperAdminGuest, 
  ensureSuperAdminSession,
  checkSuperAdminSessionTimeout,
  auditSuperAdminAction
} = require('../../middleware/superadmin-auth');

const { handleValidationErrors, superAdminAuthLimiter } = require('../../middleware/security');

const router = express.Router();

// Apply session management and timeout checks to all routes
router.use(ensureSuperAdminSession);
router.use(checkSuperAdminSessionTimeout);

// SuperAdmin validators
const validateSuperAdminLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
];

const validateSuperAdminRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email required'),
  body('password')
    .isLength({ min: 12 })
    .matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be at least 12 characters with letters, numbers, and special characters'),
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    })
];

// SuperAdmin Login page
router.get('/login', requireSuperAdminGuest, (req, res) => {
  const redirect = req.query.redirect || '/superadmin/dashboard';
  
  // Ensure messages object exists
  const messages = res.locals.messages || { error: null, success: null };
  
  // Handle specific error messages
  if (req.query.error) {
    switch (req.query.error) {
      case 'account_inactive':
        messages.error = 'Your account has been deactivated. Please contact system administrator.';
        break;
      case 'session_error':
        messages.error = 'Session error occurred. Please login again.';
        break;
      case 'session_timeout':
        messages.error = 'Your session has expired. Please login again.';
        break;
    }
  }
  
  // Debug CSRF token
  console.log('[SUPERADMIN_AUTH] Login GET - CSRF Token available:', !!res.locals.csrfToken);
  console.log('[SUPERADMIN_AUTH] Login GET - Session exists:', !!req.session);
  
  res.render('superadmin/login', {
    title: 'SuperAdmin Login - StoreHub Queue Management System',
    redirect,
    messages: messages,
    csrfToken: res.locals.csrfToken || ''
  });
});

// SuperAdmin Register page (only if no superadmins exist)
router.get('/register', requireSuperAdminGuest, async (req, res) => {
  try {
    // Check if this would be the first superadmin
    const isFirstSuperAdmin = await superAdminService.isFirstSuperAdmin();
    
    if (!isFirstSuperAdmin) {
      // If superadmins already exist, redirect to login
      req.flash('error', 'SuperAdmin registration is only available for initial setup.');
      return res.redirect('/superadmin/login');
    }

    // Ensure messages object exists
    const messages = res.locals.messages || { error: null, success: null };
    
    res.render('superadmin/register', {
      title: 'SuperAdmin Registration - StoreHub Queue Management System',
      messages: messages,
      csrfToken: res.locals.csrfToken || '',
      isFirstSuperAdmin: true
    });
  } catch (error) {
    logger.error('SuperAdmin register page error:', error);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect('/superadmin/login');
  }
});

// SuperAdmin Login POST
router.post('/login', 
  superAdminAuthLimiter, // Apply more restrictive rate limiting for SuperAdmin
  auditSuperAdminAction('ATTEMPT_LOGIN', 'SuperAdmin'),
  (req, res, next) => {
    console.log('[SUPERADMIN_AUTH] Login POST - Raw request received');
    console.log('[SUPERADMIN_AUTH] Body:', req.body);
    next();
  },
  validateSuperAdminLogin,
  handleValidationErrors,
  async (req, res) => {
  try {
    console.log('[SUPERADMIN_AUTH] Login POST route hit - email:', req.body.email);
    logger.info(`SuperAdmin login attempt for email: ${req.body.email}`);
    logger.debug('Session state before login:', {
      sessionId: req.sessionID,
      hasSession: !!req.session,
      sessionData: req.session
    });

    const { email, password } = req.body;

    // Find and authenticate superadmin
    console.log('[SUPERADMIN_AUTH] About to call superAdminService.authenticate with email:', email);
    let superAdmin;
    try {
      superAdmin = await superAdminService.authenticate(email, password);
      console.log('[SUPERADMIN_AUTH] superAdminService.authenticate returned:', superAdmin ? 'found' : 'not found');
    } catch (authError) {
      console.error('[SUPERADMIN_AUTH] Error during superAdminService.authenticate:', authError);
      console.error('[SUPERADMIN_AUTH] Error stack:', authError.stack);
      throw authError;
    }
    
    if (!superAdmin) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/superadmin/login');
    }
    
    // DEBUG: Log superadmin object structure
    logger.info('SuperAdmin object found:', {
      hasId: !!superAdmin.id,
      idValue: superAdmin.id,
      email: superAdmin.email,
      fullName: superAdmin.fullName,
      isActive: superAdmin.isActive,
      superAdminKeys: Object.keys(superAdmin).slice(0, 10) // First 10 keys
    });

    // Store data we need to preserve
    const superAdminId = superAdmin.id;
    const redirectUrl = req.body.redirect || req.query.redirect || '/superadmin/dashboard';
    const successMessage = `Welcome back, ${superAdmin.fullName}!`;
    
    // Store the CSRF token before regeneration
    const csrfToken = req.session.csrfToken;
    const csrfTokenExpiry = req.session.csrfTokenExpiry;
    
    // Regenerate session to prevent fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        logger.error('SuperAdmin session regeneration error:', err);
        req.flash('error', 'Login error. Please try again.');
        return res.redirect('/superadmin/login');
      }
      
      // Restore CSRF token after regeneration
      if (csrfToken) {
        req.session.csrfToken = csrfToken;
        req.session.csrfTokenExpiry = csrfTokenExpiry;
      }
      
      // Create session with superAdminId - separate from merchant sessions
      req.session.superAdminId = superAdminId;
      req.session.sessionType = 'superadmin';
      req.session.lastActivity = new Date();
      req.session.superAdmin = {
        id: superAdminId,
        email: superAdmin.email,
        fullName: superAdmin.fullName,
        isActive: superAdmin.isActive
      };
      
      logger.info('Setting SuperAdmin session data:', {
        superAdminId,
        sessionId: req.sessionID,
        sessionType: req.session.sessionType,
        superAdminObj: req.session.superAdmin,
        csrfTokenRestored: !!csrfToken
      });

      logger.info(`SuperAdmin logged in: ${superAdmin.email}`);
      logger.debug('Session after SuperAdmin login:', {
        sessionId: req.sessionID,
        superAdminId: req.session.superAdminId,
        sessionType: req.session.sessionType,
        superAdmin: req.session.superAdmin
      });
      
      // Set flash message after regeneration
      req.flash('success', successMessage);
      
      // Save session before redirect
      req.session.save((err) => {
        if (err) {
          logger.error('SuperAdmin session save error:', err);
        }
        
        // Redirect to original URL if provided
        logger.info(`SuperAdmin login successful, redirecting to: ${redirectUrl}`);
        res.redirect(redirectUrl);
      });
    }); // End of regenerate

  } catch (error) {
    logger.error('SuperAdmin login error:', error);
    logger.error('Error stack:', error.stack);
    req.flash('error', 'An error occurred during login. Please try again.');
    res.redirect('/superadmin/login');
  }
});

// SuperAdmin Register POST
router.post('/register', 
  superAdminAuthLimiter, // Apply more restrictive rate limiting for SuperAdmin
  auditSuperAdminAction('ATTEMPT_REGISTER', 'SuperAdmin'),
  validateSuperAdminRegister,
  handleValidationErrors,
  async (req, res) => {
  try {
    // Check if this would be the first superadmin
    const isFirstSuperAdmin = await superAdminService.isFirstSuperAdmin();
    
    if (!isFirstSuperAdmin) {
      req.flash('error', 'SuperAdmin registration is only available for initial setup.');
      return res.redirect('/superadmin/login');
    }

    const { fullName, email, password } = req.body;

    // Check if superadmin already exists with this email
    const existingSuperAdmin = await superAdminService.findByEmail(email);
    if (existingSuperAdmin) {
      req.flash('error', 'An account with this email already exists.');
      return res.redirect('/superadmin/register');
    }

    // Create superadmin
    const superAdmin = await superAdminService.create({
      fullName,
      email,
      password
    });

    // Store the CSRF token before regeneration
    const csrfToken = req.session.csrfToken;
    const csrfTokenExpiry = req.session.csrfTokenExpiry;

    // Regenerate session to prevent fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        logger.error('SuperAdmin session regeneration error:', err);
        req.flash('error', 'Registration error. Please try again.');
        return res.redirect('/superadmin/register');
      }
      
      // Restore CSRF token after regeneration
      if (csrfToken) {
        req.session.csrfToken = csrfToken;
        req.session.csrfTokenExpiry = csrfTokenExpiry;
      }
      
      // Create session with superAdminId
      req.session.superAdminId = superAdmin.id;
      req.session.sessionType = 'superadmin';
      req.session.lastActivity = new Date();
      req.session.superAdmin = {
        id: superAdmin.id,
        email: superAdmin.email,
        fullName: superAdmin.fullName,
        isActive: superAdmin.isActive
      };

      logger.info(`New SuperAdmin registered: ${superAdmin.email}`);
      req.flash('success', `Welcome to StoreHub Queue Management System, ${superAdmin.fullName}! You are now the system administrator.`);
      
      // Save session before redirect
      req.session.save((err) => {
        if (err) {
          logger.error('SuperAdmin session save error:', err);
        }
        res.redirect('/superadmin/dashboard');
      });
    });

  } catch (error) {
    logger.error('SuperAdmin registration error:', error);
    req.flash('error', 'An error occurred during registration. Please try again.');
    res.redirect('/superadmin/register');
  }
});

// SuperAdmin Logout (support both GET and POST)
router.get('/logout', 
  auditSuperAdminAction('LOGOUT', 'SuperAdmin'),
  (req, res) => {
    const superAdminEmail = req.session?.superAdmin?.email;
    
    req.session.destroy((err) => {
      if (err) {
        logger.error('SuperAdmin logout error:', err);
      } else {
        logger.info(`SuperAdmin logged out: ${superAdminEmail}`);
      }
      res.redirect('/superadmin/login');
    });
  }
);

router.post('/logout', 
  auditSuperAdminAction('LOGOUT', 'SuperAdmin'),
  (req, res) => {
    const superAdminEmail = req.session?.superAdmin?.email;
    
    req.session.destroy((err) => {
      if (err) {
        logger.error('SuperAdmin logout error:', err);
      } else {
        logger.info(`SuperAdmin logged out: ${superAdminEmail}`);
      }
      res.redirect('/superadmin/login');
    });
  }
);

// Password reset request
router.post('/forgot-password',
  superAdminAuthLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email } = req.body;
      
      // Always show success message to prevent email enumeration
      const successMessage = 'If an account with that email exists, a password reset link has been sent.';
      
      const resetToken = await superAdminService.generatePasswordResetToken(email);
      
      if (resetToken) {
        // In a real application, you would send an email here
        // For now, just log the token (REMOVE IN PRODUCTION)
        logger.info(`SuperAdmin password reset token for ${email}: ${resetToken}`);
        
        // TODO: Send email with reset link
        // emailService.sendPasswordResetEmail(email, resetToken);
      }
      
      req.flash('success', successMessage);
      res.redirect('/superadmin/login');
      
    } catch (error) {
      logger.error('SuperAdmin password reset request error:', error);
      req.flash('error', 'An error occurred. Please try again.');
      res.redirect('/superadmin/login');
    }
  }
);

// Debug endpoint (remove in production)
router.get('/debug', (req, res) => {
  res.json({
    session: {
      exists: !!req.session,
      sessionType: req.session?.sessionType,
      superAdminId: req.session?.superAdminId || null,
      hasFlash: typeof req.flash === 'function',
      lastActivity: req.session?.lastActivity
    },
    locals: {
      hasMessages: !!res.locals.messages,
      messages: res.locals.messages || {},
      hasSuperAdmin: !!res.locals.superAdmin
    },
    env: {
      NODE_ENV: process.env.NODE_ENV,
      hasSessionSecret: !!process.env.SESSION_SECRET,
      hasDbUrl: !!process.env.DATABASE_URL
    }
  });
});

// Check if first superadmin setup is needed
router.get('/setup-check', async (req, res) => {
  try {
    const isFirstSuperAdmin = await superAdminService.isFirstSuperAdmin();
    res.json({
      needsSetup: isFirstSuperAdmin,
      message: isFirstSuperAdmin ? 'Initial SuperAdmin setup required' : 'SuperAdmin accounts exist'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check setup status',
      message: error.message
    });
  }
});

module.exports = router;