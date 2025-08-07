// Test script to create sample completed customers with various timestamps
const prisma = require('./server/utils/prisma');

async function createTestCompletedCustomers() {
  try {
    console.log('Creating test completed customers...\n');
    
    // Get the first active queue
    const queue = await prisma.queue.findFirst({
      where: { isActive: true }
    });
    
    if (!queue) {
      console.log('No active queue found. Please create a queue first.');
      return;
    }
    
    console.log(`Using queue: ${queue.name} (${queue.id})\n`);
    
    // Create test customers with different time scenarios
    const testCustomers = [
      {
        name: 'Quick Service Customer',
        phone: '+60123456789',
        partySize: 2,
        joinedOffset: -60, // joined 60 minutes ago
        calledOffset: -55, // called after 5 minutes
        acknowledgedOffset: -54, // acknowledged after 1 minute
        servedOffset: -50, // served after 5 minutes
        completedOffset: -30, // completed 20 minutes after serving
      },
      {
        name: 'Long Wait Customer',
        phone: '+60198765432',
        partySize: 4,
        joinedOffset: -120, // joined 2 hours ago
        calledOffset: -80, // called after 40 minutes
        acknowledgedOffset: -78, // acknowledged after 2 minutes
        servedOffset: -75, // served after 5 minutes
        completedOffset: -45, // completed 30 minutes after serving
      },
      {
        name: 'No Acknowledgment Customer',
        phone: '+60111222333',
        partySize: 1,
        joinedOffset: -90, // joined 90 minutes ago
        calledOffset: -70, // called after 20 minutes
        acknowledgedOffset: null, // never acknowledged
        servedOffset: -65, // served after 5 minutes
        completedOffset: -35, // completed 30 minutes after serving
      },
      {
        name: 'Recent Customer',
        phone: '+60144455566',
        partySize: 3,
        joinedOffset: -25, // joined 25 minutes ago
        calledOffset: -20, // called after 5 minutes
        acknowledgedOffset: -19, // acknowledged after 1 minute
        servedOffset: -15, // served after 5 minutes
        completedOffset: -5, // completed 10 minutes after serving
      }
    ];
    
    for (const customer of testCustomers) {
      const now = new Date();
      
      const entry = await prisma.queueEntry.create({
        data: {
          queueId: queue.id,
          customerId: `test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          customerName: customer.name,
          customerPhone: customer.phone,
          platform: 'web',
          position: 0,
          status: 'completed',
          partySize: customer.partySize,
          verificationCode: Math.random().toString(36).substring(2, 6).toUpperCase(),
          joinedAt: new Date(now.getTime() + customer.joinedOffset * 60000),
          calledAt: customer.calledOffset ? new Date(now.getTime() + customer.calledOffset * 60000) : null,
          acknowledgedAt: customer.acknowledgedOffset ? new Date(now.getTime() + customer.acknowledgedOffset * 60000) : null,
          servedAt: customer.servedOffset ? new Date(now.getTime() + customer.servedOffset * 60000) : null,
          completedAt: new Date(now.getTime() + customer.completedOffset * 60000),
          acknowledged: customer.acknowledgedOffset !== null,
          acknowledgmentType: customer.acknowledgedOffset ? 'on_way' : null,
          tableNumber: `T${Math.floor(Math.random() * 20) + 1}`
        }
      });
      
      console.log(`✅ Created: ${customer.name}`);
      console.log(`   - Join Time: ${entry.joinedAt.toLocaleTimeString()}`);
      console.log(`   - Called Time: ${entry.calledAt?.toLocaleTimeString() || 'N/A'}`);
      console.log(`   - Acknowledged: ${entry.acknowledgedAt?.toLocaleTimeString() || 'N/A'}`);
      console.log(`   - Served Time: ${entry.servedAt?.toLocaleTimeString() || 'N/A'}`);
      console.log(`   - Completed Time: ${entry.completedAt.toLocaleTimeString()}\n`);
    }
    
    console.log('✨ Test completed customers created successfully!');
    console.log('Visit http://localhost:3000/dashboard and click on "Seated Customers" tab to see the results.');
    
  } catch (error) {
    console.error('Error creating test customers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
createTestCompletedCustomers();