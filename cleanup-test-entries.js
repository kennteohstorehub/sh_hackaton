#!/usr/bin/env node

const prisma = require('./server/utils/prisma');

async function cleanupTestEntries() {
    try {
        console.log('Cleaning up test entries...');
        
        // Delete test queue entries
        const result = await prisma.queueEntry.deleteMany({
            where: {
                OR: [
                    { sessionId: { startsWith: 'test-session-' } },
                    { customerName: { startsWith: 'Test Customer' } }
                ]
            }
        });
        
        console.log(`✅ Deleted ${result.count} test entries`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupTestEntries();