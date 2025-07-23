const { PrismaClient } = require('@prisma/client');
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
