#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function seedDemoData() {
  console.log('🌱 Seeding PostgreSQL with Demo Data');
  console.log('=' .repeat(50));
  
  try {
    // Check if demo merchant already exists
    const existingMerchant = await prisma.merchant.findUnique({
      where: { email: 'demo@storehub.com' }
    });
    
    if (existingMerchant) {
      console.log('⚠️  Demo merchant already exists');
      console.log('Merchant ID:', existingMerchant.id);
      console.log('Email:', existingMerchant.email);
      console.log('Business Name:', existingMerchant.businessName);
      
      // Update password to ensure it's correct
      await prisma.merchant.update({
        where: { id: existingMerchant.id },
        data: {
          password: await bcrypt.hash('demo123', 12)
        }
      });
      console.log('✅ Password updated');
      
      return existingMerchant;
    }
    
    // Create demo merchant
    console.log('\n📝 Creating demo merchant...');
    const hashedPassword = await bcrypt.hash('demo123', 12);
    
    const demoMerchant = await prisma.merchant.create({
      data: {
        businessName: 'StoreHub Demo Restaurant',
        email: 'demo@storehub.com',
        password: hashedPassword,
        phone: '+60123456789',
        businessType: 'restaurant',
        isActive: true,
        emailVerified: true,
        settings: {
          create: {
            seatingCapacity: 50,
            avgMealDuration: 45,
            maxQueueSize: 50
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
        },
        subscription: {
          create: {
            plan: 'free',
            isActive: true,
            maxQueues: 5,
            maxCustomersPerQueue: 100
          }
        }
      }
    });
    
    console.log('✅ Demo merchant created');
    console.log('Merchant ID:', demoMerchant.id);
    console.log('Email:', demoMerchant.email);
    console.log('Password: demo123');
    
    // Create demo queue
    console.log('\n📝 Creating demo queue...');
    const demoQueue = await prisma.queue.create({
      data: {
        merchantId: demoMerchant.id,
        name: 'Main Dining Queue',
        description: 'General dining queue for walk-in customers',
        isActive: true,
        maxCapacity: 50,
        averageServiceTime: 30,
        currentServing: 5,
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
    
    console.log('✅ Demo queue created');
    console.log('Queue ID:', demoQueue.id);
    
    // Create some demo queue entries
    console.log('\n📝 Creating demo queue entries...');
    const statuses = ['waiting', 'called', 'serving', 'completed'];
    const entries = [];
    
    for (let i = 1; i <= 10; i++) {
      const entry = await prisma.queueEntry.create({
        data: {
          queueId: demoQueue.id,
          customerId: `demo-customer-${i}`,
          customerName: `Customer ${i}`,
          customerPhone: `+6012345678${i}`,
          platform: i % 2 === 0 ? 'whatsapp' : 'web',
          position: i,
          estimatedWaitTime: i * 5,
          status: statuses[Math.min(i - 1, 3)],
          partySize: Math.floor(Math.random() * 4) + 1,
          joinedAt: new Date(Date.now() - (i * 10 * 60 * 1000)) // 10 minutes apart
        }
      });
      
      entries.push(entry);
    }
    
    console.log(`✅ Created ${entries.length} demo queue entries`);
    
    console.log('\n' + '=' .repeat(50));
    console.log('🎉 Demo data seeded successfully!');
    console.log('\nYou can now log in with:');
    console.log('Email: demo@storehub.com');
    console.log('Password: demo123');
    console.log('\nMerchant ID:', demoMerchant.id);
    
    return demoMerchant;
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error('Error details:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('\n🔌 Disconnected from PostgreSQL');
  }
}

// Run the seeding
seedDemoData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });