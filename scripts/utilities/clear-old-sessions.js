const { PrismaClient } = require('@prisma/client');

async function clearOldSessions() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl
      }
    }
  });
  
  try {
    console.log('🧹 Clearing old sessions from database...\n');
    
    // Delete all sessions to force fresh start
    const result = await prisma.$executeRaw`
      DELETE FROM session
    `;
    
    console.log(`✅ Deleted ${result} sessions`);
    console.log('   All users will need to login again');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Only run if called directly
if (require.main === module) {
  clearOldSessions();
}