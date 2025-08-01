#!/usr/bin/env node

const { Client } = require('pg');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔧 NEON DATABASE MIGRATION TOOL');
console.log('=' .repeat(50));
console.log('This will fix the session table columns.\n');

console.log('Get your Neon connection string:');
console.log('1. Go to https://console.neon.tech');
console.log('2. Select your project');
console.log('3. Go to Connection Details');
console.log('4. Copy the Direct connection string\n');

rl.question('Paste your Neon connection string: ', async (connectionString) => {
  if (!connectionString || !connectionString.startsWith('postgresql://')) {
    console.log('\n❌ Invalid connection string');
    rl.close();
    return;
  }

  console.log('\n📋 Migration will:');
  console.log('   - Rename column "data" to "sess"');
  console.log('   - Rename column "expiresAt" to "expire"\n');
  
  rl.question('Continue? (yes/no): ', async (answer) => {
    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Migration cancelled');
      rl.close();
      return;
    }

    const client = new Client({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false }
    });

    try {
      console.log('\n🔄 Connecting to Neon...');
      await client.connect();
      console.log('✅ Connected');

      console.log('\n🔄 Running migration...');
      
      // First check if columns exist
      const checkQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'Session' 
        AND column_name IN ('data', 'expiresAt', 'sess', 'expire');
      `;
      
      const checkResult = await client.query(checkQuery);
      const columns = checkResult.rows.map(r => r.column_name);
      
      console.log('Current columns:', columns);

      // Run migrations only if needed
      if (columns.includes('data') && !columns.includes('sess')) {
        console.log('🔄 Renaming "data" to "sess"...');
        await client.query('ALTER TABLE "Session" RENAME COLUMN "data" TO "sess";');
        console.log('✅ Column "data" renamed to "sess"');
      }

      if (columns.includes('expiresAt') && !columns.includes('expire')) {
        console.log('🔄 Renaming "expiresAt" to "expire"...');
        await client.query('ALTER TABLE "Session" RENAME COLUMN "expiresAt" TO "expire";');
        console.log('✅ Column "expiresAt" renamed to "expire"');
      }

      console.log('\n✅ MIGRATION COMPLETE!');
      console.log('\n🎉 Your Queue Management System is now fully operational!');
      console.log('📱 Visit: https://queuemanagement-vtc2.onrender.com');
      console.log('👤 Login with: demo@smartqueue.com / demo123456');

    } catch (error) {
      console.error('\n❌ Migration failed:', error.message);
      if (error.message.includes('already exists')) {
        console.log('\n💡 It looks like the migration may have already been applied.');
      }
    } finally {
      await client.end();
      rl.close();
    }
  });
});