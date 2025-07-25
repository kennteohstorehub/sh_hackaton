#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 FINAL SESSION SCHEMA FIX');
console.log('='.repeat(50));
console.log('This script will:');
console.log('1. Revert to connect-pg-simple');
console.log('2. Update Prisma schema to match connect-pg-simple');
console.log('3. Remove express-pg-session references');
console.log('='.repeat(50));

// Step 1: Update package.json
console.log('\n1. Updating package.json...');
const packagePath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Remove express-pg-session and add connect-pg-simple
delete packageJson.dependencies['express-pg-session'];
packageJson.dependencies['connect-pg-simple'] = '^10.0.0';

// Sort dependencies
packageJson.dependencies = Object.keys(packageJson.dependencies)
  .sort()
  .reduce((acc, key) => {
    acc[key] = packageJson.dependencies[key];
    return acc;
  }, {});

fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('   ✓ Package.json updated');

// Step 2: Update Prisma schema
console.log('\n2. Updating Prisma schema...');
const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
let schemaContent = fs.readFileSync(schemaPath, 'utf8');

// Replace the Session model
const oldSessionModel = /model Session \{[\s\S]*?\n\}/;
const newSessionModel = `model Session {
  id        String   @id
  sid       String   @unique
  sess      String
  expire    DateTime

  @@index([expire])
}`;

schemaContent = schemaContent.replace(oldSessionModel, newSessionModel);
fs.writeFileSync(schemaPath, schemaContent);
console.log('   ✓ Prisma schema updated');
console.log('   - Changed "data" to "sess"');
console.log('   - Changed "expiresAt" to "expire"');

// Step 3: Update server/index.js
console.log('\n3. Updating server/index.js...');
const serverPath = path.join(__dirname, 'server', 'index.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Replace express-pg-session with connect-pg-simple
serverContent = serverContent.replace(
  "const pgSession = require('express-pg-session')(session);",
  "const pgSession = require('connect-pg-simple')(session);"
);

// Remove pool configuration and revert to simple connection string
const poolConfigRegex = /\/\/ Create a PostgreSQL pool[\s\S]*?sessionConfig\.store = new pgSession\({[\s\S]*?\}\);/g;
const simpleConfig = `sessionConfig.store = new pgSession({
      conString: config.database.postgres.url || process.env.DATABASE_URL,
      tableName: 'Session',
      ttl: 24 * 60 * 60,
      disableTouch: false,
      createTableIfMissing: false,
      pruneSessionInterval: 60
    });`;

serverContent = serverContent.replace(poolConfigRegex, simpleConfig);

// Fix Socket.IO session store too
const socketPoolRegex = /const pg = require\('pg'\);[\s\S]*?sessionStore = new pgSession\({[\s\S]*?\}\);/g;
const socketSimpleConfig = `sessionStore = new pgSession({
        conString: config.database.postgres.url || process.env.DATABASE_URL,
        tableName: 'Session',
        ttl: 24 * 60 * 60,
        createTableIfMissing: false,
        pruneSessionInterval: 60
      });`;

serverContent = serverContent.replace(socketPoolRegex, socketSimpleConfig);

fs.writeFileSync(serverPath, serverContent);
console.log('   ✓ Server configuration updated');

// Step 4: Create migration SQL
console.log('\n4. Creating migration SQL...');
const migrationSql = `-- Migration to fix session table columns
-- This renames columns to match connect-pg-simple expectations

ALTER TABLE "Session" 
RENAME COLUMN "data" TO "sess";

ALTER TABLE "Session" 
RENAME COLUMN "expiresAt" TO "expire";
`;

fs.writeFileSync(path.join(__dirname, 'fix-session-columns.sql'), migrationSql);
console.log('   ✓ Migration SQL created: fix-session-columns.sql');

console.log('\n✅ FIXES COMPLETE!');
console.log('\nNext steps:');
console.log('1. Run: npm install');
console.log('2. Run migration on production: psql $DATABASE_URL < fix-session-columns.sql');
console.log('3. Commit and push changes');
console.log('4. Render will deploy automatically');

console.log('\nThis solution:');
console.log('- Uses the stable connect-pg-simple library');
console.log('- Modifies the database schema to match library expectations');
console.log('- Provides a clean, permanent fix');