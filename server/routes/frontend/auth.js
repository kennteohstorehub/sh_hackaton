const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Merchant = require('../../models/Merchant');
const logger = require('../../utils/logger');

const router = express.Router();

// Middleware to redirect if already logged in
const redirectIfAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  next();
};

// GET /auth/login
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('auth/login', {
    title: 'Login - Smart Queue Manager',
    errors: [],
    formData: {}
  });
});

// POST /auth/login
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.render('auth/login', {
        title: 'Login - Smart Queue Manager',
        errors: errors.array(),
        formData: req.body
      });
    }

    const { email, password } = req.body;

    // Find merchant
    const merchant = await Merchant.findOne({ email, isActive: true });
    if (!merchant) {
      return res.render('auth/login', {
        title: 'Login - Smart Queue Manager',
        errors: [{ msg: 'Invalid email or password' }],
        formData: req.body
      });
    }

    // Check password
    const isValidPassword = await merchant.comparePassword(password);
    if (!isValidPassword) {
      return res.render('auth/login', {
        title: 'Login - Smart Queue Manager',
        errors: [{ msg: 'Invalid email or password' }],
        formData: req.body
      });
    }

    // Update last login
    merchant.lastLogin = new Date();
    await merchant.save();

    // Set session
    req.session.user = {
      id: merchant._id,
      email: merchant.email,
      businessName: merchant.businessName,
      businessType: merchant.businessType,
      subscription: merchant.subscription
    };

    req.flash('success', `Welcome back, ${merchant.businessName}!`);
    logger.info(`Merchant logged in: ${merchant.email}`);
    
    res.redirect('/dashboard');

  } catch (error) {
    logger.error('Login error:', error);
    res.render('auth/login', {
      title: 'Login - Smart Queue Manager',
      errors: [{ msg: 'An error occurred. Please try again.' }],
      formData: req.body
    });
  }
});

// GET /auth/register
router.get('/register', redirectIfAuthenticated, (req, res) => {
  res.render('auth/register', {
    title: 'Register - Smart Queue Manager',
    errors: [],
    formData: {}
  });
});

// POST /auth/register
router.post('/register', [
  body('businessName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Business name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  body('phone')
    .isMobilePhone()
    .withMessage('Please enter a valid phone number'),
  body('businessType')
    .isIn(['restaurant', 'clinic', 'salon', 'bank', 'government', 'retail', 'other'])
    .withMessage('Please select a valid business type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.render('auth/register', {
        title: 'Register - Smart Queue Manager',
        errors: errors.array(),
        formData: req.body
      });
    }

    const { businessName, email, password, phone, businessType } = req.body;

    // Check if merchant already exists
    const existingMerchant = await Merchant.findOne({ email });
    if (existingMerchant) {
      return res.render('auth/register', {
        title: 'Register - Smart Queue Manager',
        errors: [{ msg: 'An account with this email already exists' }],
        formData: req.body
      });
    }

    // Create new merchant
    const merchant = new Merchant({
      businessName,
      email,
      password,
      phone,
      businessType,
      // Set default business hours
      businessHours: {
        monday: { start: '09:00', end: '17:00', closed: false },
        tuesday: { start: '09:00', end: '17:00', closed: false },
        wednesday: { start: '09:00', end: '17:00', closed: false },
        thursday: { start: '09:00', end: '17:00', closed: false },
        friday: { start: '09:00', end: '17:00', closed: false },
        saturday: { start: '09:00', end: '17:00', closed: false },
        sunday: { start: '09:00', end: '17:00', closed: true }
      },
      // Add default service types based on business type
      serviceTypes: getDefaultServiceTypes(businessType)
    });

    await merchant.save();

    // Set session
    req.session.user = {
      id: merchant._id,
      email: merchant.email,
      businessName: merchant.businessName,
      businessType: merchant.businessType,
      subscription: merchant.subscription
    };

    req.flash('success', 'Account created successfully! Welcome to Smart Queue Manager.');
    logger.info(`New merchant registered: ${merchant.email}`);
    
    res.redirect('/dashboard');

  } catch (error) {
    logger.error('Registration error:', error);
    res.render('auth/register', {
      title: 'Register - Smart Queue Manager',
      errors: [{ msg: 'An error occurred. Please try again.' }],
      formData: req.body
    });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Logout error:', err);
      return res.redirect('/dashboard');
    }
    res.clearCookie('connect.sid');
    req.flash('success', 'You have been logged out successfully.');
    res.redirect('/');
  });
});

// Helper function to get default service types
function getDefaultServiceTypes(businessType) {
  const serviceTypes = {
    restaurant: [
      { name: 'Dine-in', estimatedDuration: 60, description: 'Table reservation' },
      { name: 'Takeout', estimatedDuration: 15, description: 'Order pickup' }
    ],
    clinic: [
      { name: 'General Consultation', estimatedDuration: 30, description: 'Regular checkup' },
      { name: 'Specialist Consultation', estimatedDuration: 45, description: 'Specialist appointment' }
    ],
    salon: [
      { name: 'Haircut', estimatedDuration: 45, description: 'Hair cutting service' },
      { name: 'Hair Styling', estimatedDuration: 60, description: 'Hair styling service' },
      { name: 'Manicure', estimatedDuration: 30, description: 'Nail care service' }
    ],
    bank: [
      { name: 'Account Services', estimatedDuration: 15, description: 'Account related services' },
      { name: 'Loan Consultation', estimatedDuration: 30, description: 'Loan application and consultation' }
    ],
    government: [
      { name: 'Document Processing', estimatedDuration: 20, description: 'Document submission and processing' },
      { name: 'Information Inquiry', estimatedDuration: 10, description: 'General information and inquiries' }
    ],
    retail: [
      { name: 'Customer Service', estimatedDuration: 15, description: 'General customer service' },
      { name: 'Product Return', estimatedDuration: 10, description: 'Product return and exchange' }
    ],
    other: [
      { name: 'General Service', estimatedDuration: 20, description: 'General service' }
    ]
  };

  return serviceTypes[businessType] || serviceTypes.other;
}

module.exports = router; 