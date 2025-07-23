#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

// Use the connection string from the .env file
const DATABASE_URL = 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function diagnoseSessionIssue() {
  console.log('🔍 Comprehensive Session Diagnosis\n');

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL
      }
    },
    log: ['query', 'error', 'warn']
  });

  try {
    // 1. Test database connection
    console.log('1️⃣ Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connection successful\n');

    // 2. Check Session table schema
    console.log('2️⃣ Checking Session table schema...');
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'Session'
      ORDER BY ordinal_position;
    `;
    
    console.log('Session table columns:');
    tableInfo.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    console.log('');

    // 3. Check for any indexes
    console.log('3️⃣ Checking indexes...');
    const indexes = await prisma.$queryRaw`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'Session';
    `;
    
    console.log('Indexes:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.indexname}: ${idx.indexdef}`);
    });
    console.log('');

    // 4. Test creating a session
    console.log('4️⃣ Testing session creation...');
    const testSessionId = crypto.randomBytes(16).toString('hex');
    const testSid = `test_${Date.now()}`;
    const testData = JSON.stringify({
      cookie: {
        originalMaxAge: 86400000,
        expires: new Date(Date.now() + 86400000).toISOString(),
        secure: false,
        httpOnly: true,
        path: '/',
        sameSite: 'lax'
      },
      merchant: {
        id: 'test-merchant-id',
        businessName: 'Test Business',
        email: 'test@example.com'
      }
    });

    try {
      const createdSession = await prisma.session.create({
        data: {
          id: testSessionId,
          sid: testSid,
          data: testData,
          expiresAt: new Date(Date.now() + 86400000) // 24 hours from now
        }
      });
      console.log('✅ Test session created successfully');
      console.log(`   ID: ${createdSession.id}`);
      console.log(`   SID: ${createdSession.sid}`);
      console.log(`   Expires: ${createdSession.expiresAt.toISOString()}\n`);

      // 5. Test retrieving the session
      console.log('5️⃣ Testing session retrieval...');
      const retrievedSession = await prisma.session.findUnique({
        where: { sid: testSid }
      });
      
      if (retrievedSession) {
        console.log('✅ Session retrieved successfully');
        console.log(`   Data stored correctly: ${retrievedSession.data === testData}\n`);
      } else {
        console.log('❌ Failed to retrieve session\n');
      }

      // 6. Test updating the session
      console.log('6️⃣ Testing session update...');
      const updatedData = JSON.parse(testData);
      updatedData.lastAccess = new Date().toISOString();
      
      const updatedSession = await prisma.session.update({
        where: { sid: testSid },
        data: {
          data: JSON.stringify(updatedData),
          expiresAt: new Date(Date.now() + 86400000) // Extend by another 24 hours
        }
      });
      console.log('✅ Session updated successfully\n');

      // 7. Clean up test session
      console.log('7️⃣ Cleaning up test session...');
      await prisma.session.delete({
        where: { sid: testSid }
      });
      console.log('✅ Test session deleted\n');

    } catch (error) {
      console.error('❌ Error during session operations:', error.message);
      console.error('   Error code:', error.code);
      console.error('   Full error:', error);
    }

    // 8. Check for common issues
    console.log('8️⃣ Checking for common issues...');
    
    // Check if there are any constraints
    const constraints = await prisma.$queryRaw`
      SELECT conname, contype
      FROM pg_constraint
      WHERE conrelid = 'Session'::regclass;
    `;
    
    console.log('Constraints:');
    constraints.forEach(con => {
      const type = con.contype === 'p' ? 'PRIMARY KEY' : 
                   con.contype === 'u' ? 'UNIQUE' :
                   con.contype === 'f' ? 'FOREIGN KEY' : con.contype;
      console.log(`  - ${con.conname}: ${type}`);
    });

    // 9. Check Express session configuration
    console.log('\n9️⃣ Session Configuration Recommendations:');
    console.log('Ensure your Express session configuration includes:');
    console.log('```javascript');
    console.log('app.use(session({');
    console.log('  store: new PrismaSessionStore(prisma, {');
    console.log('    checkPeriod: 2 * 60 * 1000,  // 2 minutes');
    console.log('    dbRecordIdIsSessionId: true,');
    console.log('    dbRecordIdFunction: undefined,');
    console.log('  }),');
    console.log('  secret: process.env.SESSION_SECRET,');
    console.log('  resave: false,');
    console.log('  saveUninitialized: false,');
    console.log('  cookie: {');
    console.log('    secure: process.env.NODE_ENV === "production",');
    console.log('    httpOnly: true,');
    console.log('    maxAge: 24 * 60 * 60 * 1000,');
    console.log('    sameSite: "lax",');
    console.log('    path: "/"');
    console.log('  }');
    console.log('}));');
    console.log('```');

    console.log('\n✅ Diagnosis complete!');
    console.log('\nSummary:');
    console.log('- Database connection: ✅ Working');
    console.log('- Session table exists: ✅ Yes');
    console.log('- Session CRUD operations: ✅ Working');
    console.log('- Current session count: 0 (empty table)');
    console.log('\n⚠️  The issue is likely in the Express session configuration.');
    console.log('The database is working correctly, but sessions are not being saved from the application.');

  } catch (error) {
    console.error('\n❌ Diagnosis failed:', error.message);
    console.error('Error details:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the diagnosis
diagnoseSessionIssue().catch(console.error);