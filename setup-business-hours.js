const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🕐 Setting up business hours...');
  
  try {
    // Find demo merchant
    const merchant = await prisma.merchant.findUnique({
      where: { email: 'demo@smartqueue.com' }
    });
    
    if (!merchant) {
      console.log('❌ Demo merchant not found');
      return;
    }
    
    // Check if business hours already exist
    const existingHours = await prisma.businessHours.findFirst({
      where: { merchantId: merchant.id }
    });
    
    if (existingHours) {
      console.log('✅ Business hours already exist');
      return;
    }
    
    // Create business hours for all days
    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    for (const day of daysOfWeek) {
      const isWeekend = day === 'saturday' || day === 'sunday';
      
      await prisma.businessHours.create({
        data: {
          merchantId: merchant.id,
          dayOfWeek: day,
          start: isWeekend ? '10:00' : '09:00',
          end: isWeekend ? '22:00' : '23:00',
          closed: false
        }
      });
    }
    
    console.log('✅ Business hours created successfully');
    console.log('🕐 Mon-Fri: 09:00 - 23:00');
    console.log('🕐 Sat-Sun: 10:00 - 22:00');
    
  } catch (error) {
    console.error('❌ Error setting up business hours:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);