const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const app = require('../../server/index'); // Adjust path as needed
const prisma = new PrismaClient();

describe('Settings API Integration Tests', () => {
  let authToken;
  let testMerchant;

  beforeAll(async () => {
    // Setup test merchant and authentication
    testMerchant = await prisma.merchant.create({
      data: {
        email: `test-merchant-${Date.now()}@example.com`,
        password: 'secureTestPassword123!',
        businessName: 'Test Merchant',
        phone: '+1234567890'
      }
    });

    // Authenticate and get token (adjust based on your auth mechanism)
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: testMerchant.email,
        password: 'secureTestPassword123!'
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.merchant.delete({
      where: { id: testMerchant.id }
    });
    await prisma.$disconnect();
  });

  describe('PUT /api/merchant/profile', () => {
    test('should update restaurant information successfully', async () => {
      const response = await request(app)
        .put('/api/merchant/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          businessName: 'Updated Test Restaurant',
          phone: '+1987654321',
          address: {
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345'
          },
          businessHours: {
            monday: { start: '08:00', end: '20:00', closed: false },
            tuesday: { start: '08:00', end: '20:00', closed: false },
            wednesday: { start: '08:00', end: '20:00', closed: false },
            thursday: { start: '08:00', end: '20:00', closed: false },
            friday: { start: '08:00', end: '20:00', closed: false },
            saturday: { start: '10:00', end: '18:00', closed: false },
            sunday: { start: '10:00', end: '16:00', closed: true }
          }
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.merchant.businessName).toBe('Updated Test Restaurant');
      expect(response.body.merchant.phone).toBe('+1987654321');
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .put('/api/merchant/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          businessName: '', // Empty business name
          phone: 'invalid-phone'
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/validation/i);
    });

    test('should update queue settings', async () => {
      const response = await request(app)
        .put('/api/merchant/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          settings: {
            maxQueueSize: 100,
            notificationInterval: 15,
            autoNotifications: true
          }
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.merchant.settings.maxQueueSize).toBe(100);
      expect(response.body.merchant.settings.notificationInterval).toBe(15);
      expect(response.body.merchant.settings.autoNotifications).toBe(true);
    });

    test('should validate queue settings limits', async () => {
      const response = await request(app)
        .put('/api/merchant/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          settings: {
            maxQueueSize: 1000, // Exceeds limit
            notificationInterval: 300 // Exceeds reasonable time
          }
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/validation/i);
    });

    test('should handle partial updates', async () => {
      const response = await request(app)
        .put('/api/merchant/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          businessName: 'Partially Updated Restaurant'
          // Other fields remain unchanged
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.merchant.businessName).toBe('Partially Updated Restaurant');
    });
  });

  describe('GET /api/merchant/profile', () => {
    test('should retrieve merchant profile', async () => {
      const response = await request(app)
        .get('/api/merchant/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.merchant).toBeTruthy();
      expect(response.body.merchant.id).toBe(testMerchant.id);
    });
  });
});