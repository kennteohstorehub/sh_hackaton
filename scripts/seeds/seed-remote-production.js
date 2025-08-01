const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// This script seeds the demo user directly to a remote production database
// Usage: node seed-remote-production.js "postgresql://user:pass@host:port/db"

async function seedRemoteProduction() {
  const productionUrl = process.argv[2];
  
  if (!productionUrl) {
    console.error('❌ Error: Please provide the production DATABASE_URL as an argument');
    console.log('\nUsage: node seed-remote-production.js "postgresql://..."');
    console.log('\nTo get your Render database URL:');
    console.log('1. Go to Render Dashboard');
    console.log('2. Click on your PostgreSQL database');
    console.log('3. Copy the "External Database URL"');
    console.log('4. Run: node seed-remote-production.js "YOUR_URL_HERE"');
    process.exit(1);
  }

  // Create Prisma client with production URL
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: productionUrl
      }
    }
  });

  console.log('🌱 Connecting to production database...');
  
  try {
    // Test connection
    await prisma.$connect();
    console.log('✅ Connected to production database');

    // Check if demo merchant already exists
    const existingMerchant = await prisma.merchant.findUnique({
      where: { email: 'demo@smartqueue.com' }
    });

    if (existingMerchant) {
      console.log('\n✅ Demo merchant already exists:');
      console.log('   ID:', existingMerchant.id);
      console.log('   Email:', existingMerchant.email);
      console.log('   Business:', existingMerchant.businessName);
      
      // Update password to ensure it's correct
      console.log('\n🔐 Updating password to ensure correct hash...');
      const hashedPassword = await bcrypt.hash('demo123456', 10);
      await prisma.merchant.update({
        where: { id: existingMerchant.id },
        data: { password: hashedPassword }
      });
      console.log('✅ Password updated successfully!');
      
      console.log('\n📧 Login Credentials:');
      console.log('   URL: https://queuemanagement-vtc2.onrender.com');
      console.log('   Email: demo@smartqueue.com');
      console.log('   Password: demo123456');
      return;
    }

    console.log('\n📝 Creating demo merchant...');
    
    // Hash the password with same rounds as seed.js
    const hashedPassword = await bcrypt.hash('demo123456', 10);

    // Create demo merchant with all required data
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
        // Create all related records
        address: {
          create: {
            street: '123 Demo Street',
            city: 'Kuala Lumpur',
            state: 'Federal Territory',
            zipCode: '50000',
            country: 'Malaysia'
          }
        },
        businessHours: {
          create: [
            { dayOfWeek: 'monday', start: '09:00', end: '22:00', closed: false },
            { dayOfWeek: 'tuesday', start: '09:00', end: '22:00', closed: false },
            { dayOfWeek: 'wednesday', start: '09:00', end: '22:00', closed: false },
            { dayOfWeek: 'thursday', start: '09:00', end: '22:00', closed: false },
            { dayOfWeek: 'friday', start: '09:00', end: '23:00', closed: false },
            { dayOfWeek: 'saturday', start: '10:00', end: '23:00', closed: false },
            { dayOfWeek: 'sunday', start: '10:00', end: '21:00', closed: false }
          ]
        },
        serviceTypes: {
          create: [
            {
              name: 'Dine In',
              estimatedDuration: 45,
              description: 'Table service dining',
              isActive: true
            },
            {
              name: 'Takeout',
              estimatedDuration: 15,
              description: 'Quick pickup service',
              isActive: true
            }
          ]
        },
        settings: {
          create: {
            seatingCapacity: 100,
            avgMealDuration: 45,
            maxQueueSize: 50,
            autoPauseThreshold: 0.9,
            noShowTimeout: 15,
            gracePeriod: 5,
            joinCutoffTime: 30,
            advanceBookingHours: 0,
            partySizeRegularMin: 1,
            partySizeRegularMax: 8,
            partySizePeakMin: 2,
            partySizePeakMax: 6,
            firstNotification: 10,
            finalNotification: 0,
            adjustForPeakHours: true,
            sendNoShowWarning: true,
            confirmTableAcceptance: true,
            peakHours: {},
            peakMultiplier: 1.5,
            priorityEnabled: true,
            prioritySlots: 2,
            prioritySkipRegular: false,
            priorityNotifyFirst: true,
            priorityLongerGrace: true
          }
        },
        subscription: {
          create: {
            plan: 'premium',
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
            isActive: true,
            maxQueues: 10,
            maxCustomersPerQueue: 100,
            aiFeatures: true,
            analytics: true,
            customBranding: true
          }
        },
        integrations: {
          create: {
            whatsappEnabled: true,
            whatsappPhoneNumber: '+60123456789'
          }
        }
      },
      include: {
        settings: true,
        subscription: true,
        integrations: true,
        serviceTypes: true
      }
    });

    console.log('\n✅ Demo merchant created successfully!');
    console.log('   ID:', merchant.id);
    console.log('   Email:', merchant.email);
    console.log('   Business:', merchant.businessName);
    
    // Create a sample queue
    console.log('\n📋 Creating sample queue...');
    const queue = await prisma.queue.create({
      data: {
        merchantId: merchant.id,
        name: 'Main Dining Queue',
        description: 'General dining queue for walk-in customers',
        isActive: true,
        maxCapacity: 50,
        averageServiceTime: 45,
        currentServing: 0,
        autoNotifications: true,
        notificationInterval: 5,
        allowCancellation: true,
        requireConfirmation: true
      }
    });
    console.log('✅ Sample queue created:', queue.name);
    
    console.log('\n🎉 Production seeding completed!');
    console.log('\n📧 Login Credentials:');
    console.log('   URL: https://queuemanagement-vtc2.onrender.com');
    console.log('   Email: demo@smartqueue.com');
    console.log('   Password: demo123456');
    
  } catch (error) {
    console.error('\n❌ Error seeding production:', error);
    console.error('\nDetails:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the seed
seedRemoteProduction()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    process.exit(1);
  });