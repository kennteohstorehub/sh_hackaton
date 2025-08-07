const { test, expect } = require('@playwright/test');
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

test.describe('Card Acknowledgment Smoke Tests', () => {
    test('Quick validation of card-based acknowledgment system', async ({ page }) => {
        // Create test entry
        const testData = {
            customerName: 'Smoke Test ' + Date.now(),
            customerPhone: '+60123456789',
            partySize: 2,
            merchantId: '507f1f77bcf86cd799439011',
            queueId: '507f1f77bcf86cd799439012'
        };

        const joinResponse = await axios.post(`${BASE_URL}/api/customer/join-queue`, testData);
        expect(joinResponse.data.success).toBe(true);
        
        const sessionId = joinResponse.data.sessionId;
        const entryId = joinResponse.data.entryId;

        try {
            // Navigate to chat
            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            // Call customer
            await axios.post(`${BASE_URL}/api/queue/${entryId}/call`, {
                merchantId: testData.merchantId
            });

            // 1. Verify cards appear
            console.log('✓ Testing card appearance...');
            const cardsContainer = page.locator('.action-cards-container');
            await expect(cardsContainer).toBeVisible({ timeout: 10000 });

            // 2. Verify verification code
            console.log('✓ Testing verification code display...');
            const codeValue = page.locator('.code-value');
            await expect(codeValue).toBeVisible();
            const code = await codeValue.textContent();
            expect(code).toBeTruthy();

            // 3. Verify both buttons
            console.log('✓ Testing action buttons...');
            const acknowledgeCard = page.locator('#acknowledge-card');
            const cancelCard = page.locator('#cancel-card');
            await expect(acknowledgeCard).toBeVisible();
            await expect(cancelCard).toBeVisible();

            // 4. Verify input is hidden
            console.log('✓ Testing input box behavior...');
            const messageForm = page.locator('#messageForm');
            await expect(messageForm).toBeHidden();

            // 5. Test acknowledgment
            console.log('✓ Testing acknowledgment flow...');
            await acknowledgeCard.click();
            
            // Wait for confirmation
            const confirmationMessage = page.locator('.message.system').filter({
                hasText: /Great\! We're expecting you/
            });
            await expect(confirmationMessage).toBeVisible({ timeout: 5000 });

            // 6. Verify cards removed
            console.log('✓ Testing card removal...');
            await expect(cardsContainer).toBeHidden();

            // 7. Verify input re-enabled
            console.log('✓ Testing input re-enabled...');
            await expect(messageForm).toBeVisible();

            console.log('\n✅ All smoke tests passed\!');

        } finally {
            // Cleanup
            try {
                await axios.post(`${BASE_URL}/api/webchat/cancel/${sessionId}`);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    });
});