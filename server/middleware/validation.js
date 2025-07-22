const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Comprehensive Input Validation Middleware
 * 
 * Provides reusable validation chains for common patterns
 */

// Custom validators
const validators = {
  // Phone number validation (international format)
  isPhoneNumber: (value) => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(value);
  },

  // MongoDB ObjectId validation
  isObjectId: (value) => {
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    return objectIdRegex.test(value);
  },

  // Business hours validation (HH:MM format)
  isBusinessHours: (value) => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(value);
  },

  // URL validation
  isURL: (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }
};

// Common validation chains
const validate = {
  // User authentication
  register: [
    body('businessName')
      .trim()
      .notEmpty().withMessage('Business name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Business name must be 2-100 characters'),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone number is required')
      .custom(validators.isPhoneNumber).withMessage('Invalid phone number format'),
    body('businessType')
      .notEmpty().withMessage('Business type is required')
      .isIn(['restaurant', 'retail']).withMessage('Invalid business type')
  ],

  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required')
  ],

  // Queue management
  createQueue: [
    body('name')
      .trim()
      .notEmpty().withMessage('Queue name is required')
      .isLength({ min: 2, max: 50 }).withMessage('Queue name must be 2-50 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('Description must be less than 200 characters'),
    body('maxCapacity')
      .optional()
      .isInt({ min: 1, max: 1000 }).withMessage('Max capacity must be between 1 and 1000'),
    body('averageServiceTime')
      .optional()
      .isInt({ min: 1, max: 480 }).withMessage('Average service time must be between 1 and 480 minutes')
  ],

  joinQueue: [
    body('queueId')
      .notEmpty().withMessage('Queue ID is required')
      .custom(validators.isObjectId).withMessage('Invalid queue ID'),
    body('customerName')
      .trim()
      .notEmpty().withMessage('Customer name is required')
      .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
    body('customerPhone')
      .trim()
      .notEmpty().withMessage('Phone number is required')
      .custom(validators.isPhoneNumber).withMessage('Invalid phone number'),
    body('partySize')
      .optional()
      .isInt({ min: 1, max: 20 }).withMessage('Party size must be between 1 and 20'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('Notes must be less than 200 characters')
  ],

  updateQueueEntry: [
    param('id')
      .notEmpty().withMessage('Entry ID is required')
      .custom(validators.isObjectId).withMessage('Invalid entry ID'),
    body('status')
      .optional()
      .isIn(['waiting', 'called', 'serving', 'completed', 'cancelled', 'no_show'])
      .withMessage('Invalid status'),
    body('estimatedWaitTime')
      .optional()
      .isInt({ min: 0, max: 480 }).withMessage('Wait time must be between 0 and 480 minutes')
  ],

  // Merchant settings
  updateSettings: [
    body('seatingCapacity')
      .optional()
      .isInt({ min: 1, max: 1000 }).withMessage('Seating capacity must be between 1 and 1000'),
    body('avgMealDuration')
      .optional()
      .isInt({ min: 5, max: 240 }).withMessage('Average meal duration must be between 5 and 240 minutes'),
    body('maxQueueSize')
      .optional()
      .isInt({ min: 1, max: 500 }).withMessage('Max queue size must be between 1 and 500'),
    body('businessHours.*.start')
      .optional()
      .custom(validators.isBusinessHours).withMessage('Invalid time format'),
    body('businessHours.*.end')
      .optional()
      .custom(validators.isBusinessHours).withMessage('Invalid time format')
  ],

  // Pagination
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sort')
      .optional()
      .isIn(['asc', 'desc', 'newest', 'oldest']).withMessage('Invalid sort order')
  ],

  // Search
  search: [
    query('q')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 }).withMessage('Search query must be 1-100 characters')
      .escape() // Escape HTML entities
  ],

  // Date range
  dateRange: [
    query('startDate')
      .optional()
      .isISO8601().withMessage('Invalid start date format'),
    query('endDate')
      .optional()
      .isISO8601().withMessage('Invalid end date format')
      .custom((value, { req }) => {
        if (req.query.startDate && value) {
          return new Date(value) >= new Date(req.query.startDate);
        }
        return true;
      }).withMessage('End date must be after start date')
  ],

  // Webhook validation
  webhookUrl: [
    body('url')
      .notEmpty().withMessage('Webhook URL is required')
      .custom(validators.isURL).withMessage('Invalid URL format')
      .custom((value) => {
        // Ensure HTTPS in production
        if (process.env.NODE_ENV === 'production' && !value.startsWith('https://')) {
          throw new Error('Webhook URL must use HTTPS');
        }
        return true;
      }),
    body('events')
      .optional()
      .isArray().withMessage('Events must be an array')
      .custom((value) => {
        const validEvents = ['queue.joined', 'queue.updated', 'queue.completed'];
        return value.every(event => validEvents.includes(event));
      }).withMessage('Invalid event type')
  ]
};

/**
 * Validation error handler middleware
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Log validation errors
    logger.warn('Validation failed', {
      url: req.url,
      method: req.method,
      errors: errors.array(),
      ip: req.ip
    });

    // Format errors for response
    const formattedErrors = errors.array().reduce((acc, error) => {
      if (!acc[error.param]) {
        acc[error.param] = [];
      }
      acc[error.param].push(error.msg);
      return acc;
    }, {});

    // Check if it's an API request
    if (req.xhr || req.path.startsWith('/api/')) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: formattedErrors
      });
    }

    // For form submissions, flash errors and redirect back
    req.flash('error', 'Please fix the following errors:');
    req.flash('validationErrors', formattedErrors);
    return res.redirect('back');
  }
  
  next();
};

/**
 * Create a validation middleware chain
 */
const createValidationChain = (...validations) => {
  return [...validations, handleValidationErrors];
};

module.exports = {
  validate,
  validators,
  handleValidationErrors,
  createValidationChain,
  body,
  param,
  query,
  validationResult
};