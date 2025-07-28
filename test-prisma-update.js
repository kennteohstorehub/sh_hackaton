#!/usr/bin/env node

const prisma = require('./server/utils/prisma');

async function testUpdate() {
  try {
    // First, find a waiting customer
    const waiting = await prisma.queueEntry.findFirst({
      where: {
        queueId: '6dab0655-d08c-45f7-91fe-4cefc3f2485e',
        status: 'waiting'
      },
      orderBy: { position: 'asc' }
    });
    
    if (!waiting) {
      console.log('No waiting customers found');
      return;
    }
    
    console.log('Found waiting customer:', {
      id: waiting.id,
      name: waiting.customerName,
      status: waiting.status
    });
    
    // Update the customer
    const updated = await prisma.queueEntry.update({
      where: { id: waiting.id },
      data: {
        status: 'called',
        calledAt: new Date()
      }
    });
    
    console.log('\nUpdated customer:', {
      id: updated.id,
      name: updated.customerName,
      status: updated.status,
      calledAt: updated.calledAt
    });
    
    // Verify by fetching again
    const verified = await prisma.queueEntry.findUnique({
      where: { id: waiting.id }
    });
    
    console.log('\nVerified from DB:', {
      id: verified.id,
      status: verified.status
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testUpdate();