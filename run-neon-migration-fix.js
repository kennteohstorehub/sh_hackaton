#!/usr/bin/env node

const { Client } = require('pg');

async function runMigration() {
  console.log('🔧 Running Session Table Fix Migration');
  console.log('=' .repeat(50));
  
  // Use the Neon database URL from .env.test
  const databaseUrl = 'postgresql://neondb_owner:npg_rCJ2L1UzIZgw@ep-gentle-tooth-a13skk4o.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
  
  console.log('📊 Database: Neon');
  console.log('🔗 Connecting to Neon database...');
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected successfully');
    
    // Check current state
    console.log('\n📋 Checking current Session table structure...');
    const checkResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Session'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nCurrent columns:');
    checkResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // Check if id column exists
    const hasIdColumn = checkResult.rows.some(col => col.column_name === 'id');
    
    if (hasIdColumn) {
      console.log('\n🚀 Running migration to remove id column...');
      
      // First drop the primary key constraint on id
      console.log('  1. Dropping primary key constraint...');
      await client.query(`ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_pkey";`);
      
      // Drop the id column with CASCADE to remove dependent views
      console.log('  2. Dropping id column (CASCADE to remove dependent views)...');
      await client.query(`ALTER TABLE "Session" DROP COLUMN IF EXISTS "id" CASCADE;`);
      
      // Make sid the primary key
      console.log('  3. Making sid the primary key...');
      await client.query(`ALTER TABLE "Session" ADD PRIMARY KEY ("sid");`);
      
      // Remove the unique constraint on sid since it's now the primary key
      console.log('  4. Removing unique constraint on sid...');
      await client.query(`ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_sid_key";`);
      
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log('\n✅ Session table already has correct structure (no id column)');
    }
    
    // Verify final structure
    console.log('\n✔️  Verifying final structure...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'Session'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nFinal columns:');
    verifyResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // Check primary key
    const pkResult = await client.query(`
      SELECT constraint_name, column_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'Session' AND constraint_name LIKE '%pkey%';
    `);
    
    if (pkResult.rows.length > 0) {
      console.log(`\nPrimary key: ${pkResult.rows[0].column_name}`);
    }
    
    console.log('\n🎉 Session table is now correctly configured for connect-pg-simple!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('\nFailed to run migration:', error);
  process.exit(1);
});