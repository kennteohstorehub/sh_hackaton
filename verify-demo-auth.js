const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function verifyDemoAuth() {
  try {
    console.log('🔍 Checking demo user authentication...\n');
    
    // Find demo user
    const merchant = await prisma.merchant.findUnique({
      where: { email: 'demo@smartqueue.com' }
    });
    
    if (!merchant) {
      console.log('❌ Demo user not found in database');
      console.log('Run: npm run seed');
      return;
    }
    
    console.log('✅ Demo user found:', {
      id: merchant.id,
      email: merchant.email,
      businessName: merchant.businessName
    });
    
    // Test password
    const testPassword = 'demo123456';
    console.log('\n🔐 Testing password authentication...');
    console.log('Password to test:', testPassword);
    console.log('Stored hash:', merchant.password);
    
    // Test with bcrypt.compare
    const isValid = await bcrypt.compare(testPassword, merchant.password);
    console.log('\nPassword valid:', isValid ? '✅ YES' : '❌ NO');
    
    if (!isValid) {
      // Try to understand why
      console.log('\n🔍 Debugging password mismatch...');
      
      // Generate new hash with same rounds as seed
      const hash10 = await bcrypt.hash(testPassword, 10);
      const hash12 = await bcrypt.hash(testPassword, 12);
      
      console.log('Hash with 10 rounds:', hash10);
      console.log('Hash with 12 rounds:', hash12);
      
      // Check if stored hash matches either
      const matches10 = await bcrypt.compare(testPassword, hash10);
      const matches12 = await bcrypt.compare(testPassword, hash12);
      
      console.log('\nNew hash tests:');
      console.log('10 rounds valid:', matches10);
      console.log('12 rounds valid:', matches12);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDemoAuth();