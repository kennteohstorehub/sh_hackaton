#!/usr/bin/env node

const prisma = require('./server/utils/prisma');

async function fixQueuePositions() {
  try {
    console.log('Fixing queue positions...\n');
    
    // Get all active queues
    const queues = await prisma.queue.findMany({
      where: { isActive: true }
    });
    
    for (const queue of queues) {
      console.log(`\nProcessing queue: ${queue.name} (${queue.id})`);
      
      // Get all waiting customers ordered by joinedAt
      const waitingCustomers = await prisma.queueEntry.findMany({
        where: {
          queueId: queue.id,
          status: 'waiting'
        },
        orderBy: {
          joinedAt: 'asc'
        }
      });
      
      console.log(`  Found ${waitingCustomers.length} waiting customers`);
      
      // Update positions
      for (let i = 0; i < waitingCustomers.length; i++) {
        const correctPosition = i + 1;
        const customer = waitingCustomers[i];
        
        if (customer.position !== correctPosition) {
          await prisma.queueEntry.update({
            where: { id: customer.id },
            data: { 
              position: correctPosition,
              estimatedWaitTime: correctPosition * (queue.averageServiceTime || 15)
            }
          });
          console.log(`  Updated ${customer.customerName}: position ${customer.position} → ${correctPosition}`);
        }
      }
    }
    
    console.log('\n✅ Queue positions fixed!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixQueuePositions();