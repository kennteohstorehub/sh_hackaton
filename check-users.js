const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    // Check SuperAdmin
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { email: 'superadmin@storehubqms.local' }
    });
    console.log('SuperAdmin exists:', !!superAdmin);
    if (superAdmin) {
      console.log('SuperAdmin ID:', superAdmin.id);
      console.log('SuperAdmin active:', superAdmin.isActive);
    }
    
    // Check Merchant
    const merchant = await prisma.merchant.findUnique({
      where: { email: 'admin@demo.local' }
    });
    console.log('\nMerchant exists:', !!merchant);
    if (merchant) {
      console.log('Merchant ID:', merchant.id);
      console.log('Merchant tenantId:', merchant.tenantId);
    }
    
    // Check TenantUser
    const tenantUser = await prisma.tenantUser.findFirst({
      where: { email: 'admin@demo.local' }
    });
    console.log('\nTenantUser exists:', !!tenantUser);
    if (tenantUser) {
      console.log('TenantUser ID:', tenantUser.id);
      console.log('TenantUser tenantId:', tenantUser.tenantId);
      console.log('TenantUser role:', tenantUser.role);
    }
    
    // Check Tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: 'demo' }
    });
    console.log('\nTenant "demo" exists:', !!tenant);
    if (tenant) {
      console.log('Tenant ID:', tenant.id);
      console.log('Tenant name:', tenant.name);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();