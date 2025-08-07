const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');

// Mock dependencies
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

const mockBackOfficeService = {
  findById: jest.fn(),
  authenticate: jest.fn(),
  logAuditAction: jest.fn()
};

const mockMerchantService = {
  findById: jest.fn(),
  authenticate: jest.fn(),
  findByEmail: jest.fn()
};

// Mock modules
jest.mock('../../server/utils/logger', () => mockLogger);
jest.mock('../../server/services/backOfficeService', () => mockBackOfficeService);
jest.mock('../../server/services/merchantService', () => mockMerchantService);

// Import middleware after mocking
const { 
  requireBackOfficeAuth, 
  requireBackOfficeGuest,
  loadBackOfficeUser,
  ensureBackOfficeSession,
  checkBackOfficeSessionTimeout
} = require('../../server/middleware/backoffice-auth');

const {
  requireAuth,
  requireGuest,
  loadUser,
  ensureTenantSession
} = require('../../server/middleware/auth');

const { resolveTenant } = require('../../server/middleware/tenantResolver');

describe('Authentication Middleware Tests', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock request object
    mockReq = {
      session: {},
      sessionID: 'test-session-id',
      originalUrl: '/test',
      path: '/test',
      hostname: 'demo.lvh.me',
      headers: {},
      xhr: false,
      get: jest.fn().mockReturnValue('demo.lvh.me:3000'),
      ip: '127.0.0.1',
      body: {},
      params: {},
      query: {}
    };

    // Setup mock response object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
      render: jest.fn().mockReturnThis(),
      locals: {}
    };

    // Setup mock next function
    mockNext = jest.fn();
  });

  describe('BackOffice Authentication Middleware', () => {
    
    describe('requireBackOfficeAuth', () => {
      it('should allow access when backOfficeUserId exists in session', () => {
        mockReq.session.backOfficeUserId = 'backoffice-123';
        
        requireBackOfficeAuth(mockReq, mockRes, mockNext);
        
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.redirect).not.toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should redirect to login when backOfficeUserId missing', () => {
        mockReq.session = {};
        
        requireBackOfficeAuth(mockReq, mockRes, mockNext);
        
        expect(mockRes.redirect).toHaveBeenCalledWith('/backoffice/auth/login?redirect=%2Ftest');
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 401 for API requests when unauthorized', () => {
        mockReq.session = {};
        mockReq.originalUrl = '/api/test';
        
        requireBackOfficeAuth(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'BackOffice authentication required' });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 401 for AJAX requests when unauthorized', () => {
        mockReq.session = {};
        mockReq.xhr = true;
        
        requireBackOfficeAuth(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'BackOffice authentication required' });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('requireBackOfficeGuest', () => {
      it('should allow access when not authenticated', () => {
        mockReq.session = {};
        
        requireBackOfficeGuest(mockReq, mockRes, mockNext);
        
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.redirect).not.toHaveBeenCalled();
      });

      it('should redirect to dashboard when already authenticated', () => {
        mockReq.session.backOfficeUserId = 'backoffice-123';
        
        requireBackOfficeGuest(mockReq, mockRes, mockNext);
        
        expect(mockRes.redirect).toHaveBeenCalledWith('/backoffice/dashboard');
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('loadBackOfficeUser', () => {
      it('should load backoffice user data when session exists', async () => {
        const mockBackOfficeUser = {
          id: 'backoffice-123',
          email: 'admin@test.com',
          isActive: true
        };
        
        mockReq.session.backOfficeUserId = 'backoffice-123';
        mockBackOfficeService.findById.mockResolvedValue(mockBackOfficeUser);
        
        await loadBackOfficeUser(mockReq, mockRes, mockNext);
        
        expect(mockBackOfficeService.findById).toHaveBeenCalledWith('backoffice-123');
        expect(mockReq.backOfficeUser).toBe(mockBackOfficeUser);
        expect(mockRes.locals.backOfficeUser).toBe(mockBackOfficeUser);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should clear session when backoffice user not found', async () => {
        mockReq.session.backOfficeUserId = 'backoffice-123';
        mockReq.session.destroy = jest.fn();
        mockBackOfficeService.findById.mockResolvedValue(null);
        
        await loadBackOfficeUser(mockReq, mockRes, mockNext);
        
        expect(mockReq.session.destroy).toHaveBeenCalled();
        expect(mockRes.redirect).toHaveBeenCalledWith('/backoffice/login');
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should clear session when backoffice user is inactive', async () => {
        const mockBackOfficeUser = {
          id: 'backoffice-123',
          email: 'admin@test.com',
          isActive: false
        };
        
        mockReq.session.backOfficeUserId = 'backoffice-123';
        mockReq.session.destroy = jest.fn();
        mockBackOfficeService.findById.mockResolvedValue(mockBackOfficeUser);
        
        await loadBackOfficeUser(mockReq, mockRes, mockNext);
        
        expect(mockReq.session.destroy).toHaveBeenCalled();
        expect(mockRes.redirect).toHaveBeenCalledWith('/backoffice/login?error=account_inactive');
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should handle errors gracefully', async () => {
        mockReq.session.backOfficeUserId = 'backoffice-123';
        mockReq.session.destroy = jest.fn();
        mockBackOfficeService.findById.mockRejectedValue(new Error('Database error'));
        
        await loadBackOfficeUser(mockReq, mockRes, mockNext);
        
        expect(mockLogger.error).toHaveBeenCalledWith('Error loading superadmin:', expect.any(Error));
        expect(mockReq.session.destroy).toHaveBeenCalled();
        expect(mockRes.redirect).toHaveBeenCalledWith('/backoffice/login?error=session_error');
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('ensureBackOfficeSession', () => {
      it('should clear merchant session when both sessions exist', () => {
        mockReq.session = {
          userId: 'merchant-123',
          user: { id: 'merchant-123' },
          tenantId: 'tenant-123',
          tenantSlug: 'demo',
          backOfficeUserId: 'backoffice-123'
        };
        
        ensureBackOfficeSession(mockReq, mockRes, mockNext);
        
        expect(mockReq.session.userId).toBeUndefined();
        expect(mockReq.session.user).toBeUndefined();
        expect(mockReq.session.tenantId).toBeUndefined();
        expect(mockReq.session.tenantSlug).toBeUndefined();
        expect(mockReq.session.backOfficeUserId).toBe('backoffice-123');
        expect(mockLogger.warn).toHaveBeenCalledWith('Detected mixed session (both merchant and backoffice). Clearing merchant session.');
        expect(mockNext).toHaveBeenCalled();
      });

      it('should set backoffice session markers', () => {
        mockReq.session = {
          backOfficeUserId: 'backoffice-123'
        };
        
        ensureBackOfficeSession(mockReq, mockRes, mockNext);
        
        expect(mockReq.session.sessionType).toBe('backoffice');
        expect(mockReq.session.lastActivity).toBeInstanceOf(Date);
        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('checkBackOfficeSessionTimeout', () => {
      it('should allow access within timeout window', () => {
        const recentTime = new Date();
        mockReq.session = {
          backOfficeUserId: 'backoffice-123',
          lastActivity: recentTime
        };
        
        checkBackOfficeSessionTimeout(mockReq, mockRes, mockNext);
        
        expect(mockReq.session.lastActivity).toBeInstanceOf(Date);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should destroy session when timeout exceeded', () => {
        const oldTime = new Date(Date.now() - (31 * 60 * 1000)); // 31 minutes ago
        mockReq.session = {
          backOfficeUserId: 'backoffice-123',
          lastActivity: oldTime,
          destroy: jest.fn(callback => callback())
        };
        
        checkBackOfficeSessionTimeout(mockReq, mockRes, mockNext);
        
        expect(mockReq.session.destroy).toHaveBeenCalled();
        expect(mockRes.redirect).toHaveBeenCalledWith('/backoffice/login?error=session_timeout');
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 401 for API requests on timeout', () => {
        const oldTime = new Date(Date.now() - (31 * 60 * 1000)); // 31 minutes ago
        mockReq.session = {
          backOfficeUserId: 'backoffice-123',
          lastActivity: oldTime,
          destroy: jest.fn(callback => callback())
        };
        mockReq.originalUrl = '/api/test';
        
        checkBackOfficeSessionTimeout(mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Session timeout' });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });
  });

  describe('Tenant Authentication Middleware', () => {
    
    describe('requireAuth', () => {
      it('should allow access when userId exists in session', () => {
        mockReq.session.userId = 'merchant-123';
        
        requireAuth(mockReq, mockRes, mockNext);
        
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.redirect).not.toHaveBeenCalled();
      });

      it('should allow access when backOfficeUserId exists in session', () => {
        mockReq.session.backOfficeUserId = 'backoffice-123';
        
        requireAuth(mockReq, mockRes, mockNext);
        
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.redirect).not.toHaveBeenCalled();
      });

      it('should allow access when isBackOffice flag is set', () => {
        mockReq.isBackOffice = true;
        mockReq.session = {};
        
        requireAuth(mockReq, mockRes, mockNext);
        
        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.redirect).not.toHaveBeenCalled();
      });

      it('should redirect to appropriate login page', () => {
        mockReq.session = {};
        mockReq.originalUrl = '/backoffice/dashboard';
        
        requireAuth(mockReq, mockRes, mockNext);
        
        expect(mockRes.redirect).toHaveBeenCalledWith('/backoffice/auth/login?redirect=%2Fbackoffice%2Fdashboard');
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should redirect to tenant login for tenant routes', () => {
        mockReq.session = {};
        mockReq.originalUrl = '/dashboard';
        
        requireAuth(mockReq, mockRes, mockNext);
        
        expect(mockRes.redirect).toHaveBeenCalledWith('/auth/login?redirect=%2Fdashboard');
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('ensureTenantSession', () => {
      it('should clear backoffice session when both sessions exist', () => {
        mockReq.session = {
          userId: 'merchant-123',
          backOfficeUserId: 'backoffice-123',
          backOfficeUser: { id: 'backoffice-123' },
          sessionType: 'backoffice',
          lastActivity: new Date()
        };
        
        ensureTenantSession(mockReq, mockRes, mockNext);
        
        expect(mockReq.session.backOfficeUserId).toBeUndefined();
        expect(mockReq.session.backOfficeUser).toBeUndefined();
        expect(mockReq.session.sessionType).toBe('tenant');
        expect(mockLogger.warn).toHaveBeenCalledWith('Detected mixed session (both backoffice and tenant). Clearing backoffice session.');
        expect(mockNext).toHaveBeenCalled();
      });

      it('should set tenant session markers', () => {
        mockReq.session = {
          userId: 'merchant-123'
        };
        mockReq.tenantId = 'tenant-123';
        mockReq.tenant = { slug: 'demo' };
        
        ensureTenantSession(mockReq, mockRes, mockNext);
        
        expect(mockReq.session.sessionType).toBe('tenant');
        expect(mockReq.session.lastActivity).toBeInstanceOf(Date);
        expect(mockReq.session.tenantId).toBe('tenant-123');
        expect(mockReq.session.tenantSlug).toBe('demo');
        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('loadUser', () => {
      it('should load tenant user data when session exists', async () => {
        const mockUser = {
          id: 'merchant-123',
          email: 'merchant@test.com',
          businessName: 'Test Business',
          tenantId: 'tenant-123'
        };
        
        mockReq.session.userId = 'merchant-123';
        mockReq.tenantId = 'tenant-123';
        mockMerchantService.findById.mockResolvedValue(mockUser);
        
        await loadUser(mockReq, mockRes, mockNext);
        
        expect(mockMerchantService.findById).toHaveBeenCalledWith('merchant-123', {}, 'tenant-123');
        expect(mockReq.user).toBe(mockUser);
        expect(mockRes.locals.user).toBe(mockUser);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should handle backoffice user loading', async () => {
        const mockBackOfficeUser = {
          id: 'backoffice-123',
          email: 'admin@test.com',
          isActive: true
        };
        
        mockReq.session.backOfficeUserId = 'backoffice-123';
        mockBackOfficeService.findById.mockResolvedValue(mockBackOfficeUser);
        
        await loadUser(mockReq, mockRes, mockNext);
        
        expect(mockBackOfficeService.findById).toHaveBeenCalledWith('backoffice-123');
        expect(mockReq.user).toBe(mockBackOfficeUser);
        expect(mockReq.backOfficeUser).toBe(mockBackOfficeUser);
        expect(mockReq.user.isBackOffice).toBe(true);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should clear session when user not found', async () => {
        mockReq.session.userId = 'merchant-123';
        mockReq.session.destroy = jest.fn();
        mockMerchantService.findById.mockResolvedValue(null);
        
        await loadUser(mockReq, mockRes, mockNext);
        
        expect(mockReq.session.destroy).toHaveBeenCalled();
        expect(mockRes.redirect).toHaveBeenCalledWith('/auth/login');
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should validate tenant assignment', async () => {
        const mockUser = {
          id: 'merchant-123',
          email: 'merchant@test.com',
          tenantId: 'other-tenant-123'
        };
        
        mockReq.session.userId = 'merchant-123';
        mockReq.tenantId = 'tenant-123';
        mockReq.session.destroy = jest.fn();
        mockMerchantService.findById.mockResolvedValue(mockUser);
        
        await loadUser(mockReq, mockRes, mockNext);
        
        expect(mockLogger.error).toHaveBeenCalledWith('Tenant mismatch: user.tenantId=other-tenant-123, session.tenantId=tenant-123');
        expect(mockReq.session.destroy).toHaveBeenCalled();
        expect(mockRes.redirect).toHaveBeenCalledWith('/auth/login');
        expect(mockNext).not.toHaveBeenCalled();
      });
    });
  });

  describe('Session Isolation Tests', () => {
    
    it('should properly isolate backoffice and tenant sessions', () => {
      // Test backoffice session cleanup
      mockReq.session = {
        userId: 'merchant-123',
        tenantId: 'tenant-123',
        backOfficeUserId: 'backoffice-123'
      };
      
      ensureBackOfficeSession(mockReq, mockRes, mockNext);
      
      expect(mockReq.session.userId).toBeUndefined();
      expect(mockReq.session.tenantId).toBeUndefined();
      expect(mockReq.session.backOfficeUserId).toBe('backoffice-123');
      expect(mockReq.session.sessionType).toBe('backoffice');
    });

    it('should properly isolate tenant and backoffice sessions', () => {
      // Test tenant session cleanup
      mockReq.session = {
        userId: 'merchant-123',
        backOfficeUserId: 'backoffice-123',
        sessionType: 'backoffice'
      };
      
      ensureTenantSession(mockReq, mockRes, mockNext);
      
      expect(mockReq.session.backOfficeUserId).toBeUndefined();
      expect(mockReq.session.userId).toBe('merchant-123');
      expect(mockReq.session.sessionType).toBe('tenant');
    });
  });

  describe('Security Edge Cases', () => {
    
    it('should handle session without destroy method', () => {
      mockReq.session = {
        backOfficeUserId: 'backoffice-123',
        lastActivity: new Date(Date.now() - (31 * 60 * 1000))
      };
      
      // Should not throw error even if destroy method is missing
      expect(() => {
        checkBackOfficeSessionTimeout(mockReq, mockRes, mockNext);
      }).not.toThrow();
    });

    it('should handle malformed session data', async () => {
      mockReq.session = {
        userId: 'merchant-123',
        destroy: jest.fn()
      };
      
      // Simulate service throwing error due to malformed data
      mockMerchantService.findById.mockRejectedValue(new Error('Invalid ID format'));
      
      await loadUser(mockReq, mockRes, mockNext);
      
      expect(mockLogger.error).toHaveBeenCalledWith('Error loading user:', expect.any(Error));
      expect(mockNext).toHaveBeenCalled(); // Should continue despite error
    });

    it('should handle missing session object', () => {
      mockReq.session = null;
      
      requireBackOfficeAuth(mockReq, mockRes, mockNext);
      
      expect(mockRes.redirect).toHaveBeenCalledWith('/backoffice/auth/login?redirect=%2Ftest');
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});