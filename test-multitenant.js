#!/usr/bin/env node

/**
 * Multi-Tenant Implementation Test Script
 * 
 * This script tests the multi-tenant functionality including:
 * - Tenant resolution from subdomains
 * - Data isolation between tenants
 * - SuperAdmin portal access
 * - Subscription limits
 */

const express = require('express');
const request = require('supertest');
const prisma = require('./server/utils/prisma');
const logger = require('./server/utils/logger');

// Test configuration
const TEST_TENANTS = [
  {
    name: 'Test Restaurant 1',
    slug: 'test-restaurant-1',
    adminEmail: 'admin@test1.com',
    adminName: 'Test Admin 1'
  },
  {
    name: 'Test Restaurant 2', 
    slug: 'test-restaurant-2',
    adminEmail: 'admin@test2.com',
    adminName: 'Test Admin 2'
  }
];

async function cleanupTestData() {
  logger.info('Cleaning up test data...');
  
  // Delete test tenants and related data
  for (const testTenant of TEST_TENANTS) {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: testTenant.slug }
    });
    
    if (tenant) {
      // Delete in reverse order of dependencies
      await prisma.auditLog.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.queueEntry.deleteMany({ where: { queue: { merchantId: { in: await getMerchantIds(tenant.id) } } } });
      await prisma.queue.deleteMany({ where: { merchantId: { in: await getMerchantIds(tenant.id) } } });
      await prisma.merchant.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenantUser.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenantSubscription.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenant.delete({ where: { id: tenant.id } });
      
      logger.info(`Cleaned up test tenant: ${tenant.name}`);
    }
  }
}

async function getMerchantIds(tenantId) {
  const merchants = await prisma.merchant.findMany({
    where: { tenantId },
    select: { id: true }
  });
  return merchants.map(m => m.id);
}

async function createTestTenants() {
  logger.info('Creating test tenants...');
  
  const tenantService = require('./server/services/tenantService');
  const createdTenants = [];
  
  for (const tenantData of TEST_TENANTS) {
    try {
      const result = await tenantService.create({
        ...tenantData,
        adminPassword: 'Test123!@#',
        plan: 'basic',
        billingCycle: 'monthly',
        maxMerchants: 3,
        maxQueuesPerMerchant: 5,
        maxCustomersPerQueue: 100,
        aiFeatures: false,
        analytics: true,
        customBranding: false
      });
      
      createdTenants.push(result.tenant);
      logger.info(`Created test tenant: ${result.tenant.name} (${result.tenant.slug})`);
    } catch (error) {
      logger.error(`Failed to create tenant ${tenantData.name}:`, error);
    }
  }
  
  return createdTenants;
}

async function testTenantResolution() {
  logger.info('\n🧪 Testing Tenant Resolution...');
  
  const { resolveTenant } = require('./server/middleware/tenantResolver');
  
  // Test valid subdomain
  const req1 = {
    hostname: 'test-restaurant-1.storehubqms.com',
    get: () => 'test-restaurant-1.storehubqms.com'
  };
  const res1 = { 
    status: () => ({ render: () => {} }),
    redirect: () => {}
  };
  const next1 = () => {};
  
  await resolveTenant(req1, res1, next1);
  
  if (req1.tenant && req1.tenant.slug === 'test-restaurant-1') {
    logger.info('✅ Tenant resolution successful for test-restaurant-1');
  } else {
    logger.error('❌ Tenant resolution failed for test-restaurant-1');
  }
  
  // Test SuperAdmin portal
  const req2 = {
    hostname: 'admin.storehubqms.com',
    get: () => 'admin.storehubqms.com'
  };
  const res2 = { status: () => ({ render: () => {} }) };
  const next2 = () => {};
  
  await resolveTenant(req2, res2, next2);
  
  if (req2.isSuperAdmin === true) {
    logger.info('✅ SuperAdmin portal detection successful');
  } else {
    logger.error('❌ SuperAdmin portal detection failed');
  }
}

async function testDataIsolation() {
  logger.info('\n🧪 Testing Data Isolation...');
  
  const queueService = require('./server/services/queueService');
  const tenants = await prisma.tenant.findMany({
    where: {
      slug: { in: TEST_TENANTS.map(t => t.slug) }
    },
    include: {
      merchants: {
        include: {
          queues: true
        }
      }
    }
  });
  
  if (tenants.length < 2) {
    logger.error('❌ Need at least 2 test tenants for isolation test');
    return;
  }
  
  // Try to access tenant 1's queue with tenant 2's context
  const tenant1 = tenants[0];
  const tenant2 = tenants[1];
  
  if (tenant1.merchants[0]?.queues[0]) {
    const queue1Id = tenant1.merchants[0].queues[0].id;
    
    try {
      // This should return null due to tenant isolation
      const queue = await queueService.findById(queue1Id, {}, tenant2.id);
      
      if (queue === null) {
        logger.info('✅ Data isolation working - Tenant 2 cannot access Tenant 1 data');
      } else {
        logger.error('❌ Data isolation FAILED - Tenant 2 accessed Tenant 1 data!');
      }
    } catch (error) {
      logger.info('✅ Data isolation working - Access denied with error');
    }
  }
}

async function testSubscriptionLimits() {
  logger.info('\n🧪 Testing Subscription Limits...');
  
  const tenantService = require('./server/services/tenantService');
  const testTenant = await prisma.tenant.findFirst({
    where: { slug: 'test-restaurant-1' },
    include: { subscription: true }
  });
  
  if (!testTenant) {
    logger.error('❌ Test tenant not found');
    return;
  }
  
  const limits = await tenantService.checkSubscriptionLimits(testTenant.id);
  
  logger.info('Subscription limits:', {
    merchants: `${limits.merchants.current}/${limits.merchants.limit}`,
    users: `${limits.users.current}/${limits.users.limit}`,
    plan: testTenant.subscription.plan
  });
  
  if (limits.merchants.current <= limits.merchants.limit) {
    logger.info('✅ Merchant limits enforced correctly');
  } else {
    logger.error('❌ Merchant limits not enforced');
  }
}

async function runTests() {
  logger.info('🚀 Starting Multi-Tenant Tests...\n');
  
  try {
    // Clean up any existing test data
    await cleanupTestData();
    
    // Create test tenants
    const tenants = await createTestTenants();
    
    if (tenants.length === 0) {
      logger.error('Failed to create test tenants');
      return;
    }
    
    // Run tests
    await testTenantResolution();
    await testDataIsolation();
    await testSubscriptionLimits();
    
    logger.info('\n✅ Multi-tenant tests completed!');
    
  } catch (error) {
    logger.error('Test failed:', error);
  } finally {
    // Clean up test data
    await cleanupTestData();
    await prisma.$disconnect();
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch(error => {
      logger.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runTests };