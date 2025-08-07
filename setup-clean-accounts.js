#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function cleanupAndSetup() {
  console.log('🧹 Starting cleanup and setup process...');
  console.log('=' .repeat(50));
  
  try {
    // Step 1: Clean up existing data
    console.log('\n📝 Step 1: Cleaning up existing data...');
    
    // Delete all queue entries first (due to foreign key constraints)
    await prisma.queueEntry.deleteMany({});
    console.log('  ✓ Deleted all queue entries');
    
    // Delete all queues
    await prisma.queue.deleteMany({});
    console.log('  ✓ Deleted all queues');
    
    // Delete all queue analytics
    await prisma.queueAnalytics.deleteMany({});
    console.log('  ✓ Deleted all queue analytics');
    
    // Delete all merchant settings
    await prisma.merchantSettings.deleteMany({});
    console.log('  ✓ Deleted all merchant settings');
    
    // Delete all merchant addresses
    await prisma.merchantAddress.deleteMany({});
    console.log('  ✓ Deleted all merchant addresses');
    
    // Delete all business hours
    await prisma.businessHours.deleteMany({});
    console.log('  ✓ Deleted all business hours');
    
    // Delete all merchants
    await prisma.merchant.deleteMany({});
    console.log('  ✓ Deleted all merchants');
    
    // Delete all BackOffice audit logs
    await prisma.backOfficeAuditLog.deleteMany({});
    console.log('  ✓ Deleted all backoffice audit logs');
    
    // Delete all BackOffice users
    await prisma.backOfficeUser.deleteMany({});
    console.log('  ✓ Deleted all backoffice users');
    
    // Delete all tenants
    await prisma.tenant.deleteMany({});
    console.log('  ✓ Deleted all tenants');
    
    console.log('\n✅ Cleanup complete!');
    
    // Step 2: Create tenants
    console.log('\n📝 Step 2: Creating tenants...');
    
    const tenants = [
      { name: 'ChickenRice Restaurant', slug: 'chickenrice', domain: 'chickenrice.localhost' },
      { name: 'KFC', slug: 'kfc', domain: 'kfc.localhost' },
      { name: 'Hotpot Palace', slug: 'hotpot', domain: 'hotpot.localhost' }
    ];
    
    const createdTenants = [];
    for (const tenant of tenants) {
      const created = await prisma.tenant.create({
        data: {
          name: tenant.name,
          slug: tenant.slug,
          domain: tenant.domain,
          isActive: true
        }
      });
      createdTenants.push(created);
      console.log(`  ✓ Created tenant: ${tenant.name} (${tenant.slug})`);
    }
    
    // Step 3: Create merchants with password123
    console.log('\n📝 Step 3: Creating merchant accounts...');
    
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    const merchants = [
      {
        businessName: 'ChickenRice Restaurant',
        email: 'chickenrice@demo.com',
        phone: '+60123456789',
        tenantId: createdTenants[0].id
      },
      {
        businessName: 'KFC',
        email: 'kfc@demo.com',
        phone: '+60123456790',
        tenantId: createdTenants[1].id
      },
      {
        businessName: 'Hotpot Palace',
        email: 'hotpot@demo.com',
        phone: '+60123456791',
        tenantId: createdTenants[2].id
      }
    ];
    
    for (const merchant of merchants) {
      const created = await prisma.merchant.create({
        data: {
          businessName: merchant.businessName,
          email: merchant.email,
          password: hashedPassword,
          phone: merchant.phone,
          businessType: 'restaurant',
          isActive: true,
          emailVerified: true,
          tenantId: merchant.tenantId,
          settings: {
            create: {
              seatingCapacity: 50,
              avgMealDuration: 45,
              maxQueueSize: 100,
              firstNotification: 3,
              finalNotification: 1,
              noShowTimeout: 10,
              gracePeriod: 5,
              joinCutoffTime: 30
            }
          },
          address: {
            create: {
              street: '123 Demo Street',
              city: 'Kuala Lumpur',
              state: 'Federal Territory',
              zipCode: '50000',
              country: 'Malaysia'
            }
          }
        }
      });
      
      // Create a default queue for each merchant
      await prisma.queue.create({
        data: {
          merchantId: created.id,
          name: 'Main Queue',
          description: 'Main dining queue',
          isActive: false, // Start with queue stopped
          maxCapacity: 100,
          averageServiceTime: 30,
          currentServing: 0,
          autoNotifications: true,
          notificationInterval: 5,
          analytics: {
            create: {
              totalServed: 0,
              averageWaitTime: 0,
              averageServiceTime: 0
            }
          }
        }
      });
      
      console.log(`  ✓ Created merchant: ${merchant.businessName}`);
      console.log(`    Email: ${merchant.email}`);
      console.log(`    Password: password123`);
    }
    
    // Step 4: Create BackOffice admin
    console.log('\n📝 Step 4: Creating BackOffice admin...');
    
    const backofficeUser = await prisma.backOfficeUser.create({
      data: {
        email: 'admin@demo.com',
        password: hashedPassword,
        fullName: 'Admin User',
        isActive: true
      }
    });
    
    console.log('  ✓ Created BackOffice admin');
    console.log('    Email: admin@demo.com');
    console.log('    Password: password123');
    
    // Step 5: Summary
    console.log('\n' + '=' .repeat(50));
    console.log('✅ SETUP COMPLETE!');
    console.log('=' .repeat(50));
    
    console.log('\n📋 Account Summary:\n');
    
    console.log('MERCHANT ACCOUNTS:');
    console.log('------------------');
    console.log('1. ChickenRice Restaurant');
    console.log('   Email: chickenrice@demo.com');
    console.log('   Password: password123');
    console.log('   URL: http://chickenrice.localhost:3000');
    console.log('');
    console.log('2. KFC');
    console.log('   Email: kfc@demo.com');
    console.log('   Password: password123');
    console.log('   URL: http://kfc.localhost:3000');
    console.log('');
    console.log('3. Hotpot Palace');
    console.log('   Email: hotpot@demo.com');
    console.log('   Password: password123');
    console.log('   URL: http://hotpot.localhost:3000');
    console.log('');
    console.log('BACKOFFICE ADMIN:');
    console.log('-----------------');
    console.log('   Email: admin@demo.com');
    console.log('   Password: password123');
    console.log('   URL: http://localhost:3000/backoffice/login');
    console.log('');
    console.log('DIRECT LOGIN URL (no subdomain needed):');
    console.log('   http://localhost:3000/auth/login');
    console.log('');
    console.log('Note: All accounts use the same password for easy testing.');
    
  } catch (error) {
    console.error('❌ Error during setup:', error);
    console.error('Error details:', error.message);
    if (error.code) console.error('Error code:', error.code);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
cleanupAndSetup();