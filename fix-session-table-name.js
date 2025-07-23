#!/usr/bin/env node

/**
 * Fix for Session Table Case Sensitivity Issue
 * 
 * Problem: The Prisma schema defines the table as "Session" (capital S)
 * but connect-pg-simple is configured to use "session" (lowercase s).
 * 
 * This causes sessions to not be stored, leading to redirect loops.
 * 
 * Solution: Update the session store configuration to use the correct table name.
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Session Table Configuration\n');

// Path to the server index.js file
const serverFile = path.join(__dirname, 'server', 'index.js');

// Read the current file
const content = fs.readFileSync(serverFile, 'utf8');

// Check if the issue exists
if (content.includes("tableName: 'session'")) {
  console.log('❌ Found incorrect table name configuration: "session" (lowercase)');
  console.log('✅ Fixing to use correct table name: "Session" (capital S)\n');
  
  // Fix the table name
  const fixedContent = content.replace(
    "tableName: 'session', // This matches our Prisma schema",
    'tableName: \'Session\', // This matches our Prisma schema (capital S)'
  );
  
  // Write the fixed content back
  fs.writeFileSync(serverFile, fixedContent, 'utf8');
  console.log('✅ File updated successfully!\n');
  
  console.log('📝 Summary of changes:');
  console.log('- Changed session table name from "session" to "Session"');
  console.log('- This matches the Prisma schema definition');
  console.log('\n🚀 Next steps:');
  console.log('1. Restart the server');
  console.log('2. Try logging in again');
  console.log('3. Sessions should now persist correctly');
} else if (content.includes("tableName: 'Session'")) {
  console.log('✅ Table name is already correct: "Session"');
  console.log('No changes needed.');
} else {
  console.log('⚠️  Could not find session table configuration');
  console.log('Please check the server/index.js file manually');
}

// Also create a proper session store configuration file
const sessionStoreConfig = `const { PrismaClient } = require('@prisma/client');
const { PrismaSessionStore } = require('@quixo3/prisma-session-store');

/**
 * Create a Prisma-based session store
 * This ensures compatibility with the Prisma schema
 */
function createSessionStore(prisma) {
  return new PrismaSessionStore(prisma, {
    checkPeriod: 2 * 60 * 1000,  // 2 minutes
    dbRecordIdIsSessionId: true,
    dbRecordIdFunction: undefined,
  });
}

module.exports = { createSessionStore };
`;

const sessionStoreFile = path.join(__dirname, 'server', 'config', 'session-store.js');
fs.writeFileSync(sessionStoreFile, sessionStoreConfig, 'utf8');
console.log('\n✅ Created session store configuration file');
console.log('   Location: server/config/session-store.js');

console.log('\n💡 Alternative Solution:');
console.log('If the issue persists, consider using @quixo3/prisma-session-store');
console.log('instead of connect-pg-simple for better Prisma compatibility.');
console.log('\nTo install: npm install @quixo3/prisma-session-store');