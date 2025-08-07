#!/usr/bin/env node

/**
 * Simple Direct Test for Queue Join
 * Tests the queue join API directly
 */

const BASE_URL = 'http://localhost:3000';

// Use a test queue ID - you may need to update this with an actual queue ID from your database
const TEST_QUEUE_ID = '244ef284-bf07-4934-9151-8c2f968f8964'; 

async function testQueueJoin() {
    console.log('🧪 Testing Queue Join Flow\n');
    console.log('═'.repeat(50));
    
    try {
        // Join the queue directly
        console.log('\n1️⃣ Attempting to join queue...');
        const customerData = {
            name: `Test Customer ${Date.now()}`,
            phone: `+6012${Math.floor(Math.random() * 10000000)}`,
            partySize: 2,
            specialRequests: 'Test request - verification code test'
        };
        
        console.log(`   Customer Name: ${customerData.name}`);
        console.log(`   Phone: ${customerData.phone}`);
        console.log(`   Queue ID: ${TEST_QUEUE_ID}`);
        
        const joinResponse = await fetch(`${BASE_URL}/api/customer/join/${TEST_QUEUE_ID}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(customerData)
        });
        
        const responseText = await joinResponse.text();
        let joinData;
        
        try {
            joinData = JSON.parse(responseText);
        } catch (e) {
            console.log('❌ Response is not JSON:');
            console.log(responseText.substring(0, 200));
            return;
        }
        
        if (joinResponse.ok && joinData.success) {
            console.log('✅ Successfully joined queue!');
            console.log('\n📊 Response Data:');
            console.log('─'.repeat(50));
            console.log(JSON.stringify(joinData, null, 2));
            
            console.log('\n🔍 Verification Code Analysis:');
            console.log('─'.repeat(50));
            
            // Check different possible locations for verification code
            const verificationCode = 
                joinData.customer?.verificationCode ||
                joinData.verificationCode ||
                joinData.entry?.verificationCode ||
                null;
            
            if (verificationCode) {
                console.log(`✅ Verification code found: ${verificationCode}`);
                console.log('   Location: ' + (
                    joinData.customer?.verificationCode ? 'joinData.customer.verificationCode' :
                    joinData.verificationCode ? 'joinData.verificationCode' :
                    'joinData.entry.verificationCode'
                ));
            } else {
                console.log('❌ Verification code NOT found in response');
                console.log('   Checked locations:');
                console.log('   - joinData.customer.verificationCode');
                console.log('   - joinData.verificationCode');
                console.log('   - joinData.entry.verificationCode');
            }
            
            console.log('\n🔗 URLs Provided:');
            console.log('─'.repeat(50));
            if (joinData.statusUrl) {
                console.log(`✅ Status URL: ${joinData.statusUrl}`);
            } else {
                console.log('❌ Status URL not provided');
            }
            
            if (joinData.chatUrl) {
                console.log(`✅ Chat URL: ${joinData.chatUrl}`);
            } else {
                console.log('❌ Chat URL not provided');
            }
            
            // Summary
            console.log('\n' + '═'.repeat(50));
            console.log('📝 Test Summary:');
            console.log('─'.repeat(50));
            
            const checks = {
                'Queue Join': joinData.success,
                'Position Assigned': !!joinData.position,
                'Entry ID Provided': !!(joinData.id || joinData.entryId),
                'Verification Code': !!verificationCode,
                'Status URL': !!joinData.statusUrl,
                'Chat URL': !!joinData.chatUrl,
                'Session ID': !!joinData.customer?.sessionId
            };
            
            let passedCount = 0;
            for (const [check, passed] of Object.entries(checks)) {
                console.log(`${passed ? '✅' : '❌'} ${check}`);
                if (passed) passedCount++;
            }
            
            console.log('\n' + '═'.repeat(50));
            console.log(`Result: ${passedCount}/${Object.keys(checks).length} checks passed`);
            
            if (passedCount === Object.keys(checks).length) {
                console.log('🎉 All checks passed! Queue system is working correctly.');
            } else {
                console.log('⚠️ Some checks failed. Review the issues above.');
            }
            
        } else {
            console.log('❌ Failed to join queue');
            console.log(`   Status: ${joinResponse.status}`);
            console.log(`   Error: ${joinData?.error || 'Unknown error'}`);
            if (joinData?.message) {
                console.log(`   Message: ${joinData.message}`);
            }
            
            console.log('\n💡 Possible reasons:');
            console.log('   - Queue does not exist');
            console.log('   - Queue is not active');
            console.log('   - Queue is not accepting customers');
            console.log('   - Queue is full');
            console.log(`   - Update TEST_QUEUE_ID in this script with a valid queue ID`);
        }
        
    } catch (error) {
        console.log(`\n❌ Test failed with error: ${error.message}`);
        console.error(error);
    }
}

// Run the test
console.log('🚀 Starting test...');
console.log(`   Server: ${BASE_URL}`);
console.log(`   Queue ID: ${TEST_QUEUE_ID}`);
console.log('   Note: Update TEST_QUEUE_ID if needed\n');

testQueueJoin();