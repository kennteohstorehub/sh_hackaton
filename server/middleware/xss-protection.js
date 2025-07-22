const xss = require('xss');
const logger = require('../utils/logger');

/**
 * XSS Protection Middleware
 * 
 * Instead of modifying request data in-place, this middleware:
 * 1. Provides sanitized getters for request data
 * 2. Logs potential XSS attempts
 * 3. Allows specific fields to be excluded from sanitization
 */

// Fields that should not be sanitized (e.g., rich text editors, markdown)
const EXCLUDED_FIELDS = new Set([
  'description',
  'notes',
  'messageTemplate',
  'htmlContent'
]);

// Fields that might contain code/scripts legitimately
const CODE_FIELDS = new Set([
  'webhookPayload',
  'apiResponse',
  'debugInfo'
]);

/**
 * Create sanitized getters for request data
 */
const xssProtection = (req, res, next) => {
  // Store original values
  const originalBody = req.body ? { ...req.body } : {};
  const originalQuery = req.query ? { ...req.query } : {};
  const originalParams = req.params ? { ...req.params } : {};

  // Helper function to sanitize a value
  const sanitizeValue = (value, fieldName) => {
    if (typeof value !== 'string') return value;
    
    // Skip excluded fields
    if (EXCLUDED_FIELDS.has(fieldName)) return value;
    
    // For code fields, only escape HTML tags
    if (CODE_FIELDS.has(fieldName)) {
      return value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    
    // Full XSS sanitization for other fields
    const sanitized = xss(value);
    
    // Log if content was changed (potential XSS attempt)
    if (sanitized !== value) {
      logger.warn('Potential XSS attempt detected', {
        field: fieldName,
        original: value.substring(0, 100), // Log first 100 chars
        ip: req.ip,
        url: req.url,
        method: req.method
      });
    }
    
    return sanitized;
  };

  // Sanitized getter functions
  req.getSanitizedBody = (field) => {
    if (!field) {
      // Return all sanitized body fields
      const sanitized = {};
      for (const [key, value] of Object.entries(originalBody)) {
        sanitized[key] = sanitizeValue(value, key);
      }
      return sanitized;
    }
    return sanitizeValue(originalBody[field], field);
  };

  req.getSanitizedQuery = (field) => {
    if (!field) {
      // Return all sanitized query fields
      const sanitized = {};
      for (const [key, value] of Object.entries(originalQuery)) {
        sanitized[key] = sanitizeValue(value, key);
      }
      return sanitized;
    }
    return sanitizeValue(originalQuery[field], field);
  };

  req.getSanitizedParam = (field) => {
    if (!field) {
      // Return all sanitized params
      const sanitized = {};
      for (const [key, value] of Object.entries(originalParams)) {
        sanitized[key] = sanitizeValue(value, key);
      }
      return sanitized;
    }
    return sanitizeValue(originalParams[field], field);
  };

  // Convenience method to get any sanitized input
  req.getSanitized = (field) => {
    return originalBody[field] !== undefined ? req.getSanitizedBody(field) :
           originalQuery[field] !== undefined ? req.getSanitizedQuery(field) :
           originalParams[field] !== undefined ? req.getSanitizedParam(field) :
           undefined;
  };

  // Add a method to validate if input was sanitized
  req.wasInputSanitized = (field) => {
    const original = originalBody[field] || originalQuery[field] || originalParams[field];
    if (typeof original !== 'string') return false;
    
    const sanitized = sanitizeValue(original, field);
    return original !== sanitized;
  };

  next();
};

/**
 * Output encoding helper for templates
 * Use this in EJS templates: <%= encodeOutput(userInput) %>
 */
const encodeOutput = (str) => {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

module.exports = {
  xssProtection,
  encodeOutput,
  EXCLUDED_FIELDS,
  CODE_FIELDS
};