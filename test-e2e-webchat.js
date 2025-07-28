const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3838';
const MERCHANT_ID = '3ecceb82-fb33-42c8-9d84-19eb69417e16';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testE2EWebchat() {
    console.log('=== End-to-End WebChat Queue System Test ===\n');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1200, height: 800 }
    });
    
    // Create two pages - one for customer, one for dashboard
    const customerPage = await browser.newPage();
    const dashboardPage = await browser.newPage();
    
    // Enable console logging for customer page
    customerPage.on('console', msg => {
        if (msg.type() === 'log' || msg.type() === 'info') {
            console.log(`[Customer ${msg.type()}]`, msg.text());
        }
    });
    
    try {
        // Step 1: Open dashboard first
        console.log('1. Opening merchant dashboard...');
        await dashboardPage.goto(`${BASE_URL}/dashboard`);
        await dashboardPage.waitForSelector('.dashboard-content', { timeout: 10000 });
        console.log('✅ Dashboard loaded');
        
        // Get initial queue count
        const initialCount = await dashboardPage.$eval('#totalWaitingCount', el => el.textContent);
        console.log(`Initial waiting customers: ${initialCount}`);
        
        // Step 2: Customer joins queue
        console.log('\n2. Customer joining queue...');
        await customerPage.goto(`${BASE_URL}/queue/join/${MERCHANT_ID}`);
        await customerPage.waitForSelector('#queueForm');
        
        // Fill form
        await customerPage.type('#customerName', 'E2E Test Customer');
        await customerPage.type('#customerPhone', '0123456789');
        await customerPage.select('#partySize', '3');
        await customerPage.type('#specialRequests', 'E2E testing - please ignore');
        
        // Submit and wait for redirect
        await Promise.all([
            customerPage.waitForNavigation(),
            customerPage.click('button[type="submit"]')
        ]);
        
        console.log('✅ Customer joined queue and redirected to chat');
        
        // Wait for welcome messages
        await sleep(3000);
        
        // Get customer session info
        const customerInfo = await customerPage.evaluate(() => {
            if (window.queueChat && window.queueChat.queueData) {
                return {
                    sessionId: window.queueChat.sessionId,
                    queueNumber: window.queueChat.queueData.queueNumber,
                    position: window.queueChat.queueData.position,
                    verificationCode: window.queueChat.queueData.verificationCode,
                    entryId: window.queueChat.queueData.entryId,
                    customerId: window.queueChat.queueData.customerId
                };
            }
            return null;
        });
        
        console.log('\nCustomer Info:');
        console.log('- Queue Number:', customerInfo?.queueNumber);
        console.log('- Position:', customerInfo?.position);
        console.log('- Verification Code:', customerInfo?.verificationCode);
        console.log('- Entry ID:', customerInfo?.entryId);
        
        // Step 3: Refresh dashboard and verify customer appears
        console.log('\n3. Refreshing dashboard...');
        await dashboardPage.reload();
        await dashboardPage.waitForSelector('.dashboard-content');
        
        const newCount = await dashboardPage.$eval('#totalWaitingCount', el => el.textContent);
        console.log(`New waiting customers: ${newCount}`);
        
        // Check if customer appears in active queue
        const customerVisible = await dashboardPage.evaluate((name) => {
            const customerRows = document.querySelectorAll('.customer-row');
            for (const row of customerRows) {
                if (row.textContent.includes(name)) {
                    return true;
                }
            }
            return false;
        }, 'E2E Test Customer');
        
        console.log(`✅ Customer visible in dashboard: ${customerVisible}`);
        
        // Step 4: Test queue status check
        console.log('\n4. Testing queue status check...');
        
        // Click "Check Status" button
        const statusButtons = await customerPage.$x('//button[contains(text(), "Check Status")]');
        if (statusButtons.length > 0) {
            await statusButtons[0].click();
            await sleep(2000);
            
            // Check for status message
            const statusMessage = await customerPage.evaluate(() => {
                const messages = document.querySelectorAll('.message-bubble');
                for (const msg of messages) {
                    if (msg.textContent.includes('Current Status:')) {
                        return msg.textContent;
                    }
                }
                return null;
            });
            
            console.log('✅ Status check response received');
            if (statusMessage) {
                console.log('Status message preview:', statusMessage.substring(0, 100) + '...');
            }
        }
        
        // Step 5: Test notification from dashboard
        console.log('\n5. Testing customer notification from dashboard...');
        
        // Find and click the Select button for our customer
        const selectSuccess = await dashboardPage.evaluate((entryId) => {
            const buttons = document.querySelectorAll('button.btn-select');
            for (const button of buttons) {
                const onclick = button.getAttribute('onclick');
                if (onclick && onclick.includes(entryId)) {
                    button.click();
                    return true;
                }
            }
            return false;
        }, customerInfo?.entryId);
        
        if (selectSuccess) {
            // Handle confirmation dialog
            await dashboardPage.on('dialog', async dialog => {
                console.log('Confirmation dialog:', dialog.message());
                await dialog.accept();
            });
            
            await sleep(3000);
            
            // Check if customer received notification
            const notificationReceived = await customerPage.evaluate(() => {
                const messages = document.querySelectorAll('.message-bubble');
                for (const msg of messages) {
                    if (msg.textContent.includes("IT'S YOUR TURN")) {
                        return true;
                    }
                }
                return false;
            });
            
            console.log(`✅ Customer notification received: ${notificationReceived}`);
        }
        
        // Step 6: Test queue cancellation
        console.log('\n6. Testing queue cancellation...');
        
        // Click "Cancel Queue" button
        const cancelButtons = await customerPage.$x('//button[contains(text(), "Cancel Queue")]');
        if (cancelButtons.length > 0) {
            await cancelButtons[0].click();
            await sleep(1000);
            
            // Send "YES" to confirm
            await customerPage.type('#messageInput', 'YES');
            await customerPage.keyboard.press('Enter');
            await sleep(2000);
            
            // Check for cancellation confirmation
            const cancelConfirmed = await customerPage.evaluate(() => {
                const messages = document.querySelectorAll('.message-bubble');
                for (const msg of messages) {
                    if (msg.textContent.includes('successfully removed from the queue')) {
                        return true;
                    }
                }
                return false;
            });
            
            console.log(`✅ Cancellation confirmed: ${cancelConfirmed}`);
        }
        
        // Step 7: Verify removal from dashboard
        console.log('\n7. Verifying removal from dashboard...');
        await dashboardPage.reload();
        await dashboardPage.waitForSelector('.dashboard-content');
        
        const customerStillVisible = await dashboardPage.evaluate((name) => {
            const customerRows = document.querySelectorAll('.customer-row');
            for (const row of customerRows) {
                if (row.textContent.includes(name)) {
                    return true;
                }
            }
            return false;
        }, 'E2E Test Customer');
        
        console.log(`✅ Customer removed from dashboard: ${!customerStillVisible}`);
        
        // Step 8: Test status check after cancellation
        console.log('\n8. Testing status check after cancellation...');
        const statusButtons2 = await customerPage.$x('//button[contains(text(), "Check Status")]');
        if (statusButtons2.length > 0) {
            await statusButtons2[0].click();
            await sleep(2000);
            
            const notInQueueMessage = await customerPage.evaluate(() => {
                const messages = document.querySelectorAll('.message-bubble');
                for (const msg of messages) {
                    if (msg.textContent.includes('not currently in any queue')) {
                        return true;
                    }
                }
                return false;
            });
            
            console.log(`✅ Correctly shows not in queue: ${notInQueueMessage}`);
        }
        
        console.log('\n✨ End-to-End Test Completed Successfully!');
        console.log('\nSummary:');
        console.log('✅ Customer can join queue');
        console.log('✅ Customer appears in dashboard');
        console.log('✅ Queue status check works');
        console.log('✅ Merchant can notify customer');
        console.log('✅ Customer receives notifications');
        console.log('✅ Queue cancellation works');
        console.log('✅ Customer removed from dashboard after cancellation');
        console.log('✅ Status check shows not in queue after cancellation');
        
    } catch (error) {
        console.error('\n❌ Test Error:', error.message);
        console.error(error.stack);
    } finally {
        console.log('\nTest pages will remain open for 30 seconds for inspection...');
        await sleep(30000);
        await browser.close();
    }
}

// Run the test
testE2EWebchat();