const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const app = require('../server'); // Adjust path as needed

describe('Merchant Phone Number Update API Tests', () => {
  let prisma;
  let authToken;
  let testMerchantId;

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Get test merchant credentials from environment or database
    const testMerchant = await prisma.merchant.findFirst({
      where: { email: process.env.TEST_USER_EMAIL }
    });

    if (!testMerchant) {
      throw new Error('Test merchant not found');
    }

    testMerchantId = testMerchant.id;

    // Authenticate and get token (adjust based on your actual auth mechanism)
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.TEST_USER_EMAIL,
        password: process.env.TEST_USER_PASSWORD
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Update Phone Number', () => {
    const validPhoneNumbers = [
      '+60123456789',   // Malaysia
      '+65123456789',   // Singapore 
      '+44207123456',   // UK
      '+1-650-253-0000' // US with hyphen
    ];

    validPhoneNumbers.forEach(phoneNumber => {
      test(`should update phone number to ${phoneNumber}`, async () => {
        const response = await request(app)
          .patch(`/api/merchants/${testMerchantId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ phone: phoneNumber });

        expect(response.statusCode).toBe(200);
        expect(response.body.phone).toBe(phoneNumber);

        // Verify in database
        const updatedMerchant = await prisma.merchant.findUnique({
          where: { id: testMerchantId }
        });

        expect(updatedMerchant.phone).toBe(phoneNumber);
      });
    });

    const invalidPhoneNumbers = [
      '123', // Too short
      'abcdefghij', // Non-numeric
      '+601', // Incomplete
      'not a phone number',
      '' // Empty string
    ];

    invalidPhoneNumbers.forEach(phoneNumber => {
      test(`should reject invalid phone number: ${phoneNumber}`, async () => {
        const response = await request(app)
          .patch(`/api/merchants/${testMerchantId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ phone: phoneNumber });

        expect(response.statusCode).toBe(400);
        expect(response.body.error).toMatch(/invalid/i);
      });
    });

    test('should handle updates with additional fields', async () => {
      const updateData = {
        phone: '+60123456789',
        email: `merchant_${Date.now()}@example.com`,
        businessName: 'Updated Merchant Name'
      };

      const response = await request(app)
        .patch(`/api/merchants/${testMerchantId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body.phone).toBe(updateData.phone);
      expect(response.body.email).toBe(updateData.email);
      expect(response.body.businessName).toBe(updateData.businessName);

      // Verify in database
      const updatedMerchant = await prisma.merchant.findUnique({
        where: { id: testMerchantId }
      });

      expect(updatedMerchant.phone).toBe(updateData.phone);
      expect(updatedMerchant.email).toBe(updateData.email);
      expect(updatedMerchant.businessName).toBe(updateData.businessName);
    });

    test('should prevent updating another merchant\'s phone', async () => {
      // Find another merchant ID (assuming some exist)
      const otherMerchant = await prisma.merchant.findFirst({
        where: { id: { not: testMerchantId } }
      });

      if (!otherMerchant) {
        console.warn('Could not find another merchant for multi-tenant test');
        return;
      }

      const response = await request(app)
        .patch(`/api/merchants/${otherMerchant.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ phone: '+60987654321' });

      // Expect forbidden or unauthorized status
      expect(response.statusCode).toBeGreaterThanOrEqual(403);
      expect(response.statusCode).toBeLessThan(500);
    });
  });
});