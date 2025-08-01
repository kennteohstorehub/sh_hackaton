const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// This script seeds the demo user in production
// Usage: DATABASE_URL="your-production-url" node seed-production.js

const prisma = new PrismaClient();

async function seedProduction() {
  console.log('🌱 Seeding production database with demo user...');
  
  try {
    // Check if demo merchant already exists
    const existingMerchant = await prisma.merchant.findUnique({
      where: { email: 'demo@smartqueue.com' }
    });

    if (existingMerchant) {
      console.log('✅ Demo merchant already exists');
      console.log('   ID:', existingMerchant.id);
      console.log('   Email:', existingMerchant.email);
      console.log('   Business:', existingMerchant.businessName);
      
      // Update password to ensure it's correct
      const hashedPassword = await bcrypt.hash('demo123456', 10);
      await prisma.merchant.update({
        where: { id: existingMerchant.id },
        data: { password: hashedPassword }
      });
      console.log('✅ Password updated to ensure correct hash');
      return;
    }

    // Hash the password with same rounds as seed.js
    const hashedPassword = await bcrypt.hash('demo123456', 10);

    // Create demo merchant with minimal required data
    const merchant = await prisma.merchant.create({
      data: {
        email: 'demo@smartqueue.com',
        password: hashedPassword,
        businessName: 'Demo Restaurant',
        businessType: 'restaurant',
        phone: '+60123456789',
        timezone: 'Asia/Kuala_Lumpur',
        isActive: true,
        emailVerified: true,
        // Create related records with defaults
        settings: {
          create: {}
        },
        subscription: {
          create: {
            plan: 'premium',
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
            isActive: true
          }
        },
        integrations: {
          create: {}
        }
      }
    });

    console.log('✅ Demo merchant created successfully!');
    console.log('   ID:', merchant.id);
    console.log('   Email:', merchant.email);
    console.log('   Business:', merchant.businessName);
    console.log('\n📧 Login Credentials:');
    console.log('   Email: demo@smartqueue.com');
    console.log('   Password: demo123456');
    
  } catch (error) {
    console.error('❌ Error seeding production:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed
seedProduction()
  .then(() => {
    console.log('\n✅ Production seeding completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Production seeding failed:', error);
    process.exit(1);
  });