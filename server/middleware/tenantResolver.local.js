const logger = require('../utils/logger');

// Local domain mappings for development
const LOCAL_DOMAINS = [
  'storehubqms.local',
  'lvh.me',
  'localhost'
];

/**
 * Check if hostname is a local development domain
 */
function isLocalDomain(hostname) {
  return LOCAL_DOMAINS.some(domain => 
    hostname.endsWith(domain) || hostname.includes(domain + ':')
  );
}

/**
 * Extract subdomain from local development hostname
 */
function extractSubdomainLocal(hostname) {
  // Remove port if present
  const host = hostname.split(':')[0];
  
  // Check each local domain
  for (const domain of LOCAL_DOMAINS) {
    if (host.endsWith(domain)) {
      const subdomain = host.replace(`.${domain}`, '');
      if (subdomain !== domain) {
        return subdomain;
      }
    }
  }
  
  return null;
}

/**
 * Get base domain for local development
 */
function getLocalBaseDomain(hostname) {
  const host = hostname.split(':')[0];
  
  for (const domain of LOCAL_DOMAINS) {
    if (host.endsWith(domain)) {
      return domain;
    }
  }
  
  return 'localhost';
}

module.exports = {
  isLocalDomain,
  extractSubdomainLocal,
  getLocalBaseDomain,
  LOCAL_DOMAINS
};