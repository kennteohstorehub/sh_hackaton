const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Set the DATABASE_URL for production
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const prisma = new PrismaClient();

async function setupProductionAccounts() {
  console.log('🧹 Starting production account setup...');
  
  try {
    // Clean up existing data
    console.log('📦 Cleaning up existing data...');
    await prisma.$transaction([
      prisma.queueEntry.deleteMany(),
      prisma.queue.deleteMany(),
      prisma.merchant.deleteMany(),
      prisma.tenantUser.deleteMany(),
      prisma.tenantSubscription.deleteMany(),
      prisma.tenant.deleteMany(),
      prisma.backOfficeUser.deleteMany(),
    ]);
    console.log('✅ Existing data cleaned');

    // Hash password for all accounts
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Create BackOffice Admin
    console.log('👤 Creating BackOffice Admin...');
    await prisma.backOfficeUser.create({
      data: {
        email: 'admin@storehub.com',
        fullName: 'System Administrator',
        password: hashedPassword,
        isActive: true
      }
    });
    console.log('✅ BackOffice Admin created');

    // Create Demo Tenants and Merchants
    const demos = [
      {
        tenantSlug: 'demo1',
        businessName: 'Demo Restaurant 1',
        email: 'demo1@demo.com'
      },
      {
        tenantSlug: 'demo2',
        businessName: 'Demo Restaurant 2',
        email: 'demo2@demo.com'
      }
    ];

    for (const demo of demos) {
      console.log(`\n🏢 Creating ${demo.businessName}...`);
      
      // Create tenant
      const tenant = await prisma.tenant.create({
        data: {
          name: demo.businessName,
          slug: demo.tenantSlug,
          domain: `${demo.tenantSlug}.storehubqms.com`,
          isActive: true
        }
      });
      console.log(`  ✅ Tenant created: ${tenant.slug}`);

      // Create subscription (trial)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30); // 30-day trial

      await prisma.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          status: 'trial',
          priority: 'standard',
          billingCycle: 'monthly',
          startDate: new Date(),
          endDate: trialEndDate,
          maxMerchants: 1,
          maxQueuesPerMerchant: 3,
          maxUsersPerTenant: 5,
          aiFeatures: true,
          analytics: true,
          customBranding: false,
          priority_support: false
        }
      });
      console.log(`  ✅ Trial subscription created (30 days)`);

      // Create merchant
      const merchant = await prisma.merchant.create({
        data: {
          tenantId: tenant.id,
          email: demo.email,
          password: hashedPassword,
          businessName: demo.businessName,
          businessType: 'restaurant',
          phone: '+60123456789',
          isActive: true,
          emailVerified: true
        }
      });
      console.log(`  ✅ Merchant created: ${merchant.email}`);

      // Create default queue
      await prisma.queue.create({
        data: {
          merchantId: merchant.id,
          name: 'Main Queue',
          isActive: false,
          maxCapacity: 50,
          averageServiceTime: 15,
          autoNotifications: true,
          allowCancellation: true,
          requireConfirmation: false
        }
      });
      console.log(`  ✅ Default queue created`);
    }

    console.log('\n🎉 Production accounts setup completed!');
    console.log('\n📋 Account Credentials:');
    console.log('══════════════════════════════════');
    console.log('BackOffice Admin:');
    console.log('  Email: admin@storehub.com');
    console.log('  Password: password123');
    console.log('');
    console.log('Demo Merchant 1:');
    console.log('  Email: demo1@demo.com');
    console.log('  Password: password123');
    console.log('  Access: /t/demo1/');
    console.log('');
    console.log('Demo Merchant 2:');
    console.log('  Email: demo2@demo.com');
    console.log('  Password: password123');
    console.log('  Access: /t/demo2/');
    console.log('══════════════════════════════════');

  } catch (error) {
    console.error('❌ Error setting up accounts:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
setupProductionAccounts();