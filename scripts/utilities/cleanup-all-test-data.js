#!/usr/bin/env node

const prisma = require('./server/utils/prisma');
const logger = require('./server/utils/logger');

async function cleanupAllTestData() {
    try {
        console.log('🧹 Starting comprehensive test data cleanup...\n');
        
        // 1. Delete test queue entries
        console.log('1️⃣ Cleaning up test queue entries...');
        const deletedEntries = await prisma.queueEntry.deleteMany({
            where: {
                OR: [
                    { customerName: { contains: 'Test', mode: 'insensitive' } },
                    { customerName: { contains: 'test', mode: 'insensitive' } },
                    { sessionId: { startsWith: 'test-' } },
                    { customerPhone: { startsWith: '+6012345678' } },
                    { specialRequests: { contains: 'Test', mode: 'insensitive' } },
                    { notes: { contains: 'test', mode: 'insensitive' } }
                ]
            }
        });
        console.log(`   ✅ Deleted ${deletedEntries.count} test queue entries\n`);
        
        // 2. Delete test merchants
        console.log('2️⃣ Cleaning up test merchants...');
        const deletedMerchants = await prisma.merchant.deleteMany({
            where: {
                OR: [
                    { businessName: { contains: 'Test', mode: 'insensitive' } },
                    { businessName: { contains: 'Demo', mode: 'insensitive' } },
                    { email: { contains: 'test@', mode: 'insensitive' } },
                    { email: { contains: 'demo@', mode: 'insensitive' } }
                ]
            }
        });
        console.log(`   ✅ Deleted ${deletedMerchants.count} test merchants\n`);
        
        // 3. Delete test push subscriptions
        console.log('3️⃣ Cleaning up test push subscriptions...');
        const deletedSubs = await prisma.pushSubscription.deleteMany({
            where: {
                endpoint: { contains: 'test', mode: 'insensitive' }
            }
        });
        console.log(`   ✅ Deleted ${deletedSubs.count} test push subscriptions\n`);
        
        // 4. Clean up orphaned queue entries (entries for non-existent queues)
        console.log('4️⃣ Cleaning up orphaned queue entries...');
        const orphanedEntries = await prisma.$executeRaw`
            DELETE FROM "QueueEntry" 
            WHERE "queueId" NOT IN (SELECT "id" FROM "Queue")
        `;
        console.log(`   ✅ Deleted ${orphanedEntries} orphaned queue entries\n`);
        
        // 5. Reset queue positions for remaining entries
        console.log('5️⃣ Resetting queue positions...');
        const queues = await prisma.queue.findMany({
            where: { isActive: true }
        });
        
        for (const queue of queues) {
            const waitingEntries = await prisma.queueEntry.findMany({
                where: {
                    queueId: queue.id,
                    status: 'waiting'
                },
                orderBy: {
                    joinedAt: 'asc'
                }
            });
            
            // Update positions to start from 1
            for (let i = 0; i < waitingEntries.length; i++) {
                await prisma.queueEntry.update({
                    where: { id: waitingEntries[i].id },
                    data: { 
                        position: i + 1,
                        estimatedWaitTime: (i + 1) * (queue.averageServiceTime || 15)
                    }
                });
            }
            
            if (waitingEntries.length > 0) {
                console.log(`   ✅ Reset ${waitingEntries.length} positions for queue: ${queue.name}`);
            }
        }
        
        // 6. Clean up old completed/cancelled entries (older than 7 days)
        console.log('\n6️⃣ Cleaning up old completed/cancelled entries...');
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const deletedOld = await prisma.queueEntry.deleteMany({
            where: {
                OR: [
                    { status: 'completed' },
                    { status: 'cancelled' },
                    { status: 'no_show' }
                ],
                completedAt: {
                    lt: sevenDaysAgo
                }
            }
        });
        console.log(`   ✅ Deleted ${deletedOld.count} old entries\n`);
        
        // 7. Summary
        console.log('📊 Cleanup Summary:');
        console.log(`   • Test queue entries deleted: ${deletedEntries.count}`);
        console.log(`   • Test merchants deleted: ${deletedMerchants.count}`);
        console.log(`   • Test push subscriptions deleted: ${deletedSubs.count}`);
        console.log(`   • Orphaned entries deleted: ${orphanedEntries}`);
        console.log(`   • Old completed entries deleted: ${deletedOld.count}`);
        console.log(`   • Queue positions reset for ${queues.length} active queues`);
        
        console.log('\n✅ Test data cleanup completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        logger.error('Test data cleanup error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the cleanup
cleanupAllTestData();