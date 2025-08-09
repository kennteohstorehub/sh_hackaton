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
    logger.info(`Resolving tenant for hostname: ${hostname}, path: ${req.path}`);
    
    // Check for path-based tenant routing FIRST (e.g., /t/tenant-slug/...)
    const pathMatch = req.path.match(/^\/t\/([^\/]+)/);
    if (pathMatch) {
      const tenantSlug = pathMatch[1];
      logger.info(`Path-based tenant detected: ${tenantSlug}`);
      
      // Look up tenant by slug
      const tenant = await prisma.tenant.findFirst({
        where: {
          slug: tenantSlug,
          isActive: true
        }
      });
      
      if (tenant) {
        logger.info(`Tenant resolved from path: ${tenant.name}`);
        req.tenant = tenant;
        req.tenantId = tenant.id;
        req.tenantSlug = tenantSlug;
        // Rewrite the path to remove the tenant prefix
        req.url = req.url.replace(`/t/${tenantSlug}`, '');
        req.path = req.path.replace(`/t/${tenantSlug}`, '');
        return next();
      } else {
        logger.warn(`Tenant not found for slug: ${tenantSlug}`);
        return res.status(404).render('errors/tenant-not-found', {
          message: 'Organization not found',
          slug: tenantSlug
        });
      }
    }
    
    // Check if this is a public route that doesn't require tenant resolution
    // Note: '/' is only public for non-subdomain access (localhost, main domain)
    // Auth routes need tenant context when accessed via subdomain
    const publicPaths = ['/register', '/auth/logout', '/terms', '/privacy', '/help', '/contact', '/features'];
    // Add '/' to public paths only if it's not a subdomain request
    const isRootPath = req.path === '/';
    const isAuthPath = req.path.startsWith('/auth/');
    const isPublicPath = publicPaths.some(path => req.path === path || req.path.startsWith('/register/'));
    
    // For Render deployment or single domain setup without subdomains
    const isRenderDeployment = hostname.includes('onrender.com');
    
    // Check if this appears to be a subdomain (for early detection)
    const hasSubdomain = (() => {
      const parts = hostname.split(':')[0].split('.');
      // For local dev: check for subdomain.lvh.me pattern
      if (hostname.includes('lvh.me')) {
        return parts.length > 2 && parts[0] !== 'lvh';
      }
      // For production: 3+ parts means subdomain (sub.domain.com)
      return parts.length >= 3 && !hostname.includes('onrender.com');
    })();
    
    // Special handling for root path - only public if NOT a subdomain
    if (isRootPath && !hasSubdomain) {
      // Root path on main domain (localhost, main domain) is public
      logger.info(`Public root path accessed on main domain: ${hostname}`);
      req.tenant = null;
      req.tenantId = null;
      return next();
    }
    
    if ((isPublicPath && !isRootPath && !hasSubdomain) || (isRenderDeployment && !hasSubdomain)) {
      // Check if this is a backoffice route
      if (req.path.startsWith('/backoffice')) {
        logger.info(`BackOffice access via ${hostname}`);
        req.isBackOffice = true;
        req.tenant = null;
        req.tenantId = null;
        return next();
      }
      
      // For public paths on main domain (not subdomain), skip tenant resolution
      // But auth paths on subdomains should continue to get tenant context
      if (isPublicPath && !isAuthPath) {
        logger.info(`Public path accessed: ${req.path}`);
        req.tenant = null;
        req.tenantId = null;
        return next();
      }
    }
    
    // Special case: Auth paths on subdomains need tenant context
    if (isAuthPath && hasSubdomain) {
      logger.info(`Auth path on subdomain - will resolve tenant: ${req.path}`);
      // Continue to resolve tenant below
    } else if (isAuthPath && !hasSubdomain) {
      // Auth path on main domain - no tenant context needed
      logger.info(`Auth path on main domain - no tenant: ${req.path}`);
      req.tenant = null;
      req.tenantId = null;
      return next();
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