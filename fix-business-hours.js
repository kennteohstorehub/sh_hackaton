const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing business hours format...');
  
  try {
    // Find demo merchant
    const merchant = await prisma.merchant.findUnique({
      where: { email: 'demo@smartqueue.com' }
    });
    
    if (!merchant) {
      console.log('❌ Demo merchant not found');
      return;
    }
    
    // Delete existing business hours
    await prisma.businessHours.deleteMany({
      where: { merchantId: merchant.id }
    });
    
    // Create business hours with capitalized day names
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    for (const day of daysOfWeek) {
      const isWeekend = day === 'Saturday' || day === 'Sunday';
      
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
    
    console.log('✅ Business hours fixed with proper day names');
    console.log('🕐 Mon-Fri: 09:00 - 23:00');
    console.log('🕐 Sat-Sun: 10:00 - 22:00');
    
  } catch (error) {
    console.error('❌ Error fixing business hours:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);