const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3838';
const MERCHANT_ID = '3ecceb82-fb33-42c8-9d84-19eb69417e16';

async function testDashboardView() {
    console.log('=== Dashboard WebChat Customer View Test ===\n');
    
    try {
        // Step 1: Create a test webchat customer
        console.log('1. Creating test webchat customer...');
        const sessionId = 'test_dashboard_' + Date.now();
        const customerData = {
            customerName: 'Dashboard Test Customer',
            customerPhone: '+60123456789',
            partySize: 2,
            merchantId: MERCHANT_ID,
            sessionId: sessionId,
            specialRequests: 'Testing dashboard visibility'
        };
        
        const joinResponse = await fetch(`${BASE_URL}/api/webchat/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customerData)
        });
        
        const joinResult = await joinResponse.json();
        if (!joinResult.success) {
            throw new Error(`Failed to join queue: ${joinResult.error}`);
        }
        
        console.log('✅ Customer created successfully');
        console.log(`   Queue Number: ${joinResult.queueNumber}`);
        console.log(`   Position: #${joinResult.position}`);
        console.log(`   Entry ID: ${joinResult.queueEntry.id}`);
        console.log(`   Customer ID: ${joinResult.queueEntry.customerId}`);
        
        // Step 2: Fetch dashboard data
        console.log('\n2. Fetching dashboard data...');
        const dashboardResponse = await fetch(`${BASE_URL}/api/queue`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (dashboardResponse.ok) {
            const dashboardData = await dashboardResponse.json();
            console.log(`✅ Found ${dashboardData.queues?.length || 0} queues`);
            
            // Check if our customer appears in any queue
            let foundCustomer = false;
            dashboardData.queues?.forEach(queue => {
                const entries = queue.entries || [];
                const webchatCustomer = entries.find(e => 
                    e.customerName === 'Dashboard Test Customer' ||
                    e.customerId === joinResult.queueEntry.customerId
                );
                
                if (webchatCustomer) {
                    foundCustomer = true;
                    console.log('✅ Customer found in queue entries');
                    console.log(`   Platform: ${webchatCustomer.platform}`);
                    console.log(`   Status: ${webchatCustomer.status}`);
                }
            });
            
            if (!foundCustomer) {
                console.log('❌ Customer not found in dashboard data');
            }
        } else {
            console.log('❌ Failed to fetch dashboard data (might need authentication)');
        }
        
        // Step 3: Test calling the customer
        console.log('\n3. Testing customer notification...');
        const queueId = '5a9afc58-3636-4fd4-b40d-d5a6581b0426';
        const callResponse = await fetch(`${BASE_URL}/api/queue/${queueId}/call-specific`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                customerId: joinResult.queueEntry.id 
            })
        });
        
        if (callResponse.ok) {
            const callResult = await callResponse.json();
            console.log('✅ Customer called successfully');
            console.log(`   Verification Code: ${callResult.customer?.verificationCode}`);
        } else {
            const error = await callResponse.json();
            console.log(`❌ Failed to call customer: ${error.error}`);
        }
        
        // Step 4: Test status check
        console.log('\n4. Testing status check...');
        const statusResponse = await fetch(`${BASE_URL}/api/webchat/status/${sessionId}`);
        const statusResult = await statusResponse.json();
        
        if (statusResponse.ok) {
            console.log('✅ Status check successful');
            console.log(`   Status: ${statusResult.status}`);
            console.log(`   Position: #${statusResult.position}`);
        } else {
            console.log(`❌ Status check failed: ${statusResult.error}`);
        }
        
        // Step 5: Test cancellation
        console.log('\n5. Testing cancellation...');
        const cancelResponse = await fetch(`${BASE_URL}/api/webchat/cancel/${sessionId}`, {
            method: 'POST'
        });
        
        if (cancelResponse.ok) {
            console.log('✅ Queue cancelled successfully');
        } else {
            const error = await cancelResponse.json();
            console.log(`❌ Cancellation failed: ${error.error}`);
        }
        
        // Step 6: Verify cancellation
        console.log('\n6. Verifying cancellation...');
        const verifyResponse = await fetch(`${BASE_URL}/api/webchat/status/${sessionId}`);
        const verifyResult = await verifyResponse.json();
        
        if (verifyResponse.status === 404) {
            console.log('✅ Correctly returns 404 after cancellation');
        } else {
            console.log('❌ Still showing in queue after cancellation');
        }
        
        console.log('\n✨ Dashboard View Test Completed!');
        
    } catch (error) {
        console.error('\n❌ Test Error:', error.message);
    }
}

// Run the test
testDashboardView();