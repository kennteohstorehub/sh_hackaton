const prisma = require('./server/utils/prisma');
const bcrypt = require('bcryptjs');

async function debugLoginIssue() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('   DEBUG: LOGIN ISSUE INVESTIGATION');
  console.log('════════════════════════════════════════════════════════════');
  console.log('');
  
  try {
    // Find recent test merchants
    console.log('🔍 Finding recent test merchants...');
    const testMerchants = await prisma.merchant.findMany({
      where: {
        email: {
          contains: 'test-'
        }
      },
      include: {
        tenant: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });
    
    console.log(`Found ${testMerchants.length} test merchants:\n`);
    
    for (const merchant of testMerchants) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Merchant: ${merchant.businessName}`);
      console.log(`  ID: ${merchant.id}`);
      console.log(`  Email: ${merchant.email}`);
      console.log(`  Tenant ID: ${merchant.tenantId}`);
      console.log(`  Tenant Name: ${merchant.tenant?.name || 'N/A'}`);
      console.log(`  Tenant Slug: ${merchant.tenant?.slug || 'N/A'}`);
      console.log(`  Created: ${merchant.createdAt}`);
      console.log(`  Password Hash: ${merchant.password ? merchant.password.substring(0, 20) + '...' : 'NO PASSWORD'}`);
      console.log('');
      
      // Test password verification
      if (merchant.password) {
        const testPassword = 'TestPassword123!';
        const isValid = await bcrypt.compare(testPassword, merchant.password);
        console.log(`  Password 'TestPassword123!' valid: ${isValid}`);
      }
    }
    
    // Check tenant structure
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Checking recent tenants...\n');
    
    const recentTenants = await prisma.tenant.findMany({
      where: {
        slug: {
          contains: 'test'
        }
      },
      include: {
        merchants: {
          select: {
            id: true,
            email: true,
            businessName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });
    
    console.log(`Found ${recentTenants.length} test tenants:\n`);
    
    for (const tenant of recentTenants) {
      console.log(`Tenant: ${tenant.name}`);
      console.log(`  ID: ${tenant.id}`);
      console.log(`  Slug: ${tenant.slug}`);
      console.log(`  Domain: ${tenant.domain}`);
      console.log(`  Is Active: ${tenant.isActive}`);
      console.log(`  Merchants: ${tenant.merchants.length}`);
      if (tenant.merchants.length > 0) {
        tenant.merchants.forEach(m => {
          console.log(`    - ${m.businessName} (${m.email})`);
        });
      }
      console.log('');
    }
    
    // Check for orphaned merchants (no tenant)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Checking for orphaned merchants (no tenant)...\n');
    
    const orphanedMerchants = await prisma.merchant.findMany({
      where: {
        tenantId: null
      },
      select: {
        id: true,
        email: true,
        businessName: true,
        createdAt: true
      }
    });
    
    if (orphanedMerchants.length > 0) {
      console.log(`⚠️  Found ${orphanedMerchants.length} merchants without tenant assignment:`);
      orphanedMerchants.forEach(m => {
        console.log(`  - ${m.businessName} (${m.email}) - Created: ${m.createdAt}`);
      });
    } else {
      console.log('✅ No orphaned merchants found');
    }
    
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('ANALYSIS COMPLETE');
    console.log('════════════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the debug
debugLoginIssue().catch(console.error);