const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Test registration flow with subdomain redirect
 */
async function testRegistrationRedirect() {
  let browser;
  
  try {
    console.log('🚀 Starting registration redirect test...');
    
    // Clean up any existing test data
    const testEmail = `test-${Date.now()}@example.com`;
    const testBusinessName = `Test Business ${Date.now()}`;
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Get test tenant (assuming one exists)
    const testTenant = await prisma.tenant.findFirst({
      where: { isActive: true }
    });
    
    if (!testTenant) {
      console.error('❌ No active tenant found. Please create a tenant first.');
      return;
    }
    
    console.log(`📋 Using tenant: ${testTenant.name} (${testTenant.slug})`);
    
    // Navigate to registration page on tenant subdomain
    const registrationUrl = `http://${testTenant.slug}.lvh.me:3000/auth/register`;
    console.log(`📝 Navigating to: ${registrationUrl}`);
    
    await page.goto(registrationUrl, { waitUntil: 'networkidle2' });
    
    // Fill registration form
    console.log('📝 Filling registration form...');
    
    // Fill in the form fields
    await page.type('#businessName', testBusinessName);
    await page.type('#phone', '+60123456789');
    await page.type('#email', testEmail);
    await page.type('#password', 'TestPassword123!');
    await page.type('#confirmPassword', 'TestPassword123!');
    
    // Check terms checkbox
    await page.click('#terms');
    
    // Take screenshot before submission
    await page.screenshot({ 
      path: 'registration-form-filled.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved: registration-form-filled.png');
    
    // Submit form
    console.log('🚀 Submitting registration form...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('button[type="submit"]')
    ]);
    
    // Check where we were redirected
    const currentUrl = page.url();
    console.log(`📍 Redirected to: ${currentUrl}`);
    
    // Take screenshot of the page after redirect
    await page.screenshot({ 
      path: 'after-registration-redirect.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved: after-registration-redirect.png');
    
    // Verify we're on the correct subdomain
    const url = new URL(currentUrl);
    const expectedHost = `${testTenant.slug}.lvh.me:3000`;
    
    if (url.host === expectedHost && url.pathname === '/dashboard') {
      console.log('✅ SUCCESS: Registration redirected to correct subdomain dashboard!');
      console.log(`   Expected: http://${expectedHost}/dashboard`);
      console.log(`   Got: ${currentUrl}`);
    } else {
      console.log('❌ FAILED: Registration did not redirect to subdomain dashboard');
      console.log(`   Expected: http://${expectedHost}/dashboard`);
      console.log(`   Got: ${currentUrl}`);
    }
    
    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    await prisma.merchant.deleteMany({
      where: { email: testEmail }
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Take error screenshot
    if (browser) {
      const pages = await browser.pages();
      if (pages.length > 0) {
        await pages[0].screenshot({ 
          path: 'error-screenshot.png',
          fullPage: true 
        });
        console.log('📸 Error screenshot saved: error-screenshot.png');
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    await prisma.$disconnect();
  }
}

// Run the test
testRegistrationRedirect().catch(console.error);