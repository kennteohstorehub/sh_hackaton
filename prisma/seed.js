const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Check if demo merchant already exists
  const existingMerchant = await prisma.merchant.findUnique({
    where: { email: 'demo@smartqueue.com' }
  });

  if (existingMerchant) {
    console.log('✅ Demo merchant already exists');
    return;
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash('demo123456', 10);

  // Create demo merchant with all related data
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
      // Create related records
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
          },
          {
            name: 'Private Dining',
            estimatedDuration: 90,
            description: 'VIP room service',
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
          peakHours: {
            friday: [{ start: '18:00', end: '21:00' }],
            saturday: [{ start: '12:00', end: '14:00' }, { start: '18:00', end: '21:00' }],
            sunday: [{ start: '12:00', end: '14:00' }]
          },
          peakMultiplier: 1.5,
          priorityEnabled: true,
          prioritySlots: 2,
          prioritySkipRegular: false,
          priorityNotifyFirst: true,
          priorityLongerGrace: true,
          notificationTemplates: {
            create: [
              {
                type: 'welcome',
                template: 'Welcome to {{businessName}}! You are #{{position}} in the queue. Estimated wait: {{waitTime}} minutes.'
              },
              {
                type: 'position_update',
                template: 'Good news! You are now #{{position}} in the queue. Your wait time is approximately {{waitTime}} minutes.'
              },
              {
                type: 'final_call',
                template: '🔔 Your table is ready! Please proceed to the host stand within {{gracePeriod}} minutes.'
              },
              {
                type: 'no_show_warning',
                template: '⚠️ Last call! Your table will be released in {{remainingTime}} minutes if you don\'t confirm.'
              }
            ]
          }
        }
      },
      subscription: {
        create: {
          plan: 'premium',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
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

  console.log('✅ Demo merchant created:', merchant.businessName);

  // Create a sample queue
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

  // Add some sample queue entries for demo
  const sampleCustomers = [
    { name: 'John Doe', phone: '+60191234567', partySize: 2 },
    { name: 'Jane Smith', phone: '+60182345678', partySize: 4 },
    { name: 'Robert Lee', phone: '+60173456789', partySize: 3 },
    { name: 'Sarah Johnson', phone: '+60164567890', partySize: 5 }
  ];

  for (let i = 0; i < sampleCustomers.length; i++) {
    const customer = sampleCustomers[i];
    await prisma.queueEntry.create({
      data: {
        queueId: queue.id,
        customerId: `demo-customer-${i + 1}`,
        customerName: customer.name,
        customerPhone: customer.phone,
        platform: 'web',
        position: i + 1,
        estimatedWaitTime: (i + 1) * 15,
        status: 'waiting',
        priority: 'normal',
        partySize: customer.partySize,
        notes: i === 0 ? 'Anniversary celebration' : null
      }
    });
  }

  console.log('✅ Sample queue entries created');
  console.log('\n🎉 Database seed completed!');
  console.log('\n📧 Demo Account Credentials:');
  console.log('   Email: demo@smartqueue.com');
  console.log('   Password: demo123456');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });