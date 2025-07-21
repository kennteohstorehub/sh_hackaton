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
  res.render('auth/login', {
    title: 'Login - StoreHub Queue Management System',
    redirect
  });
});

// Register page
router.get('/register', requireGuest, (req, res) => {
  res.render('auth/register', {
    title: 'Register - StoreHub Queue Management System'
  });
});

// Login POST
router.post('/login', 
  validateLogin,
  handleValidationErrors,
  async (req, res) => {
  try {

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
      req.flash('success', `Welcome back, ${merchant.businessName}!`);
      
      // Save session before redirect
      req.session.save((err) => {
        if (err) {
          logger.error('Session save error:', err);
        }
        
        // Redirect to original URL if provided
        const redirectUrl = req.body.redirect || req.query.redirect || '/dashboard';
        res.redirect(redirectUrl);
      });
    });

  } catch (error) {
    logger.error('Login error:', error);
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

module.exports = router; 