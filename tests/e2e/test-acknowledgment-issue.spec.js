const { test, expect } = require('@playwright/test');

test.describe('Debug Acknowledgment Issue', () => {
    const baseUrl = 'http://localhost:3000';
    const testQueueId = '453b1b29-7d3b-4c0e-92d6-d86cc9952f8e';
    
    test('Check acknowledgment API response', async ({ page }) => {
        console.log('\n🔍 Debugging acknowledgment issue\n');
        
        // Create customer
        const testData = {
            name: 'Debug Test ' + Date.now(),
            phone: '+60' + Math.floor(100000000 + Math.random() * 900000000),
            partySize: 2
        };
        
        const response = await page.request.post(`${baseUrl}/api/customer/join/${testQueueId}`, {
            data: testData
        });
        
        const result = await response.json();
        expect(result.success).toBe(true);
        const entryId = result.entryId;
        console.log('✅ Customer created with entry ID:', entryId);
        
        // Navigate to chat
        await page.goto(`${baseUrl}${result.chatUrl}`, {
            waitUntil: 'networkidle'
        });
        
        // Listen to console messages
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('❌ Console error:', msg.text());
            }
        });
        
        // Listen to network responses
        page.on('response', response => {
            if (response.url().includes('/api/queue/acknowledge')) {
                console.log('📡 Acknowledge response:', response.status(), response.statusText());
            }
        });
        
        // Call customer
        await page.request.post(`${baseUrl}/api/queue/${testQueueId}/call-specific`, {
            data: { customerId: entryId }
        });
        
        // Wait for overlay
        await page.waitForSelector('.acknowledgment-overlay', { 
            visible: true, 
            timeout: 15000 
        });
        console.log('✅ Overlay appeared');
        
        // Check if window.queueChat exists
        const hasQueueChat = await page.evaluate(() => {
            return typeof window.queueChat !== 'undefined';
        });
        console.log('✅ window.queueChat exists:', hasQueueChat);
        
        // Check queueData
        const queueData = await page.evaluate(() => {
            return window.queueChat ? window.queueChat.queueData : null;
        });
        console.log('✅ Queue data:', JSON.stringify(queueData, null, 2));
        
        // Manually call acknowledge to test
        const ackResult = await page.evaluate(async () => {
            if (window.queueChat && window.queueChat.acknowledge) {
                try {
                    await window.queueChat.acknowledge('on_way');
                    return { success: true };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }
            return { success: false, error: 'No queueChat or acknowledge method' };
        });
        console.log('📡 Manual acknowledge result:', ackResult);
        
        // Wait a bit
        await page.waitForTimeout(3000);
        
        // Check if overlay is still visible
        const overlayVisible = await page.locator('.acknowledgment-overlay').isVisible();
        console.log('❓ Overlay still visible:', overlayVisible);
        
        // Check if removeAcknowledgmentOverlay exists
        const hasRemoveMethod = await page.evaluate(() => {
            return typeof window.queueChat.removeAcknowledgmentOverlay === 'function';
        });
        console.log('✅ removeAcknowledgmentOverlay exists:', hasRemoveMethod);
        
        // Try to manually remove overlay
        if (overlayVisible) {
            await page.evaluate(() => {
                if (window.queueChat && window.queueChat.removeAcknowledgmentOverlay) {
                    window.queueChat.removeAcknowledgmentOverlay();
                }
            });
            
            await page.waitForTimeout(1000);
            
            const stillVisible = await page.locator('.acknowledgment-overlay').isVisible();
            console.log('❓ After manual removal, overlay visible:', stillVisible);
        }
    });
});
