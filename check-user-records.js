const { PrismaClient } = require('@prisma/client');

async function checkUserRecords() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking user records in database...\n');
    
    // Check BackOffice users
    console.log('1. BackOffice Users:');
    console.log('='.repeat(50));
    const backofficeUsers = await prisma.backOfficeUser.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        createdAt: true
      }
    });
    
    if (backofficeUsers.length === 0) {
      console.log('❌ No BackOffice users found');
    } else {
      backofficeUsers.forEach(user => {
        console.log(`✅ ${user.email} | Name: ${user.fullName} | Active: ${user.isActive} | Created: ${user.createdAt.toISOString().split('T')[0]}`);
      });
    }
    
    // Check Tenants
    console.log('\n2. Tenants:');
    console.log('='.repeat(50));
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        createdAt: true
      }
    });
    
    if (tenants.length === 0) {
      console.log('❌ No tenants found');
    } else {
      tenants.forEach(tenant => {
        console.log(`✅ ${tenant.name} | Slug: ${tenant.slug} | Active: ${tenant.isActive}`);
      });
    }
    
    // Check Tenant Users
    console.log('\n3. Tenant Users:');
    console.log('='.repeat(50));
    const tenantUsers = await prisma.tenantUser.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        tenant: {
          select: {
            name: true,
            slug: true
          }
        }
      }
    });
    
    if (tenantUsers.length === 0) {
      console.log('❌ No tenant users found');
    } else {
      tenantUsers.forEach(user => {
        console.log(`✅ ${user.email} | Role: ${user.role} | Active: ${user.isActive} | Tenant: ${user.tenant.name} (${user.tenant.slug})`);
      });
    }
    
    // Check for specific test users
    console.log('\n4. Checking Specific Test Credentials:');
    console.log('='.repeat(50));
    
    const testCredentials = [
      { email: 'backoffice@storehubqms.local', type: 'BackOffice' },
      { email: 'admin@demo.local', type: 'Tenant' },
      { email: 'cafe@testcafe.local', type: 'Tenant' }
    ];
    
    for (const cred of testCredentials) {
      if (cred.type === 'BackOffice') {
        const user = await prisma.backOfficeUser.findUnique({
          where: { email: cred.email },
          select: { email: true, fullName: true, isActive: true }
        });
        
        if (user) {
          console.log(`✅ ${cred.email} (BackOffice) - Found | Name: ${user.fullName} | Active: ${user.isActive}`);
        } else {
          console.log(`❌ ${cred.email} (BackOffice) - NOT FOUND`);
        }
      } else {
        const user = await prisma.tenantUser.findUnique({
          where: { email: cred.email },
          select: { 
            email: true, 
            role: true, 
            isActive: true,
            tenant: { select: { slug: true } }
          }
        });
        
        if (user) {
          console.log(`✅ ${cred.email} (Tenant) - Found | Role: ${user.role} | Active: ${user.isActive} | Slug: ${user.tenant.slug}`);
        } else {
          console.log(`❌ ${cred.email} (Tenant) - NOT FOUND`);
        }
      }
    }
    
    // Check session store
    console.log('\n5. Checking Session Store:');
    console.log('='.repeat(50));
    try {
      const sessionCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM session`;
      console.log(`📊 Total sessions in database: ${sessionCount[0].count}`);
      
      // Get recent sessions
      const recentSessions = await prisma.$queryRaw`
        SELECT sid, sess::text, expire 
        FROM session 
        WHERE expire > NOW() 
        ORDER BY expire DESC 
        LIMIT 5
      `;
      
      if (recentSessions.length > 0) {
        console.log('Recent active sessions:');
        recentSessions.forEach((session, i) => {
          const sessData = JSON.parse(session.sess);
          console.log(`  ${i + 1}. SID: ${session.sid.substring(0, 20)}... | User: ${sessData.user?.email || 'No user'} | Expires: ${session.expire}`);
        });
      } else {
        console.log('❌ No active sessions found');
      }
    } catch (sessionError) {
      console.log('⚠️ Could not check session store:', sessionError.message);
    }
    
  } catch (error) {
    console.error('❌ Database check error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserRecords();