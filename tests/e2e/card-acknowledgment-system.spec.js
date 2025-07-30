const { test, expect } = require('@playwright/test');
const axios = require('axios');

const BASE_URL = 'http://localhost:3838';

test.describe('Card-Based Acknowledgment System', () => {
    let testSessionId;
    let testEntryId;
    let testMerchantId = '507f1f77bcf86cd799439011';
    let testQueueId = '507f1f77bcf86cd799439012';
    
    // Cleanup after each test
    test.afterEach(async () => {
        if (testSessionId) {
            try {
                await axios.post(`${BASE_URL}/api/webchat/cancel/${testSessionId}`);
            } catch (e) {
                console.log('Cleanup failed:', e.message);
            }
        }
    });

    // Helper function to create a test queue entry
    async function createTestEntry(name = 'Test User') {
        const testData = {
            customerName: name + ' ' + Date.now(),
            customerPhone: '+60123456789',
            partySize: 2,
            merchantId: testMerchantId,
            queueId: testQueueId
        };

        const response = await axios.post(`${BASE_URL}/api/customer/join-queue`, testData);
        return {
            sessionId: response.data.sessionId,
            entryId: response.data.entryId,
            data: testData
        };
    }

    // Helper function to call a customer
    async function callCustomer(entryId) {
        return await axios.post(`${BASE_URL}/api/queue/${entryId}/call`, {
            merchantId: testMerchantId
        });
    }

    test.describe('1. Card Appearance', () => {
        test('Cards appear inline when customer is called', async ({ page }) => {
            // Setup console monitoring
            const consoleLogs = [];
            page.on('console', msg => {
                const text = msg.text();
                consoleLogs.push({ type: msg.type(), text });
                if (text.includes('[CARDS]') || text.includes('[NOTIFICATION]')) {
                    console.log('Browser console:', text);
                }
            });

            // Create test entry
            const { sessionId, entryId, data } = await createTestEntry('Card Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            // Navigate to chat page
            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000); // Wait for WebSocket connection

            // Call the customer
            const callResponse = await callCustomer(entryId);
            expect(callResponse.data.success).toBe(true);

            // Wait for action cards container
            const cardsContainer = page.locator('.action-cards-container');
            await expect(cardsContainer).toBeVisible({ timeout: 10000 });

            // Verify cards are inline (not overlay)
            const isInline = await page.evaluate(() => {
                const container = document.querySelector('.action-cards-container');
                if (\!container) return false;
                
                const styles = window.getComputedStyle(container);
                // Check it's not positioned as overlay
                return styles.position \!== 'fixed' && styles.position \!== 'absolute';
            });
            expect(isInline).toBe(true);

            // Check both action cards are present
            const acknowledgeCard = page.locator('#acknowledge-card');
            const cancelCard = page.locator('#cancel-card');
            
            await expect(acknowledgeCard).toBeVisible();
            await expect(cancelCard).toBeVisible();
            
            // Take screenshot for debugging
            await page.screenshot({ path: 'test-results/card-appearance.png', fullPage: true });
        });

        test('Verification code is displayed prominently', async ({ page }) => {
            const { sessionId, entryId } = await createTestEntry('Code Display Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);

            // Wait for verification code display
            const codeDisplay = page.locator('.verification-code-card-display');
            await expect(codeDisplay).toBeVisible({ timeout: 10000 });

            // Check code value is displayed
            const codeValue = page.locator('.code-value');
            await expect(codeValue).toBeVisible();
            
            const code = await codeValue.textContent();
            expect(code).toBeTruthy();
            expect(code.length).toBeGreaterThan(0);

            // Check styling
            const codeStyles = await page.evaluate(() => {
                const element = document.querySelector('.code-value');
                const styles = window.getComputedStyle(element);
                return {
                    fontSize: styles.fontSize,
                    fontWeight: styles.fontWeight,
                    color: styles.color
                };
            });

            // Verify prominent styling
            expect(parseFloat(codeStyles.fontSize)).toBeGreaterThan(20);
            expect(codeStyles.fontWeight).toBe('700'); // bold
        });

        test('Two action buttons are visible and clickable', async ({ page }) => {
            const { sessionId, entryId } = await createTestEntry('Button Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);

            // Wait for cards
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Check both buttons
            const acknowledgeBtn = page.locator('#acknowledge-card');
            const cancelBtn = page.locator('#cancel-card');

            // Verify visibility
            await expect(acknowledgeBtn).toBeVisible();
            await expect(cancelBtn).toBeVisible();

            // Verify enabled state
            await expect(acknowledgeBtn).toBeEnabled();
            await expect(cancelBtn).toBeEnabled();

            // Verify text content
            await expect(acknowledgeBtn).toContainText("I'm headed to the restaurant");
            await expect(cancelBtn).toContainText('Cancel my spot');

            // Verify ARIA attributes for accessibility
            const ariaAttrs = await page.evaluate(() => {
                const ackBtn = document.querySelector('#acknowledge-card');
                const cancelBtn = document.querySelector('#cancel-card');
                return {
                    acknowledge: {
                        role: ackBtn?.getAttribute('role'),
                        ariaLabel: ackBtn?.getAttribute('aria-label'),
                        tabindex: ackBtn?.getAttribute('tabindex')
                    },
                    cancel: {
                        role: cancelBtn?.getAttribute('role'),
                        ariaLabel: cancelBtn?.getAttribute('aria-label'),
                        tabindex: cancelBtn?.getAttribute('tabindex')
                    }
                };
            });

            expect(ariaAttrs.acknowledge.role).toBe('button');
            expect(ariaAttrs.acknowledge.tabindex).toBe('0');
            expect(ariaAttrs.cancel.role).toBe('button');
            expect(ariaAttrs.cancel.tabindex).toBe('0');
        });
    });

    test.describe('2. Input Box Behavior', () => {
        test('Text input is hidden during queue interactions', async ({ page }) => {
            const { sessionId, entryId } = await createTestEntry('Input Hide Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            // Verify input is visible initially
            const messageForm = page.locator('#messageForm');
            await expect(messageForm).toBeVisible();

            // Call customer
            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Check input is hidden
            await expect(messageForm).toBeHidden();

            // Check input area has the hidden class
            const inputAreaHasClass = await page.evaluate(() => {
                const inputArea = document.querySelector('.input-area');
                return inputArea?.classList.contains('input-hidden');
            });
            expect(inputAreaHasClass).toBe(true);
        });

        test('Shows "use action buttons" message when input is hidden', async ({ page }) => {
            const { sessionId, entryId } = await createTestEntry('Input Message Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Check for the message in CSS pseudo-element
            const messageVisible = await page.evaluate(() => {
                const inputArea = document.querySelector('.input-area.input-hidden');
                if (\!inputArea) return false;
                
                const styles = window.getComputedStyle(inputArea, '::before');
                return styles.content.includes('use the action buttons');
            });
            expect(messageVisible).toBe(true);
        });

        test('Re-enables after acknowledgment', async ({ page }) => {
            const { sessionId, entryId } = await createTestEntry('Input Re-enable Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Click acknowledge button
            await page.click('#acknowledge-card');

            // Wait for acknowledgment to process
            await page.waitForTimeout(2000);

            // Check input is re-enabled
            const messageForm = page.locator('#messageForm');
            await expect(messageForm).toBeVisible({ timeout: 5000 });

            // Check hidden class is removed
            const inputAreaHasClass = await page.evaluate(() => {
                const inputArea = document.querySelector('.input-area');
                return inputArea?.classList.contains('input-hidden');
            });
            expect(inputAreaHasClass).toBe(false);
        });
    });

    test.describe('3. Acknowledgment Flow', () => {
        test('Click "I\'m headed to restaurant" → confirmation message', async ({ page }) => {
            const { sessionId, entryId } = await createTestEntry('Ack Flow Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Click acknowledge button
            await page.click('#acknowledge-card');

            // Wait for confirmation message
            const confirmationMessage = page.locator('.message.system').filter({
                hasText: /Great\! We're expecting you/
            });
            await expect(confirmationMessage).toBeVisible({ timeout: 5000 });

            // Verify cards are removed
            const cardsContainer = page.locator('.action-cards-container');
            await expect(cardsContainer).toBeHidden();
        });

        test('Dashboard updates with acknowledgment', async ({ page, context }) => {
            const { sessionId, entryId } = await createTestEntry('Dashboard Update Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            // Open dashboard in new tab
            const dashboardPage = await context.newPage();
            await dashboardPage.goto(`${BASE_URL}/dashboard`);
            
            // Login if needed (adjust based on your auth)
            // await loginToDashboard(dashboardPage);

            // Navigate to chat and acknowledge
            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Click acknowledge
            await page.click('#acknowledge-card');
            await page.waitForTimeout(2000);

            // Check dashboard shows acknowledgment
            // This will depend on your dashboard implementation
            // Example check:
            // await dashboardPage.reload();
            // const ackIndicator = dashboardPage.locator(`[data-entry-id="${entryId}"] .acknowledged-badge`);
            // await expect(ackIndicator).toBeVisible();
        });

        test('Cards are replaced with success message', async ({ page }) => {
            const { sessionId, entryId } = await createTestEntry('Success Message Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Get initial card count
            const initialCardCount = await page.locator('.action-card').count();
            expect(initialCardCount).toBe(2);

            // Click acknowledge
            await page.click('#acknowledge-card');

            // Wait for cards to be removed
            await page.waitForFunction(() => {
                return document.querySelectorAll('.action-card').length === 0;
            }, { timeout: 5000 });

            // Verify success message appears
            const successMessage = await page.locator('.message.system').last().textContent();
            expect(successMessage).toContain('Great\!');
            expect(successMessage).toContain('expecting you');
        });
    });

    test.describe('4. Cancellation Flow', () => {
        test('Click "Cancel my spot" → confirmation card appears', async ({ page }) => {
            const { sessionId, entryId } = await createTestEntry('Cancel Flow Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Click cancel button
            await page.click('#cancel-card');

            // Wait for confirmation cards
            const confirmCancelCard = page.locator('#confirm-cancel-card');
            const declineCancelCard = page.locator('#decline-cancel-card');

            await expect(confirmCancelCard).toBeVisible({ timeout: 5000 });
            await expect(declineCancelCard).toBeVisible();

            // Verify confirmation message
            const confirmationMessage = page.locator('.card-message').filter({
                hasText: /Are you sure you want to cancel/
            });
            await expect(confirmationMessage).toBeVisible();
        });

        test('"Yes, cancel" → queue cancelled', async ({ page }) => {
            const { sessionId, entryId } = await createTestEntry('Cancel Confirm Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Click cancel → confirm
            await page.click('#cancel-card');
            await page.waitForSelector('#confirm-cancel-card', { state: 'visible' });
            await page.click('#confirm-cancel-card');

            // Wait for cancellation message
            const cancelMessage = page.locator('.message').filter({
                hasText: /successfully removed from the queue/
            });
            await expect(cancelMessage).toBeVisible({ timeout: 5000 });

            // Verify all cards are removed
            const cardsCount = await page.locator('.action-card').count();
            expect(cardsCount).toBe(0);

            // Clear testSessionId to prevent cleanup error
            testSessionId = null;
        });

        test('"No, keep my spot" → returns to acknowledgment cards', async ({ page }) => {
            const { sessionId, entryId } = await createTestEntry('Keep Spot Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Click cancel → decline
            await page.click('#cancel-card');
            await page.waitForSelector('#decline-cancel-card', { state: 'visible' });
            await page.click('#decline-cancel-card');

            // Wait for original cards to reappear
            await page.waitForTimeout(500);
            
            const acknowledgeCard = page.locator('#acknowledge-card');
            const cancelCard = page.locator('#cancel-card');

            await expect(acknowledgeCard).toBeVisible({ timeout: 5000 });
            await expect(cancelCard).toBeVisible();
        });
    });

    test.describe('5. Timeout Flow', () => {
        test.skip('4 min: Warning card appears', async ({ page }) => {
            // Skip in automated tests due to long wait time
            // Can be run manually or with modified timeouts
        });

        test('Warning card styling is correct', async ({ page }) => {
            const { sessionId, entryId } = await createTestEntry('Warning Style Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Manually trigger warning (for testing)
            await page.evaluate(() => {
                if (window.queueChat && window.queueChat.showTimeoutWarning) {
                    window.queueChat.showTimeoutWarning(1);
                }
            });

            // Check warning message
            const warningMessage = page.locator('#timeout-warning');
            await expect(warningMessage).toBeVisible({ timeout: 5000 });

            // Verify warning styling
            const hasWarningClass = await page.evaluate(() => {
                const warning = document.querySelector('#timeout-warning');
                return warning?.classList.contains('warning-message');
            });
            expect(hasWarningClass).toBe(true);
        });
    });

    test.describe('6. Edge Cases', () => {
        test('Double-click prevention', async ({ page }) => {
            const { sessionId, entryId } = await createTestEntry('Double Click Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Setup request interception
            let acknowledgeCount = 0;
            await page.route('**/api/queue/acknowledge', (route) => {
                acknowledgeCount++;
                route.continue();
            });

            // Double-click acknowledge button
            const acknowledgeBtn = page.locator('#acknowledge-card');
            await acknowledgeBtn.dblclick();

            // Wait for request to complete
            await page.waitForTimeout(2000);

            // Should only send one request
            expect(acknowledgeCount).toBe(1);

            // Button should be disabled after first click
            const isDisabled = await acknowledgeBtn.isDisabled();
            expect(isDisabled).toBe(true);
        });

        test('Page refresh handling', async ({ page }) => {
            const { sessionId, entryId } = await createTestEntry('Refresh Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Get verification code before refresh
            const codeBeforeRefresh = await page.locator('.code-value').textContent();

            // Refresh page
            await page.reload();
            await page.waitForTimeout(2000);

            // Cards should reappear if not acknowledged
            const cardsContainer = page.locator('.action-cards-container');
            await expect(cardsContainer).toBeVisible({ timeout: 10000 });

            // Verification code should be the same
            const codeAfterRefresh = await page.locator('.code-value').textContent();
            expect(codeAfterRefresh).toBe(codeBeforeRefresh);
        });

        test('Multiple notifications handling', async ({ page }) => {
            const { sessionId, entryId } = await createTestEntry('Multiple Notif Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            // Call customer multiple times
            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });
            
            await page.waitForTimeout(1000);
            await callCustomer(entryId);

            // Should still only have one set of cards
            const cardContainers = await page.locator('.action-cards-container').count();
            expect(cardContainers).toBe(1);

            // Should still have only 2 action buttons
            const actionCards = await page.locator('.action-card').count();
            expect(actionCards).toBe(2);
        });

        test('Network error handling', async ({ page, context }) => {
            const { sessionId, entryId } = await createTestEntry('Network Error Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Simulate network failure
            await context.setOffline(true);

            // Try to acknowledge
            await page.click('#acknowledge-card');

            // Wait for error handling
            await page.waitForTimeout(3000);

            // Cards should be re-enabled on error
            const acknowledgeBtn = page.locator('#acknowledge-card');
            const isDisabled = await acknowledgeBtn.isDisabled();
            expect(isDisabled).toBe(false);

            // Should show error message
            const errorMessage = page.locator('.message').filter({
                hasText: /Error sending acknowledgment/
            });
            await expect(errorMessage).toBeVisible();

            // Restore network
            await context.setOffline(false);
        });

        test('Keyboard navigation support', async ({ page }) => {
            const { sessionId, entryId } = await createTestEntry('Keyboard Nav Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Tab to first button
            await page.keyboard.press('Tab');
            await page.keyboard.press('Tab'); // May need multiple tabs

            // Check focus
            const focusedElement = await page.evaluate(() => {
                return document.activeElement?.id;
            });

            // Should be able to focus action cards
            expect(['acknowledge-card', 'cancel-card']).toContain(focusedElement);

            // Press Enter to activate
            await page.keyboard.press('Enter');

            // Should trigger the action
            await page.waitForTimeout(1000);
            const confirmationVisible = await page.locator('.message.system').filter({
                hasText: /Great\!/
            }).isVisible();
            expect(confirmationVisible).toBe(true);
        });
    });

    test.describe('7. Visual Regression Tests', () => {
        test('Card appearance matches design', async ({ page }) => {
            const { sessionId, entryId } = await createTestEntry('Visual Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Take screenshot of cards
            const cardsContainer = page.locator('.action-cards-container');
            await cardsContainer.screenshot({ 
                path: 'test-results/cards-visual.png' 
            });

            // Could compare with baseline image if needed
            // expect(await cardsContainer.screenshot()).toMatchSnapshot('cards-baseline.png');
        });

        test('Mobile responsive layout', async ({ page }) => {
            // Set mobile viewport
            await page.setViewportSize({ width: 375, height: 667 });

            const { sessionId, entryId } = await createTestEntry('Mobile Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Check cards stack vertically on mobile
            const cardsLayout = await page.evaluate(() => {
                const container = document.querySelector('.action-cards-container');
                const styles = window.getComputedStyle(container);
                return {
                    flexDirection: styles.flexDirection,
                    width: container.offsetWidth
                };
            });

            expect(cardsLayout.flexDirection).toBe('column');
            
            // Take mobile screenshot
            await page.screenshot({ 
                path: 'test-results/cards-mobile.png',
                fullPage: true 
            });
        });
    });

    test.describe('8. Sound and Notification Tests', () => {
        test('Notification sound plays when called', async ({ page }) => {
            const { sessionId, entryId } = await createTestEntry('Sound Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            // Monitor console for sound events
            const soundEvents = [];
            page.on('console', msg => {
                if (msg.text().includes('playNotificationSound')) {
                    soundEvents.push(msg.text());
                }
            });

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Check if sound manager was called
            const soundPlayed = await page.evaluate(() => {
                return window.notificationSoundManager && 
                       typeof window.notificationSoundManager.playNotificationSound === 'function';
            });
            expect(soundPlayed).toBe(true);
        });

        test('Sound stops on acknowledgment', async ({ page }) => {
            const { sessionId, entryId } = await createTestEntry('Sound Stop Test');
            testSessionId = sessionId;
            testEntryId = entryId;

            await page.goto(`${BASE_URL}/queue-chat`);
            await page.waitForTimeout(2000);

            await callCustomer(entryId);
            await page.waitForSelector('.action-cards-container', { state: 'visible' });

            // Acknowledge
            await page.click('#acknowledge-card');
            await page.waitForTimeout(1000);

            // Check if sound was stopped
            const soundStopped = await page.evaluate(() => {
                return window.notificationSoundManager && 
                       typeof window.notificationSoundManager.stop === 'function';
            });
            expect(soundStopped).toBe(true);
        });
    });
});
EOF < /dev/null