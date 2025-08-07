#!/usr/bin/env node

/**
 * Setup Test Data for Multi-Tenant System
 * Creates test tenants, users, and sample data for testing
 */

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('./server/utils/logger');

// Test tenants configuration
const TEST_TENANTS = [
  {
    name: 'Demo Restaurant',
    slug: 'demo',
    businessType: 'restaurant',
    adminEmail: 'admin@demo.local',
    adminName: 'Demo Admin',
    adminPassword: 'Demo123!@#',
    phone: '+60123456789',
    timezone: 'Asia/Kuala_Lumpur'
  },
  {
    name: 'Test Cafe',
    slug: 'test-cafe',
    businessType: 'cafe',
    adminEmail: 'cafe@testcafe.local',
    adminName: 'Test Cafe Admin',
    adminPassword: 'Test123!@#',
    phone: '+60123456790',
    timezone: 'Asia/Kuala_Lumpur'
  },
  {
    name: 'Test Restaurant 1',
    slug: 'test-restaurant-1',
    businessType: 'restaurant',
    adminEmail: 'test1@test1.com',
    adminName: 'Test Admin 1',
    adminPassword: 'Test123!@#',
    phone: '+60123456791',
    timezone: 'Asia/Kuala_Lumpur'
  },
  {
    name: 'Test Restaurant 2',
    slug: 'test-restaurant-2',
    businessType: 'restaurant',
    adminEmail: 'test2@test2.com',
    adminName: 'Test Admin 2',
    adminPassword: 'Test123!@#',
    phone: '+60123456792',
    timezone: 'Asia/Kuala_Lumpur'
  }
];

// Test BackOffice User
const BACKOFFICE_USER = {
  email: 'backoffice@storehubqms.local',
  password: 'BackOffice123!@#',
  fullName: 'Development BackOffice User'
};

async function createBackOfficeUser() {
  try {
    const existing = await prisma.backOfficeUser.findUnique({
      where: { email: BACKOFFICE_USER.email }
    });
    
    if (existing) {
      logger.info(`✅ BackOfficeUser already exists: ${BACKOFFICE_USER.email}`);
      return existing;
    }
    
    const hashedPassword = await bcrypt.hash(BACKOFFICE_USER.password, 10);
    
    const backOfficeUser = await prisma.backOfficeUser.create({
      data: {
        email: BACKOFFICE_USER.email,
        password: hashedPassword,
        fullName: BACKOFFICE_USER.fullName,
        isActive: true
      }
    });
    
    logger.info(`✅ Created BackOfficeUser: ${BACKOFFICE_USER.email}`);
    return backOfficeUser;
  } catch (error) {
    logger.error('Error creating BackOfficeUser:', error);
    throw error;
  }
}

async function createTestTenant(tenantData) {
  try {
    // Check if tenant already exists
    const existing = await prisma.tenant.findUnique({
      where: { slug: tenantData.slug }
    });
    
    if (existing) {
      logger.info(`ℹ️  Tenant already exists: ${tenantData.name} (${tenantData.slug})`);
      return existing;
    }
    
    // Use transaction to create all related data
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: tenantData.name,
          slug: tenantData.slug,
          isActive: true
        }
      });
      
      // Create subscription
      const subscription = await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          status: 'active',
          priority: 'standard',
          billingCycle: 'monthly',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
          maxMerchants: 3,
          maxQueuesPerMerchant: 5,
          maxUsersPerTenant: 5,
          aiFeatures: false,
          analytics: true,
          customBranding: false
        }
      });
      
      // Create admin user
      const hashedPassword = await bcrypt.hash(tenantData.adminPassword, 10);
      const adminUser = await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          email: tenantData.adminEmail,
          password: hashedPassword,
          fullName: tenantData.adminName,
          role: 'admin',
          isActive: true,
          emailVerified: true
        }
      });
      
      // Create merchant
      const merchant = await tx.merchant.create({
        data: {
          tenantId: tenant.id,
          businessName: tenantData.name,
          email: tenantData.adminEmail,
          password: hashedPassword, // Use same password as admin user
          phone: tenantData.phone,
          businessType: 'restaurant', // Only restaurant and retail are valid
          timezone: tenantData.timezone,
          isActive: true,
          emailVerified: true
        }
      });
      
      // Create default queue
      const queue = await tx.queue.create({
        data: {
          merchantId: merchant.id,
          name: 'Main Queue',
          isActive: true,
          acceptingCustomers: true,
          maxCapacity: 100,
          currentServing: 0,
          autoNotifications: true,
          notificationInterval: 5,
          allowCancellation: true,
          requireConfirmation: false
        }
      });
      
      return { tenant, subscription, adminUser, merchant, queue };
    });
    
    logger.info(`✅ Created tenant: ${tenantData.name} (${tenantData.slug})`);
    logger.info(`   Admin login: ${tenantData.adminEmail} / ${tenantData.adminPassword}`);
    logger.info(`   URL: http://${tenantData.slug}.lvh.me:3000`);
    
    return result.tenant;
  } catch (error) {
    logger.error(`Error creating tenant ${tenantData.name}:`, error);
    throw error;
  }
}

