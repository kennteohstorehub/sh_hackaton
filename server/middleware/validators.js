const { body, param, query, check } = require('express-validator');
const { isValidObjectId, isValidUUID } = require('./security');

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
  ],

  // ===============================
  // SUPERADMIN VALIDATIONS
  // ===============================

  // UUID validations for PostgreSQL IDs
  validateUUID: (field = 'id') => 
    param(field)
      .custom(isValidUUID)
      .withMessage('Invalid UUID format'),

  validateTenantId: param('tenantId')
    .custom(isValidUUID)
    .withMessage('Invalid tenant ID format'),

  validateSuperAdminId: param('superAdminId')
    .custom(isValidUUID)
    .withMessage('Invalid superadmin ID format'),

  // SuperAdmin authentication validations
  validateSuperAdminLogin: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
  ],

  validateSuperAdminRegister: [
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
  ],

  validateSuperAdminUpdate: [
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email required'),
    body('fullName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be between 2 and 100 characters'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be boolean')
  ],

  validatePasswordChange: [
    body('currentPassword')
      .isLength({ min: 1 })
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 12 })
      .matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('New password must be at least 12 characters with letters, numbers, and special characters'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Password confirmation does not match new password');
        }
        return true;
      })
  ],

  // Tenant validations
  validateCreateTenant: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Tenant name must be between 2 and 100 characters'),
    body('slug')
      .trim()
      .isLength({ min: 2, max: 50 })
      .matches(/^[a-z0-9-]+$/)
      .withMessage('Slug must be lowercase letters, numbers, and hyphens only'),
    body('domain')
      .optional()
      .trim()
      .isLength({ min: 4, max: 100 })
      .matches(/^[a-z0-9.-]+\.[a-z]{2,}$/)
      .withMessage('Domain must be a valid domain format')
  ],

  validateUpdateTenant: [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Tenant name must be between 2 and 100 characters'),
    body('domain')
      .optional()
      .trim()
      .isLength({ min: 4, max: 100 })
      .matches(/^[a-z0-9.-]+\.[a-z]{2,}$/)
      .withMessage('Domain must be a valid domain format'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be boolean')
  ],

  // Subscription validations
  validateCreateSubscription: [
    body('tenantId')
      .custom(isValidUUID)
      .withMessage('Valid tenant ID required'),
    body('plan')
      .isIn(['free', 'basic', 'premium', 'enterprise'])
      .withMessage('Invalid subscription plan'),
    body('maxQueues')
      .isInt({ min: 1, max: 1000 })
      .withMessage('Max queues must be between 1 and 1000'),
    body('maxCustomersPerQueue')
      .isInt({ min: 1, max: 10000 })
      .withMessage('Max customers per queue must be between 1 and 10000'),
    body('maxMerchants')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Max merchants must be between 1 and 1000')
  ],

  validateUpdateSubscription: [
    body('plan')
      .optional()
      .isIn(['free', 'basic', 'premium', 'enterprise'])
      .withMessage('Invalid subscription plan'),
    body('maxQueues')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Max queues must be between 1 and 1000'),
    body('maxCustomersPerQueue')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Max customers per queue must be between 1 and 10000'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be boolean')
  ],

  // Audit log validations
  validateAuditLogQuery: [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be valid ISO 8601 date'),
    query('action')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Action must be between 1 and 100 characters'),
    query('resourceType')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Resource type must be between 1 and 50 characters'),
    query('superAdminId')
      .optional()
      .custom(isValidUUID)
      .withMessage('Invalid superadmin ID format'),
    query('tenantId')
      .optional()
      .custom(isValidUUID)
      .withMessage('Invalid tenant ID format')
  ],

  // System settings validations
  validateSystemSettings: [
    body('maxTenantsPerSystem')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Max tenants must be between 1 and 10000'),
    body('defaultSubscriptionPlan')
      .optional()
      .isIn(['free', 'basic', 'premium', 'enterprise'])
      .withMessage('Invalid default subscription plan'),
    body('systemMaintenanceMode')
      .optional()
      .isBoolean()
      .withMessage('System maintenance mode must be boolean'),
    body('allowNewTenantRegistration')
      .optional()
      .isBoolean()
      .withMessage('Allow new tenant registration must be boolean')
  ]
};

// Sanitize common fields
const sanitizeCommon = [
  body('*').trim().escape(),
  query('*').trim().escape()
];

module.exports = validators;