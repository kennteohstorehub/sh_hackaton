#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

// Use the connection string from the .env file
const DATABASE_URL = 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function verifySessionFix() {
  console.log('🔍 Verifying Session Configuration Fix\n');

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL
      }
    },
    log: ['error']
  });

  try {
    // 1. Check if the Session table is accessible
    console.log('1️⃣ Checking Session table accessibility...');
    const tableCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Session'
      );
    `;
    console.log('✅ Session table exists and is accessible\n');

    // 2. Check current session count
    console.log('2️⃣ Current session status:');
    const totalSessions = await prisma.session.count();
    const activeSessions = await prisma.session.count({
      where: {
        expiresAt: {
          gt: new Date()
        }
      }
    });
    console.log(`   Total sessions: ${totalSessions}`);
    console.log(`   Active sessions: ${activeSessions}\n`);

    // 3. Verify the fix was applied
    console.log('3️⃣ Verifying configuration fixes:');
    
    const fs = require('fs');
    const path = require('path');
    const serverFile = fs.readFileSync(path.join(__dirname, 'server/index.js'), 'utf8');
    
    // Check main session store
    const mainStoreFixed = serverFile.includes("tableName: 'Session', // This matches our Prisma schema (capital S)");
    console.log(`   Main session store config: ${mainStoreFixed ? '✅ Fixed' : '❌ Still needs fixing'}`);
    
    // Check Socket.IO session store
    const socketStoreFixed = serverFile.includes("tableName: 'Session', // Fixed to match Prisma schema (capital S)");
    console.log(`   Socket.IO session store config: ${socketStoreFixed ? '✅ Fixed' : '❌ Still needs fixing'}`);
    
    console.log('\n📝 Summary:');
    if (mainStoreFixed && socketStoreFixed) {
      console.log('✅ All session configurations have been fixed!');
      console.log('\n🚀 Next Steps:');
      console.log('1. Restart the server to apply the changes');
      console.log('2. Try logging in again');
      console.log('3. Sessions should now persist correctly in the database');
      console.log('\n💡 To restart the server:');
      console.log('   npm start');
      console.log('   OR');
      console.log('   ./scripts/server-manager.sh restart');
    } else {
      console.log('❌ Some configurations still need fixing');
      console.log('Please run the fix script again or manually update the table names to "Session"');
    }

    // 4. Additional recommendations
    console.log('\n🔧 Additional Recommendations:');
    console.log('1. Monitor the Session table after restart:');
    console.log('   node check-session-table-direct.js');
    console.log('\n2. If issues persist, consider using @quixo3/prisma-session-store:');
    console.log('   npm install @quixo3/prisma-session-store');
    console.log('   This provides better Prisma compatibility than connect-pg-simple');
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification
verifySessionFix().catch(console.error);