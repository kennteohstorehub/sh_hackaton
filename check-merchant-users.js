#!/usr/bin/env node

const prisma = require('./server/utils/prisma');

async function checkUsers() {
  try {
    console.log('🔍 Checking merchants in database...\n');
    
    const merchants = await prisma.merchant.findMany({
      select: {
        id: true,
        email: true,
        businessName: true,
        tenantId: true,
        isActive: true,
        lastLogin: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${merchants.length} merchants:\n`);
    
    merchants.forEach((merchant, index) => {
      console.log(`${index + 1}. ${merchant.email}`);
      console.log(`   Business: ${merchant.businessName}`);
      console.log(`   ID: ${merchant.id}`);
      console.log(`   Tenant: ${merchant.tenantId || 'No tenant'}`);
      console.log(`   Active: ${merchant.isActive}`);
      console.log(`   Last Login: ${merchant.lastLogin || 'Never'}`);
      console.log('');
    });

    // Check if there are any backoffice users
    console.log('🔍 Checking backoffice users...\n');
    
    const backofficeUsers = await prisma.backOfficeUser.findMany({
      select: {
        id: true,
        email: true,
        isActive: true,
        lastLogin: true
      }
    });

    console.log(`Found ${backofficeUsers.length} backoffice users:\n`);
    
    backofficeUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Active: ${user.isActive}`);
      console.log(`   Last Login: ${user.lastLogin || 'Never'}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();