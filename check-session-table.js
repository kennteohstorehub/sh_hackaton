const { PrismaClient } = require('@prisma/client');

async function checkSessionTable() {
  const dbUrl = 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl
      }
    }
  });
  
  try {
    console.log('🔍 Checking session table in database...\n');
    
    // Check if session table exists
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'session'
    `;
    
    if (tables.length > 0) {
      console.log('✅ Session table exists');
      
      // Count sessions
      const sessionCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM session
      `;
      console.log(`   Total sessions: ${sessionCount[0].count}`);
      
      // Check recent sessions
      const recentSessions = await prisma.$queryRaw`
        SELECT sid, expire 
        FROM session 
        ORDER BY expire DESC 
        LIMIT 5
      `;
      
      console.log('\n📋 Recent sessions:');
      recentSessions.forEach(s => {
        console.log(`   ${s.sid.substring(0, 20)}... expires: ${s.expire}`);
      });
      
    } else {
      console.log('❌ Session table does not exist!');
      console.log('   This is why sessions are not persisting');
      
      // Create session table
      console.log('\n🔧 Creating session table...');
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "session" (
          "sid" varchar NOT NULL COLLATE "default",
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL,
          CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
        ) WITH (OIDS=FALSE);
      `;
      
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
      `;
      
      console.log('✅ Session table created successfully!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSessionTable();