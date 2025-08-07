const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');

// Mock Prisma client
const mockPrisma = {
  tenant: {
    findFirst: jest.fn(),
    findUnique: jest.fn()
  },
  merchant: {
    findUnique: jest.fn()
  },
  tenantUser: {
    findUnique: jest.fn()
  }
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Mock local domain functions
const mockTenantResolverLocal = {
  isLocalDomain: jest.fn(),
  extractSubdomainLocal: jest.fn()
};

// Mock modules before importing
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma)
}));

jest.mock('../../server/utils/logger', () => mockLogger);
jest.mock('../../server/middleware/tenantResolver.local', () => mockTenantResolverLocal);

// Import the module after mocking
const { 
  resolveTenant, 
  ensureTenant, 
  validateTenantUser,
  applyTenantFilter 
} = require('../../server/middleware/tenantResolver');

describe('Tenant Resolver Middleware Tests', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock request object
    mockReq = {
      hostname: 'demo.lvh.me',
      get: jest.fn().mockReturnValue('demo.lvh.me:3000'),
      session: {},
      user: null,
      tenant: null,
      tenantId: null,
      isBackOffice: false,
      isApiEndpoint: false,
      headers: {},
      query: {}
    };

    // Setup mock response object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      render: jest.fn().mockReturnThis(),
      locals: {}
    };

    // Setup mock next function
    mockNext = jest.fn();
  });

  describe('resolveTenant', () => {
    
    describe('Local Development Environment', () => {
      
      beforeEach(() => {
        mockTenantResolverLocal.isLocalDomain.mockReturnValue(true);
      });

      it('should resolve tenant from local subdomain', async () => {
        const mockTenant = {
          id: 'tenant-123',
          name: 'Demo Tenant',
          slug: 'demo',
          isActive: true,
          subscription: { status: 'active' }
        };

        mockTenantResolverLocal.extractSubdomainLocal.mockReturnValue('demo');
        mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);

        await resolveTenant(mockReq, mockRes, mockNext);

        expect(mockTenantResolverLocal.extractSubdomainLocal).toHaveBeenCalledWith('demo.lvh.me');
        expect(mockPrisma.tenant.findFirst).toHaveBeenCalledWith({
          where: {
            OR: [
              { slug: 'demo' },
              { domain: 'demo.lvh.me' }
            ],
            isActive: true
          },
          include: {
            subscription: true
          }
        });
        expect(mockReq.tenant).toBe(mockTenant);
        expect(mockReq.tenantId).toBe('tenant-123');
        expect(mockReq.session.tenantId).toBe('tenant-123');
        expect(mockReq.session.tenantSlug).toBe('demo');
        expect(mockRes.locals.tenant).toBe(mockTenant);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should handle admin subdomain for BackOffice', async () => {
        mockTenantResolverLocal.extractSubdomainLocal.mockReturnValue('admin');

        await resolveTenant(mockReq, mockRes, mockNext);

        expect(mockReq.isBackOffice).toBe(true);
        expect(mockReq.tenant).toBeNull();
        expect(mockReq.tenantId).toBeNull();
        expect(mockNext).toHaveBeenCalled();
        expect(mockPrisma.tenant.findFirst).not.toHaveBeenCalled();
      });

      it('should handle API subdomain', async () => {
        mockTenantResolverLocal.extractSubdomainLocal.mockReturnValue('api');
        mockReq.headers['x-tenant-id'] = 'tenant-123';

        const mockTenant = {
          id: 'tenant-123',
          name: 'API Tenant',
          isActive: true
        };

        mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);

        await resolveTenant(mockReq, mockRes, mockNext);

        expect(mockReq.isApiEndpoint).toBe(true);
        expect(mockReq.tenant).toBe(mockTenant);
        expect(mockReq.tenantId).toBe('tenant-123');
        expect(mockNext).toHaveBeenCalled();
      });

      it('should return 400 for API requests without tenant ID', async () => {
        mockTenantResolverLocal.extractSubdomainLocal.mockReturnValue('api');

        await resolveTenant(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Tenant ID required for API requests'
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should handle bare localhost with default tenant', async () => {
        mockReq.hostname = 'localhost';
        mockTenantResolverLocal.extractSubdomainLocal.mockReturnValue(null);

        const mockTenant = {
          id: 'default-tenant',
          name: 'Default Tenant',
          isActive: true
        };

        mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);

        await resolveTenant(mockReq, mockRes, mockNext);

        expect(mockReq.tenant).toBe(mockTenant);
        expect(mockReq.tenantId).toBe('default-tenant');
        expect(mockNext).toHaveBeenCalled();
      });

      it('should show no-subdomain error when no subdomain provided', async () => {
        mockTenantResolverLocal.extractSubdomainLocal.mockReturnValue(null);
        mockPrisma.tenant.findFirst.mockResolvedValue(null);

        await resolveTenant(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.render).toHaveBeenCalledWith('errors/no-subdomain', {
          message: 'Please access the system through your organization\'s subdomain',
          devMessage: 'Try using admin.lvh.me:3000 for BackOffice or demo.lvh.me:3000 for demo tenant'
        });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('Production Environment', () => {
      
      beforeEach(() => {
        mockTenantResolverLocal.isLocalDomain.mockReturnValue(false);
      });

      it('should resolve tenant from production subdomain', async () => {
        mockReq.hostname = 'demo.storehubqms.com';
        mockReq.get.mockReturnValue('demo.storehubqms.com');

        const mockTenant = {
          id: 'tenant-123',
          name: 'Demo Tenant',
          slug: 'demo',
          isActive: true,
          subscription: { status: 'active' }
        };

        mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);

        await resolveTenant(mockReq, mockRes, mockNext);

        expect(mockPrisma.tenant.findFirst).toHaveBeenCalledWith({
          where: {
            OR: [
              { slug: 'demo' },
              { domain: 'demo.storehubqms.com' }
            ],
            isActive: true
          },
          include: {
            subscription: true
          }
        });
        expect(mockReq.tenant).toBe(mockTenant);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should show no-subdomain error for apex domain', async () => {
        mockReq.hostname = 'storehubqms.com';
        mockReq.get.mockReturnValue('storehubqms.com');

        await resolveTenant(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.render).toHaveBeenCalledWith('errors/no-subdomain', {
          message: 'Please access the system through your organization\'s subdomain'
        });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      
      beforeEach(() => {
        mockTenantResolverLocal.isLocalDomain.mockReturnValue(true);
        mockTenantResolverLocal.extractSubdomainLocal.mockReturnValue('demo');
      });

      it('should show tenant-not-found error when tenant not found', async () => {
        mockPrisma.tenant.findFirst.mockResolvedValue(null);

        await resolveTenant(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.render).toHaveBeenCalledWith('errors/tenant-not-found', {
          message: 'Organization not found',
          subdomain: 'demo'
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should show subscription-inactive error when subscription inactive', async () => {
        const mockTenant = {
          id: 'tenant-123',
          name: 'Demo Tenant',
          slug: 'demo',
          isActive: true,
          subscription: { status: 'inactive' }
        };

        mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);

        await resolveTenant(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.render).toHaveBeenCalledWith('errors/subscription-inactive', {
          message: 'Your subscription is currently inactive',
          tenant: mockTenant
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should handle database errors gracefully', async () => {
        mockPrisma.tenant.findFirst.mockRejectedValue(new Error('Database connection failed'));

        await resolveTenant(mockReq, mockRes, mockNext);

        expect(mockLogger.error).toHaveBeenCalledWith('Error resolving tenant:', expect.any(Error));
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.render).toHaveBeenCalledWith('errors/server-error', {
          message: 'Error loading organization data'
        });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });
  });

  describe('ensureTenant', () => {
    
    it('should allow access when tenantId exists', () => {
      mockReq.tenantId = 'tenant-123';

      ensureTenant(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow access for BackOffice', () => {
      mockReq.isBackOffice = true;
      mockReq.tenantId = null;

      ensureTenant(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 403 when tenant context missing', () => {
      mockReq.tenantId = null;
      mockReq.isBackOffice = false;

      ensureTenant(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Tenant context required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateTenantUser', () => {
    
    it('should allow access for BackOffice users', async () => {
      mockReq.isBackOffice = true;

      await validateTenantUser(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 when user not authenticated', async () => {
      mockReq.user = null;
      mockReq.tenantId = 'tenant-123';

      await validateTenantUser(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate merchant tenant assignment', async () => {
      const mockMerchant = {
        id: 'merchant-123',
        tenantId: 'tenant-123'
      };

      mockReq.user = { merchantId: 'merchant-123' };
      mockReq.tenantId = 'tenant-123';
      mockPrisma.merchant.findUnique.mockResolvedValue(mockMerchant);

      await validateTenantUser(mockReq, mockRes, mockNext);

      expect(mockPrisma.merchant.findUnique).toHaveBeenCalledWith({
        where: { id: 'merchant-123' }
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject merchant with wrong tenant assignment', async () => {
      const mockMerchant = {
        id: 'merchant-123',
        tenantId: 'other-tenant-123'
      };

      mockReq.user = { merchantId: 'merchant-123' };
      mockReq.tenantId = 'tenant-123';
      mockPrisma.merchant.findUnique.mockResolvedValue(mockMerchant);

      await validateTenantUser(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Access denied to this organization'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate tenant user assignment', async () => {
      const mockTenantUser = {
        id: 'tenant-user-123',
        tenantId: 'tenant-123'
      };

      mockReq.user = { tenantUserId: 'tenant-user-123' };
      mockReq.tenantId = 'tenant-123';
      mockPrisma.tenantUser.findUnique.mockResolvedValue(mockTenantUser);

      await validateTenantUser(mockReq, mockRes, mockNext);

      expect(mockPrisma.tenantUser.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-user-123' }
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject tenant user with wrong tenant assignment', async () => {
      const mockTenantUser = {
        id: 'tenant-user-123',
        tenantId: 'other-tenant-123'
      };

      mockReq.user = { tenantUserId: 'tenant-user-123' };
      mockReq.tenantId = 'tenant-123';
      mockPrisma.tenantUser.findUnique.mockResolvedValue(mockTenantUser);

      await validateTenantUser(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Access denied to this organization'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 for invalid user context', async () => {
      mockReq.user = { id: 'user-123' }; // No merchantId or tenantUserId
      mockReq.tenantId = 'tenant-123';

      await validateTenantUser(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid user context'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('applyTenantFilter', () => {
    
    it('should add tenantId filter when tenantId exists', () => {
      mockReq.tenantId = 'tenant-123';
      const where = { name: 'test' };

      const result = applyTenantFilter(mockReq, where);

      expect(result).toEqual({
        name: 'test',
        tenantId: 'tenant-123'
      });
    });

    it('should preserve existing where clause without tenantId', () => {
      mockReq.tenantId = null;
      const where = { merchantId: 'merchant-123' };

      const result = applyTenantFilter(mockReq, where);

      expect(result).toEqual({
        merchantId: 'merchant-123'
      });
    });

    it('should add merchantId filter for backward compatibility', () => {
      mockReq.tenantId = null;
      mockReq.user = { merchantId: 'merchant-123' };
      const where = { name: 'test' };

      const result = applyTenantFilter(mockReq, where);

      expect(result).toEqual({
        name: 'test',
        merchantId: 'merchant-123'
      });
    });

    it('should return original where clause when no filters apply', () => {
      mockReq.tenantId = null;
      mockReq.user = null;
      const where = { name: 'test' };

      const result = applyTenantFilter(mockReq, where);

      expect(result).toEqual({
        name: 'test'
      });
    });
  });

  describe('Multi-tenant Isolation Tests', () => {
    
    it('should enforce strict tenant isolation', async () => {
      const mockTenant = {
        id: 'tenant-123',
        slug: 'demo',
        isActive: true,
        subscription: { status: 'active' }
      };

      mockTenantResolverLocal.isLocalDomain.mockReturnValue(true);
      mockTenantResolverLocal.extractSubdomainLocal.mockReturnValue('demo');
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);

      await resolveTenant(mockReq, mockRes, mockNext);

      // Verify tenant context is properly set
      expect(mockReq.tenant).toBe(mockTenant);
      expect(mockReq.tenantId).toBe('tenant-123');
      expect(mockReq.session.tenantId).toBe('tenant-123');
      expect(mockReq.session.tenantSlug).toBe('demo');

      // Verify tenant filter application
      const filter = applyTenantFilter(mockReq, {});
      expect(filter.tenantId).toBe('tenant-123');
    });

    it('should handle cross-tenant access attempts', async () => {
      const mockMerchant = {
        id: 'merchant-123',
        tenantId: 'other-tenant-456'
      };

      mockReq.user = { merchantId: 'merchant-123' };
      mockReq.tenantId = 'tenant-123';
      mockPrisma.merchant.findUnique.mockResolvedValue(mockMerchant);

      await validateTenantUser(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Access denied to this organization'
      });
    });
  });

  describe('Edge Cases and Security', () => {
    
    it('should handle malformed hostnames', async () => {
      mockReq.hostname = '';
      mockReq.get.mockReturnValue('');
      mockTenantResolverLocal.isLocalDomain.mockReturnValue(false);

      await resolveTenant(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should handle missing session object', async () => {
      const mockTenant = {
        id: 'tenant-123',
        slug: 'demo',
        isActive: true
      };

      mockReq.session = null;
      mockTenantResolverLocal.isLocalDomain.mockReturnValue(true);
      mockTenantResolverLocal.extractSubdomainLocal.mockReturnValue('demo');
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);

      await resolveTenant(mockReq, mockRes, mockNext);

      expect(mockReq.tenant).toBe(mockTenant);
      expect(mockReq.tenantId).toBe('tenant-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle database connection failures', async () => {
      mockTenantResolverLocal.isLocalDomain.mockReturnValue(true);
      mockTenantResolverLocal.extractSubdomainLocal.mockReturnValue('demo');
      mockPrisma.tenant.findFirst.mockRejectedValue(new Error('Connection timeout'));

      await resolveTenant(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.render).toHaveBeenCalledWith('errors/server-error', {
        message: 'Error loading organization data'
      });
    });
  });
});