async function createSampleQueueData(tenant) {
  try {
    // Get the merchant for this tenant
    const merchant = await prisma.merchant.findFirst({
      where: { tenantId: tenant.id },
      include: { queues: true }
    });
    
    if (!merchant || merchant.queues.length === 0) {
      logger.warn(`No merchant/queue found for tenant ${tenant.name}`);
      return;
    }
    
    const queue = merchant.queues[0];
    
    // Create some sample customers in queue
    const sampleCustomers = [
      { name: 'John Doe', phone: '+60111111111', partySize: 2 },
      { name: 'Jane Smith', phone: '+60122222222', partySize: 4 },
      { name: 'Bob Johnson', phone: '+60133333333', partySize: 1 }
    ];
    
    for (const [index, customer] of sampleCustomers.entries()) {
      // First create or find the customer
      let customerRecord = await prisma.customer.findFirst({
        where: { phone: customer.phone }
      });
      
      if (!customerRecord) {
        customerRecord = await prisma.customer.create({
          data: {
            name: customer.name,
            phone: customer.phone,
            isActive: true
          }
        });
      }
      
      // Then create the queue entry
      await prisma.queueEntry.create({
        data: {
          queueId: queue.id,
          customerId: customerRecord.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          partySize: customer.partySize,
          status: index === 0 ? 'called' : 'waiting',
          position: index + 1,
          ticketNumber: `A${String(index + 1).padStart(3, '0')}`,
          joinedAt: new Date(Date.now() - (30 - index * 10) * 60 * 1000), // Stagger join times
          source: 'walk_in'
        }
      });
    }
    
    logger.info(`✅ Created sample queue data for ${tenant.name}`);
  } catch (error) {
    logger.error(`Error creating sample data for ${tenant.name}:`, error);
  }
}

async function main() {
  logger.info('🚀 Setting up test data for multi-tenant system...\n');
  
  try {
    // Create BackOfficeUser
    logger.info('Creating BackOfficeUser...');
    await createBackOfficeUser();
    logger.info('');
    
    // Create test tenants
    logger.info('Creating test tenants...');
    for (const tenantData of TEST_TENANTS) {
      const tenant = await createTestTenant(tenantData);
      
      // Add sample data for first two tenants
      if (tenantData.slug === 'demo' || tenantData.slug === 'test-cafe') {
        await createSampleQueueData(tenant);
      }
    }
    
    logger.info('\n✅ Test data setup complete!\n');
    logger.info('📋 Quick Access URLs:');
    logger.info('====================');
    logger.info('BackOfficeUser Portal: http://admin.lvh.me:3000');
    logger.info(`  Login: ${BACKOFFICE_USER.email} / ${BACKOFFICE_USER.password}\n`);
    
    for (const tenant of TEST_TENANTS) {
      logger.info(`${tenant.name}: http://${tenant.slug}.lvh.me:3000`);
      logger.info(`  Login: ${tenant.adminEmail} / ${tenant.adminPassword}`);
    }
    
    logger.info('\n💡 Tips:');
    logger.info('- Use lvh.me domain for automatic localhost resolution');
    logger.info('- Clear cookies if you have session issues');
    logger.info('- Check TENANT_TESTING_GUIDE.md for detailed testing scenarios');
    
  } catch (error) {
    logger.error('Failed to setup test data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { createBackOfficeUser, createTestTenant, TEST_TENANTS, BACKOFFICE_USER };