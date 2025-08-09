const logger = require('./logger');

/**
 * Helper functions for subdomain URL construction
 */

/**
 * Build a full URL with subdomain for a given tenant
 * @param {Object} req - Express request object
 * @param {string} path - Path to append to the URL (e.g., '/dashboard')
 * @param {Object} tenant - Tenant object with slug property
 * @returns {string} Full URL with subdomain or relative path
 */
function buildTenantUrl(req, path, tenant = null) {
  // Use tenant from parameter or request
  const tenantObj = tenant || req.tenant;
  
  // If no tenant, return relative path
  if (!tenantObj || !tenantObj.slug) {
    return path;
  }
  
  const protocol = req.protocol;
  const host = req.get('host');
  const baseHost = host.split(':')[0]; // Remove port if present
  const port = host.includes(':') ? `:${host.split(':')[1]}` : '';
  
  // Check if this is local development
  if (baseHost === 'localhost' || baseHost === '127.0.0.1' || baseHost.includes('lvh.me')) {
    // For local development, use lvh.me domain
    return `${protocol}://${tenantObj.slug}.lvh.me${port}${path}`;
  }
  
  // Check if this is Render deployment
  if (baseHost.includes('onrender.com')) {
    // For Render deployment, use path-based routing
    return path;
  }
  
  // For production with custom domain
  // Remove any existing subdomain from the host
  const domainParts = baseHost.split('.');
  const baseDomain = domainParts.length > 2 ? 
    domainParts.slice(1).join('.') : 
    baseHost;
  
  return `${protocol}://${tenantObj.slug}.${baseDomain}${port}${path}`;
}

/**
 * Check if URL needs subdomain adjustment
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is relative and needs adjustment
 */
function needsSubdomainAdjustment(url) {
  return url && url.startsWith('/');
}

/**
 * Get base domain without subdomain
 * @param {string} hostname - Full hostname
 * @returns {string} Base domain
 */
function getBaseDomain(hostname) {
  const host = hostname.split(':')[0]; // Remove port
  const parts = host.split('.');
  
  // If it's a local domain, return as is
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'lvh.me'; // Use lvh.me for local development
  }
  
  // If it has subdomain (3+ parts), remove first part
  if (parts.length > 2) {
    return parts.slice(1).join('.');
  }
  
  return host;
}

/**
 * Check if running in local development
 * @param {string} hostname - Hostname to check
 * @returns {boolean} True if local development
 */
function isLocalDevelopment(hostname) {
  const host = hostname.split(':')[0];
  return host === 'localhost' || 
         host === '127.0.0.1' || 
         host.includes('lvh.me');
}

/**
 * Check if running on Render platform
 * @param {string} hostname - Hostname to check
 * @returns {boolean} True if on Render
 */
function isRenderDeployment(hostname) {
  return hostname.includes('onrender.com');
}

module.exports = {
  buildTenantUrl,
  needsSubdomainAdjustment,
  getBaseDomain,
  isLocalDevelopment,
  isRenderDeployment
};