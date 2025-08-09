const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Test registration flow with subdomain redirect using Puppeteer
 */
async function testRegistrationWithPuppeteer() {
  let browser;
  
  try {
    console.log('🚀 Starting Puppeteer registration test...\n');
    
    // Get test tenant
    const testTenant = await prisma.tenant.findFirst({
      where: { isActive: true }
    });
    
    if (!testTenant) {
      console.error('❌ No active tenant found. Please create a tenant first.');
      return;
    }
    
    console.log(`📋 Using tenant: ${testTenant.name} (${testTenant.slug})`);
    
    // Generate unique test data
    const timestamp = Date.now();
    const testEmail = `test-${timestamp}@example.com`;
    const testBusinessName = `Test Business ${timestamp}`;
    const testPassword = 'TestPassword123!';
    
    console.log(`📧 Test email: ${testEmail}`);
    console.log(`🏢 Test business: ${testBusinessName}\n`);
    
    // Clean up any existing test data first
    await prisma.merchant.deleteMany({
      where: { email: testEmail }
    });
    
    // Launch browser
    console.log('🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: false, // Set to true for CI/CD
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 800 }
    });
    
    const page = await browser.newPage();
    
    // Enable console logging from the page
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Browser console error:', msg.text());
      }
    });
    
    // Navigate to registration page on tenant subdomain
    const registrationUrl = `http://${testTenant.slug}.lvh.me:3000/auth/register`;
    console.log(`📝 Navigating to: ${registrationUrl}`);
    
    await page.goto(registrationUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for the form to be ready
    await page.waitForSelector('#businessName', { timeout: 5000 });
    
    // Take screenshot of empty form
    await page.screenshot({ 
      path: 'puppeteer-registration-empty.png',
      fullPage: true 
    });
    console.log('📸 Screenshot: puppeteer-registration-empty.png');
    
    // Fill registration form
    console.log('✍️  Filling registration form...');
    
    // Clear and type into each field
    await page.click('#businessName', { clickCount: 3 });
    await page.type('#businessName', testBusinessName);
    
    await page.click('#phone', { clickCount: 3 });
    await page.type('#phone', '+60123456789');
    
    await page.click('#email', { clickCount: 3 });
    await page.type('#email', testEmail);
    
    await page.click('#password', { clickCount: 3 });
    await page.type('#password', testPassword);
    
    await page.click('#confirmPassword', { clickCount: 3 });
    await page.type('#confirmPassword', testPassword);
    
    // Check terms checkbox if it exists
    const termsCheckbox = await page.$('#terms');
    if (termsCheckbox) {
      await page.click('#terms');
    }
    
    // Take screenshot of filled form
    await page.screenshot({ 
      path: 'puppeteer-registration-filled.png',
      fullPage: true 
    });
    console.log('📸 Screenshot: puppeteer-registration-filled.png');
    
    // Submit form and wait for navigation
    console.log('🚀 Submitting registration form...');
    
    // Click submit and wait for navigation
    await Promise.all([
      page.waitForNavigation({ 
        waitUntil: 'networkidle2',
        timeout: 30000 
      }),
      page.click('button[type="submit"]')
    ]);
    
    // Wait a bit for any redirects to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get final URL after all redirects
    const finalUrl = page.url();
    console.log(`\n📍 Final URL: ${finalUrl}`);
    
    // Take screenshot of final page
    await page.screenshot({ 
      path: 'puppeteer-registration-result.png',
      fullPage: true 
    });
    console.log('📸 Screenshot: puppeteer-registration-result.png\n');
    
    // Verify the redirect
    const expectedDashboardUrl = `http://${testTenant.slug}.lvh.me:3000/dashboard`;
    const url = new URL(finalUrl);
    const expectedHost = `${testTenant.slug}.lvh.me:3000`;
    
    console.log('🔍 Verification Results:');
    console.log('─'.repeat(50));
    
    if (url.host === expectedHost && url.pathname === '/dashboard') {
      console.log('✅ SUCCESS: Registration correctly redirected to subdomain!');
      console.log(`   Expected: ${expectedDashboardUrl}`);
      console.log(`   Got:      ${finalUrl}`);
      console.log('\n🎉 The fix is working correctly!');
    } else if (url.pathname === '/dashboard' && url.host !== expectedHost) {
      console.log('⚠️  PARTIAL: Redirected to dashboard but wrong domain');
      console.log(`   Expected host: ${expectedHost}`);
      console.log(`   Got host:      ${url.host}`);
      console.log('\n❌ The subdomain redirect is not working');
    } else if (finalUrl.includes('/auth/register')) {
      console.log('❌ FAILED: Still on registration page');
      console.log(`   Expected: ${expectedDashboardUrl}`);
      console.log(`   Got:      ${finalUrl}`);
      console.log('\n⚠️  Registration might have failed. Check for validation errors.');
      
      // Try to get any error messages
      const errorMessages = await page.$$eval('.alert-danger', elements => 
        elements.map(el => el.textContent.trim())
      );
      if (errorMessages.length > 0) {
        console.log('❌ Error messages found:');
        errorMessages.forEach(msg => console.log(`   - ${msg}`));
      }
    } else {
      console.log('❓ UNEXPECTED: Redirected to unexpected location');
      console.log(`   Expected: ${expectedDashboardUrl}`);
      console.log(`   Got:      ${finalUrl}`);
    }
    
    console.log('─'.repeat(50));
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    const deletedCount = await prisma.merchant.deleteMany({
      where: { email: testEmail }
    });
    console.log(`   Deleted ${deletedCount.count} test merchant(s)`);
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('Stack:', error.stack);
    
    // Take error screenshot
    if (browser) {
      const pages = await browser.pages();
      if (pages.length > 0) {
        await pages[0].screenshot({ 
          path: 'puppeteer-error.png',
          fullPage: true 
        });
        console.log('📸 Error screenshot: puppeteer-error.png');
      }
    }
  } finally {
    if (browser) {
      console.log('\n🔚 Closing browser...');
      await browser.close();
    }
    await prisma.$disconnect();
    console.log('✅ Test complete!\n');
  }
}

// Run the test
console.log('═'.repeat(60));
console.log('   PUPPETEER REGISTRATION REDIRECT TEST');
console.log('═'.repeat(60));
console.log();

testRegistrationWithPuppeteer().catch(console.error);