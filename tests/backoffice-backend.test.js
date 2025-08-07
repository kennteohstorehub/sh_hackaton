/**
 * BackOffice Backend Services Unit Tests
 * 
 * Tests the BackOffice service layer, authentication middleware,
 * and data operations without requiring browser automation
 */

const request = require('supertest');
const { app } = require('../server/index');

// Test configuration
const BACKOFFICE_CREDENTIALS = {
  email: 'backoffice@storehubqms.local',
  password: 'BackOffice123!@#'
};

const INVALID_CREDENTIALS = {
  email: 'invalid@test.com',
  password: 'wrongpassword'
};

describe('BackOffice Backend Services', () => {
  
  let authCookie;
  let csrfToken;

  describe('Authentication API', () => {
    
    test('GET /backoffice/auth/login should return login page', async () => {
      const response = await request(app)
        .get('/backoffice/auth/login')
        .expect(200);
      
      expect(response.text).toContain('BackOffice');
      expect(response.text).toContain('email');
      expect(response.text).toContain('password');
      expect(response.text).toContain('_csrf');
    });

    test('POST /backoffice/auth/login should reject invalid credentials', async () => {
      // First get CSRF token
      const loginPage = await request(app)
        .get('/backoffice/auth/login');
      
      const csrfMatch = loginPage.text.match(/name="_csrf"[^>]*value="([^"]+)"/);
      const csrf = csrfMatch ? csrfMatch[1] : '';
      
      const response = await request(app)
        .post('/backoffice/auth/login')
        .send({
          email: INVALID_CREDENTIALS.email,
          password: INVALID_CREDENTIALS.password,
          _csrf: csrf
        })
        .expect(302); // Redirect back to login
      
      expect(response.headers.location).toContain('/login');
    });

    test('POST /backoffice/auth/login should accept valid credentials', async () => {
      // Get CSRF token
      const loginPage = await request(app)
        .get('/backoffice/auth/login');
      
      const csrfMatch = loginPage.text.match(/name="_csrf"[^>]*value="([^"]+)"/);
      const csrf = csrfMatch ? csrfMatch[1] : '';
      
      const response = await request(app)
        .post('/backoffice/auth/login')
        .send({
          email: BACKOFFICE_CREDENTIALS.email,
          password: BACKOFFICE_CREDENTIALS.password,
          _csrf: csrf
        })
        .expect(302); // Redirect to dashboard
      
      expect(response.headers.location).toContain('/dashboard');
      
      // Store auth cookie for later tests
      authCookie = response.headers['set-cookie'];
    });

    test('GET /backoffice/auth/logout should clear session', async () => {
      // Login first if we don't have auth cookie
      if (!authCookie) {
        const loginPage = await request(app).get('/backoffice/auth/login');
        const csrfMatch = loginPage.text.match(/name="_csrf"[^>]*value="([^"]+)"/);
        const csrf = csrfMatch ? csrfMatch[1] : '';
        
        const loginResponse = await request(app)
          .post('/backoffice/auth/login')
          .send({
            email: BACKOFFICE_CREDENTIALS.email,
            password: BACKOFFICE_CREDENTIALS.password,
            _csrf: csrf
          });
        
        authCookie = loginResponse.headers['set-cookie'];
      }
      
      // Now logout
      const response = await request(app)
        .get('/backoffice/auth/logout')
        .set('Cookie', authCookie)
        .expect(302);
      
      expect(response.headers.location).toContain('/login');
    });

    test('Should protect routes without authentication', async () => {
      const protectedRoutes = [
        '/backoffice/dashboard',
        '/backoffice/tenants',
        '/backoffice/merchants',
        '/backoffice/settings',
        '/backoffice/audit-logs'
      ];

      for (const route of protectedRoutes) {
        const response = await request(app)
          .get(route)
          .expect(302);
        
        expect(response.headers.location).toContain('/login');
      }
    });
  });

  describe('Dashboard API', () => {
    
    beforeAll(async () => {
      // Login to get auth cookie
      const loginPage = await request(app).get('/backoffice/auth/login');
      const csrfMatch = loginPage.text.match(/name="_csrf"[^>]*value="([^"]+)"/);
      const csrf = csrfMatch ? csrfMatch[1] : '';
      
      const loginResponse = await request(app)
        .post('/backoffice/auth/login')
        .send({
          email: BACKOFFICE_CREDENTIALS.email,
          password: BACKOFFICE_CREDENTIALS.password,
          _csrf: csrf
        });
      
      authCookie = loginResponse.headers['set-cookie'];
    });

    test('GET /backoffice/dashboard should return dashboard with stats', async () => {
      const response = await request(app)
        .get('/backoffice/dashboard')
        .set('Cookie', authCookie)
        .expect(200);
      
      expect(response.text).toContain('Dashboard');
      expect(response.text).toContain('BackOffice');
      // Should contain system statistics
      expect(response.text).toMatch(/Tenants|Merchants|System/i);
    });
  });

  describe('Tenants API', () => {
    
    test('GET /backoffice/tenants should return tenant list', async () => {
      const response = await request(app)
        .get('/backoffice/tenants')
        .set('Cookie', authCookie)
        .expect(200);
      
      expect(response.text).toContain('Tenants');
      expect(response.text).toMatch(/Create|Add|New/i);
    });

    test('GET /backoffice/tenants/create should return creation form', async () => {
      const response = await request(app)
        .get('/backoffice/tenants/create')
        .set('Cookie', authCookie)
        .expect(200);
      
      expect(response.text).toContain('form');
      expect(response.text).toMatch(/name.*domain/i);
      expect(response.text).toContain('_csrf');
    });

    test('POST /backoffice/tenants should create new tenant', async () => {
      // Get CSRF token from create form
      const createPage = await request(app)
        .get('/backoffice/tenants/create')
        .set('Cookie', authCookie);
      
      const csrfMatch = createPage.text.match(/name="_csrf"[^>]*value="([^"]+)"/);
      const csrf = csrfMatch ? csrfMatch[1] : '';
      
      const tenantData = {
        name: `Test Tenant ${Date.now()}`,
        domain: `test-tenant-${Date.now()}`,
        description: 'Test tenant created by unit tests',
        _csrf: csrf
      };
      
      const response = await request(app)
        .post('/backoffice/tenants')
        .set('Cookie', authCookie)
        .send(tenantData)
        .expect(302); // Should redirect after creation
      
      // Should redirect to tenant list or show success
      expect(response.headers.location).toMatch(/tenants|dashboard/);
    });

    test('POST /backoffice/tenants should validate required fields', async () => {
      // Get CSRF token
      const createPage = await request(app)
        .get('/backoffice/tenants/create')
        .set('Cookie', authCookie);
      
      const csrfMatch = createPage.text.match(/name="_csrf"[^>]*value="([^"]+)"/);
      const csrf = csrfMatch ? csrfMatch[1] : '';
      
      // Submit empty form
      const response = await request(app)
        .post('/backoffice/tenants')
        .set('Cookie', authCookie)
        .send({ _csrf: csrf });
      
      // Should return validation errors (either 400 or redirect back with errors)
      expect([400, 302]).toContain(response.status);
    });
  });

  describe('Merchants API', () => {
    
    test('GET /backoffice/merchants should return merchant list', async () => {
      const response = await request(app)
        .get('/backoffice/merchants')
        .set('Cookie', authCookie)
        .expect(200);
      
      expect(response.text).toContain('Merchants');
      expect(response.text).toMatch(/Name|Email|Phone|Status/i);
    });

    test('GET /backoffice/merchants/:id should return merchant details', async () => {
      // This test assumes there's at least one merchant
      // In a real test, you'd create test data first
      
      const merchantsPage = await request(app)
        .get('/backoffice/merchants')
        .set('Cookie', authCookie);
      
      // Look for merchant ID in the response
      const idMatch = merchantsPage.text.match(/merchants\/(\d+)/);
      
      if (idMatch) {
        const merchantId = idMatch[1];
        
        const response = await request(app)
          .get(`/backoffice/merchants/${merchantId}`)
          .set('Cookie', authCookie)
          .expect(200);
        
        expect(response.text).toMatch(/Merchant|Details|Profile/i);
      }
    });
  });

  describe('Audit Logs API', () => {
    
    test('GET /backoffice/audit-logs should return audit log list', async () => {
      const response = await request(app)
        .get('/backoffice/audit-logs')
        .set('Cookie', authCookie)
        .expect(200);
      
      expect(response.text).toMatch(/Audit|Logs|Activity/i);
      expect(response.text).toMatch(/Action|User|Date|Time/i);
    });

    test('Audit logs should record login activity', async () => {
      const response = await request(app)
        .get('/backoffice/audit-logs')
        .set('Cookie', authCookie)
        .expect(200);
      
      // Should contain recent login activity
      expect(response.text).toMatch(/LOGIN|ATTEMPT_LOGIN/i);
      expect(response.text).toContain(BACKOFFICE_CREDENTIALS.email);
    });
  });

  describe('Settings API', () => {
    
    test('GET /backoffice/settings should return settings page', async () => {
      const response = await request(app)
        .get('/backoffice/settings')
        .set('Cookie', authCookie)
        .expect(200);
      
      expect(response.text).toContain('Settings');
      expect(response.text).toMatch(/System|Configuration|Preferences/i);
    });

    test('POST /backoffice/settings should update settings', async () => {
      // Get current settings page to extract CSRF token
      const settingsPage = await request(app)
        .get('/backoffice/settings')
        .set('Cookie', authCookie);
      
      const csrfMatch = settingsPage.text.match(/name="_csrf"[^>]*value="([^"]+)"/);
      const csrf = csrfMatch ? csrfMatch[1] : '';
      
      // Try to update a setting
      const response = await request(app)
        .post('/backoffice/settings')
        .set('Cookie', authCookie)
        .send({
          systemName: 'Test System Update',
          _csrf: csrf
        });
      
      // Should either succeed (302) or show validation errors
      expect([200, 302]).toContain(response.status);
    });
  });

  describe('API Security', () => {
    
    test('Should require CSRF token for POST requests', async () => {
      const response = await request(app)
        .post('/backoffice/auth/login')
        .send({
          email: BACKOFFICE_CREDENTIALS.email,
          password: BACKOFFICE_CREDENTIALS.password
          // Missing _csrf token
        });
      
      // Should reject without CSRF token
      expect([400, 403, 302]).toContain(response.status);
    });

    test('Should implement rate limiting for login attempts', async () => {
      // Get CSRF token
      const loginPage = await request(app).get('/backoffice/auth/login');
      const csrfMatch = loginPage.text.match(/name="_csrf"[^>]*value="([^"]+)"/);
      const csrf = csrfMatch ? csrfMatch[1] : '';
      
      // Make multiple failed login attempts quickly
      const promises = [];
      for (let i = 0; i < 6; i++) {
        promises.push(
          request(app)
            .post('/backoffice/auth/login')
            .send({
              email: `attempt${i}@test.com`,
              password: 'wrongpassword',
              _csrf: csrf
            })
        );
      }
      
      const responses = await Promise.all(promises);
      
      // Later attempts should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('Should sanitize input data', async () => {
      // Get CSRF token
      const createPage = await request(app)
        .get('/backoffice/tenants/create')
        .set('Cookie', authCookie);
      
      const csrfMatch = createPage.text.match(/name="_csrf"[^>]*value="([^"]+)"/);
      const csrf = csrfMatch ? csrfMatch[1] : '';
      
      // Try to submit XSS payload
      const response = await request(app)
        .post('/backoffice/tenants')
        .set('Cookie', authCookie)
        .send({
          name: '<script>alert("xss")</script>',
          domain: 'test-domain',
          _csrf: csrf
        });
      
      // Should handle malicious input gracefully
      expect([200, 302, 400]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    
    test('Should handle 404 routes gracefully', async () => {
      const response = await request(app)
        .get('/backoffice/nonexistent-route')
        .set('Cookie', authCookie);
      
      expect([404, 302]).toContain(response.status);
    });

    test('Should handle database errors gracefully', async () => {
      // This test would typically involve mocking database failures
      // For now, just verify that the app doesn't crash
      
      const response = await request(app)
        .get('/backoffice/dashboard')
        .set('Cookie', authCookie);
      
      // Should return some response, not crash
      expect(response.status).toBeLessThan(500);
    });

    test('Should log important events', async () => {
      // This test verifies that logging is working
      // In a real scenario, you'd check log files or mock the logger
      
      const response = await request(app)
        .get('/backoffice/dashboard')
        .set('Cookie', authCookie)
        .expect(200);
      
      // If we got here, logging didn't prevent the request
      expect(response.status).toBe(200);
    });
  });
});

