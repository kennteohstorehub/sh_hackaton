#!/usr/bin/env node

/**
 * Simple Tenant Creation Test
 * Tests if the basic tenant creation functionality works after fixing the schema issues
 */

const tenantService = require('./server/services/tenantService');
const prisma = require('./server/utils/prisma');
const logger = require('./server/utils/logger');

async function testTenantCreation() {
  logger.info('🧪 Testing simple tenant creation...');

  try {
    // Clean up any existing test tenant
    const existingTenant = await prisma.tenant.findFirst({
      where: { slug: 'simple-test-tenant' }
    });

    if (existingTenant) {
      // Clean up
      await prisma.merchant.deleteMany({ where: { tenantId: existingTenant.id } });
      await prisma.tenantUser.deleteMany({ where: { tenantId: existingTenant.id } });
      await prisma.tenantSubscription.deleteMany({ where: { tenantId: existingTenant.id } });
      await prisma.tenant.delete({ where: { id: existingTenant.id } });
      logger.info('Cleaned up existing test tenant');
    }

    // Test tenant creation
    const result = await tenantService.create({
      name: 'Simple Test Tenant',
      slug: 'simple-test-tenant',
      adminEmail: 'admin@simpletest.com',
      adminName: 'Simple Admin',
      adminPassword: 'SimpleTest123!@#',
      plan: 'basic',
      billingCycle: 'monthly',
      maxMerchants: 3,
      maxQueuesPerMerchant: 5,
      maxCustomersPerQueue: 100,
      aiFeatures: false,
      analytics: true,
      customBranding: false,
      businessType: 'restaurant'
    });

    if (result && result.tenant && result.subscription) {
      logger.info('✅ Tenant creation successful!');
      logger.info(`   Tenant ID: ${result.tenant.id}`);
      logger.info(`   Tenant Name: ${result.tenant.name}`);
      logger.info(`   Subscription Status: ${result.subscription.status}`);
      logger.info(`   Subscription Priority: ${result.subscription.priority}`);

      // Test reading the tenant back
      const retrievedTenant = await tenantService.findById(result.tenant.id);
      if (retrievedTenant && retrievedTenant.subscription) {
        logger.info('✅ Tenant retrieval successful!');
        logger.info(`   Retrieved tenant with subscription: ${retrievedTenant.subscription.status}`);
      } else {
        logger.error('❌ Tenant retrieval failed');
      }

      // Clean up
      await prisma.merchant.deleteMany({ where: { tenantId: result.tenant.id } });
      await prisma.tenantUser.deleteMany({ where: { tenantId: result.tenant.id } });
      await prisma.tenantSubscription.deleteMany({ where: { tenantId: result.tenant.id } });
      await prisma.tenant.delete({ where: { id: result.tenant.id } });
      logger.info('✅ Test cleanup completed');

      return true;
    } else {
      logger.error('❌ Tenant creation failed - missing data');
      return false;
    }

  } catch (error) {
    logger.error(`❌ Test failed: ${error.message}`);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
if (require.main === module) {
  testTenantCreation()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logger.error(`Fatal error: ${error.message}`);
      process.exit(1);
    });
}

module.exports = testTenantCreation;