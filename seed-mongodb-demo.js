#!/usr/bin/env node

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Merchant = require('./server/models/Merchant');
const Queue = require('./server/models/Queue');
const QueueEntry = require('./server/models/QueueEntry');
require('dotenv').config();

async function seedDemoData() {
  console.log('🌱 Seeding MongoDB with Demo Data');
  console.log('=' .repeat(50));
  
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/queue_manager';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Check if demo merchant already exists
    const existingMerchant = await Merchant.findOne({ email: 'demo@storehub.com' });
    if (existingMerchant) {
      console.log('⚠️  Demo merchant already exists');
      console.log('Merchant ID:', existingMerchant._id);
      console.log('Email:', existingMerchant.email);
      console.log('Business Name:', existingMerchant.businessName);
      
      // Update password to ensure it's correct
      existingMerchant.password = await bcrypt.hash('demo123', 12);
      await existingMerchant.save();
      console.log('✅ Password updated');
      
      return existingMerchant;
    }
    
    // Create demo merchant
    console.log('\n📝 Creating demo merchant...');
    const hashedPassword = await bcrypt.hash('demo123', 12);
    
    const demoMerchant = new Merchant({
      businessName: 'StoreHub Demo Restaurant',
      email: 'demo@storehub.com',
      password: hashedPassword,
      phone: '+60123456789',
      businessType: 'restaurant',
      isActive: true,
      emailVerified: true
    });
    
    await demoMerchant.save();
    console.log('✅ Demo merchant created');
    console.log('Merchant ID:', demoMerchant._id);
    console.log('Email:', demoMerchant.email);
    console.log('Password: demo123');
    
    // Create demo queue
    console.log('\n📝 Creating demo queue...');
    const demoQueue = new Queue({
      merchantId: demoMerchant._id,
      name: 'Main Dining Queue',
      description: 'General dining queue for walk-in customers',
      isActive: true,
      maxCapacity: 50,
      averageServiceTime: 30,
      currentServing: 5,
      autoNotifications: true,
      notificationInterval: 5
    });
    
    await demoQueue.save();
    console.log('✅ Demo queue created');
    console.log('Queue ID:', demoQueue._id);
    
    // Create some demo queue entries
    console.log('\n📝 Creating demo queue entries...');
    const statuses = ['waiting', 'called', 'serving', 'completed'];
    const entries = [];
    
    for (let i = 1; i <= 10; i++) {
      const entry = new QueueEntry({
        queueId: demoQueue._id,
        customerId: `demo-customer-${i}`,
        customerName: `Customer ${i}`,
        customerPhone: `+6012345678${i}`,
        platform: i % 2 === 0 ? 'whatsapp' : 'web',
        position: i,
        estimatedWaitTime: i * 5,
        status: statuses[Math.min(i - 1, 3)],
        partySize: Math.floor(Math.random() * 4) + 1,
        joinedAt: new Date(Date.now() - (i * 10 * 60 * 1000)) // 10 minutes apart
      });
      
      entries.push(entry);
    }
    
    await QueueEntry.insertMany(entries);
    console.log(`✅ Created ${entries.length} demo queue entries`);
    
    // Add entries to queue
    demoQueue.entries = entries.map(e => e._id);
    await demoQueue.save();
    
    console.log('\n' + '=' .repeat(50));
    console.log('🎉 Demo data seeded successfully!');
    console.log('\nYou can now log in with:');
    console.log('Email: demo@storehub.com');
    console.log('Password: demo123');
    console.log('\nMerchant ID:', demoMerchant._id);
    
    return demoMerchant;
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the seeding
seedDemoData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });