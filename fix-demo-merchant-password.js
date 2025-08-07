#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function fixDemoMerchantPassword() {
  try {
    console.log('🔧 Fixing demo merchant password...');
    
    const newPassword = 'Demo123!@#';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the demo merchant password
    const updatedMerchant = await prisma.merchant.update({
      where: {
        email: 'admin@demo.local'
      },
      data: {
        password: hashedPassword
      }
    });
    
    console.log('✅ Demo merchant password updated successfully');
    console.log(`  - Email: ${updatedMerchant.email}`);
    console.log(`  - Business Name: ${updatedMerchant.businessName}`);
    console.log(`  - New Password: ${newPassword}`);
    
    // Verify the password works
    const isValid = await bcrypt.compare(newPassword, hashedPassword);
    console.log(`  - Password verification: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
    
  } catch (error) {
    console.error('❌ Error fixing demo merchant password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDemoMerchantPassword();