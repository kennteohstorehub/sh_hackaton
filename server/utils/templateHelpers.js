const xss = require('xss');

// Safe HTML escape function for EJS templates
const escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;'
  };
  
  return String(str).replace(/[&<>"'\/]/g, (s) => map[s]);
};

// Sanitize user content while allowing some safe HTML
const sanitizeHtml = (str, options = {}) => {
  if (!str) return '';
  
  const defaultOptions = {
    whiteList: {
      b: [],
      i: [],
      em: [],
      strong: [],
      br: [],
      p: [],
      span: ['class']
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
  };
  
  return xss(str, { ...defaultOptions, ...options });
};

// Safe JSON stringification for inline JavaScript
const safeJsonStringify = (obj) => {
  if (!obj) return '{}';
  
  try {
    // Convert to JSON and escape for safe embedding in HTML
    const json = JSON.stringify(obj);
    return json
      .replace(/</g, '\\u003C')
      .replace(/>/g, '\\u003E')
      .replace(/&/g, '\\u0026')
      .replace(/'/g, '\\u0027')
      .replace(/"/g, '\\u0022');
  } catch (error) {
    console.error('Error stringifying object:', error);
    return '{}';
  }
};

// Format phone number safely
const formatPhone = (phone) => {
  if (!phone) return '';
  // Remove any potential XSS from phone numbers
  const cleaned = String(phone).replace(/[^\d+\s\-()]/g, '');
  return escapeHtml(cleaned);
};

// Safe URL encoding
const safeUrl = (url) => {
  if (!url) return '#';
  
  try {
    // Validate URL to prevent javascript: protocols
    const parsed = new URL(url, 'http://localhost');
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return '#';
    }
    return encodeURI(url);
  } catch {
    return '#';
  }
};

// Add helpers to app locals
const registerHelpers = (app) => {
  app.locals.escapeHtml = escapeHtml;
  app.locals.sanitizeHtml = sanitizeHtml;
  app.locals.safeJsonStringify = safeJsonStringify;
  app.locals.formatPhone = formatPhone;
  app.locals.safeUrl = safeUrl;
  
  // Legacy compatibility - map to escape function
  app.locals.h = escapeHtml;
};

module.exports = {
  escapeHtml,
  sanitizeHtml,
  safeJsonStringify,
  formatPhone,
  safeUrl,
  registerHelpers
};