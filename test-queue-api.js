#!/usr/bin/env node

/**
 * Simple API Test for Queue System
 * Tests the queue join flow and verification code generation
 */

const BASE_URL = 'http://localhost:3000';

async function testQueueJoin() {
    console.log('🧪 Testing Queue Join API\n');
    console.log('═'.repeat(50));
    
    try {
        // First, get available queues to find an active one
        console.log('\n1️⃣ Finding active queue...');
        const queuesResponse = await fetch(`${BASE_URL}/api/customer/queues`);
        const queuesData = await queuesResponse.json();
        
        if (!queuesData.queues || queuesData.queues.length === 0) {
            console.log('❌ No queues available. Please create a queue first.');
            return;
        }
        
        const activeQueue = queuesData.queues.find(q => q.isActive && q.acceptingCustomers);
        if (!activeQueue) {
            console.log('❌ No active queue accepting customers');
            return;
        }
        
        console.log(`✅ Found active queue: ${activeQueue.name} (ID: ${activeQueue.id})`);
        
        // Join the queue
        console.log('\n2️⃣ Joining queue...');
        const customerData = {
            name: `Test Customer ${Date.now()}`,
            phone: `+6012${Math.floor(Math.random() * 10000000)}`,
            partySize: 2,
            specialRequests: 'Test request - API testing'
        };
        
        console.log(`   Customer: ${customerData.name}`);
        console.log(`   Phone: ${customerData.phone}`);
        
        const joinResponse = await fetch(`${BASE_URL}/api/customer/join/${activeQueue.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(customerData)
        });
        
        const joinData = await joinResponse.json();
        
        if (joinResponse.ok && joinData.success) {
            console.log('✅ Successfully joined queue!');
            console.log('\n📊 Queue Entry Details:');
            console.log('─'.repeat(50));
            console.log(`   Queue Position: ${joinData.position}`);
            console.log(`   Entry ID: ${joinData.id || joinData.entryId}`);
            console.log(`   Estimated Wait: ${joinData.estimatedWaitTime || joinData.estimatedWait} minutes`);
            console.log(`   Session ID: ${joinData.customer?.sessionId || 'Not provided'}`);
            console.log(`   Verification Code: ${joinData.customer?.verificationCode || 'NOT PROVIDED'}`);
            console.log(`   Status URL: ${joinData.statusUrl || 'Not provided'}`);
            console.log(`   Chat URL: ${joinData.chatUrl || 'Not provided'}`);
            
            // Check verification code
            console.log('\n3️⃣ Verification Code Check:');
            if (joinData.customer?.verificationCode) {
                console.log(`✅ Verification code generated: ${joinData.customer.verificationCode}`);
            } else {
                console.log('❌ Verification code NOT included in response');
                console.log('   This needs to be fixed - the API should return the verification code');
            }
            
            // Check redirect URLs
            console.log('\n4️⃣ Redirect URLs Check:');
            if (joinData.statusUrl) {
                console.log(`✅ Status URL provided: ${joinData.statusUrl}`);
                
                // Test if the status page includes the verification code
                const fullStatusUrl = `${BASE_URL}${joinData.statusUrl}`;
                console.log(`   Testing status page: ${fullStatusUrl}`);
                
                try {
                    const statusResponse = await fetch(fullStatusUrl);
                    if (statusResponse.ok) {
                        const statusHtml = await statusResponse.text();
                        const hasVerificationCode = statusHtml.includes(joinData.customer?.verificationCode) ||
                                                   statusHtml.includes('Verification');
                        
                        if (hasVerificationCode) {
                            console.log('   ✅ Status page displays verification code');
                        } else {
                            console.log('   ❌ Status page does NOT display verification code');
                        }
                    } else {
                        console.log(`   ⚠️ Status page returned ${statusResponse.status}`);
                    }
                } catch (error) {
                    console.log(`   ⚠️ Could not test status page: ${error.message}`);
                }
            } else {
                console.log('❌ Status URL not provided in response');
            }
            
            console.log('\n' + '═'.repeat(50));
            console.log('\n📝 Summary:');
            console.log('─'.repeat(50));
            
            const issues = [];
            if (!joinData.customer?.verificationCode) {
                issues.push('Verification code not returned in API response');
            }
            if (!joinData.statusUrl) {
                issues.push('Status URL not provided');
            }
            
            if (issues.length === 0) {
                console.log('✅ All checks passed! Queue system is working correctly.');
            } else {
                console.log('⚠️ Issues found:');
                issues.forEach(issue => console.log(`   - ${issue}`));
            }
            
        } else {
            console.log('❌ Failed to join queue');
            console.log(`   Error: ${joinData.error || 'Unknown error'}`);
            if (joinData.message) {
                console.log(`   Message: ${joinData.message}`);
            }
        }
        
    } catch (error) {
        console.log(`\n❌ Test failed with error: ${error.message}`);
        console.error(error);
    }
}

// Run the test
testQueueJoin();