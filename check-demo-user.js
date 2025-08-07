const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { email: 'merchant@demo.com' }
    });
    
    console.log('Merchant found:', merchant ? 'Yes' : 'No');
    if (merchant) {
      console.log('Merchant ID:', merchant.id);
      console.log('Business Name:', merchant.businessName);
      console.log('Email:', merchant.email);
      console.log('Password hash exists:', Boolean(merchant.password));
    }
    
    // Check if any merchants exist
    const allMerchants = await prisma.merchant.findMany({
      select: { email: true, businessName: true }
    });
    
    console.log('\nAll merchants in database:');
    allMerchants.forEach(m => {
      console.log(' -', m.email, '(' + m.businessName + ')');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
