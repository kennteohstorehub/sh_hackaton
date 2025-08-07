#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const QUEUE_ID = 'bb6aec56-d06d-4706-a793-1cfa9e9a1ad9';

async function createCalledCustomer() {
  console.log('🚀 Creating Test Customer with CALLED Status\n');
  console.log('='.repeat(50));
  
  try {
    // Create a test customer directly in database with 'called' status
    const testCustomer = await prisma.queueEntry.create({
      data: {
        queueId: QUEUE_ID,
        customerId: 'manual-test-' + Date.now(),
        customerName: 'Manual Test Customer',
        customerPhone: '+60199998888',
        partySize: 4,
        position: 1,
        status: 'called',  // Set directly to called
        platform: 'web',
        joinedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        calledAt: new Date(Date.now() - 2 * 60 * 1000),  // Called 2 minutes ago
        verificationCode: 'M123',
        estimatedWaitTime: 0,
        specialRequests: 'Window seat please'
      }
    });
    
    console.log('\n✅ SUCCESS! Customer created with CALLED status:');
    console.log('   Name: ' + testCustomer.customerName);
    console.log('   Phone: ' + testCustomer.customerPhone);
    console.log('   Status: ' + testCustomer.status);
    console.log('   Verification Code: ' + testCustomer.verificationCode);
    console.log('   Called at: ' + testCustomer.calledAt);
    console.log('   ID: ' + testCustomer.id);
    
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Open your browser and go to: http://localhost:3000');
    console.log('2. Login with:');
    console.log('   Email: demo@example.com');
    console.log('   Password: password123');
    console.log('3. You should see "Manual Test Customer" with a "Seat Customer" button');
    console.log('4. Click the button to test table assignment');
    
    console.log('\n⚠️  To clean up this test customer later, run:');
    console.log(`   node -e "const p=require('@prisma/client');const prisma=new p.PrismaClient();prisma.queueEntry.delete({where:{id:'${testCustomer.id}'}}).then(()=>{console.log('Deleted');process.exit()})"`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('Unique constraint')) {
      console.error('\n💡 TIP: There might be an existing test customer. Try cleaning up first.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Also check current queue status
async function checkQueueStatus() {
  console.log('\n📊 Current Queue Status:');
  console.log('='.repeat(50));
  
  const queue = await prisma.queue.findUnique({
    where: { id: QUEUE_ID },
    include: {
      entries: {
        where: {
          status: {
            in: ['waiting', 'called']
          }
        },
        orderBy: {
          position: 'asc'
        }
      }
    }
  });
  
  if (queue) {
    console.log(`Queue: ${queue.name}`);
    console.log(`Active: ${queue.isActive}`);
    console.log(`Customers in queue: ${queue.entries.length}`);
    
    queue.entries.forEach((entry, index) => {
      console.log(`\n${index + 1}. ${entry.customerName}`);
      console.log(`   Status: ${entry.status}`);
      console.log(`   Phone: ${entry.customerPhone}`);
      if (entry.verificationCode) {
        console.log(`   Code: ${entry.verificationCode}`);
      }
    });
  } else {
    console.log('Queue not found!');
  }
}

// Run both functions
async function main() {
  await createCalledCustomer();
  await checkQueueStatus();
}

main().catch(console.error);