const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupTestData() {
  try {
    // Find the chickenrice tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: 'chickenrice' }
    });
    
    if (!tenant) {
      console.log('Tenant not found');
      return;
    }
    
    console.log('Found tenant:', tenant.name);
    
    // Find the merchant for this tenant
    const merchant = await prisma.merchant.findFirst({
      where: { tenantId: tenant.id }
    });
    
    if (!merchant) {
      console.log('No merchant found for this tenant');
      return;
    }
    
    console.log('Found merchant:', merchant.businessName);
    
    // Check if a queue already exists
    const existingQueue = await prisma.queue.findFirst({
      where: { merchantId: merchant.id }
    });
    
    if (existingQueue) {
      // Make sure it's active
      const updatedQueue = await prisma.queue.update({
        where: { id: existingQueue.id },
        data: { 
          isActive: true,
          acceptingCustomers: true
        }
      });
      console.log('Updated existing queue to active:', {
        id: updatedQueue.id,
        name: updatedQueue.name,
        isActive: updatedQueue.isActive,
        acceptingCustomers: updatedQueue.acceptingCustomers
      });
    } else {
      // Create a new queue
      const newQueue = await prisma.queue.create({
        data: {
          merchantId: merchant.id,
          name: 'Main Queue',
          description: 'Main restaurant queue for walk-in customers',
          isActive: true,
          acceptingCustomers: true,
          maxCapacity: 50,
          averageServiceTime: 30
        }
      });
      console.log('Created new queue:', {
        id: newQueue.id,
        name: newQueue.name,
        isActive: newQueue.isActive,
        acceptingCustomers: newQueue.acceptingCustomers
      });
    }
    
    // Add a test customer to the queue if none exist
    const queue = await prisma.queue.findFirst({
      where: { 
        merchantId: merchant.id,
        isActive: true
      },
      include: {
        entries: {
          where: {
            status: { in: ['waiting', 'called'] }
          }
        }
      }
    });
    
    if (queue && queue.entries.length === 0) {
      console.log('No active customers in queue, adding test customers...');
      
      // Add test customers
      const testCustomers = [
        { name: 'John Doe', phone: '+60111111111', partySize: 2 },
        { name: 'Jane Smith', phone: '+60122222222', partySize: 4 },
        { name: 'Test Family', phone: '+60133333333', partySize: 6 }
      ];
      
      for (let i = 0; i < testCustomers.length; i++) {
        const customerData = testCustomers[i];
        
        // Generate a unique customer ID (using timestamp + index)
        const customerId = `guest_${Date.now()}_${i}`;
        
        const entry = await prisma.queueEntry.create({
          data: {
            queueId: queue.id,
            customerId: customerId,
            customerName: customerData.name,
            customerPhone: customerData.phone,
            partySize: customerData.partySize,
            platform: 'web',
            status: 'waiting',
            joinedAt: new Date(),
            position: i + 1,
            estimatedWaitTime: 15 * (i + 1)
          }
        });
        console.log(`Added test customer: ${entry.customerName} (position ${entry.position})`);
      }
    } else if (queue) {
      console.log(`Queue has ${queue.entries.length} active customer(s)`);
    }
    
    console.log('\n✅ Test data setup complete!');
    console.log('You can now test the queue management system.');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestData();