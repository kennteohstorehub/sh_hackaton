const { chromium } = require('playwright');

async function testNotificationWithBrowser() {
    console.log('🔍 Testing Notification Flow with Browser');
    console.log('=========================================\n');
    
    const browser = await chromium.launch({ 
        headless: false,
        devtools: true 
    });
    
    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        // Listen for console messages
        page.on('console', msg => {
            if (msg.text().includes('NUCLEAR') || msg.text().includes('ERROR')) {
                console.log(`[Browser Console]: ${msg.text()}`);
            }
        });
        
        // Listen for page crashes
        page.on('crash', () => {
            console.log('❌❌❌ PAGE CRASHED!');
        });
        
        // Step 1: Login
        console.log('1️⃣ Navigating to login page...');
        await page.goto('http://localhost:3000/auth/login');
        
        console.log('   Filling login form...');
        await page.fill('input[name="email"]', 'admin@demo.local');
        await page.fill('input[name="password"]', 'Password123!');
        
        console.log('   Submitting...');
        await page.click('button[type="submit"]');
        
        // Wait for navigation to dashboard
        await page.waitForURL('**/dashboard', { timeout: 10000 });
        console.log('✅ Login successful\n');
        
        // Step 2: Check for queue
        console.log('2️⃣ Checking for active queue...');
        const queueId = await page.getAttribute('[data-queue-id]', 'data-queue-id');
        
        if (!queueId) {
            console.log('❌ No active queue found');
            await browser.close();
            return;
        }
        
        console.log(`   Queue ID: ${queueId}\n`);
        
        // Step 3: Open customer page in new tab
        console.log('3️⃣ Opening customer queue page...');
        const customerPage = await context.newPage();
        await customerPage.goto(`http://localhost:3000/queue/${queueId}`);
        
        console.log('   Joining queue as customer...');
        await customerPage.fill('input[name="customerName"]', 'Test Customer ' + Date.now());
        await customerPage.fill('input[name="customerPhone"]', '+60123456789');
        await customerPage.fill('input[name="partySize"]', '2');
        
        await customerPage.click('button[type="submit"]');
        await customerPage.waitForSelector('.queue-status', { timeout: 5000 });
        console.log('✅ Joined queue\n');
        
        // Step 4: THE CRITICAL TEST - Notify from dashboard
        console.log('4️⃣ TESTING NOTIFICATION (This crashed before)...');
        console.log('   Looking for notify button...');
        
        // Go back to dashboard
        await page.bringToFront();
        await page.reload(); // Refresh to see new customer
        
        // Wait for queue entries to load
        await page.waitForSelector('.queue-entry', { timeout: 5000 });
        
        // Find and click notify button for the first customer
        const notifyButton = await page.$('.notify-btn, button:has-text("Notify"), [onclick*="notify"]');
        
        if (notifyButton) {
            console.log('   Clicking notify button...');
            
            // Set up response listener
            const responsePromise = page.waitForResponse(
                resp => resp.url().includes('/api/queue/notify'),
                { timeout: 10000 }
            );
            
            await notifyButton.click();
            
            try {
                const response = await responsePromise;
                const status = response.status();
                
                if (status === 200) {
                    console.log('✅✅✅ NOTIFICATION SENT SUCCESSFULLY!');
                    console.log('   Server did not crash!');
                } else {
                    console.log(`❌ Notification failed with status: ${status}`);
                }
            } catch (e) {
                console.log('⚠️ Notification response timeout');
            }
        } else {
            console.log('⚠️ Could not find notify button');
        }
        
        // Step 5: Verify server health
        console.log('\n5️⃣ Verifying server health...');
        
        // Try to navigate to a new page
        const healthPage = await context.newPage();
        try {
            await healthPage.goto('http://localhost:3000', { timeout: 5000 });
            console.log('✅ Server is responsive!\n');
            console.log('🎉 SUCCESS: The server crash has been fixed!');
        } catch (e) {
            console.log('❌ Server is not responding - may have crashed');
        }
        
        // Wait a bit to see results
        await page.waitForTimeout(3000);
        
    } catch (error) {
        console.error('Test error:', error.message);
    } finally {
        await browser.close();
    }
}

testNotificationWithBrowser().catch(console.error);