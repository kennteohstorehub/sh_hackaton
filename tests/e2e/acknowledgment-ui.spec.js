const { test, expect } = require('@playwright/test');
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

test.describe('Acknowledgment UI Tests', () => {
    let testSessionId;
    let testEntryId;

    test.afterEach(async () => {
        // Clean up test data
        if (testSessionId) {
            try {
                await axios.post(`${BASE_URL}/api/webchat/cancel/${testSessionId}`);
            } catch (e) {
                console.log('Cleanup failed:', e.message);
            }
        }
    });

    test('Welcome message should not show "Welcome back" for new customers', async ({ page }) => {
        // Create test queue entry
        const testData = {
            customerName: 'Test User ' + Date.now(),
            customerPhone: '+60123456789',
            partySize: 2,
            merchantId: '507f1f77bcf86cd799439011',
            queueId: '507f1f77bcf86cd799439012'
        };

        const joinResponse = await axios.post(`${BASE_URL}/api/customer/join-queue`, testData);
        expect(joinResponse.data.success).toBe(true);
        
        testSessionId = joinResponse.data.sessionId;

        // Navigate to chat page
        await page.goto(`${BASE_URL}/queue-chat`);
        
        // Wait for messages to load
        await page.waitForSelector('.message', { timeout: 5000 });
        
        // Check welcome message
        const welcomeMessage = await page.locator('.message.bot .message-bubble').first().textContent();
        
        // Should say "Welcome [Name]\!" not "Welcome back [Name]\!"
        expect(welcomeMessage).toContain(`Welcome ${testData.customerName}\!`);
        expect(welcomeMessage).not.toContain('Welcome back');
        
        // Refresh page and check again
        await page.reload();
        await page.waitForSelector('.message', { timeout: 5000 });
        
        const refreshMessage = await page.locator('.message.bot .message-bubble').first().textContent();
        expect(refreshMessage).not.toContain('Welcome back');
    });

    test('Acknowledgment overlay should appear when customer is called', async ({ page }) => {
        // Set up console log capture
        const consoleLogs = [];
        page.on('console', msg => {
            const text = msg.text();
            consoleLogs.push({ type: msg.type(), text });
            if (text.includes('[OVERLAY]') || text.includes('[NOTIFICATION]')) {
                console.log('Browser console:', text);
            }
        });

        // Create test queue entry
        const testData = {
            customerName: 'Overlay Test ' + Date.now(),
            customerPhone: '+60123456789',
            partySize: 2,
            merchantId: '507f1f77bcf86cd799439011',
            queueId: '507f1f77bcf86cd799439012'
        };

        const joinResponse = await axios.post(`${BASE_URL}/api/customer/join-queue`, testData);
        expect(joinResponse.data.success).toBe(true);
        
        testSessionId = joinResponse.data.sessionId;
        testEntryId = joinResponse.data.entryId;

        // Navigate to chat page
        await page.goto(`${BASE_URL}/queue-chat`);
        
        // Wait for WebSocket connection
        await page.waitForTimeout(2000);
        
        // Call the customer
        const callResponse = await axios.post(`${BASE_URL}/api/queue/${testEntryId}/call`, {
            merchantId: testData.merchantId
        });
        expect(callResponse.data.success).toBe(true);

        // Wait for overlay to appear
        const overlay = page.locator('.acknowledgment-overlay');
        await expect(overlay).toBeVisible({ timeout: 10000 });
        
        // Check overlay content
        const verificationCode = await page.locator('.verification-code-large').textContent();
        expect(verificationCode).toBeTruthy();
        
        // Check button is present and clickable
        const ackButton = page.locator('.ack-btn-primary');
        await expect(ackButton).toBeVisible();
        await expect(ackButton).toBeEnabled();
        await expect(ackButton).toContainText("I'm headed to the restaurant");
        
        // Take screenshot for debugging
        await page.screenshot({ path: 'test-acknowledgment-overlay.png', fullPage: true });
        
        // Check console logs for expected messages
        const overlayLogs = consoleLogs.filter(log => log.text.includes('[OVERLAY]'));
        expect(overlayLogs.length).toBeGreaterThan(0);
        
        const hasShowOverlayLog = overlayLogs.some(log => 
            log.text.includes('showAcknowledgmentOverlay called')
        );
        expect(hasShowOverlayLog).toBe(true);
        
        const hasAddedToDomLog = overlayLogs.some(log => 
            log.text.includes('Acknowledgment overlay added to DOM')
        );
        expect(hasAddedToDomLog).toBe(true);
    });

    test('Acknowledgment overlay should have proper styling', async ({ page }) => {
        // Create and call customer
        const testData = {
            customerName: 'Style Test ' + Date.now(),
            customerPhone: '+60123456789',
            partySize: 2,
            merchantId: '507f1f77bcf86cd799439011',
            queueId: '507f1f77bcf86cd799439012'
        };

        const joinResponse = await axios.post(`${BASE_URL}/api/customer/join-queue`, testData);
        testSessionId = joinResponse.data.sessionId;
        testEntryId = joinResponse.data.entryId;

        await page.goto(`${BASE_URL}/queue-chat`);
        await page.waitForTimeout(2000);
        
        await axios.post(`${BASE_URL}/api/queue/${testEntryId}/call`, {
            merchantId: testData.merchantId
        });

        // Wait for overlay
        await page.waitForSelector('.acknowledgment-overlay', { state: 'visible', timeout: 10000 });
        
        // Check overlay styles
        const overlayStyles = await page.evaluate(() => {
            const overlay = document.querySelector('.acknowledgment-overlay');
            const styles = window.getComputedStyle(overlay);
            return {
                display: styles.display,
                position: styles.position,
                zIndex: styles.zIndex,
                background: styles.background,
                visibility: styles.visibility,
                opacity: styles.opacity
            };
        });
        
        expect(overlayStyles.display).toBe('flex');
        expect(overlayStyles.position).toBe('fixed');
        expect(overlayStyles.zIndex).toBe('10000');
        expect(overlayStyles.visibility).toBe('visible');
        expect(parseFloat(overlayStyles.opacity)).toBeGreaterThan(0);
        
        // Check if CSS file loaded
        const cssLoaded = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
            return links.some(link => link.href.includes('queue-chat.css'));
        });
        expect(cssLoaded).toBe(true);
    });

    test('Check for z-index conflicts', async ({ page }) => {
        // Create and call customer
        const testData = {
            customerName: 'Z-Index Test ' + Date.now(),
            customerPhone: '+60123456789',
            partySize: 2,
            merchantId: '507f1f77bcf86cd799439011',
            queueId: '507f1f77bcf86cd799439012'
        };

        const joinResponse = await axios.post(`${BASE_URL}/api/customer/join-queue`, testData);
        testSessionId = joinResponse.data.sessionId;
        testEntryId = joinResponse.data.entryId;

        await page.goto(`${BASE_URL}/queue-chat`);
        await page.waitForTimeout(2000);
        
        await axios.post(`${BASE_URL}/api/queue/${testEntryId}/call`, {
            merchantId: testData.merchantId
        });

        // Wait for overlay
        await page.waitForSelector('.acknowledgment-overlay', { state: 'visible', timeout: 10000 });
        
        // Check for elements with higher z-index
        const highZIndexElements = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            return elements
                .filter(el => {
                    const z = window.getComputedStyle(el).zIndex;
                    return z && z !== 'auto' && parseInt(z) > 10000;
                })
                .map(el => ({
                    tagName: el.tagName,
                    className: el.className,
                    id: el.id,
                    zIndex: window.getComputedStyle(el).zIndex
                }));
        });
        
        // Should not find any elements with z-index higher than 10000
        expect(highZIndexElements).toHaveLength(0);
    });
});