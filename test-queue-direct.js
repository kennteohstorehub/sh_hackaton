const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testQueueDirectly() {
    console.log('🔍 DIRECT DATABASE TEST: Queue Notification Issue');
    console.log('=================================================\n');
    
    try {
        // Step 1: Find active queue
        console.log('1️⃣ Finding active queue...');
        const queue = await prisma.queue.findFirst({
            where: { isActive: true },
            include: { merchant: true }
        });
        
        if (!queue) {
            console.log('❌ No active queue found');
            return;
        }
        
        console.log(`✅ Found queue: ${queue.name} (${queue.id})\n`);
        
        // Step 2: Create a test queue entry
        console.log('2️⃣ Creating test queue entry...');
        const entry = await prisma.queueEntry.create({
            data: {
                queueId: queue.id,
                customerId: 'test-' + Date.now(),
                customerName: 'Test Customer ' + Date.now(),
                customerPhone: '+60123456789',
                platform: 'web',
                position: 999,
                status: 'waiting',
                partySize: 2
            }
        });
        
        console.log(`✅ Created entry: ${entry.id}`);
        console.log(`   Status: ${entry.status}\n`);
        
        // Step 3: Simulate notification update (what should happen)
        console.log('3️⃣ Simulating notification update...');
        console.log('   Updating with correct fields:');
        console.log('   - status: "called"');
        console.log('   - calledAt: new Date()');
        console.log('   - lastNotified: new Date()');
        
        try {
            const updated = await prisma.queueEntry.update({
                where: { id: entry.id },
                data: {
                    status: 'called',
                    calledAt: new Date(),
                    lastNotified: new Date()
                }
            });
            
            console.log('✅ Update successful!');
            console.log(`   New status: ${updated.status}`);
            console.log(`   Called at: ${updated.calledAt}`);
            console.log(`   Last notified: ${updated.lastNotified}\n`);
            
        } catch (updateError) {
            console.error('❌ UPDATE FAILED!');
            console.error('   Error:', updateError.message);
            console.error('   This is why notifications are failing!\n');
        }
        
        // Step 4: Check if entry still exists
        console.log('4️⃣ Checking if entry still exists...');
        const stillExists = await prisma.queueEntry.findUnique({
            where: { id: entry.id }
        });
        
        if (stillExists) {
            console.log('✅ Entry still exists after update');
            console.log(`   Current status: ${stillExists.status}`);
        } else {
            console.log('❌ ENTRY DISAPPEARED! This is the bug!');
        }
        
        // Step 5: Test the problematic unifiedNotificationService update
        console.log('\n5️⃣ Testing unifiedNotificationService update...');
        console.log('   Testing update with notificationCount increment:');
        
        try {
            const serviceUpdate = await prisma.queueEntry.update({
                where: { id: entry.id },
                data: {
                    lastNotified: new Date(),
                    notificationCount: {
                        increment: 1
                    }
                }
            });
            
            console.log('✅ Service update successful!');
            console.log(`   Notification count: ${serviceUpdate.notificationCount}`);
            
        } catch (serviceError) {
            console.error('❌ SERVICE UPDATE FAILED!');
            console.error('   Error:', serviceError.message);
            console.error('   This might be causing the 500 error!\n');
        }
        
        // Step 6: Clean up
        console.log('\n6️⃣ Cleaning up test entry...');
        await prisma.queueEntry.delete({
            where: { id: entry.id }
        });
        console.log('✅ Test entry deleted\n');
        
        // Analysis
        console.log('📊 ANALYSIS COMPLETE:');
        console.log('=====================================');
        console.log('If all updates succeeded, the issue is NOT with database fields.');
        console.log('The problem might be:');
        console.log('1. Transaction handling in the actual route');
        console.log('2. Middleware interfering with the request');
        console.log('3. Socket.io events causing side effects');
        console.log('4. Frontend JavaScript removing entries');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

testQueueDirectly();