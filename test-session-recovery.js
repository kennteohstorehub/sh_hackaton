const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = process.env.API_URL || 'http://localhost:3838';

// Test data
const testMerchantId = 'demo';
const testSessionId = `test_session_${Date.now()}`;
const testCustomer = {
    customerName: 'Test Recovery User',
    customerPhone: '+60123456789',
    partySize: 2,
    merchantId: testMerchantId,
    sessionId: testSessionId,
    specialRequests: 'Testing session recovery'
};

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test functions
async function testJoinQueue() {
    console.log('\n📋 Test 1: Join Queue with Session');
    try {
        const response = await axios.post(`${BASE_URL}/api/webchat/join`, testCustomer);
        console.log('✅ Successfully joined queue');
        console.log('   Queue Number:', response.data.queueNumber);
        console.log('   Entry ID:', response.data.queueEntry.id);
        console.log('   Session ID:', testSessionId);
        return response.data.queueEntry.id;
    } catch (error) {
        console.error('❌ Failed to join queue:', error.response?.data || error.message);
        throw error;
    }
}

async function testSessionValidation(shouldPass = true) {
    console.log(`\n🔍 Test 2: Session Validation (should ${shouldPass ? 'pass' : 'fail'})`);
    try {
        const response = await axios.post(`${BASE_URL}/api/webchat/session/validate`, {
            sessionId: testSessionId
        });
        
        if (shouldPass) {
            console.log('✅ Session validated successfully');
            console.log('   Recovered:', response.data.recovered);
            console.log('   Within Grace Period:', response.data.withinGracePeriod);
            console.log('   Position:', response.data.queueData?.position);
        } else {
            console.log('❌ Unexpectedly validated expired session');
        }
        
        return response.data;
    } catch (error) {
        if (!shouldPass) {
            console.log('✅ Session validation correctly failed for expired session');
        } else {
            console.error('❌ Session validation failed:', error.response?.data || error.message);
        }
        return null;
    }
}

async function testSessionExtension() {
    console.log('\n⏰ Test 3: Session Extension');
    try {
        const response = await axios.post(`${BASE_URL}/api/webchat/session/extend`, {
            sessionId: testSessionId
        });
        console.log('✅ Session extended successfully');
        console.log('   New expiry:', new Date(response.data.sessionExpiresAt).toLocaleString());
        return response.data;
    } catch (error) {
        console.error('❌ Failed to extend session:', error.response?.data || error.message);
        return null;
    }
}

async function testGracePeriodRecovery(entryId) {
    console.log('\n🔄 Test 4: Grace Period Recovery');
    
    try {
        // First, cancel the queue entry
        console.log('   Cancelling queue entry...');
        await axios.post(`${BASE_URL}/api/webchat/cancel/${testSessionId}`);
        console.log('   ✅ Queue entry cancelled');
        
        // Wait a moment
        await wait(1000);
        
        // Try to validate session (should fail as cancelled)
        console.log('   Attempting to validate cancelled session...');
        const validation = await axios.post(`${BASE_URL}/api/webchat/session/validate`, {
            sessionId: testSessionId
        });
        
        if (!validation.data.recovered) {
            console.log('   ✅ Session correctly not recovered (cancelled)');
        } else {
            console.log('   ❌ Unexpected recovery of cancelled session');
        }
        
        // Update the queue entry to simulate grace period scenario
        console.log('\n   Simulating grace period scenario...');
        await prisma.queueEntry.update({
            where: { id: entryId },
            data: {
                status: 'waiting',
                completedAt: null,
                lastActivityAt: new Date()
            }
        });
        
        // Now try validation again
        const recoveryResponse = await axios.post(`${BASE_URL}/api/webchat/session/validate`, {
            sessionId: testSessionId
        });
        
        if (recoveryResponse.data.recovered && recoveryResponse.data.withinGracePeriod) {
            console.log('   ✅ Successfully recovered within grace period');
            console.log('      Position restored:', recoveryResponse.data.queueData.position);
        } else {
            console.log('   ❌ Failed to recover within grace period');
        }
        
        return recoveryResponse.data;
    } catch (error) {
        console.error('❌ Grace period test failed:', error.response?.data || error.message);
        return null;
    }
}

async function testExpiredSession(entryId) {
    console.log('\n⏱️ Test 5: Expired Session Handling');
    
    try {
        // Manually expire the session
        console.log('   Expiring session manually...');
        await prisma.webChatSession.updateMany({
            where: { sessionId: testSessionId },
            data: {
                sessionExpiresAt: new Date(Date.now() - 1000), // 1 second ago
                isActive: false
            }
        });
        
        // Also expire the queue entry session
        await prisma.queueEntry.update({
            where: { id: entryId },
            data: {
                sessionExpiresAt: new Date(Date.now() - 1000),
                lastActivityAt: new Date(Date.now() - 20 * 60 * 1000) // 20 minutes ago
            }
        });
        
        console.log('   ✅ Session expired');
        
        // Try to validate expired session
        const validation = await testSessionValidation(false);
        
        // Try to extend expired session
        console.log('\n   Attempting to extend expired session...');
        try {
            await axios.post(`${BASE_URL}/api/webchat/session/extend`, {
                sessionId: testSessionId
            });
            console.log('   ❌ Unexpectedly extended expired session');
        } catch (error) {
            console.log('   ✅ Correctly failed to extend expired session');
        }
        
    } catch (error) {
        console.error('❌ Expired session test failed:', error.message);
    }
}

