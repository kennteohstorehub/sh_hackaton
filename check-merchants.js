const prisma = require('./server/utils/prisma');

async function checkMerchants() {
  try {
    console.log('Checking merchants in database...\n');
    
    const merchants = await prisma.merchant.findMany({
      select: {
        id: true,
        email: true,
        businessName: true,
        phone: true,
        isActive: true
      }
    });
    
    console.log(`Found ${merchants.length} merchants:\n`);
    
    merchants.forEach((merchant, index) => {
      console.log(`${index + 1}. ${merchant.businessName}`);
      console.log(`   Email: ${merchant.email}`);
      console.log(`   Phone: ${merchant.phone || 'Not set'}`);
      console.log(`   Active: ${merchant.isActive}`);
      console.log(`   ID: ${merchant.id}`);
      console.log();
    });
    
    if (merchants.length === 0) {
      console.log('No merchants found in database.');
      console.log('You may need to run the seed script or create a test merchant.');
    }
    
  } catch (error) {
    console.error('Error checking merchants:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkMerchants();