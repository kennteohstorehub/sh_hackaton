const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkDemoPassword() {
  console.log('🔍 Checking demo merchant account...\n');
  
  try {
    // Find the demo merchant
    const merchant = await prisma.merchant.findFirst({
      where: { email: 'demo@storehub.com' },
      select: { 
        id: true, 
        email: true, 
        password: true,
        businessName: true,
        isActive: true,
        tenantId: true
      }
    });
    
    if (!merchant) {
      console.log('❌ No merchant found with email: demo@storehub.com');
      console.log('\nSearching for any merchant with "demo" in email...');
      
      const demoMerchants = await prisma.merchant.findMany({
        where: { 
          email: { contains: 'demo' }
        },
        select: { email: true, businessName: true }
      });
      
      if (demoMerchants.length > 0) {
        console.log('Found these demo merchants:');
        demoMerchants.forEach(m => {
          console.log(`  - ${m.email} (${m.businessName})`);
        });
      }
      return;
    }
    
    console.log('✅ Merchant found:');
    console.log('  Email:', merchant.email);
    console.log('  Business:', merchant.businessName);
    console.log('  Active:', merchant.isActive);
    console.log('  Tenant ID:', merchant.tenantId);
    console.log('  Password hash exists:', !!merchant.password);
    
    if (merchant.password) {
      console.log('\n🔐 Testing passwords:');
      const passwords = [
        'demo1234',
        'Demo1234',
        'demo123',
        'demo',
        'password',
        'admin123'
      ];
      
      let foundPassword = false;
      for (const pwd of passwords) {
        const matches = bcrypt.compareSync(pwd, merchant.password);
        console.log(`  ${pwd}: ${matches ? '✅ CORRECT' : '❌ Wrong'}`);
        if (matches) {
          foundPassword = true;
          console.log(`\n✅ WORKING PASSWORD: ${pwd}`);
        }
      }
      
      if (!foundPassword) {
        console.log('\n⚠️ None of the common passwords work.');
        console.log('Would you like to reset the password to "demo1234"? Run:');
        console.log('node fix-demo-password.js');
      }
    } else {
      console.log('\n❌ No password set for this merchant!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDemoPassword();