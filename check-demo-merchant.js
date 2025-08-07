#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function checkDemoMerchant() {
  try {
    console.log('🔍 Checking demo merchant credentials...');
    
    // Find the demo merchant
    const merchant = await prisma.merchant.findFirst({
      where: {
        email: 'admin@demo.local'
      }
    });
    
    if (!merchant) {
      console.log('❌ Demo merchant not found with email admin@demo.local');
      
      // Check what merchants exist
      const allMerchants = await prisma.merchant.findMany({
        select: {
          id: true,
          email: true,
          businessName: true,
          tenantId: true,
          isActive: true
        }
      });
      
      console.log('\n📋 Available merchants:');
      allMerchants.forEach(m => {
        console.log(`  - ${m.email} (${m.businessName}) - Tenant: ${m.tenantId} - Active: ${m.isActive}`);
      });
      
      return;
    }
    
    console.log('✅ Demo merchant found:');
    console.log(`  - ID: ${merchant.id}`);
    console.log(`  - Email: ${merchant.email}`);
    console.log(`  - Business Name: ${merchant.businessName}`);
    console.log(`  - Tenant ID: ${merchant.tenantId}`);
    console.log(`  - Active: ${merchant.isActive}`);
    console.log(`  - Password Hash: ${merchant.password.substring(0, 20)}...`);
    
    // Test different possible passwords
    const testPasswords = [
      'Demo123!@#',
      'demo123',
      'Demo123',
      'password',
      'admin',
      'demo',
      'Demo123456',
      'demo123456'
    ];
    
    console.log('\n🔑 Testing possible passwords:');
    for (const password of testPasswords) {
      const isValid = await bcrypt.compare(password, merchant.password);
      console.log(`  - "${password}": ${isValid ? '✅ CORRECT' : '❌ Wrong'}`);
      
      if (isValid) {
        console.log(`\n🎉 FOUND CORRECT PASSWORD: "${password}"`);
        break;
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking demo merchant:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDemoMerchant();