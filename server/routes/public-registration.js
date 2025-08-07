const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');
const tenantService = require('../services/tenantService');

const router = express.Router();

// Validation rules for registration
const validateRegistration = [
  body('fullName')
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}[-\s\.]?[0-9]{1,9}$/)
    .withMessage('Please provide a valid phone number'),
  
  body('businessName')
    .notEmpty()
    .withMessage('Business name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Business name must be between 2 and 100 characters'),
  
  body('subdomain')
    .notEmpty()
    .withMessage('Subdomain is required')
    .isLength({ min: 3, max: 30 })
    .withMessage('Subdomain must be between 3 and 30 characters')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Subdomain can only contain lowercase letters, numbers, and hyphens')
    .custom(async (value) => {
      // Check if subdomain is already taken
      const existingTenant = await prisma.tenant.findFirst({
        where: {
          OR: [
            { slug: value },
            { domain: `${value}.storehubqms.com` }
          ]
        }
      });
      if (existingTenant) {
        throw new Error('This subdomain is already taken');
      }
      return true;
    }),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('confirmPassword')
    .notEmpty()
    .withMessage('Please confirm your password')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
  
  body('businessType')
    .optional()
    .isIn(['restaurant', 'retail', 'healthcare', 'salon', 'other'])
    .withMessage('Invalid business type'),
  
  body('agreeToTerms')
    .equals('true')
    .withMessage('You must agree to the terms and conditions')
];

// GET /register - Display registration page
router.get('/register', async (req, res) => {
  try {
    res.render('register', {
      title: 'Start Your Free Trial - StoreHub QMS',
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      errors: [],
      formData: {}
    });
  } catch (error) {
    logger.error('Error displaying registration page:', error);
    res.status(500).render('error', {
      message: 'Unable to load registration page',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// POST /register - Handle registration
router.post('/register', validateRegistration, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('register', {
        title: 'Start Your Free Trial - StoreHub QMS',
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        errors: errors.array(),
        formData: req.body
      });
    }

    const {
      fullName,
      email,
      phone,
      businessName,
      subdomain,
      password,
      businessType = 'restaurant'
    } = req.body;

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Calculate trial end date (14 days from now)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      // 1. Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: businessName,
          slug: subdomain.toLowerCase(),
          domain: `${subdomain.toLowerCase()}.storehubqms.com`,
          isActive: true
        }
      });

      // 2. Create subscription with trial
      const subscription = await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          status: 'trial',
          priority: 'standard',
          billingCycle: 'monthly',
          startDate: new Date(),
          endDate: trialEndDate,
          maxMerchants: 1,
          maxQueuesPerMerchant: 1,
          maxUsersPerTenant: 3,
          aiFeatures: false,
          analytics: true, // Basic analytics included in trial
          customBranding: false,
          priority_support: false
        }
      });

      // 3. Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // 4. Create merchant account
      const merchant = await tx.merchant.create({
        data: {
          tenantId: tenant.id,
          email,
          password: hashedPassword,
          businessName,
          businessType,
          phone,
          ownerName: fullName,
          isActive: true,
          emailVerified: false,
          // Generate email verification token
          emailVerificationToken: Buffer.from(Math.random().toString()).toString('base64').slice(0, 32)
        }
      });

      // 5. Create default queue for the merchant
      const queue = await tx.queue.create({
        data: {
          merchantId: merchant.id,
          name: 'Main Queue',
          isActive: false, // Start as inactive
          maxSize: 50,
          averageServiceTime: 15, // 15 minutes default
          allowJoinAfterClose: false,
          enableNotifications: true
        }
      });

      // 6. Log the registration in audit log
      await tx.backOfficeAuditLog.create({
        data: {
          tenantId: tenant.id,
          action: 'TENANT_CREATED',
          entityType: 'Tenant',
          entityId: tenant.id,
          description: `New tenant registered via self-service: ${businessName}`,
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('user-agent') || 'unknown',
          metadata: JSON.stringify({
            registrationType: 'self-service',
            trial: true,
            businessType,
            subdomain
          })
        }
      });

      return { tenant, merchant, subscription };
    });

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail({
        to: email,
        name: fullName,
        businessName,
        loginUrl: `https://${subdomain.toLowerCase()}.storehubqms.com/login`,
        trialDays: 14
      });
    } catch (emailError) {
      logger.error('Failed to send welcome email:', emailError);
      // Don't fail registration if email fails
    }

    // Log successful registration
    logger.info(`New merchant registered: ${businessName} (${email})`);

    // Redirect to success page
    res.render('registration-success', {
      title: 'Registration Successful - StoreHub QMS',
      businessName,
      subdomain: subdomain.toLowerCase(),
      email,
      loginUrl: `https://${subdomain.toLowerCase()}.storehubqms.com/login`
    });

  } catch (error) {
    logger.error('Registration error:', error);
    
    // Check if it's a unique constraint error
    if (error.code === 'P2002') {
      return res.status(400).render('register', {
        title: 'Start Your Free Trial - StoreHub QMS',
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        errors: [{ msg: 'An account with this email or subdomain already exists' }],
        formData: req.body
      });
    }

    res.status(500).render('register', {
      title: 'Start Your Free Trial - StoreHub QMS',
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      errors: [{ msg: 'Registration failed. Please try again later.' }],
      formData: req.body
    });
  }
});

// GET /register/check-subdomain - Check subdomain availability (AJAX)
router.get('/register/check-subdomain/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;
    
    // Validate subdomain format
    if (!/^[a-z0-9-]{3,30}$/.test(subdomain)) {
      return res.json({
        available: false,
        message: 'Invalid subdomain format'
      });
    }

    // Check if subdomain exists
    const existingTenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: subdomain },
          { domain: `${subdomain}.storehubqms.com` }
        ]
      }
    });

    res.json({
      available: !existingTenant,
      message: existingTenant ? 'Subdomain is already taken' : 'Subdomain is available'
    });
  } catch (error) {
    logger.error('Error checking subdomain:', error);
    res.status(500).json({
      available: false,
      message: 'Error checking subdomain availability'
    });
  }
});

module.exports = router;