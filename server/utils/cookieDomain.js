const logger = require('./logger');

/**
 * Get the appropriate cookie domain for session sharing across subdomains
 * @param {string} hostname - The hostname from the request
 * @returns {string|undefined} The domain to use for cookies, or undefined for default
 */
function getCookieDomain(hostname) {
  // Remove port if present
  const host = hostname.split(':')[0];
  
  // For localhost, don't set domain (cookies will be host-only)
  if (host === 'localhost' || host === '127.0.0.1') {
    logger.debug('Cookie domain: Using host-only for localhost');
    return undefined;
  }
  
  // For lvh.me (local development domain that supports subdomains)
  if (host.endsWith('lvh.me')) {
    logger.debug('Cookie domain: Using .lvh.me for local development');
    return '.lvh.me';
  }
  
  // For onrender.com deployments
  if (host.endsWith('onrender.com')) {
    // Extract the app name and use the base render domain
    const parts = host.split('.');
    if (parts.length >= 3) {
      // e.g., app-name.onrender.com -> .app-name.onrender.com
      const baseDomain = parts.slice(-3).join('.');
      logger.debug(`Cookie domain: Using .${baseDomain} for Render deployment`);
      return `.${baseDomain}`;
    }
  }
  
  // For production domains with subdomains
  const parts = host.split('.');
  if (parts.length >= 2) {
    // Check if it's an IP address
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      logger.debug('Cookie domain: IP address detected, using host-only');
      return undefined;
    }
    
    // For domains like subdomain.example.com -> .example.com
    // This allows cookies to be shared across all subdomains
    let baseDomain;
    if (parts.length === 2) {
      // example.com -> .example.com
      baseDomain = `.${host}`;
    } else {
      // subdomain.example.com -> .example.com
      // Get the last two parts (domain.tld)
      baseDomain = `.${parts.slice(-2).join('.')}`;
    }
    
    logger.debug(`Cookie domain: Using ${baseDomain} for production`);
    return baseDomain;
  }
  
  // Default: don't set domain (host-only cookies)
  logger.debug('Cookie domain: Using default (host-only)');
  return undefined;
}

/**
 * Get session configuration with proper cookie domain
 * @param {Object} req - Express request object
 * @returns {Object} Session configuration
 */
function getSessionConfig(req) {
  const config = require('../config').config;
  const hostname = req ? (req.hostname || req.get('host')) : 'localhost';
  
  const sessionConfig = {
    ...config.session,
    cookie: {
      ...config.session.cookie
    }
  };
  
  // Set cookie domain for subdomain support
  const cookieDomain = getCookieDomain(hostname);
  if (cookieDomain) {
    sessionConfig.cookie.domain = cookieDomain;
  }
  
  logger.debug('Session config:', {
    hostname,
    cookieDomain,
    secure: sessionConfig.cookie.secure,
    sameSite: sessionConfig.cookie.sameSite
  });
  
  return sessionConfig;
}

module.exports = {
  getCookieDomain,
  getSessionConfig
};