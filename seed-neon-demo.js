#!/usr/bin/env node

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function seedNeonDemo() {
  console.log('🌱 Seeding Neon Database with Demo Data');
  console.log('=' .repeat(50));
  
  // Use the Neon database URL from .env.test
  const databaseUrl = 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to Neon database');
    
    // Check if demo merchant already exists
    const checkResult = await client.query(
      'SELECT * FROM "Merchant" WHERE email = $1',
      ['demo@storehub.com']
    );
    
    let merchantId;
    
    if (checkResult.rows.length > 0) {
      console.log('⚠️  Demo merchant already exists');
      merchantId = checkResult.rows[0].id;
      console.log('Merchant ID:', merchantId);
      
      // Update password
      const hashedPassword = await bcrypt.hash('demo123', 12);
      await client.query(
        'UPDATE "Merchant" SET password = $1 WHERE id = $2',
        [hashedPassword, merchantId]
      );
      console.log('✅ Password updated');
    } else {
      // Create demo merchant
      console.log('\n📝 Creating demo merchant...');
      const hashedPassword = await bcrypt.hash('demo123', 12);
      
      const insertResult = await client.query(`
        INSERT INTO "Merchant" (
          id, "businessName", email, password, phone, "businessType", 
          "isActive", "emailVerified", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
        ) RETURNING id
      `, [
        'StoreHub Demo Restaurant',
        'demo@storehub.com',
        hashedPassword,
        '+60123456789',
        'restaurant',
        true,
        true
      ]);
      
      merchantId = insertResult.rows[0].id;
      console.log('✅ Demo merchant created');
      console.log('Merchant ID:', merchantId);
      
      // Create merchant settings
      await client.query(`
        INSERT INTO "MerchantSettings" (
          id, "merchantId", "seatingCapacity", "avgMealDuration", "maxQueueSize"
        ) VALUES (
          gen_random_uuid(), $1, 50, 45, 50
        )
      `, [merchantId]);
      console.log('✅ Merchant settings created');
      
      // Create merchant subscription
      await client.query(`
        INSERT INTO "MerchantSubscription" (
          id, "merchantId", plan, "isActive", "maxQueues", "maxCustomersPerQueue"
        ) VALUES (
          gen_random_uuid(), $1, 'free', true, 5, 100
        )
      `, [merchantId]);
      console.log('✅ Merchant subscription created');
    }
    
    // Check for existing queue
    const queueCheck = await client.query(
      'SELECT * FROM "Queue" WHERE "merchantId" = $1 LIMIT 1',
      [merchantId]
    );
    
    let queueId;
    
    if (queueCheck.rows.length > 0) {
      queueId = queueCheck.rows[0].id;
      console.log('⚠️  Demo queue already exists, ID:', queueId);
    } else {
      // Create demo queue
      console.log('\n📝 Creating demo queue...');
      const queueResult = await client.query(`
        INSERT INTO "Queue" (
          id, "merchantId", name, description, "isActive", "maxCapacity",
          "averageServiceTime", "currentServing", "autoNotifications",
          "notificationInterval", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
        ) RETURNING id
      `, [
        merchantId,
        'Main Dining Queue',
        'General dining queue for walk-in customers',
        true,
        50,
        30,
        5,
        true,
        5
      ]);
      
      queueId = queueResult.rows[0].id;
      console.log('✅ Demo queue created, ID:', queueId);
    }
    
    // Clear existing demo entries
    await client.query(
      'DELETE FROM "QueueEntry" WHERE "queueId" = $1 AND "customerId" LIKE $2',
      [queueId, 'demo-customer-%']
    );
    
    // Create demo queue entries
    console.log('\n📝 Creating demo queue entries...');
    const statuses = ['waiting', 'called', 'serving', 'completed'];
    
    for (let i = 1; i <= 10; i++) {
      await client.query(`
        INSERT INTO "QueueEntry" (
          id, "queueId", "customerId", "customerName", "customerPhone",
          platform, position, "estimatedWaitTime", status, "partySize",
          "joinedAt", "notificationCount"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0
        )
      `, [
        queueId,
        `demo-customer-${i}`,
        `Customer ${i}`,
        `+6012345678${i}`,
        i % 2 === 0 ? 'whatsapp' : 'web',
        i,
        i * 5,
        statuses[Math.min(i - 1, 3)],
        Math.floor(Math.random() * 4) + 1,
        new Date(Date.now() - (i * 10 * 60 * 1000))
      ]);
    }
    
    console.log('✅ Created 10 demo queue entries');
    
    console.log('\n' + '=' .repeat(50));
    console.log('🎉 Demo data seeded successfully in Neon!');
    console.log('\nYou can now log in with:');
    console.log('Email: demo@storehub.com');
    console.log('Password: demo123');
    console.log('\nMerchant ID:', merchantId);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error('Error details:', error);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from Neon database');
  }
}

// Run the seeding
seedNeonDemo()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });