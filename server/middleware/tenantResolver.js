const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../utils/logger');
const { isLocalDomain, extractSubdomainLocal } = require('./tenantResolver.local');

/**
 * Middleware to resolve tenant from subdomain
 * Extracts tenant information from the request hostname and sets it on the request object
 */
async function resolveTenant(req, res, next) {
  try {
    const hostname = req.hostname || req.get('host').split(':')[0];
    logger.info(`Resolving tenant for hostname: ${hostname}`);
    
    // Check if this is a public route that doesn't require tenant resolution
    const publicPaths = ['/register', '/auth/login', '/auth/logout', '/terms', '/privacy', '/', '/help', '/contact', '/features'];
    const isPublicPath = publicPaths.some(path => req.path === path || req.path.startsWith('/register/'));
    
    // For Render deployment or single domain setup without subdomains
    const isRenderDeployment = hostname.includes('onrender.com');
    
    if (isPublicPath || isRenderDeployment) {
      // Check if this is a backoffice route
      if (req.path.startsWith('/backoffice')) {
        logger.info(`BackOffice access via ${hostname}`);
        req.isBackOffice = true;
        req.tenant = null;
        req.tenantId = null;
        return next();
      }
      
      // For public paths or Render deployment, skip tenant resolution
      if (isPublicPath) {
        logger.info(`Public path accessed: ${req.path}`);
        req.tenant = null;
        req.tenantId = null;
        return next();
      }
    }
    
    let subdomain = null;
    let isLocalDev = false;
    
    // Check if this is a local development domain
    if (isLocalDomain(hostname)) {
      isLocalDev = true;
      subdomain = extractSubdomainLocal(hostname);
      logger.info(`Local development - extracted subdomain: ${subdomain}`);
      
      // If no subdomain in local development, handle gracefully
      if (!subdomain) {
        // Check if this is a backoffice route first
        if (req.path.startsWith('/backoffice')) {
          logger.info(`BackOffice access via ${hostname}`);
          req.isBackOffice = true;
          req.tenant = null;
          req.tenantId = null;
          return next();
        }
        
        // For bare localhost/lvh.me, check if we should use a default tenant
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'lvh.me') {
          const testTenant = await prisma.tenant.findFirst({
            where: { isActive: true }
          });
          
          if (testTenant) {
            logger.info(`Using default tenant for ${hostname}: ${testTenant.name}`);
            req.tenant = testTenant;
            req.tenantId = testTenant.id;
            return next();
          }
        }
        
        // Show helpful development page
        return res.status(404).render('errors/no-subdomain', {
          message: 'Please access the system through your organization\'s subdomain',
          devMessage: isLocalDev ? 'Try using admin.lvh.me:3000 for BackOffice or demo.lvh.me:3000 for demo tenant' : null
        });
      }
    } else {
      // Production subdomain extraction
      const parts = hostname.split('.');
      
      // For Render deployment, allow access without subdomain for public routes
      if (hostname.includes('onrender.com')) {
        // Check if trying to access dashboard without tenant
        if (req.path.startsWith('/dashboard') || req.path.startsWith('/queue')) {
          // Try to find a demo tenant for Render deployment
          const demoTenant = await prisma.tenant.findFirst({
            where: { 
              OR: [
                { slug: 'demo' },
                { isActive: true }
              ]
            }
          });
          
          if (demoTenant) {
            req.tenant = demoTenant;
            req.tenantId = demoTenant.id;
            return next();
          }
          
          return res.status(404).render('errors/no-subdomain', {
            message: 'Please register your organization first',
            registerUrl: '/register'
          });
        }
        
        // Allow other paths to proceed without tenant
        req.tenant = null;
        req.tenantId = null;
        return next();
      }
      
      // Check if this is a subdomain request (need at least 3 parts: sub.domain.tld)
      if (parts.length < 3) {
        // Not a subdomain (e.g., storehubqms.com)
        // Allow public paths without subdomain
        if (isPublicPath) {
          req.tenant = null;
          req.tenantId = null;
          return next();
        }
        
        return res.status(404).render('errors/no-subdomain', {
          message: 'Please access the system through your organization\'s subdomain'
        });
      }
      
      subdomain = parts[0];
      logger.info(`Production - extracted subdomain: ${subdomain}`);
    }
    
    // Special handling for BackOffice portal
    // Check if this is a backoffice route (regardless of subdomain)
    if (subdomain === 'admin' || req.path.startsWith('/backoffice')) {
      req.isBackOffice = true;
      req.tenant = null;
      req.tenantId = null;
      return next();
    }
    
    // Special handling for API subdomain
    if (subdomain === 'api') {
      req.isApiEndpoint = true;
      // API requests should include tenant ID in headers or auth token
      const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
      
      if (tenantId) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId, isActive: true }
        });
        
        if (tenant) {
          req.tenant = tenant;
          req.tenantId = tenant.id;
          return next();
        }
      }
      
      return res.status(400).json({
        error: 'Tenant ID required for API requests'
      });
    }
    
    // Resolve tenant from subdomain
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: subdomain },
          { domain: hostname }
        ],
        isActive: true
      },
      include: {
        subscription: true
      }
    });
    
    if (!tenant) {
      logger.warn(`Tenant not found for subdomain: ${subdomain}`);
      return res.status(404).render('errors/tenant-not-found', {
        message: 'Organization not found',
        subdomain
      });
    }
    
    // Check if tenant subscription is active
    if (tenant.subscription && tenant.subscription.status !== 'active') {
      logger.warn(`Tenant ${tenant.id} has inactive subscription`);
      return res.status(403).render('errors/subscription-inactive', {
        message: 'Your subscription is currently inactive',
        tenant
      });
    }
    
    // Set tenant context on request
    req.tenant = tenant;
    req.tenantId = tenant.id;
    
    // Set tenant context in session if available
    if (req.session) {
      req.session.tenantId = tenant.id;
      req.session.tenantSlug = tenant.slug;
    }
    
    // Set tenant info in response locals for views
    res.locals.tenant = tenant;
    res.locals.tenantId = tenant.id;
    
    logger.info(`Tenant resolved: ${tenant.name} (${tenant.id})`);
    next();
  } catch (error) {
    logger.error('Error resolving tenant:', error);
    res.status(500).render('errors/server-error', {
      message: 'Error loading organization data'
    });
  }
}

/**
 * Middleware to ensure tenant context is available
 * Use this after authentication to ensure user belongs to the tenant
 */
function ensureTenant(req, res, next) {
  if (!req.tenantId && !req.isBackOffice) {
    return res.status(403).json({
      error: 'Tenant context required'
    });
  }
  next();
}

/**
 * Middleware to validate user belongs to tenant
 */
async function validateTenantUser(req, res, next) {
  if (req.isBackOffice) {
    return next();
  }
  
  if (!req.user || !req.tenantId) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }
  
  // For backward compatibility with existing Merchant model
  if (req.user.merchantId) {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.user.merchantId }
    });
    
    if (!merchant || (merchant.tenantId && merchant.tenantId !== req.tenantId)) {
      return res.status(403).json({
        error: 'Access denied to this organization'
      });
    }
    
    return next();
  }
  
  // For TenantUser model
  if (req.user.tenantUserId) {
    const tenantUser = await prisma.tenantUser.findUnique({
      where: { id: req.user.tenantUserId }
    });
    
    if (!tenantUser || tenantUser.tenantId !== req.tenantId) {
      return res.status(403).json({
        error: 'Access denied to this organization'
      });
    }
    
    return next();
  }
  
  return res.status(403).json({
    error: 'Invalid user context'
  });
}

/**
 * Apply tenant filter to Prisma queries
 */
function applyTenantFilter(req, where = {}) {
  if (req.tenantId) {
    // For models with tenantId field
    return { ...where, tenantId: req.tenantId };
  }
  
  // For models with merchant relation (backward compatibility)
  if (where.merchantId) {
    return where;
  }
  
  // If querying through merchant relation
  if (req.user?.merchantId) {
    return { ...where, merchantId: req.user.merchantId };
  }
  
  return where;
}

module.exports = {
  resolveTenant,
  ensureTenant,
  validateTenantUser,
  applyTenantFilter
};