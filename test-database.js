const { PrismaClient } = require('@prisma/client');

async function testDatabase() {
  console.log('🔍 Testing database connection...\n');
  
  // Set the DATABASE_URL for this test
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
  
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });
  
  try {
    // Test basic connection
    console.log('Testing connection...');
    await prisma.$connect();
    console.log('✅ Connected to database!');
    
    // Count existing records
    const tenantCount = await prisma.tenant.count();
    const merchantCount = await prisma.merchant.count();
    const backOfficeCount = await prisma.backOfficeUser.count();
    
    console.log('\nCurrent database state:');
    console.log(`  Tenants: ${tenantCount}`);
    console.log(`  Merchants: ${merchantCount}`);
    console.log(`  BackOffice Users: ${backOfficeCount}`);
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('  Error:', error.message);
    
    if (error.message.includes('P1001')) {
      console.log('\n💡 Possible fixes:');
      console.log('  1. Check if database server is running');
      console.log('  2. Verify connection string is correct');
      console.log('  3. Check network/firewall settings');
      console.log('  4. Ensure SSL is properly configured');
    }
    
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase().then(success => {
  if (success) {
    console.log('\n✅ Database is accessible and ready!');
  } else {
    console.log('\n❌ Database connection issues need to be resolved');
  }
  process.exit(success ? 0 : 1);
});