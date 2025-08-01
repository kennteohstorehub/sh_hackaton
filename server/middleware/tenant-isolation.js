const { PrismaClient } = require('@prisma/client');

/**
 * Comprehensive Tenant Isolation Middleware
 * Ensures complete data security between tenants in a multi-tenant system
 * 
 * Features:
 * - Automatic tenant resolution from domain/subdomain/header
 * - Row-level security enforcement
 * - Cross-tenant access prevention
 * - Audit logging for security events
 * - Backward compatibility with single-tenant mode
 */

// Singleton Prisma client for database operations
let prisma;
if (!global.prisma) {
  global.prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error']
  });
}
prisma = global.prisma;

/**
 * Security Event Logger
 * Logs all tenant-related security events for audit trails
 */
class TenantSecurityLogger {
  static extractSafeRequestInfo(req) {
    if (!req) return {};
    
    return {
      method: req.method,
      path: req.path,
      userAgent: req.get?.('User-Agent'),
      ip: req.ip || req.connection?.remoteAddress,
      sessionId: req.sessionID,
      userId: req.user?.id,
      merchantId: req.merchantId
    };
  }

  static log(level, event, details = {}) {
    const timestamp = new Date().toISOString();
    
    // Extract safe request info if req is passed
    const safeDetails = { ...details };
    if (details.req) {
      safeDetails.request = this.extractSafeRequestInfo(details.req);
      delete safeDetails.req;
    }
    
    const logEntry = {
      timestamp,
      level,
      event,
      ...safeDetails
    };

    // Log to console in development, should integrate with proper logging service in production
    console.log(`[TENANT_SECURITY_${level.toUpperCase()}]`, JSON.stringify(logEntry));

    // Store critical security events in database
    if (level === 'CRITICAL' || level === 'ERROR') {
      this.storeCriticalEvent(logEntry).catch(err => {
        console.error('Failed to store critical security event:', err);
      });
    }
  }

  static async storeCriticalEvent(logEntry) {
    try {
      await prisma.superAdminAuditLog.create({
        data: {
          action: logEntry.event,
          resourceType: 'tenant_security',
          details: JSON.stringify({
            level: logEntry.level,
            ...logEntry
          }),
          timestamp: new Date(logEntry.timestamp),
          userId: logEntry.userId || null,
          merchantId: logEntry.merchantId || null
        }
      });
    } catch (error) {
      console.error('Database logging failed:', error);
    }
  }

  static info(event, details) { this.log('INFO', event, details); }
  static warn(event, details) { this.log('WARNING', event, details); }
  static error(event, details) { this.log('ERROR', event, details); }
  static critical(event, details) { this.log('CRITICAL', event, details); }
}

/**
 * Tenant Resolution Service
 * Determines the current tenant from request context
 */
