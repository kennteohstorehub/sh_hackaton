const bcrypt = require('bcryptjs');
const prisma = require('./server/utils/prisma');
const logger = require('./server/utils/logger');

async function setupTestData() {
  try {
    console.log('🚀 Setting up test data for multi-tenant system...\n');

    // 1. Create SuperAdmin
    console.log('1️⃣ Creating SuperAdmin...');
    
    // Check if SuperAdmin already exists
    let superAdmin = await prisma.superAdmin.findUnique({
      where: { email: 'admin@storehub.com' }
    });
    
    if (!superAdmin) {
      const hashedPassword = await bcrypt.hash('superadmin123', 12);
      superAdmin = await prisma.superAdmin.create({
        data: {
          email: 'admin@storehub.com',
          password: hashedPassword,
          fullName: 'System Administrator',
          isActive: true
        }
      });
      console.log('✅ SuperAdmin created:');
    } else {
      console.log('✅ SuperAdmin already exists:');
    }
    console.log('   Email: admin@storehub.com');
    console.log('   Password: superadmin123\n');

    // 2. Create Tenants with different subscription plans
    console.log('2️⃣ Creating test tenants...\n');

    // Tenant 1: Restaurant Chain (Premium)
    const tenant1 = await prisma.tenant.create({
      data: {
        name: 'Delicious Restaurant Group',
        slug: 'delicious-restaurants',
        domain: 'delicious-restaurants.local',
        isActive: true,
        subscription: {
          create: {
            status: 'active',
            billingCycle: 'monthly',
            maxMerchants: 10,
            maxQueuesPerMerchant: 5,
            maxUsersPerTenant: 20,
            aiFeatures: true,
            analytics: true,
            customBranding: true,
            priority: 'high',
            priority_support: true
          }
        }
      },
      include: { subscription: true }
    });
    console.log('✅ Tenant 1: Delicious Restaurant Group (Premium Features)');
    console.log(`   Domain: ${tenant1.domain}`);
    console.log(`   Max Merchants: ${tenant1.subscription.maxMerchants}`);

    // Tenant 2: Coffee Shop Chain (Basic)
    const tenant2 = await prisma.tenant.create({
      data: {
        name: 'Coffee Paradise Network',
        slug: 'coffee-paradise',
        domain: 'coffee-paradise.local',
        isActive: true,
        subscription: {
          create: {
            status: 'active',
            billingCycle: 'monthly',
            maxMerchants: 3,
            maxQueuesPerMerchant: 2,
            maxUsersPerTenant: 10,
            aiFeatures: false,
            analytics: true,
            customBranding: false,
            priority: 'standard',
            priority_support: false
          }
        }
      },
      include: { subscription: true }
    });
    console.log('\n✅ Tenant 2: Coffee Paradise Network (Standard Features)');
    console.log(`   Domain: ${tenant2.domain}`);
    console.log(`   Max Merchants: ${tenant2.subscription.maxMerchants}`);

    // Tenant 3: Small Business (Free)
    const tenant3 = await prisma.tenant.create({
      data: {
        name: 'Local Bakery Shop',
        slug: 'local-bakery',
        domain: 'local-bakery.local',
        isActive: true,
        subscription: {
          create: {
            status: 'active',
            billingCycle: 'monthly',
            maxMerchants: 1,
            maxQueuesPerMerchant: 1,
            maxUsersPerTenant: 3,
            aiFeatures: false,
            analytics: false,
            customBranding: false,
            priority: 'standard',
            priority_support: false
          }
        }
      },
      include: { subscription: true }
    });
    console.log('\n✅ Tenant 3: Local Bakery Shop (Basic Features)');
    console.log(`   Domain: ${tenant3.domain}`);
    console.log(`   Max Merchants: ${tenant3.subscription.maxMerchants}`);

    // 3. Create test merchants for each tenant
    console.log('\n\n3️⃣ Creating test merchants for each tenant...\n');

    const merchantPassword = await bcrypt.hash('merchant123', 10);

    // Merchants for Tenant 1
    const merchant1_1 = await prisma.merchant.create({
      data: {
        tenantId: tenant1.id,
        businessName: 'Delicious Downtown',
        email: 'downtown@delicious.com',
        password: merchantPassword,
        phone: '+60123456789',
        businessType: 'restaurant',
        isActive: true
      }
    });
    console.log('✅ Merchant: Delicious Downtown (Tenant 1)');
    console.log('   Email: downtown@delicious.com');
    console.log('   Password: merchant123');

    const merchant1_2 = await prisma.merchant.create({
      data: {
        tenantId: tenant1.id,
        businessName: 'Delicious Uptown',
        email: 'uptown@delicious.com',
        password: merchantPassword,
        phone: '+60123456790',
        businessType: 'restaurant',
        isActive: true
      }
    });
    console.log('\n✅ Merchant: Delicious Uptown (Tenant 1)');
    console.log('   Email: uptown@delicious.com');
    console.log('   Password: merchant123');

    // Merchant for Tenant 2
    const merchant2_1 = await prisma.merchant.create({
      data: {
        tenantId: tenant2.id,
        businessName: 'Coffee Paradise Central',
        email: 'central@coffeeparadise.com',
        password: merchantPassword,
        phone: '+60123456791',
        businessType: 'retail',
        isActive: true
      }
    });
    console.log('\n✅ Merchant: Coffee Paradise Central (Tenant 2)');
    console.log('   Email: central@coffeeparadise.com');
    console.log('   Password: merchant123');

    // Merchant for Tenant 3
    const merchant3_1 = await prisma.merchant.create({
      data: {
        tenantId: tenant3.id,
        businessName: 'Sweet Local Bakery',
        email: 'owner@localbakery.com',
        password: merchantPassword,
        phone: '+60123456792',
        businessType: 'retail',
        isActive: true
      }
    });
    console.log('\n✅ Merchant: Sweet Local Bakery (Tenant 3)');
    console.log('   Email: owner@localbakery.com');
    console.log('   Password: merchant123');

    // 4. Create queues for some merchants
    console.log('\n\n4️⃣ Creating test queues...\n');

    await prisma.queue.create({
      data: {
        merchantId: merchant1_1.id,
        name: 'Main Dining Queue',
        description: 'Queue for main dining area',
        isActive: true,
        maxCapacity: 100,
        averageServiceTime: 45
      }
    });
    console.log('✅ Queue: Main Dining Queue (Delicious Downtown)');

    await prisma.queue.create({
      data: {
        merchantId: merchant2_1.id,
        name: 'Coffee Pickup',
        description: 'Quick pickup for coffee orders',
        isActive: true,
        maxCapacity: 50,
        averageServiceTime: 5
      }
    });
    console.log('✅ Queue: Coffee Pickup (Coffee Paradise Central)');

    await prisma.queue.create({
      data: {
        merchantId: merchant3_1.id,
        name: 'Bakery Orders',
        description: 'Fresh bakery items queue',
        isActive: true,
        maxCapacity: 30,
        averageServiceTime: 10
      }
    });
    console.log('✅ Queue: Bakery Orders (Sweet Local Bakery)');

    // 5. Create an inactive tenant to test filtering
    const inactiveTenant = await prisma.tenant.create({
      data: {
        name: 'Closed Business Inc',
        slug: 'closed-business',
        domain: 'closed-business.local',
        isActive: false,
        subscription: {
          create: {
            status: 'cancelled',
            billingCycle: 'monthly',
            maxMerchants: 3,
            maxQueuesPerMerchant: 2,
            maxUsersPerTenant: 10
          }
        }
      }
    });
    console.log('\n✅ Inactive Tenant: Closed Business Inc (for testing filters)');

    console.log('\n\n✨ Test data setup complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 CREDENTIALS SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🔐 SUPERADMIN:');
    console.log('   Email: admin@storehub.com');
    console.log('   Password: superadmin123');
    console.log('   URL: http://localhost:3000/superadmin/auth/login');
    console.log('\n🏢 TENANT 1 (Premium):');
    console.log('   Merchant 1: downtown@delicious.com / merchant123');
    console.log('   Merchant 2: uptown@delicious.com / merchant123');
    console.log('\n☕ TENANT 2 (Basic):');
    console.log('   Merchant: central@coffeeparadise.com / merchant123');
    console.log('\n🥐 TENANT 3 (Free):');
    console.log('   Merchant: owner@localbakery.com / merchant123');
    console.log('\n📌 Regular Merchant Login: http://localhost:3000/auth/login');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error setting up test data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
setupTestData();