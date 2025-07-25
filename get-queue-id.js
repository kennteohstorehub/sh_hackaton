#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

async function getQueueId() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL
      }
    }
  });

  try {
    console.log('Finding demo merchant queue...');
    
    const queue = await prisma.queue.findFirst({
      where: {
        merchantId: '7a99f35e-0f73-4f8e-831c-fde8fc3a5532',
        isActive: true
      }
    });
    
    if (queue) {
      console.log('\n✅ Found queue:');
      console.log('Queue ID:', queue.id);
      console.log('Queue Name:', queue.name);
      console.log('Is Active:', queue.isActive);
      console.log('\n🔗 Public Queue URL:');
      console.log(`https://queuemanagement-vtc2.onrender.com/queue/${queue.id}`);
    } else {
      console.log('❌ No active queue found for demo merchant');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getQueueId();