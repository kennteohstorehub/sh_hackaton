const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const backOfficeService = require('../../services/backOfficeService');
const logger = require('../../utils/logger');

// Use appropriate auth middleware based on environment
const useAuthBypass = process.env.USE_AUTH_BYPASS === 'true';

const { 
  requireBackOfficeGuest, 
  ensureBackOfficeSession,
  checkBackOfficeSessionTimeout,
  auditBackOfficeAction
} = require('../../middleware/backoffice-auth');

const { requireGuestByContext } = require('../../middleware/auth-context');

const { handleValidationErrors, backOfficeAuthLimiter } = require('../../middleware/security');

const router = express.Router();

// Apply session management and timeout checks to all routes
router.use(ensureBackOfficeSession);
router.use(checkBackOfficeSessionTimeout);

// BackOffice validators
const validateBackOfficeLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
];

const validateBackOfficeRegister = [
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

// BackOffice Login page
router.get('/login', requireGuestByContext, (req, res) => {
  const redirect = req.query.redirect || '/backoffice/dashboard';
  
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
  console.log('[BACKOFFICE_AUTH] Login GET - CSRF Token available:', !!res.locals.csrfToken);
  console.log('[BACKOFFICE_AUTH] Login GET - Session exists:', !!req.session);
  
  res.render('backoffice/login-storehub', {
    title: 'BackOffice Login - StoreHub Queue Management System',
    redirect,
    messages: messages,
    csrfToken: res.locals.csrfToken || '',
    merchantName: 'StoreHub Admin',
    merchantSlug: null,
    portalType: 'BackOffice Portal'
  });
});

// BackOffice Register page (only if no superadmins exist)
router.get('/register', requireGuestByContext, async (req, res) => {
  try {
    // Check if this would be the first superadmin
    const isFirstBackOffice = await backOfficeService.isFirstBackOfficeUser();
    
    if (!isFirstBackOffice) {
      // If superadmins already exist, redirect to login
      req.flash('error', 'BackOffice registration is only available for initial setup.');
      return res.redirect('/backoffice/login');
    }

    // Ensure messages object exists
    const messages = res.locals.messages || { error: null, success: null };
    
    res.render('backoffice/register', {
      title: 'BackOffice Registration - StoreHub Queue Management System',
      messages: messages,
      csrfToken: res.locals.csrfToken || '',
      isFirstBackOffice: true
    });
  } catch (error) {
    logger.error('BackOffice register page error:', error);
    req.flash('error', 'An error occurred. Please try again.');
    res.redirect('/backoffice/login');
  }
});

// BackOffice Login POST
router.post('/login', 
  backOfficeAuthLimiter, // Apply more restrictive rate limiting for BackOffice
  auditBackOfficeAction('ATTEMPT_LOGIN', 'BackOffice'),
  (req, res, next) => {
    console.log('[BACKOFFICE_AUTH] Login POST - Raw request received');
    console.log('[BACKOFFICE_AUTH] Body:', req.body);
    next();
  },
  validateBackOfficeLogin,
  handleValidationErrors,
  async (req, res) => {
  try {
    console.log('[BACKOFFICE_AUTH] Login POST route hit - email:', req.body.email);
    logger.info(`BackOffice login attempt for email: ${req.body.email}`);
    logger.debug('Session state before login:', {
      sessionId: req.sessionID,
      hasSession: !!req.session,
      sessionData: req.session
    });

    const { email, password } = req.body;

    // Find and authenticate superadmin
    console.log('[BACKOFFICE_AUTH] About to call backOfficeService.authenticate with email:', email);
    let backOfficeUser;
    try {
      backOfficeUser = await backOfficeService.authenticate(email, password);
      console.log('[BACKOFFICE_AUTH] backOfficeService.authenticate returned:', backOfficeUser ? 'found' : 'not found');
    } catch (authError) {
      console.error('[BACKOFFICE_AUTH] Error during backOfficeService.authenticate:', authError);
      console.error('[BACKOFFICE_AUTH] Error stack:', authError.stack);
      throw authError;
    }
    
    if (!backOfficeUser) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/backoffice/login');
    }
    
    // DEBUG: Log superadmin object structure
    logger.info('BackOffice object found:', {
      hasId: !!backOfficeUser.id,
      idValue: backOfficeUser.id,
      email: backOfficeUser.email,
      fullName: backOfficeUser.fullName,
      isActive: backOfficeUser.isActive,
      backOfficeUserKeys: Object.keys(backOfficeUser).slice(0, 10) // First 10 keys
    });

    // Store data we need to preserve
    const backOfficeUserId = backOfficeUser.id;
    const redirectUrl = req.body.redirect || req.query.redirect || '/backoffice/dashboard';
    const successMessage = `Welcome back, ${backOfficeUser.fullName}!`;
    
    // Store the CSRF token before regeneration
    const csrfToken = req.session.csrfToken;
    const csrfTokenExpiry = req.session.csrfTokenExpiry;
    
    // Regenerate session to prevent fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        logger.error('BackOffice session regeneration error:', err);
        req.flash('error', 'Login error. Please try again.');
        return res.redirect('/backoffice/login');
      }
      
      // Restore CSRF token after regeneration
      if (csrfToken) {
        req.session.csrfToken = csrfToken;
        req.session.csrfTokenExpiry = csrfTokenExpiry;
      }
      
      // Create session with backOfficeUserId - separate from merchant sessions
      req.session.backOfficeUserId = backOfficeUserId;
      req.session.sessionType = 'backoffice';
      req.session.lastActivity = new Date();
      req.session.backOfficeUser = {
        id: backOfficeUserId,
        email: backOfficeUser.email,
        fullName: backOfficeUser.fullName,
        isActive: backOfficeUser.isActive
      };
      
      logger.info('Setting BackOffice session data:', {
        backOfficeUserId,
        sessionId: req.sessionID,
        sessionType: req.session.sessionType,
        backOfficeUserObj: req.session.backOfficeUser,
        csrfTokenRestored: !!csrfToken
      });

      logger.info(`BackOffice logged in: ${backOfficeUser.email}`);
      logger.debug('Session after BackOffice login:', {
        sessionId: req.sessionID,
        backOfficeUserId: req.session.backOfficeUserId,
        sessionType: req.session.sessionType,
        backOfficeUser: req.session.backOfficeUser
      });
      
      // Set flash message after regeneration
      req.flash('success', successMessage);
      
      // Save session before redirect
      req.session.save((err) => {
        if (err) {
          logger.error('BackOffice session save error:', err);
        }
        
        // Redirect to original URL if provided
        logger.info(`BackOffice login successful, redirecting to: ${redirectUrl}`);
        res.redirect(redirectUrl);
      });
    }); // End of regenerate

  } catch (error) {
    logger.error('BackOffice login error:', error);
    logger.error('Error stack:', error.stack);
    req.flash('error', 'An error occurred during login. Please try again.');
    res.redirect('/backoffice/login');
  }
});

// BackOffice Register POST
router.post('/register', 
  backOfficeAuthLimiter, // Apply more restrictive rate limiting for BackOffice
  auditBackOfficeAction('ATTEMPT_REGISTER', 'BackOffice'),
  validateBackOfficeRegister,
  handleValidationErrors,
  async (req, res) => {
  try {
    // Check if this would be the first superadmin
    const isFirstBackOffice = await backOfficeService.isFirstBackOfficeUser();
    
    if (!isFirstBackOffice) {
      req.flash('error', 'BackOffice registration is only available for initial setup.');
      return res.redirect('/backoffice/login');
    }

    const { fullName, email, password } = req.body;

    // Check if superadmin already exists with this email
    const existingBackOffice = await backOfficeService.findByEmail(email);
    if (existingBackOffice) {
      req.flash('error', 'An account with this email already exists.');
      return res.redirect('/backoffice/register');
    }

    // Create superadmin
    const backOfficeUser = await backOfficeService.create({
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
        logger.error('BackOffice session regeneration error:', err);
        req.flash('error', 'Registration error. Please try again.');
        return res.redirect('/backoffice/register');
      }
      
      // Restore CSRF token after regeneration
      if (csrfToken) {
        req.session.csrfToken = csrfToken;
        req.session.csrfTokenExpiry = csrfTokenExpiry;
      }
      
      // Create session with backOfficeUserId
      req.session.backOfficeUserId = backOfficeUser.id;
      req.session.sessionType = 'backoffice';
      req.session.lastActivity = new Date();
      req.session.backOfficeUser = {
        id: backOfficeUser.id,
        email: backOfficeUser.email,
        fullName: backOfficeUser.fullName,
        isActive: backOfficeUser.isActive
      };

      logger.info(`New BackOffice registered: ${backOfficeUser.email}`);
      req.flash('success', `Welcome to StoreHub Queue Management System, ${backOfficeUser.fullName}! You are now the system administrator.`);
      
      // Save session before redirect
      req.session.save((err) => {
        if (err) {
          logger.error('BackOffice session save error:', err);
        }
        // BACKOFFICE FIX: Ensure proper redirect
    res.redirect('/backoffice/dashboard');
      });
    });

  } catch (error) {
    logger.error('BackOffice registration error:', error);
    req.flash('error', 'An error occurred during registration. Please try again.');
    res.redirect('/backoffice/register');
  }
});

// BackOffice Logout (support both GET and POST)
router.get('/logout', 
  auditBackOfficeAction('LOGOUT', 'BackOffice'),
  (req, res) => {
    const backOfficeUserEmail = req.session?.backOfficeUser?.email;
    
    req.session.destroy((err) => {
      if (err) {
        logger.error('BackOffice logout error:', err);
      } else {
        logger.info(`BackOffice logged out: ${backOfficeUserEmail}`);
      }
      res.redirect('/backoffice/login');
    });
  }
);

router.post('/logout', 
  auditBackOfficeAction('LOGOUT', 'BackOffice'),
  (req, res) => {
    const backOfficeUserEmail = req.session?.backOfficeUser?.email;
    
    req.session.destroy((err) => {
      if (err) {
        logger.error('BackOffice logout error:', err);
      } else {
        logger.info(`BackOffice logged out: ${backOfficeUserEmail}`);
      }
      res.redirect('/backoffice/login');
    });
  }
);

// Password reset request
router.post('/forgot-password',
  backOfficeAuthLimiter,
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
      
      const resetToken = await backOfficeService.generatePasswordResetToken(email);
      
      if (resetToken) {
        // In a real application, you would send an email here
        // For now, just log the token (REMOVE IN PRODUCTION)
        logger.info(`BackOffice password reset token for ${email}: ${resetToken}`);
        
        // TODO: Send email with reset link
        // emailService.sendPasswordResetEmail(email, resetToken);
      }
      
      req.flash('success', successMessage);
      res.redirect('/backoffice/login');
      
    } catch (error) {
      logger.error('BackOffice password reset request error:', error);
      req.flash('error', 'An error occurred. Please try again.');
      res.redirect('/backoffice/login');
    }
  }
);

// Debug endpoint (remove in production)
router.get('/debug', (req, res) => {
  res.json({
    session: {
      exists: !!req.session,
      sessionType: req.session?.sessionType,
      backOfficeUserId: req.session?.backOfficeUserId || null,
      hasFlash: typeof req.flash === 'function',
      lastActivity: req.session?.lastActivity
    },
    locals: {
      hasMessages: !!res.locals.messages,
      messages: res.locals.messages || {},
      hasBackOffice: !!res.locals.backOfficeUser
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
    const isFirstBackOffice = await backOfficeService.isFirstBackOfficeUser();
    res.json({
      needsSetup: isFirstBackOffice,
      message: isFirstBackOffice ? 'Initial BackOffice setup required' : 'BackOffice accounts exist'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check setup status',
      message: error.message
    });
  }
});

module.exports = router;