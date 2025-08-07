#!/usr/bin/env node

/**
 * Database Integration Test for Queue Notification Fix
 * Demonstrates the testing strategy recommended by Gemini AI
 */

const { PrismaClient } = require('@prisma/client');
const unifiedNotificationService = require('./server/services/unifiedNotificationService');

const prisma = new PrismaClient();

async function testNotificationDatabaseUpdate() {
  console.log('🧪 Testing notification database update fix...\n');
  
  try {
    // Step 1: Create a test queue entry
    console.log('1. Creating test queue entry...');
    const testEntry = await prisma.queueEntry.create({
      data: {
        name: 'Test User',
        phoneNumber: '+1234567890',
        partySize: 2,
        estimatedWaitTime: 15,
        status: 'waiting',
        merchantId: 'test-merchant',
        notificationCount: 0,
        createdAt: new Date()
      }
    });
    console.log(`✅ Created entry with ID: ${testEntry.id}`);

    // Step 2: Test the notification update function
    console.log('\n2. Testing updateNotificationStatus function...');
    await unifiedNotificationService.updateNotificationStatus(testEntry.id, 'telegram');
    console.log('✅ updateNotificationStatus completed without error');

    // Step 3: Verify the database was updated correctly
    console.log('\n3. Verifying database updates...');
    const updatedEntry = await prisma.queueEntry.findUnique({
      where: { id: testEntry.id }
    });

    if (!updatedEntry) {
      throw new Error('Queue entry disappeared after update!');
    }

    console.log('Updated entry fields:');
    console.log(`- lastNotified: ${updatedEntry.lastNotified}`);
    console.log(`- notificationCount: ${updatedEntry.notificationCount}`);

    // Verify the fields were updated correctly
    if (!updatedEntry.lastNotified) {
      throw new Error('lastNotified field was not updated!');
    }

    if (updatedEntry.notificationCount !== 1) {
      throw new Error(`Expected notificationCount to be 1, got ${updatedEntry.notificationCount}`);
    }

    console.log('✅ Database fields updated correctly');

    // Step 4: Test multiple notifications increment properly
    console.log('\n4. Testing multiple notifications...');
    await unifiedNotificationService.updateNotificationStatus(testEntry.id, 'telegram');
    
    const finalEntry = await prisma.queueEntry.findUnique({
      where: { id: testEntry.id }
    });

    if (finalEntry.notificationCount !== 2) {
      throw new Error(`Expected notificationCount to be 2, got ${finalEntry.notificationCount}`);
    }

    console.log('✅ Multiple notifications increment correctly');

    // Cleanup
    console.log('\n5. Cleaning up test data...');
    await prisma.queueEntry.delete({
      where: { id: testEntry.id }
    });
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 ALL TESTS PASSED! The notification fix is working correctly.');
    console.log('\nWhat this test verified:');
    console.log('- updateNotificationStatus no longer crashes with field mismatch');
    console.log('- lastNotified field is properly updated');
    console.log('- notificationCount increments correctly');
    console.log('- Queue entry persists (no transaction rollback)');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function testErrorScenarios() {
  console.log('\n🧪 Testing error handling scenarios...\n');
  
  try {
    // Test with non-existent entry ID
    console.log('1. Testing with non-existent entry ID...');
    await unifiedNotificationService.updateNotificationStatus('non-existent-id', 'telegram');
    console.log('✅ Handled non-existent ID gracefully (no crash)');
    
    console.log('\n🎉 Error handling tests passed!');
    
  } catch (error) {
    console.error('\n❌ Error handling test failed:', error.message);
  }
}

// Run the tests
async function runTests() {
  await testNotificationDatabaseUpdate();
  await testErrorScenarios();
}

if (require.main === module) {
  runTests()
    .then(() => {
      console.log('\n✨ All tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testNotificationDatabaseUpdate, testErrorScenarios };