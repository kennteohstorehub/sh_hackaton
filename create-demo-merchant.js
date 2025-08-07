const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function createDemoMerchant() {
  try {
    const demoTenant = await prisma.tenant.findFirst({
      where: { slug: 'demo' }
    });
    
    if (!demoTenant) {
      console.error('Demo tenant not found!');
      return;
    }
    
    console.log('Found demo tenant:', demoTenant.name);
    
    // Check if merchant already exists
    const existingMerchant = await prisma.merchant.findFirst({
      where: { email: 'demo@storehub.com' }
    });
    
    if (existingMerchant) {
      console.log('Demo merchant already exists');
      return;
    }
    
    // Create demo merchant
    const hashedPassword = await bcrypt.hash('demo123', 10);
    const demoMerchant = await prisma.merchant.create({
      data: {
        tenantId: demoTenant.id,
        email: 'demo@storehub.com',
        password: hashedPassword,
        businessName: 'Demo Business',
        phone: '+60123456789',
        businessType: 'restaurant',
        timezone: 'Asia/Kuala_Lumpur',
        isActive: true,
        emailVerified: true
      }
    });
    
    console.log('Created demo merchant:', {
      email: demoMerchant.email,
      businessName: demoMerchant.businessName,
      tenantId: demoMerchant.tenantId
    });
    
    // Create a default queue for the merchant
    const queue = await prisma.queue.create({
      data: {
        merchantId: demoMerchant.id,
        name: 'Default Queue',
        description: 'Main queue for demo restaurant',
        isActive: true,
        acceptingCustomers: true,
        maxCapacity: 100,
        averageServiceTime: 30
      }
    });
    
    console.log('Created default queue:', queue.name);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDemoMerchant();