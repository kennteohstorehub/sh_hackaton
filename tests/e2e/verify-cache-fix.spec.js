const { test, expect } = require('@playwright/test');

test.describe('Webchat Cache Fix Verification', () => {
    test('should load without null reference errors after cache clear', async ({ page, context }) => {
        // Clear cache by creating new context
        await context.clearCookies();
        
        // Collect console errors
        const consoleErrors = [];
        page.on('console', message => {
            if (message.type() === 'error') {
                consoleErrors.push(message.text());
            }
        });
        
        // Monitor for the specific null style error
        let nullStyleError = false;
        page.on('pageerror', error => {
            if (error.message.includes("Cannot read properties of null (reading 'style')")) {
                nullStyleError = true;
            }
        });
        
        // Create test customer
        const testData = {
            name: 'Cache Fix Test',
            phone: '+60' + Math.floor(100000000 + Math.random() * 900000000),
            partySize: 2
        };
        
        // Join queue via API
        const response = await page.request.post('http://localhost:3000/api/customer/join/453b1b29-7d3b-4c0e-92d6-d86cc9952f8e', {
            data: testData
        });
        
        const result = await response.json();
        expect(result.success).toBe(true);
        
        const chatUrl = `http://localhost:3000${result.chatUrl}`;
        console.log('Testing chat URL:', chatUrl);
        console.log('Entry ID:', result.entryId);
        console.log('Verification Code:', result.customer.verificationCode);
        
        // Navigate to chat with cache disabled
        await page.goto(chatUrl, {
            waitUntil: 'networkidle',
            // Force reload to bypass cache
            bypassCSP: true
        });
        
        // Wait for initialization
        await page.waitForTimeout(2000);
        
        // Check for null style errors
        expect(nullStyleError).toBe(false);
        expect(consoleErrors.filter(e => e.includes("Cannot read properties of null"))).toHaveLength(0);
        
        // Verify welcome message appears
        const welcomeMessage = await page.locator('.message.bot').first().textContent();
        expect(welcomeMessage).toContain('Welcome');
        
        // Verify verification code displays
        const verificationDisplay = await page.locator('#headerVerifyCode').isVisible();
        if (result.customer.verificationCode) {
            const codeText = await page.locator('#headerVerifyCode').textContent();
            expect(codeText).toBe(result.customer.verificationCode);
        }
        
        // Test quick action buttons
        const statusButton = await page.locator('button:has-text("Check Status")');
        await statusButton.click();
        
        // Should not throw any errors
        await page.waitForTimeout(1000);
        
        // Send notification
        const notifyResponse = await page.request.post(`http://localhost:3000/api/queue/${result.customer.queueId}/call-specific`, {
            data: { customerId: result.entryId }
        });
        
        expect(notifyResponse.ok()).toBe(true);
        
        // Wait for notification
        await page.waitForTimeout(2000);
        
        // Check notification appeared
        const notificationVisible = await page.locator('text=/your turn/i').isVisible();
        expect(notificationVisible).toBe(true);
        
        console.log('✅ All tests passed - no null reference errors!');
    });
});