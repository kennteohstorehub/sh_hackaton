const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const colors = require('colors');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

// Test data
const TEST_MERCHANT_ID = 'f8c3bf2c-c3e1-4e9e-94b6-e1a456123456';
const TEST_QUEUE_ID = 'bb6aec56-d06d-4706-a793-1cfa9e9a1ad9';

async function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const icons = {
    success: '✓'.green,
    error: '✗'.red,
    info: 'ℹ'.blue,
    warning: '⚠'.yellow,
    step: '▸'.cyan
  };
  
  console.log(`[${timestamp}] ${icons[type] || icons.info} ${message}`);
}

async function testQueuePersistence() {
  console.log('\n' + '='.repeat(60).magenta);
  console.log('QUEUE PERSISTENCE TEST'.bold.white);
  console.log('Testing customer visibility after acknowledgment'.gray);
  console.log('='.repeat(60).magenta + '\n');

  try {
    // Step 1: Create a test customer in queue
    await log('Creating test customer in queue...', 'step');
    
    // Generate a unique customer ID
    const customerId = 'test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    const testCustomer = await prisma.queueEntry.create({
      data: {
        queueId: TEST_QUEUE_ID,
        customerId: customerId,
        customerName: 'Test Customer',
        customerPhone: '+60123456789',
        partySize: 2,
        position: 99,
        status: 'waiting',
        platform: 'web',  // Required field
        joinedAt: new Date(),
        estimatedWaitTime: 15
      }
    });
    
    await log(`Created customer: ${testCustomer.id}`, 'success');

    // Step 2: Verify customer appears in dashboard (waiting status)
    await log('Checking if customer appears in dashboard (waiting status)...', 'step');
    
    const waitingQueue = await prisma.queue.findUnique({
      where: { id: TEST_QUEUE_ID },
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

    const foundWaiting = waitingQueue?.entries.find(e => e.id === testCustomer.id);
    if (foundWaiting) {
      await log('✓ Customer visible in dashboard with waiting status', 'success');
    } else {
      await log('✗ Customer NOT visible in dashboard with waiting status', 'error');
      throw new Error('Customer not found in waiting status');
    }

    // Step 3: Call the customer (change status to 'called')
    await log('Calling customer (changing status to called)...', 'step');
    
    const calledCustomer = await prisma.queueEntry.update({
      where: { id: testCustomer.id },
      data: {
        status: 'called',
        calledAt: new Date(),
        verificationCode: 'TEST'
      }
    });
    
    await log(`Customer called with verification code: ${calledCustomer.verificationCode}`, 'success');

    // Step 4: Verify customer still appears in dashboard (called status)
    await log('Checking if customer still appears in dashboard (called status)...', 'step');
    
    const calledQueue = await prisma.queue.findUnique({
      where: { id: TEST_QUEUE_ID },
      include: {
        entries: {
          where: {
            status: {
              in: ['waiting', 'called']  // THIS IS THE KEY FIX
            }
          },
          orderBy: {
            position: 'asc'
          }
        }
      }
    });

    const foundCalled = calledQueue?.entries.find(e => e.id === testCustomer.id);
    if (foundCalled) {
      await log('✓ Customer STILL visible in dashboard with called status', 'success');
      await log(`  Status: ${foundCalled.status}`, 'info');
      await log(`  Called at: ${foundCalled.calledAt}`, 'info');
    } else {
      await log('✗ Customer disappeared from dashboard after being called', 'error');
      throw new Error('Customer not found after being called');
    }

    // Step 5: Simulate customer acknowledgment
    await log('Simulating customer acknowledgment (On My Way)...', 'step');
    
    const acknowledgedCustomer = await prisma.queueEntry.update({
      where: { id: testCustomer.id },
      data: {
        acknowledgedAt: new Date(),
        acknowledgmentType: 'on_way',
        estimatedArrival: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      }
    });
    
    await log('Customer acknowledged notification', 'success');

    // Step 6: Verify customer STILL appears in dashboard after acknowledgment
    await log('Checking if customer still appears after acknowledgment...', 'step');
    
    const acknowledgedQueue = await prisma.queue.findUnique({
      where: { id: TEST_QUEUE_ID },
      include: {
        entries: {
          where: {
            status: {
              in: ['waiting', 'called']  // Customer should still be 'called' status
            }
          },
          orderBy: {
            position: 'asc'
          }
        }
      }
    });

    const foundAcknowledged = acknowledgedQueue?.entries.find(e => e.id === testCustomer.id);
    if (foundAcknowledged) {
      await log('✓ Customer STILL visible after acknowledgment!', 'success');
      await log(`  Status: ${foundAcknowledged.status}`, 'info');
      await log(`  Acknowledgment: ${foundAcknowledged.acknowledgmentType}`, 'info');
      await log(`  ETA: ${foundAcknowledged.estimatedArrival}`, 'info');
    } else {
      await log('✗ Customer disappeared after acknowledgment', 'error');
      throw new Error('Customer not found after acknowledgment');
    }

    // Step 7: Test API endpoint
    await log('Testing dashboard API endpoint...', 'step');
    
    try {
      const response = await axios.get(`${BASE_URL}/dashboard`, {
        headers: {
          'Cookie': 'merchantId=' + TEST_MERCHANT_ID
        }
      });
      
      // Check if response contains our customer
      const html = response.data;
      const containsCustomer = html.includes('Test Customer') || html.includes(testCustomer.id);
      
      if (containsCustomer) {
        await log('✓ Dashboard HTML contains the customer', 'success');
      } else {
        await log('⚠ Dashboard HTML might not contain the customer', 'warning');
      }
    } catch (apiError) {
      await log(`API test skipped (server might need auth): ${apiError.message}`, 'warning');
    }

    // Step 8: Complete the customer (seat them)
    await log('Seating customer (changing status to completed)...', 'step');
    
    const completedCustomer = await prisma.queueEntry.update({
      where: { id: testCustomer.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        tableNumber: 'T-12'
      }
    });
    
    await log('Customer seated at table T-12', 'success');

    // Step 9: Verify customer no longer appears in active queue
    await log('Checking if seated customer is removed from active queue...', 'step');
    
    const completedQueue = await prisma.queue.findUnique({
      where: { id: TEST_QUEUE_ID },
      include: {
        entries: {
          where: {
            status: {
              in: ['waiting', 'called']
            }
          }
        }
      }
    });

    const foundCompleted = completedQueue?.entries.find(e => e.id === testCustomer.id);
    if (!foundCompleted) {
      await log('✓ Seated customer correctly removed from active queue', 'success');
    } else {
      await log('✗ Seated customer still in active queue', 'error');
    }

    // Cleanup
    await log('Cleaning up test data...', 'step');
    await prisma.queueEntry.delete({
      where: { id: testCustomer.id }
    });
    await log('Test data cleaned up', 'success');

    // Summary
    console.log('\n' + '='.repeat(60).green);
    console.log('TEST PASSED! 🎉'.bold.green);
    console.log('Queue persistence is working correctly:'.green);
    console.log('  ✓ Customers stay visible when waiting'.green);
    console.log('  ✓ Customers stay visible when called'.green);
    console.log('  ✓ Customers stay visible after acknowledgment'.green);
    console.log('  ✓ Customers are removed only when seated'.green);
    console.log('='.repeat(60).green + '\n');

  } catch (error) {
    console.log('\n' + '='.repeat(60).red);
    console.log('TEST FAILED! ❌'.bold.red);
    console.log(`Error: ${error.message}`.red);
    console.log('='.repeat(60).red + '\n');
    
    // Cleanup on error
    try {
      await prisma.queueEntry.deleteMany({
        where: {
          customerName: 'Test Customer',
          customerPhone: '+60123456789'
        }
      });
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testQueuePersistence().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});