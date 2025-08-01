#!/usr/bin/env node

/**
 * Test Script: Acknowledgment Flow
 * Tests the complete read receipt/acknowledgment system for table ready notifications
 */

const { chromium } = require('playwright');
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:3838';
const MERCHANT_CREDENTIALS = {
    email: 'demo@storehub.com',
    password: 'Demo123!'
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAcknowledgmentFlow() {
    console.log('🧪 Starting Acknowledgment Flow Test...\n');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 500 
    });
    
    try {
        // 1. Setup merchant dashboard
        console.log('1️⃣ Setting up merchant dashboard...');
        const merchantContext = await browser.newContext();
        const merchantPage = await merchantContext.newPage();
        
        await merchantPage.goto(`${BASE_URL}/auth/login`);
        await merchantPage.fill('input[name="email"]', MERCHANT_CREDENTIALS.email);
        await merchantPage.fill('input[name="password"]', MERCHANT_CREDENTIALS.password);
        await merchantPage.click('button[type="submit"]');
        await merchantPage.waitForURL('**/dashboard');
        console.log('✅ Merchant logged in\n');
        
        // 2. Customer joins queue
        console.log('2️⃣ Customer joining queue...');
        const customerContext = await browser.newContext();
        const customerPage = await customerContext.newPage();
        
        await customerPage.goto(`${BASE_URL}/join`);
        await customerPage.fill('input[name="customerName"]', 'Test Customer');
        await customerPage.fill('input[name="customerPhone"]', '+60123456789');
        await customerPage.fill('input[name="partySize"]', '2');
        await customerPage.click('button[type="submit"]');
        
        // Wait for queue chat to load
        await customerPage.waitForSelector('#messagesContainer');
        console.log('✅ Customer joined queue\n');
        
        // 3. Merchant calls customer
        console.log('3️⃣ Merchant calling customer...');
        await merchantPage.reload();
        await sleep(1000);
        
        // Find and click the call button for the test customer
        const callButton = await merchantPage.locator('button:has-text("Call")').first();
        await callButton.click();
        console.log('✅ Customer called\n');
        
        // 4. Wait for customer to receive notification
        console.log('4️⃣ Waiting for customer notification...');
        await customerPage.waitForSelector('.action-card', { timeout: 10000 });
        console.log('✅ Customer received table ready notification\n');
        
        // 5. Customer acknowledges
        console.log('5️⃣ Customer acknowledging...');
        const ackButton = await customerPage.locator('button:has-text("headed to the restaurant")').first();
        await ackButton.click();
        
        // Wait for acknowledgment confirmation
        await customerPage.waitForSelector('.acknowledgment-success', { timeout: 10000 });
        console.log('✅ Customer acknowledgment confirmed\n');
        
        // 6. Verify merchant sees acknowledgment
        console.log('6️⃣ Verifying merchant dashboard update...');
        await sleep(2000); // Give time for update to propagate
        
        const ackStatus = await merchantPage.locator('.ack-status.on-way').first();
        const isVisible = await ackStatus.isVisible();
        
        if (isVisible) {
            console.log('✅ Merchant sees acknowledgment status\n');
        } else {
            console.log('❌ Acknowledgment status not visible on merchant dashboard\n');
        }
        
        // 7. Test retry mechanism (disconnect and reconnect)
        console.log('7️⃣ Testing retry mechanism...');
        
        // Create a new customer session
        const retryPage = await customerContext.newPage();
        await retryPage.goto(`${BASE_URL}/join`);
        await retryPage.fill('input[name="customerName"]', 'Retry Test Customer');
        await retryPage.fill('input[name="customerPhone"]', '+60198765432');
        await retryPage.fill('input[name="partySize"]', '1');
        await retryPage.click('button[type="submit"]');
        await retryPage.waitForSelector('#messagesContainer');
        
        // Simulate network interruption by going offline
        await retryPage.context().setOffline(true);
        console.log('📵 Simulated network disconnection');
        
        // Merchant calls this customer
        await merchantPage.reload();
        await sleep(1000);
        const retryCallButton = await merchantPage.locator('button:has-text("Call")').last();
        await retryCallButton.click();
        
        // Go back online
        await sleep(2000);
        await retryPage.context().setOffline(false);
        console.log('📶 Network restored');
        
        // Wait for notification and try to acknowledge
        await retryPage.waitForSelector('.action-card', { timeout: 15000 });
        const retryAckButton = await retryPage.locator('button:has-text("headed to the restaurant")').first();
        await retryAckButton.click();
        
        // Check if retry mechanism worked
        const retrySuccess = await retryPage.waitForSelector('.acknowledgment-success', { timeout: 20000 })
            .then(() => true)
            .catch(() => false);
        
        if (retrySuccess) {
            console.log('✅ Retry mechanism successful\n');
        } else {
            console.log('❌ Retry mechanism failed\n');
        }
        
        // Summary
        console.log('\n📊 Test Summary:');
        console.log('================');
        console.log('✅ Merchant login');
        console.log('✅ Customer queue join');
        console.log('✅ Table ready notification');
        console.log('✅ Customer acknowledgment');
        console.log('✅ Acknowledgment confirmation');
        console.log(isVisible ? '✅ Merchant dashboard update' : '❌ Merchant dashboard update');
        console.log(retrySuccess ? '✅ Retry mechanism' : '❌ Retry mechanism');
        
        console.log('\n✨ Acknowledgment flow test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await sleep(5000); // Keep browser open for inspection
        await browser.close();
    }
}

// Run the test
testAcknowledgmentFlow().catch(console.error);