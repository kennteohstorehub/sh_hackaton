#!/usr/bin/env node

/**
 * Test script to verify that verification codes are always visible on the dashboard
 */

const { chromium } = require('playwright');

(async () => {
    console.log('🔍 Testing Verification Code Display on Dashboard...\n');
    
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        // First, create a test customer
        console.log('1️⃣ Creating test customer...');
        const joinResponse = await page.request.post('http://localhost:3838/api/customer/join/453b1b29-7d3b-4c0e-92d6-d86cc9952f8e', {
            data: {
                name: 'Code Display Test',
                phone: '+60' + Math.floor(100000000 + Math.random() * 900000000),
                partySize: 2
            }
        });
        
        const customer = await joinResponse.json();
        console.log(`✅ Customer created with verification code: ${customer.customer.verificationCode}`);
        
        // Login to dashboard (assuming test credentials)
        console.log('\n2️⃣ Accessing dashboard...');
        await page.goto('http://localhost:3838/dashboard');
        
        // Wait for dashboard to load
        await page.waitForSelector('.customer-list', { timeout: 10000 });
        
        // Check if verification code is visible BEFORE notification
        console.log('\n3️⃣ Checking verification code visibility...');
        
        // Desktop view
        const codeVisible = await page.locator('.verification-code .code-badge').first().isVisible();
        const codeText = await page.locator('.verification-code .code-badge').first().textContent().catch(() => null);
        
        console.log(`   Desktop view - Code visible: ${codeVisible ? '✅' : '❌'}`);
        console.log(`   Desktop view - Code value: ${codeText || 'Not found'}`);
        
        // Mobile view (if available)
        const mobileCodeVisible = await page.locator('.customer-card-body .code-badge').first().isVisible().catch(() => false);
        if (mobileCodeVisible) {
            const mobileCodeText = await page.locator('.customer-card-body .code-badge').first().textContent();
            console.log(`   Mobile view - Code visible: ✅`);
            console.log(`   Mobile view - Code value: ${mobileCodeText}`);
        }
        
        // Take screenshot for verification
        await page.screenshot({ path: 'dashboard-verification-codes.png', fullPage: true });
        console.log('\n📸 Screenshot saved: dashboard-verification-codes.png');
        
        console.log('\n✅ Test Complete!');
        console.log('   Verification codes should be visible for ALL customers in the queue.');
        console.log('   Check the screenshot to confirm.');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
    
    console.log('\nPress Ctrl+C to close the browser...');
})();