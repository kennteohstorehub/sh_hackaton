const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkBackOfficeUser() {
  try {
    // Find the BackOffice user
    const user = await prisma.backOfficeUser.findUnique({
      where: { email: 'backoffice@storehubqms.local' }
    });
    
    if (!user) {
      console.log('❌ BackOffice user not found');
      return;
    }
    
    console.log('✅ BackOffice user found:');
    console.log('   Email:', user.email);
    console.log('   Name:', user.fullName);
    console.log('   Active:', user.isActive);
    console.log('   Password hash exists:', !!user.password);
    
    // Test the password
    const testPassword = 'BackOffice123!@#';
    const isValid = await bcrypt.compare(testPassword, user.password);
    
    console.log('\nPassword validation:');
    console.log('   Testing password:', testPassword);
    console.log('   Password is valid:', isValid);
    
    if (!isValid) {
      console.log('\n⚠️  The password might have been changed or incorrectly hashed.');
      console.log('   Let me update it to the correct password...');
      
      // Update the password
      const newHash = await bcrypt.hash(testPassword, 10);
      await prisma.backOfficeUser.update({
        where: { id: user.id },
        data: { password: newHash }
      });
      
      console.log('   ✅ Password updated successfully!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBackOfficeUser();