const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Comprehensive Login Flow Test for StoreHub Queue Management System
 * 
 * This test covers:
 * 1. Server health check
 * 2. Registration flow
 * 3. Login flow
 * 4. Dashboard access verification
 */
async function testComprehensiveLoginFlow() {
    let browser;
    const testConfig = {
        baseUrl: 'http://lvh.me:3000',
        timestamp: Date.now(),
        get testEmail() { return `test-${this.timestamp}@example.com`; },
        testPassword: 'TestPassword123!',
        testBusinessName: `Test Business ${this.timestamp}`
    };

    try {
        console.log('🚀 Starting Comprehensive Login Flow Test...\n');

        // Server Health Check
        console.log('🌐 Checking Server Health...');
        const response = await fetch(`${testConfig.baseUrl}/health`).catch(() => null);
        if (!response || !response.ok) {
            throw new Error('Server is not responding. Ensure server is running on port 3000.');
        }

        // Get an active tenant
        const testTenant = await prisma.tenant.findFirst({
            where: { isActive: true }
        });

        if (!testTenant) {
            throw new Error('No active tenant found. Please create a tenant first.');
        }

        console.log(`📋 Using tenant: ${testTenant.name} (${testTenant.slug})`);

        // Launch browser
        browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: { width: 1280, height: 800 }
        });

        const page = await browser.newPage();
        page.setDefaultTimeout(10000);

        // Enable console logging
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('❌ Browser console error:', msg.text());
            }
        });

        // Registration Flow
        console.log('\n📝 Starting Registration Process...');
        const registrationUrl = `http://${testTenant.slug}.lvh.me:3000/auth/register`;
        await page.goto(registrationUrl, { waitUntil: 'networkidle2' });

        await page.waitForSelector('#businessName');

        // Fill registration form
        await page.type('#businessName', testConfig.testBusinessName);
        await page.type('#phone', '+60123456789');
        await page.type('#email', testConfig.testEmail);
        await page.type('#password', testConfig.testPassword);
        await page.type('#confirmPassword', testConfig.testPassword);

        const termsCheckbox = await page.$('#terms');
        if (termsCheckbox) {
            await page.click('#terms');
        }

        // Take screenshots
        await page.screenshot({ path: 'registration-form-filled.png', fullPage: true });

        // Submit registration
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('button[type="submit"]')
        ]);

        // Login Flow
        console.log('\n🔐 Starting Login Process...');
        const loginUrl = `http://${testTenant.slug}.lvh.me:3000/t/${testTenant.slug}/auth/merchant-login`;
        await page.goto(loginUrl, { waitUntil: 'networkidle2' });

        await page.waitForSelector('#email');
        
        // Fill login form
        await page.type('#email', testConfig.testEmail);
        await page.type('#password', testConfig.testPassword);

        // Take screenshots
        await page.screenshot({ path: 'login-form-filled.png', fullPage: true });

        // Submit login
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('button[type="submit"]')
        ]);

        // Dashboard Verification
        const currentUrl = page.url();
        const expectedDashboardUrl = `http://${testTenant.slug}.lvh.me:3000/dashboard`;

        console.log('\n🔍 Verification Results:');
        console.log('─'.repeat(50));

        if (currentUrl === expectedDashboardUrl) {
            console.log('✅ SUCCESS: Full Login Flow Verified!');
            console.log(`   Logged in and redirected to: ${currentUrl}`);
        } else {
            console.log('❌ LOGIN FAILED');
            console.log(`   Expected: ${expectedDashboardUrl}`);
            console.log(`   Got:      ${currentUrl}`);

            // Check for any error messages
            const errorMessages = await page.$$eval('.alert-danger', 
                elements => elements.map(el => el.textContent.trim())
            );

            if (errorMessages.length > 0) {
                console.log('\n❌ Error messages found:');
                errorMessages.forEach(msg => console.log(`   - ${msg}`));
            }
        }

        console.log('─'.repeat(50));

        // Take final screenshot
        await page.screenshot({ path: 'final-dashboard.png', fullPage: true });

    } catch (error) {
        console.error('\n❌ Comprehensive Test Failed:', error.message);
        console.error('Stack:', error.stack);

        // Error screenshot
        if (browser) {
            const pages = await browser.pages();
            if (pages.length > 0) {
                await pages[0].screenshot({ 
                    path: 'comprehensive-test-error.png',
                    fullPage: true 
                });
                console.log('📸 Error screenshot: comprehensive-test-error.png');
            }
        }
    } finally {
        if (browser) {
            await browser.close();
        }
        await prisma.$disconnect();
        console.log('\n✅ Comprehensive Login Flow Test Complete!\n');
    }
}

// Run the test
console.log('═'.repeat(60));
console.log('   COMPREHENSIVE LOGIN FLOW TEST');
console.log('═'.repeat(60));
console.log();

testComprehensiveLoginFlow().catch(console.error);