class TenantResolver {
  /**
   * Resolve tenant from various sources in priority order:
   * 1. Explicit tenant header (X-Tenant-ID)
   * 2. Subdomain (tenant.yourdomain.com)
   * 3. Domain mapping (custom.domain.com → tenant)
   * 4. Session tenant context
   * 5. Single-tenant fallback (backward compatibility)
   */
  static async resolve(req) {
    try {
      let tenantId = null;
      let tenantSlug = null;
      let tenant = null;

      // Method 1: Explicit tenant header (for API clients)
      // Security: Only allow if no authenticated user or if user belongs to specified tenant
      if (req.headers['x-tenant-id']) {
        tenantId = req.headers['x-tenant-id'];
        
        // If user is authenticated, validate they belong to the requested tenant
        if (req.user && req.user.tenantId && req.user.tenantId !== tenantId) {
          TenantSecurityLogger.critical('CROSS_TENANT_HEADER_ATTEMPT', {
            req,
            attemptedTenantId: tenantId,
            userTenantId: req.user.tenantId,
            method: 'header'
          });
          // Ignore the header and use the user's actual tenant
          tenantId = req.user.tenantId;
        } else {
          TenantSecurityLogger.info('TENANT_RESOLVED_BY_HEADER', {
            req,
            tenantId,
            method: 'header'
          });
        }
      }

      // Method 2: Subdomain resolution
      else if (req.subdomains && req.subdomains.length > 0) {
        tenantSlug = req.subdomains[req.subdomains.length - 1]; // Get first subdomain
        TenantSecurityLogger.info('TENANT_RESOLVED_BY_SUBDOMAIN', {
          req,
          tenantSlug,
          subdomains: req.subdomains,
          method: 'subdomain'
        });
      }

      // Method 3: Domain mapping
      else if (req.hostname) {
        const domainMapping = await this.findTenantByDomain(req.hostname);
        if (domainMapping) {
          tenant = domainMapping;
          TenantSecurityLogger.info('TENANT_RESOLVED_BY_DOMAIN', {
            req,
            domain: req.hostname,
            tenantId: tenant.id,
            method: 'domain'
          });
        }
      }

      // Fetch tenant by ID or slug if not already resolved
      if (!tenant && (tenantId || tenantSlug)) {
        tenant = await this.fetchTenant(tenantId, tenantSlug);
      }

      // Method 4: Check authenticated merchant's tenant
      if (!tenant && req.user && req.user.tenantId) {
        tenant = await this.fetchTenant(req.user.tenantId, null);
        if (tenant) {
          TenantSecurityLogger.info('TENANT_RESOLVED_BY_MERCHANT', {
            req,
            tenantId: tenant.id,
            merchantId: req.user.id,
            method: 'merchant'
          });
        }
      }

      // Method 5: Single-tenant fallback for backward compatibility
      if (!tenant) {
        tenant = await this.getSingleTenantFallback();
        if (tenant) {
          TenantSecurityLogger.info('TENANT_RESOLVED_BY_FALLBACK', {
            req,
            tenantId: tenant.id,
            method: 'fallback'
          });
        }
      }

      // Validate tenant is active
      if (tenant && !tenant.isActive) {
        TenantSecurityLogger.critical('INACTIVE_TENANT_ACCESS_ATTEMPT', {
          req,
          tenantId: tenant.id,
          tenantSlug: tenant.slug
        });
        throw new Error('TENANT_INACTIVE');
      }

      return tenant;
    } catch (error) {
      TenantSecurityLogger.error('TENANT_RESOLUTION_FAILED', {
        req,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  static async findTenantByDomain(domain) {
    try {
      const tenant = await prisma.tenant.findFirst({
        where: { domain: domain, isActive: true }
      });
      return tenant;
    } catch (error) {
      TenantSecurityLogger.error('DOMAIN_TENANT_LOOKUP_FAILED', {
        domain,
        error: error.message
      });
      return null;
    }
  }

  static async fetchTenant(tenantId, tenantSlug) {
    try {
      const where = tenantId 
        ? { id: tenantId, isActive: true }
        : { slug: tenantSlug, isActive: true };
      
      const tenant = await prisma.tenant.findFirst({ where });
      return tenant;
    } catch (error) {
      TenantSecurityLogger.error('TENANT_FETCH_FAILED', {
        tenantId,
        tenantSlug,
        error: error.message
      });
      return null;
    }
  }

  static async getSingleTenantFallback() {
    try {
      // In single-tenant mode, return the first active tenant
      const tenant = await prisma.tenant.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' }
      });
      return tenant;
    } catch (error) {
      TenantSecurityLogger.warn('SINGLE_TENANT_FALLBACK_FAILED', {
        error: error.message
      });
      return null;
    }
  }
}

/**
 * Tenant Context Validator
 * Validates user-tenant relationships and prevents cross-tenant access
 */
class TenantValidator {
  /**
   * Validate that the authenticated user belongs to the resolved tenant
   */
  static async validateUserTenantAccess(user, tenant, req) {
    if (!user || !tenant) {
      TenantSecurityLogger.critical('MISSING_USER_OR_TENANT_CONTEXT', {
        req,
        hasUser: !!user,
        hasTenant: !!tenant,
        userId: user?.id,
        tenantId: tenant?.id
      });
      return false;
    }

    try {
      // Check if user has access to this tenant
      const tenantUser = await prisma.tenantUser.findFirst({
        where: {
          userId: user.id,
          tenantId: tenant.id,
          isActive: true
        }
      });

      if (!tenantUser) {
        TenantSecurityLogger.critical('CROSS_TENANT_ACCESS_ATTEMPT', {
          req,
          userId: user.id,
          userEmail: user.email,
          attemptedTenantId: tenant.id,
          attemptedTenantSlug: tenant.slug
        });
        return false;
      }

      TenantSecurityLogger.info('VALID_TENANT_ACCESS', {
        req,
        userId: user.id,
        tenantId: tenant.id,
        role: tenantUser.role
      });

      return true;
    } catch (error) {
      TenantSecurityLogger.error('TENANT_VALIDATION_ERROR', {
        req,
        userId: user?.id,
        tenantId: tenant?.id,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Validate merchant belongs to the current tenant
   */
  static async validateMerchantTenantAccess(merchantId, tenant, req) {
    if (!merchantId || !tenant) {
      return false;
    }

    try {
      const merchant = await prisma.merchant.findFirst({
        where: {
          id: merchantId,
          OR: [
            { tenantId: tenant.id },
            { tenantId: null } // Backward compatibility for legacy merchants
          ]
        }
      });

      if (!merchant) {
        TenantSecurityLogger.critical('CROSS_TENANT_MERCHANT_ACCESS_ATTEMPT', {
          req,
          merchantId,
          tenantId: tenant.id
        });
        return false;
      }

      // Log warning for legacy merchants without tenant assignment
      if (!merchant.tenantId) {
        TenantSecurityLogger.warn('LEGACY_MERCHANT_ACCESS', {
          req,
          merchantId,
          message: 'Merchant accessed without tenant assignment - backward compatibility mode'
        });
      }

      return true;
    } catch (error) {
      TenantSecurityLogger.error('MERCHANT_TENANT_VALIDATION_ERROR', {
        req,
        merchantId,
        tenantId: tenant?.id,
        error: error.message
      });
      return false;
    }
  }
}

/**
 * Main Tenant Isolation Middleware
 * Establishes tenant context and enforces tenant boundaries for all requests
 */
const tenantIsolationMiddleware = async (req, res, next) => {
  try {
    // Skip tenant isolation for public routes or health checks
    if (req.path.startsWith('/health') || req.path.startsWith('/public')) {
      return next();
    }

    // Resolve tenant from request context
    const tenant = await TenantResolver.resolve(req);
    
    if (!tenant) {
      TenantSecurityLogger.error('TENANT_RESOLUTION_FAILED', {
        req,
        path: req.path,
        method: req.method
      });
      return res.status(400).json({
        error: 'Tenant not found',
        code: 'TENANT_NOT_FOUND'
      });
    }

    // Attach tenant context to request
    req.tenant = tenant;
    req.tenantId = tenant.id;

    // For authenticated routes, validate user-tenant relationship
    if (req.user && req.user.id) {
      // Check if this is a merchant user (has businessName property)
      if (req.user.businessName) {
        // Validate merchant access
        const hasAccess = await TenantValidator.validateMerchantTenantAccess(req.user.id, tenant, req);
        
        if (!hasAccess) {
          TenantSecurityLogger.critical('UNAUTHORIZED_TENANT_ACCESS_BLOCKED', {
            req,
            merchantId: req.user.id,
            tenantId: tenant.id,
            path: req.path,
            method: req.method
          });
          
          return res.status(403).json({
            error: 'Access denied to tenant resources',
            code: 'TENANT_ACCESS_DENIED'
          });
        }
      } else {
        // Validate tenant user access
        const hasAccess = await TenantValidator.validateUserTenantAccess(req.user, tenant, req);
        
        if (!hasAccess) {
          TenantSecurityLogger.critical('UNAUTHORIZED_TENANT_ACCESS_BLOCKED', {
            req,
            userId: req.user.id,
            tenantId: tenant.id,
            path: req.path,
            method: req.method
          });
          
          return res.status(403).json({
            error: 'Access denied to tenant resources',
            code: 'TENANT_ACCESS_DENIED'
          });
        }
      }
    }

    TenantSecurityLogger.info('TENANT_CONTEXT_ESTABLISHED', {
      req,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      userId: req.user?.id
    });

    next();
  } catch (error) {
    TenantSecurityLogger.critical('TENANT_MIDDLEWARE_ERROR', {
      error: error.message,
      stack: error.stack
    });

    // Don't expose internal errors to client
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Middleware to validate merchant access within tenant context
 * Use this after tenantIsolationMiddleware for merchant-specific routes
 */
const validateMerchantAccess = async (req, res, next) => {
  try {
    const merchantId = req.params.merchantId || req.body.merchantId || req.user?.id;
    
    if (!merchantId) {
      return res.status(400).json({
        error: 'Merchant ID required',
        code: 'MERCHANT_ID_REQUIRED'
      });
    }

    const hasAccess = await TenantValidator.validateMerchantTenantAccess(
      merchantId, 
      req.tenant, 
      req
    );

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied to merchant resources',
        code: 'MERCHANT_ACCESS_DENIED'
      });
    }

    req.merchantId = merchantId;
    next();
  } catch (error) {
    TenantSecurityLogger.error('MERCHANT_ACCESS_VALIDATION_ERROR', {
      req,
      error: error.message
    });

    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Database Query Interceptor
 * Automatically injects tenant filters into Prisma queries
 */
class TenantAwarePrisma {
  constructor(tenantId) {
    this.tenantId = tenantId;
    this.prisma = global.prisma;
  }

  /**
   * Create tenant-aware Prisma client that automatically filters by tenant
   */
  static create(tenantId) {
    const client = new TenantAwarePrisma(tenantId);
    
    // Override common Prisma methods to inject tenant filtering
    return new Proxy(client.prisma, {
      get(target, prop) {
        if (prop === 'merchant') {
          return client.createTenantAwareMerchantClient();
        }
        if (prop === 'queue') {
          return client.createTenantAwareQueueClient();
        }
        if (prop === 'queueEntry') {
          return client.createTenantAwareQueueEntryClient();
        }
        
        return target[prop];
      }
    });
  }

  createTenantAwareMerchantClient() {
    const self = this;
    return new Proxy(this.prisma.merchant, {
      get(target, prop) {
        if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'].includes(prop)) {
          return function(args = {}) {
            // Inject tenant filter
            args.where = {
              ...args.where,
              OR: [
                { tenantId: self.tenantId },
                { tenantId: null } // Backward compatibility
              ]
            };
            
            TenantSecurityLogger.info('TENANT_FILTERED_MERCHANT_QUERY', {
              tenantId: self.tenantId,
              operation: prop,
              where: args.where
            });
            
            return target[prop](args);
          };
        }
        
        if (['create', 'update', 'upsert'].includes(prop)) {
          return function(args = {}) {
            // Inject tenant ID for create/update operations
            if (args.data && self.tenantId) {
              args.data.tenantId = self.tenantId;
            }
            
            TenantSecurityLogger.info('TENANT_SCOPED_MERCHANT_MUTATION', {
              tenantId: self.tenantId,
              operation: prop
            });
            
            return target[prop](args);
          };
        }
        
        return target[prop];
      }
    });
  }

  createTenantAwareQueueClient() {
    const self = this;
    return new Proxy(this.prisma.queue, {
      get(target, prop) {
        if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'].includes(prop)) {
          return function(args = {}) {
            // Inject tenant filter through merchant relationship
            args.where = {
              ...args.where,
              merchant: {
                ...args.where?.merchant,
                OR: [
                  { tenantId: self.tenantId },
                  { tenantId: null } // Backward compatibility
                ]
              }
            };
            
            TenantSecurityLogger.info('TENANT_FILTERED_QUEUE_QUERY', {
              tenantId: self.tenantId,
              operation: prop,
              where: args.where
            });
            
            return target[prop](args);
          };
        }
        
        return target[prop];
      }
    });
  }

  createTenantAwareQueueEntryClient() {
    const self = this;
    return new Proxy(this.prisma.queueEntry, {
      get(target, prop) {
        if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'].includes(prop)) {
          return function(args = {}) {
            // Inject tenant filter through queue -> merchant relationship
            args.where = {
              ...args.where,
              queue: {
                ...args.where?.queue,
                merchant: {
                  ...args.where?.queue?.merchant,
                  OR: [
                    { tenantId: self.tenantId },
                    { tenantId: null } // Backward compatibility
                  ]
                }
              }
            };
            
            TenantSecurityLogger.info('TENANT_FILTERED_QUEUE_ENTRY_QUERY', {
              tenantId: self.tenantId,
              operation: prop,
              where: args.where
            });
            
            return target[prop](args);
          };
        }
        
        return target[prop];
      }
    });
  }
}

module.exports = {
  tenantIsolationMiddleware,
  validateMerchantAccess,
  TenantAwarePrisma,
  TenantSecurityLogger,
  TenantResolver,
  TenantValidator
};