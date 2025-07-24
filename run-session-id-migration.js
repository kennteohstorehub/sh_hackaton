#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function runMigration() {
  console.log('🔧 Running Session ID Default Migration');
  console.log('=' .repeat(50));
  
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }
  
  // Parse database URL
  const isNeon = databaseUrl.includes('neon.tech');
  console.log(`📊 Database: ${isNeon ? 'Neon' : 'PostgreSQL'}`);
  console.log(`🔗 Host: ${databaseUrl.split('@')[1]?.split('/')[0] || 'unknown'}`);
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: isNeon ? { rejectUnauthorized: false } : false
  });
  
  try {
    console.log('\n🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');
    
    // Check current state
    console.log('\n📋 Checking current Session table structure...');
    const checkResult = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Session'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nCurrent columns:');
    checkResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (default: ${col.column_default || 'none'})`);
    });
    
    // Run migration
    console.log('\n🚀 Running migration...');
    
    // First, update any existing rows with NULL id
    const updateResult = await client.query(`
      UPDATE "Session" 
      SET "id" = gen_random_uuid() 
      WHERE "id" IS NULL;
    `);
    
    console.log(`  ✅ Updated ${updateResult.rowCount} rows with NULL id`);
    
    // Then alter the column to have a default value
    await client.query(`
      ALTER TABLE "Session" 
      ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
    `);
    
    console.log('  ✅ Added default value gen_random_uuid() to id column');
    
    // Verify the change
    console.log('\n✔️  Verifying migration...');
    const verifyResult = await client.query(`
      SELECT column_name, column_default
      FROM information_schema.columns
      WHERE table_name = 'Session' AND column_name = 'id';
    `);
    
    const idColumn = verifyResult.rows[0];
    if (idColumn && idColumn.column_default) {
      console.log(`  ✅ Success! id column now has default: ${idColumn.column_default}`);
    } else {
      console.log('  ⚠️  Warning: Could not verify default value');
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\nThe Session table now has a default UUID for the id column.');
    console.log('This should fix the "null value in column id" error.');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the migration
runMigration().catch(console.error);