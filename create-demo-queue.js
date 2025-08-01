const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Creating demo queue...');
  
  try {
    // Find demo merchant
    const merchant = await prisma.merchant.findUnique({
      where: { email: 'demo@smartqueue.com' }
    });
    
    if (!merchant) {
      console.log('❌ Demo merchant not found. Please run setup-demo-account.js first');
      return;
    }
    
    // Check if queue already exists
    const existingQueue = await prisma.queue.findFirst({
      where: { merchantId: merchant.id }
    });
    
    if (existingQueue) {
      console.log('✅ Demo queue already exists');
      console.log(`📋 Queue: ${existingQueue.name}`);
      return;
    }
    
    // Create demo queue
    const queue = await prisma.queue.create({
      data: {
        merchantId: merchant.id,
        name: 'General Queue',
        description: 'Main dining queue',
        isActive: true,
        acceptingCustomers: true,
        maxCapacity: 50,
        averageServiceTime: 30,
        autoNotifications: true,
        notificationInterval: 10,
        allowCancellation: true,
        requireConfirmation: false,
        businessHoursStart: '09:00',
        businessHoursEnd: '22:00',
        businessHoursTimezone: 'Asia/Kuala_Lumpur'
      }
    });
    
    console.log('✅ Demo queue created successfully');
    console.log(`📋 Queue: ${queue.name}`);
    console.log(`🆔 Queue ID: ${queue.id}`);
    console.log(`🏪 Merchant: ${merchant.businessName}`);
    
  } catch (error) {
    console.error('❌ Error creating demo queue:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);