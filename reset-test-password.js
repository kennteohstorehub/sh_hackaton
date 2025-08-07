#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const prisma = require('./server/utils/prisma');

async function resetPassword() {
  try {
    const email = 'downtown@delicious.com';
    const newPassword = 'testpassword123';
    
    console.log(`🔒 Resetting password for ${email}...`);
    
    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update the merchant's password
    const updatedMerchant = await prisma.merchant.update({
      where: { email },
      data: { password: hashedPassword },
      select: {
        id: true,
        email: true,
        businessName: true,
        tenantId: true
      }
    });
    
    console.log('✅ Password updated successfully!');
    console.log('📝 Login details:');
    console.log(`   Email: ${updatedMerchant.email}`);
    console.log(`   Password: ${newPassword}`);
    console.log(`   Business: ${updatedMerchant.businessName}`);
    console.log(`   Tenant ID: ${updatedMerchant.tenantId}`);
    
  } catch (error) {
    console.error('❌ Error resetting password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();