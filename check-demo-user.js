const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDemoUser() {
  try {
    const demoTenant = await prisma.tenant.findFirst({
      where: { slug: 'demo' }
    });
    console.log('Demo tenant:', demoTenant);
    
    if (demoTenant) {
      const demoMerchant = await prisma.merchant.findFirst({
        where: { 
          email: 'demo@storehub.com',
          tenantId: demoTenant.id
        }
      });
      console.log('Demo merchant:', demoMerchant ? { 
        email: demoMerchant.email, 
        businessName: demoMerchant.businessName,
        tenantId: demoMerchant.tenantId
      } : 'Not found');
      
      // Also check any merchant with demo email
      const anyDemoMerchant = await prisma.merchant.findFirst({
        where: { email: 'demo@storehub.com' }
      });
      console.log('Any merchant with demo email:', anyDemoMerchant ? {
        email: anyDemoMerchant.email,
        businessName: anyDemoMerchant.businessName,
        tenantId: anyDemoMerchant.tenantId
      } : 'Not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDemoUser();