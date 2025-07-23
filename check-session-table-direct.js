#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

// Use the connection string from the .env file
const DATABASE_URL = 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function checkSessionTable() {
  console.log('🔍 Checking Session table in Neon database...\n');

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL
      }
    },
    log: ['error', 'warn']
  });

  try {
    // 1. Check if Session table exists and get count
    console.log('📊 Session Table Statistics:');
    const totalSessions = await prisma.session.count();
    console.log(`Total sessions: ${totalSessions}`);

    // 2. Check active sessions (not expired)
    const now = new Date();
    const activeSessions = await prisma.session.count({
      where: {
        expiresAt: {
          gt: now
        }
      }
    });
    console.log(`Active sessions (not expired): ${activeSessions}`);

    // 3. Check expired sessions
    const expiredSessions = await prisma.session.count({
      where: {
        expiresAt: {
          lte: now
        }
      }
    });
    console.log(`Expired sessions: ${expiredSessions}`);

    // 4. Get recent sessions
    console.log('\n🕐 Recent Sessions (last 10):');
    const recentSessions = await prisma.session.findMany({
      take: 10,
      orderBy: {
        expiresAt: 'desc'
      }
    });

    if (recentSessions.length === 0) {
      console.log('No sessions found in the database.');
    } else {
      for (const session of recentSessions) {
        const expired = session.expiresAt < now;
        const expStatus = expired ? '❌ Expired' : '✅ Active';
        const timeLeft = expired 
          ? `${Math.abs(Math.round((session.expiresAt - now) / 1000 / 60))} minutes ago`
          : `${Math.round((session.expiresAt - now) / 1000 / 60)} minutes left`;
        
        console.log(`\nSession ID: ${session.id}`);
        console.log(`  SID: ${session.sid}`);
        console.log(`  Status: ${expStatus}`);
        console.log(`  Expires: ${session.expiresAt.toISOString()} (${timeLeft})`);
        
        // Parse session data to see what's stored
        try {
          const sessionData = JSON.parse(session.data);
          if (sessionData.cookie) {
            console.log(`  Cookie settings:`);
            console.log(`    - httpOnly: ${sessionData.cookie.httpOnly}`);
            console.log(`    - secure: ${sessionData.cookie.secure}`);
            console.log(`    - sameSite: ${sessionData.cookie.sameSite}`);
            console.log(`    - path: ${sessionData.cookie.path}`);
          }
          if (sessionData.merchant) {
            console.log(`  Merchant: ${sessionData.merchant.businessName} (${sessionData.merchant.email})`);
          }
        } catch (e) {
          console.log(`  Data: Unable to parse session data`);
        }
      }
    }

    // 5. Check for problematic sessions
    console.log('\n⚠️  Checking for potential issues:');
    
    // Sessions with very short expiry times
    const shortExpirySessions = await prisma.session.count({
      where: {
        expiresAt: {
          gt: now,
          lt: new Date(now.getTime() + 5 * 60 * 1000) // Less than 5 minutes
        }
      }
    });
    console.log(`Sessions expiring in < 5 minutes: ${shortExpirySessions}`);

    // Very old expired sessions
    const veryOldSessions = await prisma.session.count({
      where: {
        expiresAt: {
          lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) // More than 24 hours old
        }
      }
    });
    console.log(`Sessions expired > 24 hours ago: ${veryOldSessions}`);

    // 6. Database cleanup recommendation
    if (expiredSessions > 100 || veryOldSessions > 0) {
      console.log('\n🧹 Recommendation: Consider cleaning up old sessions');
      console.log('Run: npx prisma db execute --schema=./prisma/schema.prisma --sql "DELETE FROM \\"Session\\" WHERE \\"expiresAt\\" < NOW()"');
    }

    // 7. Session configuration check
    console.log('\n⚙️  Session Configuration Check:');
    if (activeSessions === 0 && totalSessions > 0) {
      console.log('❌ All sessions are expired - this could cause login redirect loops');
      console.log('   Check your session maxAge configuration');
    } else {
      console.log('✅ Active sessions found');
    }

  } catch (error) {
    console.error('\n❌ Error checking session table:', error.message);
    
    if (error.code === 'P2002') {
      console.error('Duplicate key error - there might be session conflicts');
    } else if (error.code === 'P2021') {
      console.error('Table does not exist - run prisma migrations');
    } else if (error.message.includes('connect')) {
      console.error('Cannot connect to database - check connection string and network');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkSessionTable().catch(console.error);