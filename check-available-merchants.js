const prisma = require('./server/utils/prisma');
const logger = require('./server/utils/logger');

async function checkMerchants() {
  try {
    console.log('Checking available merchants in the database...\n');
    
    const merchants = await prisma.merchant.findMany({
      select: {
        id: true,
        email: true,
        businessName: true,
        tenantId: true,
        isActive: true
      },
      orderBy: {
        businessName: 'asc'
      }
    });
    
    if (merchants.length === 0) {
      console.log('❌ No merchants found in database');
      return null;
    }
    
    console.log(`Found ${merchants.length} merchants:`);
    console.log('='.repeat(60));
    
    merchants.forEach((merchant, index) => {
      console.log(`${index + 1}. ${merchant.businessName}`);
      console.log(`   Email: ${merchant.email}`);
      console.log(`   Tenant ID: ${merchant.tenantId || 'null (default tenant)'}`);
      console.log(`   Active: ${merchant.isActive ? '✓' : '❌'}`);
      console.log('');
    });
    
    // Find a good test merchant
    const activeMerchant = merchants.find(m => m.isActive);
    if (activeMerchant) {
      console.log('Recommended test merchant:');
      console.log(`- Email: ${activeMerchant.email}`);
      console.log(`- Business: ${activeMerchant.businessName}`);
      console.log(`- Tenant ID: ${activeMerchant.tenantId || 'default'}`);
      return activeMerchant;
    } else {
      console.log('❌ No active merchants found');
      return null;
    }
    
  } catch (error) {
    console.error('Error checking merchants:', error);
    return null;
  } finally {
    await prisma.$disconnect();
  }
}

checkMerchants().then((merchant) => {
  if (!merchant) {
    process.exit(1);
  }
});