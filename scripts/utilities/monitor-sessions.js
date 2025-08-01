#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

// Use the connection string from the .env file
const DATABASE_URL = 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function monitorSessions() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL
      }
    },
    log: ['error']
  });

  console.log('📊 Real-time Session Monitor');
  console.log('Press Ctrl+C to stop\n');

  const checkSessions = async () => {
    try {
      const now = new Date();
      const totalSessions = await prisma.session.count();
      const activeSessions = await prisma.session.count({
        where: {
          expiresAt: {
            gt: now
          }
        }
      });

      // Get the most recent session
      const recentSession = await prisma.session.findFirst({
        orderBy: {
          expiresAt: 'desc'
        }
      });

      // Clear console and display updated info
      console.clear();
      console.log('📊 Real-time Session Monitor');
      console.log('Press Ctrl+C to stop\n');
      console.log(`⏰ Last checked: ${now.toLocaleTimeString()}`);
      console.log(`📈 Total sessions: ${totalSessions}`);
      console.log(`✅ Active sessions: ${activeSessions}`);
      console.log(`❌ Expired sessions: ${totalSessions - activeSessions}`);

      if (recentSession) {
        const isActive = recentSession.expiresAt > now;
        console.log('\n📝 Most Recent Session:');
        console.log(`   ID: ${recentSession.id.substring(0, 8)}...`);
        console.log(`   Status: ${isActive ? '✅ Active' : '❌ Expired'}`);
        console.log(`   Expires: ${recentSession.expiresAt.toLocaleString()}`);
        
        try {
          const data = JSON.parse(recentSession.data);
          if (data.merchant) {
            console.log(`   Merchant: ${data.merchant.businessName || 'Unknown'}`);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Show alerts
      if (totalSessions > 0 && activeSessions === 0) {
        console.log('\n⚠️  ALERT: All sessions have expired!');
        console.log('   This could cause login redirect loops.');
      } else if (activeSessions > 0) {
        console.log('\n✅ Session persistence is working correctly!');
      }

    } catch (error) {
      console.error('\n❌ Error checking sessions:', error.message);
    }
  };

  // Check immediately
  await checkSessions();

  // Then check every 5 seconds
  const interval = setInterval(checkSessions, 5000);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    clearInterval(interval);
    await prisma.$disconnect();
    console.log('\n👋 Session monitor stopped');
    process.exit(0);
  });
}

// Run the monitor
monitorSessions().catch(console.error);