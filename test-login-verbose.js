const { chromium } = require('playwright');

async function testLoginVerbose() {
  console.log('🔍 Verbose login test...\n');
  
  const browser = await chromium.launch({ 
    headless: true
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Enable request/response logging
  page.on('request', request => {
    if (request.url().includes('/auth/login') && request.method() === 'POST') {
      console.log('📤 Login POST request');
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/auth/login') && response.request().method() === 'POST') {
      console.log(`📥 Login response: ${response.status()}`);
      console.log(`   Headers:`, response.headers());
    }
  });
  
  try {
    // Navigate to login
    console.log('1️⃣ Going to login page...');
    await page.goto('https://queuemanagement-vtc2.onrender.com/auth/login');
    
    // Fill form
    console.log('2️⃣ Filling form...');
    await page.fill('input[name="email"]', 'demo@smartqueue.com');
    await page.fill('input[name="password"]', 'demo123456');
    
    // Submit
    console.log('3️⃣ Submitting...');
    await Promise.all([
      page.waitForLoadState('networkidle'),
      page.click('button[type="submit"]')
    ]);
    
    // Wait a bit
    await page.waitForTimeout(2000);
    
    // Check result
    const url = page.url();
    console.log(`\n4️⃣ Result:`);
    console.log(`   URL: ${url}`);
    
    // Check for error messages
    const errorElement = page.locator('.alert-danger');
    if (await errorElement.count() > 0) {
      const errorText = await errorElement.textContent();
      console.log(`   ❌ Error: ${errorText.trim()}`);
    }
    
    // Check page content
    const pageText = await page.textContent('body');
    if (pageText.includes('Dashboard')) {
      console.log('   ✅ Dashboard text found!');
    } else if (pageText.includes('Welcome Back')) {
      console.log('   ❌ Still on login page');
    }
    
    // Get all cookies
    const cookies = await context.cookies();
    console.log(`\n5️⃣ Cookies (${cookies.length}):`);
    cookies.forEach(c => {
      console.log(`   ${c.name}: ${c.value.substring(0, 20)}... (${c.sameSite})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

testLoginVerbose();