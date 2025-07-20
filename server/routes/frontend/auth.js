const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const Merchant = require('../../models/Merchant');
const logger = require('../../utils/logger');
const { requireGuest } = require('../../middleware/auth');

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
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Please check your input and try again.');
      return res.redirect('/auth/login');
    }

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

    // Create session with userId
    req.session.userId = merchant._id.toString();

    logger.info(`Merchant logged in: ${merchant.email}`);
    req.flash('success', `Welcome back, ${merchant.businessName}!`);
    
    // Redirect to original URL if provided
    const redirectUrl = req.body.redirect || req.query.redirect || '/dashboard';
    res.redirect(redirectUrl);

  } catch (error) {
    logger.error('Login error:', error);
    req.flash('error', 'An error occurred during login. Please try again.');
    res.redirect('/auth/login');
  }
});

// Register POST
router.post('/register', [
  body('businessName').trim().isLength({ min: 2, max: 100 }).withMessage('Business name must be 2-100 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').isMobilePhone().withMessage('Valid phone number is required'),
  body('businessType').isIn(['restaurant', 'retail']).withMessage('Valid business type is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Please check your input and try again.');
      return res.redirect('/auth/register');
    }

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

    // Create session with userId
    req.session.userId = merchant._id.toString();

    logger.info(`New merchant registered: ${merchant.email}`);
    req.flash('success', `Welcome to StoreHub Queue Management System, ${merchant.businessName}!`);
    res.redirect('/dashboard');

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