async function testMultiTabSync() {
    console.log('\n🖥️ Test 6: Multi-Tab Session Sync');
    
    try {
        // Create a new session entry
        const newEntryResponse = await axios.post(`${BASE_URL}/api/webchat/join`, {
            ...testCustomer,
            sessionId: `${testSessionId}_tab2`
        });
        
        console.log('   ✅ Created second tab session');
        
        // Validate both sessions
        console.log('   Validating original session...');
        const tab1Validation = await axios.post(`${BASE_URL}/api/webchat/session/validate`, {
            sessionId: testSessionId
        });
        
        console.log('   Validating second tab session...');
        const tab2Validation = await axios.post(`${BASE_URL}/api/webchat/session/validate`, {
            sessionId: `${testSessionId}_tab2`
        });
        
        if (tab1Validation.data.recovered && tab2Validation.data.recovered) {
            console.log('   ✅ Both sessions validated successfully');
        } else {
            console.log('   ❌ Multi-tab validation failed');
        }
        
        // Clean up second session
        await axios.post(`${BASE_URL}/api/webchat/cancel/${testSessionId}_tab2`);
        
    } catch (error) {
        console.error('❌ Multi-tab sync test failed:', error.response?.data || error.message);
    }
}

async function testSessionCleanup() {
    console.log('\n🧹 Test 7: Session Cleanup Job');
    
    try {
        // Import and run the cleanup job directly
        const { cleanupExpiredSessions } = require('./server/jobs/sessionCleanup');
        
        console.log('   Running cleanup job...');
        const result = await cleanupExpiredSessions();
        
        console.log('   ✅ Cleanup job completed');
        console.log('      Expired sessions marked inactive:', result.expiredSessions);
        console.log('      Old sessions deleted:', result.deletedSessions);
        console.log('      Expired queue entries updated:', result.expiredQueueEntries);
        console.log('      Orphaned entries marked no-show:', result.orphanedEntries);
        
    } catch (error) {
        console.error('❌ Cleanup job test failed:', error.message);
    }
}

async function testQuickRejoin(entryId) {
    console.log('\n🔄 Test 8: Quick Rejoin Functionality');
    
    try {
        // First expire the session to simulate timeout
        await prisma.webChatSession.updateMany({
            where: { sessionId: testSessionId },
            data: {
                sessionExpiresAt: new Date(Date.now() - 1000),
                isActive: false
            }
        });
        
        // Update queue entry to be within grace period
        await prisma.queueEntry.update({
            where: { id: entryId },
            data: {
                status: 'waiting',
                lastActivityAt: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
            }
        });
        
        console.log('   Session expired but within grace period');
        
        // Try to validate - should offer quick rejoin
        const validation = await axios.post(`${BASE_URL}/api/webchat/session/validate`, {
            sessionId: testSessionId
        });
        
        if (validation.data.recovered && validation.data.withinGracePeriod) {
            console.log('   ✅ Quick rejoin offered successfully');
            console.log('      Recovery token:', validation.data.queueData.recoveryToken);
        } else {
            console.log('   ❌ Quick rejoin not offered when expected');
        }
        
    } catch (error) {
        console.error('❌ Quick rejoin test failed:', error.response?.data || error.message);
    }
}

// Main test runner
async function runTests() {
    console.log('🧪 Starting Session Recovery Tests');
    console.log('================================');
    
    let entryId;
    
    try {
        // Test 1: Join queue
        entryId = await testJoinQueue();
        await wait(1000);
        
        // Test 2: Validate active session
        await testSessionValidation(true);
        await wait(1000);
        
        // Test 3: Extend session
        await testSessionExtension();
        await wait(1000);
        
        // Test 4: Grace period recovery
        await testGracePeriodRecovery(entryId);
        await wait(1000);
        
        // Test 5: Expired session handling
        await testExpiredSession(entryId);
        await wait(1000);
        
        // Test 6: Multi-tab sync
        await testMultiTabSync();
        await wait(1000);
        
        // Test 7: Session cleanup
        await testSessionCleanup();
        await wait(1000);
        
        // Test 8: Quick rejoin
        await testQuickRejoin(entryId);
        
        console.log('\n✅ All tests completed!');
        
    } catch (error) {
        console.error('\n❌ Test suite failed:', error.message);
    } finally {
        // Cleanup test data
        console.log('\n🧹 Cleaning up test data...');
        
        try {
            // Delete test sessions
            await prisma.webChatSession.deleteMany({
                where: {
                    sessionId: {
                        contains: testSessionId
                    }
                }
            });
            
            // Delete test queue entries
            await prisma.queueEntry.deleteMany({
                where: {
                    sessionId: {
                        contains: testSessionId
                    }
                }
            });
            
            console.log('✅ Test data cleaned up');
        } catch (cleanupError) {
            console.error('❌ Cleanup failed:', cleanupError.message);
        }
        
        await prisma.$disconnect();
        process.exit(0);
    }
}

// Run tests
runTests().catch(console.error);