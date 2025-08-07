const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function ensureAdminUser() {
  try {
    // Check if admin exists
    let admin = await prisma.backOfficeUser.findUnique({
      where: { email: 'admin@storehub.com' }
    });
    
    if (!admin) {
      console.log('❌ Admin user not found, creating...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      admin = await prisma.backOfficeUser.create({
        data: {
          email: 'admin@storehub.com',
          password: hashedPassword,
          fullName: 'System Administrator',
          isActive: true
        }
      });
      console.log('✅ Admin user created:', admin.email);
    } else {
      console.log('✅ Admin user exists:', admin.email);
      console.log('   ID:', admin.id);
      console.log('   Name:', admin.fullName);
      console.log('   Active:', admin.isActive);
      
      // Update password to ensure it's correct
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await prisma.backOfficeUser.update({
        where: { id: admin.id },
        data: { 
          password: hashedPassword,
          isActive: true
        }
      });
      console.log('✅ Admin password updated to: admin123');
    }
    
    // Verify password works
    const testAdmin = await prisma.backOfficeUser.findUnique({
      where: { email: 'admin@storehub.com' }
    });
    
    const passwordValid = await bcrypt.compare('admin123', testAdmin.password);
    console.log('🔐 Password verification:', passwordValid ? 'PASSED' : 'FAILED');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

ensureAdminUser();