const { body, param, query, check } = require('express-validator');
const { isValidObjectId } = require('./security');

// Common validation rules
const validators = {
  // ID validations
  validateMongoId: (field = 'id') => 
    param(field)
      .custom(isValidObjectId)
      .withMessage('Invalid ID format'),

  // Auth validations
  validateLogin: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
  ],

  validateRegister: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must be at least 8 characters with letters, numbers, and special characters'),
    body('businessName')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Business name must be between 2 and 100 characters'),
    body('phoneNumber')
      .optional()
      .matches(/^\+?[1-9]\d{1,14}$/)
      .withMessage('Invalid phone number format')
  ],

  // Queue validations
  validateCreateQueue: [
    body('name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Queue name is required and must be less than 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('maxSize')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Max size must be between 1 and 1000'),
    body('estimatedServiceTime')
      .optional()
      .isInt({ min: 1, max: 240 })
      .withMessage('Service time must be between 1 and 240 minutes'),
    body('allowMultipleEntries')
      .optional()
      .isBoolean()
      .withMessage('Allow multiple entries must be boolean')
  ],

  validateUpdateQueue: [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Queue name must be less than 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('maxSize')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Max size must be between 1 and 1000'),
    body('estimatedServiceTime')
      .optional()
      .isInt({ min: 1, max: 240 })
      .withMessage('Service time must be between 1 and 240 minutes'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be boolean')
  ],

  // Queue entry validations
  validateJoinQueue: [
    body('customerName')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Customer name is required'),
    body('customerPhone')
      .matches(/^\+?[1-9]\d{1,14}$/)
      .withMessage('Valid phone number required'),
    body('partySize')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Party size must be between 1 and 50'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Notes must be less than 500 characters')
  ],

  // Search validations
  validateSearch: [
    query('q')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Search query too long'),
    query('status')
      .optional()
      .isIn(['waiting', 'serving', 'completed', 'cancelled'])
      .withMessage('Invalid status'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be non-negative')
  ],

  // Business hours validations
  validateBusinessHours: [
    body('businessHours')
      .isObject()
      .withMessage('Business hours must be an object'),
    body('businessHours.*.open')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Invalid time format (HH:MM)'),
    body('businessHours.*.close')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Invalid time format (HH:MM)'),
    body('businessHours.*.isClosed')
      .optional()
      .isBoolean()
      .withMessage('isClosed must be boolean')
  ],

  // Pagination
  validatePagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ]
};

// Sanitize common fields
const sanitizeCommon = [
  body('*').trim().escape(),
  query('*').trim().escape()
];

module.exports = validators;