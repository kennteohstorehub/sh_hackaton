#!/usr/bin/env node
require('dotenv').config();
const { cleanupOldAnalyticsData } = require('../server/jobs/analyticsDataRetention');
const prisma = require('../server/utils/prisma');
const moment = require('moment');

async function testAnalyticsRetention() {
  console.log('🧪 Testing Analytics Data Retention (6 months max)');
  console.log('================================================\n');
  
  try {
    // 1. Show current data statistics
    console.log('📊 Current Data Statistics:');
    
    const totalEntries = await prisma.queueEntry.count();
    const oldEntries = await prisma.queueEntry.count({
      where: {
        joinedAt: { lt: moment().subtract(6, 'months').toDate() }
      }
    });
    
    const totalMessages = await prisma.webChatMessage.count();
    const oldMessages = await prisma.webChatMessage.count({
      where: {
        createdAt: { lt: moment().subtract(6, 'months').toDate() }
      }
    });
    
    const totalNotifications = await prisma.notificationLog.count();
    const oldNotifications = await prisma.notificationLog.count({
      where: {
        sentAt: { lt: moment().subtract(6, 'months').toDate() }
      }
    });
    
    const totalAuditLogs = await prisma.auditLog.count();
    const oldAuditLogs = await prisma.auditLog.count({
      where: {
        createdAt: { lt: moment().subtract(6, 'months').toDate() },
        userType: { not: 'SUPERADMIN' }
      }
    });
    
    console.log(`  - Queue Entries: ${totalEntries} total (${oldEntries} older than 6 months)`);
    console.log(`  - WebChat Messages: ${totalMessages} total (${oldMessages} older than 6 months)`);
    console.log(`  - Notification Logs: ${totalNotifications} total (${oldNotifications} older than 6 months)`);
    console.log(`  - Audit Logs: ${totalAuditLogs} total (${oldAuditLogs} older than 6 months)`);
    console.log('');
    
    // 2. Show sample of old data that will be deleted
    if (oldEntries > 0) {
      console.log('📝 Sample of old queue entries to be deleted:');
      const sampleOldEntries = await prisma.queueEntry.findMany({
        where: {
          joinedAt: { lt: moment().subtract(6, 'months').toDate() },
          status: { in: ['completed', 'cancelled', 'no_show'] }
        },
        take: 5,
        orderBy: { joinedAt: 'asc' }
      });
      
      for (const entry of sampleOldEntries) {
        console.log(`  - ${entry.customerName} (${entry.status}) - ${moment(entry.joinedAt).format('YYYY-MM-DD')}`);
      }
      console.log('');
    }
    
    // 3. Ask for confirmation before running cleanup
    console.log('⚠️  WARNING: This will permanently delete data older than 6 months!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 4. Run the cleanup
    console.log('🔄 Running analytics data retention cleanup...\n');
    const result = await cleanupOldAnalyticsData();
    
    // 5. Show results
    console.log('✅ Cleanup Results:');
    console.log(`  - Deleted ${result.deletedEntries} queue entries`);
    console.log(`  - Deleted ${result.deletedMessages} WebChat messages`);
    console.log(`  - Deleted ${result.deletedNotifications} notification logs`);
    console.log(`  - Deleted ${result.deletedAuditLogs} audit logs`);
    console.log(`  - Updated analytics for ${result.updatedQueues} queues`);
    console.log('');
    
    // 6. Verify data retention
    const remainingOldEntries = await prisma.queueEntry.count({
      where: {
        joinedAt: { lt: moment().subtract(6, 'months').toDate() },
        status: { in: ['completed', 'cancelled', 'no_show'] }
      }
    });
    
    console.log('🔍 Verification:');
    console.log(`  - Remaining old completed/cancelled entries: ${remainingOldEntries}`);
    console.log(`  - Data retention policy (6 months) is ${remainingOldEntries === 0 ? '✅ working correctly' : '❌ NOT working correctly'}`);
    
  } catch (error) {
    console.error('❌ Error during analytics retention test:', error);
  } finally {
    await prisma.$disconnect();
    console.log('\n✨ Test completed!');
  }
}

// Run the test
testAnalyticsRetention();