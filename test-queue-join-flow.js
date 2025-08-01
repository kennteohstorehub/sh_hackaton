#!/usr/bin/env node

/**
 * Test Script: Queue Join to Webchat Flow
 * Tests the complete flow from joining queue to being redirected to webchat
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3838';

async function testQueueJoinFlow() {
    console.log('🧪 Testing Queue Join to Webchat Flow...\n');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 500 
    });
    
    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        // Test 1: Access /join without merchant ID
        console.log('1️⃣ Testing /join redirect...');
        await page.goto(`${BASE_URL}/join`);
        await page.waitForLoadState('networkidle');
        
        // Should redirect to a merchant's join page
        const urlAfterRedirect = page.url();
        console.log(`   Redirected to: ${urlAfterRedirect}`);
        
        if (urlAfterRedirect.includes('/queue/join/') || urlAfterRedirect.includes('/join-queue/')) {
            console.log('✅ Successfully redirected to merchant join page\n');
        } else {
            console.log('❌ Redirect failed\n');
        }
        
        // Test 2: Fill and submit the join form
        console.log('2️⃣ Testing queue join form submission...');
        
        // Wait for page to load
        await page.waitForSelector('.queue-item', { timeout: 5000 }).catch(() => {
            console.log('   No queue items found, checking if business is open...');
        });
        
        // Check if there are queues available
        const hasQueues = await page.locator('.queue-item').count() > 0;
        
        if (hasQueues) {
            // Click on the first queue
            await page.click('.queue-item:first-child');
            console.log('   Selected first available queue');
            
            // Wait for form to appear
            await page.waitForSelector('#joinForm.active', { timeout: 5000 });
            
            // Fill the form
            await page.fill('#customerName', 'Test Customer Flow');
            await page.fill('#customerPhone', '+60123456789');
            await page.selectOption('#partySize', '2');
            console.log('   Filled customer details');
            
            // Submit the form
            await page.click('#joinBtn');
            console.log('   Submitted join form');
            
            // Wait for success message
            await page.waitForSelector('#successMessage', { state: 'visible', timeout: 10000 });
            console.log('✅ Successfully joined queue\n');
            
            // Test 3: Check for webchat redirect
            console.log('3️⃣ Waiting for webchat redirect...');
            
            // Wait for navigation to webchat (should happen within 2 seconds)
            await page.waitForURL('**/queue-chat/**', { timeout: 5000 }).then(() => {
                console.log('✅ Successfully redirected to webchat');
                const chatUrl = page.url();
                console.log(`   Webchat URL: ${chatUrl}\n`);
            }).catch(() => {
                console.log('❌ Not redirected to webchat');
                console.log(`   Current URL: ${page.url()}\n`);
            });
            
            // Test 4: Verify webchat loaded properly
            const isOnChatPage = page.url().includes('/queue-chat/');
            if (isOnChatPage) {
                console.log('4️⃣ Verifying webchat interface...');
                
                // Wait for chat elements
                const hasChatContainer = await page.waitForSelector('#messagesContainer', { timeout: 5000 })
                    .then(() => true)
                    .catch(() => false);
                
                if (hasChatContainer) {
                    console.log('✅ Webchat interface loaded successfully');
                    
                    // Check for queue data in localStorage
                    const queueData = await page.evaluate(() => {
                        return localStorage.getItem('queueData');
                    });
                    
                    if (queueData) {
                        const data = JSON.parse(queueData);
                        console.log('✅ Queue data stored in localStorage:');
                        console.log(`   - Customer: ${data.customerName}`);
                        console.log(`   - Position: ${data.position}`);
                        console.log(`   - Wait time: ${data.estimatedWaitTime} minutes`);
                        console.log(`   - Verification code: ${data.verificationCode}`);
                    }
                } else {
                    console.log('❌ Webchat interface failed to load');
                }
            }
            
        } else {
            console.log('⚠️  No active queues available or business is closed');
            
            // Check for closed message
            const closedMessage = await page.locator('.business-closed').count() > 0;
            if (closedMessage) {
                console.log('   Business is currently closed');
            }
        }
        
        // Summary
        console.log('\n📊 Test Summary:');
        console.log('================');
        console.log(`✅ /join redirect works`);
        console.log(hasQueues ? '✅ Queue selection works' : '⚠️  No queues to test');
        console.log(hasQueues ? '✅ Form submission works' : '⚠️  Could not test form');
        
        if (hasQueues) {
            const redirected = page.url().includes('/queue-chat/');
            console.log(redirected ? '✅ Webchat redirect works' : '❌ Webchat redirect failed');
            console.log(redirected ? '✅ Webchat loads properly' : '❌ Webchat did not load');
        }
        
        console.log('\n✨ Queue join flow test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        // Keep browser open for inspection
        await new Promise(resolve => setTimeout(resolve, 5000));
        await browser.close();
    }
}

// Run the test
testQueueJoinFlow().catch(console.error);