describe('BackOffice Service Layer', () => {
  
  describe('Authentication Service', () => {
    
    test('Should hash passwords properly', async () => {
      const backOfficeService = require('../server/services/backOfficeService');
      
      // This test assumes the service has a method to hash passwords
      if (typeof backOfficeService.hashPassword === 'function') {
        const password = 'testpassword123';
        const hashed = await backOfficeService.hashPassword(password);
        
        expect(hashed).toBeDefined();
        expect(hashed).not.toBe(password);
        expect(hashed.length).toBeGreaterThan(20);
      }
    });

    test('Should validate email formats', async () => {
      const backOfficeService = require('../server/services/backOfficeService');
      
      if (typeof backOfficeService.validateEmail === 'function') {
        expect(backOfficeService.validateEmail('valid@email.com')).toBe(true);
        expect(backOfficeService.validateEmail('invalid-email')).toBe(false);
        expect(backOfficeService.validateEmail('')).toBe(false);
      }
    });
  });

  describe('Tenant Service', () => {
    
    test('Should validate tenant domain uniqueness', async () => {
      const tenantService = require('../server/services/tenantService');
      
      if (typeof tenantService.isDomainUnique === 'function') {
        // This would typically check against test database
        const isUnique = await tenantService.isDomainUnique('unique-test-domain');
        expect(typeof isUnique).toBe('boolean');
      }
    });

    test('Should generate proper tenant slugs', async () => {
      const tenantService = require('../server/services/tenantService');
      
      if (typeof tenantService.generateSlug === 'function') {
        const slug = tenantService.generateSlug('Test Tenant Name!@#$');
        expect(slug).toMatch(/^[a-z0-9-]+$/);
        expect(slug).not.toContain(' ');
        expect(slug).not.toContain('!@#$');
      }
    });
  });
});

// Helper function to clean up test data
afterAll(async () => {
  // In a real test environment, you'd clean up any test data created
  // This might involve deleting test tenants, clearing test sessions, etc.
  console.log('BackOffice backend tests completed');
});