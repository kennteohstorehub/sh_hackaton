const { test, expect } = require('@playwright/test');

test.describe('Queue Notification - Simple Tests', () => {
    const baseUrl = 'http://localhost:3838';
    const testQueueId = '453b1b29-7d3b-4c0e-92d6-d86cc9952f8e';
    
    test('Basic notification flow works', async ({ page, context }) => {
        console.log('\n🧪 Testing basic notification flow\n');
        
        // Create customer
        const testData = {
            name: 'Test Customer ' + Date.now(),
            phone: '+60' + Math.floor(100000000 + Math.random() * 900000000),
            partySize: 2
        };
        
        const response = await page.request.post(`${baseUrl}/api/customer/join/${testQueueId}`, {
            data: testData
        });
        
        const result = await response.json();
        expect(result.success).toBe(true);
        console.log('✅ Customer created:', testData.name);
        console.log('📱 Chat URL:', result.chatUrl);
        
        // Open customer page
        const customerPage = await context.newPage();
        await customerPage.goto(`${baseUrl}${result.chatUrl}`, {
            waitUntil: 'networkidle'
        });
        
        // Wait for welcome message
        await customerPage.waitForSelector('.message.bot', { timeout: 10000 });
        console.log('✅ Chat page loaded');
        
        // Call customer via API
        const callResponse = await page.request.post(`${baseUrl}/api/queue/${testQueueId}/call-specific`, {
            data: { customerId: result.entryId }
        });
        expect(callResponse.ok()).toBe(true);
        console.log('✅ Customer called');
        
        // Wait for overlay
        await customerPage.waitForSelector('.acknowledgment-overlay', { 
            visible: true, 
            timeout: 15000 
        });
        console.log('✅ Acknowledgment overlay appeared');
        
        // Verify overlay content
        const overlayTitle = await customerPage.locator('.acknowledgment-header h2').textContent();
        expect(overlayTitle).toContain("It's Your Turn\!");
        
        const verificationCode = await customerPage.locator('.verification-code-large').textContent();
        expect(verificationCode).toBeTruthy();
        console.log('✅ Verification code displayed:', verificationCode);
        
        // Click acknowledgment
        const ackButton = await customerPage.locator('button:has-text("I\'m headed to the restaurant")');
        await ackButton.click();
        console.log('✅ Acknowledgment button clicked');
        
        // Wait for overlay to disappear
        await customerPage.waitForTimeout(2000);
        await expect(customerPage.locator('.acknowledgment-overlay')).toBeHidden();
        console.log('✅ Overlay dismissed');
        
        console.log('\n✅ All tests passed\!\n');
    });
    
    test('Status check shows correct state', async ({ page }) => {
        console.log('\n🧪 Testing status messages\n');
        
        // Create customer
        const testData = {
            name: 'Status Test ' + Date.now(),
            phone: '+60' + Math.floor(100000000 + Math.random() * 900000000),
            partySize: 2
        };
        
        const response = await page.request.post(`${baseUrl}/api/customer/join/${testQueueId}`, {
            data: testData
        });
        
        const result = await response.json();
        expect(result.success).toBe(true);
        
        // Open customer page
        await page.goto(`${baseUrl}${result.chatUrl}`, {
            waitUntil: 'networkidle'
        });
        
        // Wait for page to load
        await page.waitForSelector('.message.bot', { timeout: 10000 });
        
        // Click status button
        await page.locator('button:has-text("Check Status")').click();
        await page.waitForTimeout(2000);
        
        // Verify waiting status shows position
        const waitingStatus = await page.locator('text=/Position: #\\d+/').isVisible();
        expect(waitingStatus).toBe(true);
        console.log('✅ Waiting status shows position');
        
        // Call customer
        await page.request.post(`${baseUrl}/api/queue/${testQueueId}/call-specific`, {
            data: { customerId: result.entryId }
        });
        
        await page.waitForTimeout(3000);
        
        // Check status again
        await page.locator('button:has-text("Check Status")').click();
        await page.waitForTimeout(2000);
        
        // Verify called status
        const calledStatus = await page.locator('text=/YOUR TABLE IS READY/i').isVisible();
        expect(calledStatus).toBe(true);
        console.log('✅ Called status shows ready message');
        
        console.log('\n✅ Status tests passed\!\n');
    });
    
    test('Page refresh maintains called state', async ({ page }) => {
        console.log('\n🧪 Testing state persistence after refresh\n');
        
        // Create customer
        const testData = {
            name: 'Refresh Test ' + Date.now(),
            phone: '+60' + Math.floor(100000000 + Math.random() * 900000000),
            partySize: 2
        };
        
        const response = await page.request.post(`${baseUrl}/api/customer/join/${testQueueId}`, {
            data: testData
        });
        
        const result = await response.json();
        expect(result.success).toBe(true);
        
        // Open customer page
        await page.goto(`${baseUrl}${result.chatUrl}`, {
            waitUntil: 'networkidle'
        });
        
        // Call customer
        await page.request.post(`${baseUrl}/api/queue/${testQueueId}/call-specific`, {
            data: { customerId: result.entryId }
        });
        
        // Wait for overlay
        await page.waitForSelector('.acknowledgment-overlay', { 
            visible: true, 
            timeout: 15000 
        });
        console.log('✅ Initial overlay appeared');
        
        // Refresh page
        await page.reload({ waitUntil: 'networkidle' });
        console.log('✅ Page refreshed');
        
        // Verify overlay reappears
        await page.waitForSelector('.acknowledgment-overlay', { 
            visible: true, 
            timeout: 15000 
        });
        console.log('✅ Overlay reappeared after refresh');
        
        // Verify verification code is still there
        const verificationCode = await page.locator('.verification-code-large').textContent();
        expect(verificationCode).toBeTruthy();
        console.log('✅ Verification code persisted:', verificationCode);
        
        console.log('\n✅ Refresh test passed\!\n');
    });
});
