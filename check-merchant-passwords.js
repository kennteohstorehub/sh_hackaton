const prisma = require('./server/utils/prisma');
const bcrypt = require('bcrypt');

async function checkPasswords() {
  try {
    console.log('Checking merchant passwords...\n');
    
    const merchants = await prisma.merchant.findMany({
      select: {
        id: true,
        email: true,
        password: true,
        businessName: true,
        tenantId: true,
        isActive: true
      },
      where: {
        isActive: true
      }
    });
    
    const testPasswords = ['demo123', 'password', 'admin123', 'test123', '123456'];
    
    console.log('Testing common passwords on active merchants...\n');
    
    for (const merchant of merchants) {
      console.log(`${merchant.businessName} (${merchant.email}):`);
      
      for (const testPassword of testPasswords) {
        try {
          const isMatch = await bcrypt.compare(testPassword, merchant.password);
          if (isMatch) {
            console.log(`  ✅ Password: ${testPassword}`);
            console.log(`  📧 Email: ${merchant.email}`);
            console.log(`  🏢 Business: ${merchant.businessName}`);
            console.log(`  🔑 Tenant: ${merchant.tenantId || 'default'}`);
            console.log('');
            return { 
              email: merchant.email, 
              password: testPassword,
              businessName: merchant.businessName,
              tenantId: merchant.tenantId
            };
          }
        } catch (error) {
          // Skip this password
        }
      }
      console.log('  ❌ No matching password found');
      console.log('');
    }
    
    console.log('No merchants found with common passwords');
    return null;
    
  } catch (error) {
    console.error('Error checking passwords:', error);
    return null;
  } finally {
    await prisma.$disconnect();
  }
}

checkPasswords().then((result) => {
  if (result) {
    console.log('='.repeat(50));
    console.log('Found working credentials:');
    console.log(`Email: ${result.email}`);
    console.log(`Password: ${result.password}`);
    console.log(`Business: ${result.businessName}`);
    console.log(`Tenant: ${result.tenantId || 'default'}`);
    console.log('='.repeat(50));
  }
});