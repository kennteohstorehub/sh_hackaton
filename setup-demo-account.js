const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Creating demo account...');
  
  try {
    // Check if demo account already exists
    const existingMerchant = await prisma.merchant.findUnique({
      where: { email: 'demo@smartqueue.com' }
    });
    
    if (existingMerchant) {
      console.log('✅ Demo account already exists');
      return;
    }
    
    // Create demo merchant
    const hashedPassword = await bcrypt.hash('demo123456', 10);
    
    const merchant = await prisma.merchant.create({
      data: {
        email: 'demo@smartqueue.com',
        password: hashedPassword,
        businessName: 'Demo Restaurant',
        businessType: 'restaurant',
        phone: '+60123456789',
        timezone: 'Asia/Kuala_Lumpur',
        isActive: true,
        emailVerified: true
      }
    });
    
    console.log('✅ Demo merchant created successfully');
    console.log('📧 Email: demo@smartqueue.com');
    console.log('🔑 Password: demo123456');
    console.log('🏪 Business: Demo Restaurant');
    
  } catch (error) {
    console.error('❌ Error creating demo account:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);