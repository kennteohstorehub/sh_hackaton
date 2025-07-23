const axios = require('axios');
const { chromium } = require('playwright');

async function comprehensiveTest() {
  console.log('🧪 Comprehensive Production Test\n');
  
  // First try API approach
  console.log('=== API TEST ===');
  const axiosInstance = axios.create({
    baseURL: 'https://queuemanagement-vtc2.onrender.com',
    validateStatus: () => true,
    maxRedirects: 5,
    timeout: 30000
  });
  
  try {
    // Test 1: Check home page
    console.log('1️⃣ Testing home page...');
    const homeRes = await axiosInstance.get('/');
    console.log(`   Status: ${homeRes.status}`);
    
    // Test 2: Check login page  
    console.log('\n2️⃣ Testing login page...');
    const loginPageRes = await axiosInstance.get('/auth/login');
    console.log(`   Status: ${loginPageRes.status}`);
    
    // Extract CSRF
    const csrfMatch = loginPageRes.data.match(/name="_csrf" value="([^"]+)"/);
    if (csrfMatch) {
      console.log(`   CSRF found: ${csrfMatch[1].substring(0, 20)}...`);
    }
    
    // Test 3: Check demo user exists
    console.log('\n3️⃣ Checking demo user...');
    const demoCheckRes = await axiosInstance.get('/auth/check-demo');
    console.log(`   Status: ${demoCheckRes.status}`);
    if (demoCheckRes.data) {
      console.log(`   Demo user exists: ${demoCheckRes.data.demoUserExists}`);
      if (demoCheckRes.data.email) {
        console.log(`   Email: ${demoCheckRes.data.email}`);
        console.log(`   Business: ${demoCheckRes.data.businessName}`);
      }
    }
    
    // Test 4: Check health
    console.log('\n4️⃣ Testing API health...');
    const healthRes = await axiosInstance.get('/api/health');
    console.log(`   Status: ${healthRes.status}`);
    console.log(`   Uptime: ${Math.round(healthRes.data.uptime)} seconds`);
    
  } catch (error) {
    console.error('API Test Error:', error.message);
  }
  
  // Now try browser approach with different config
  console.log('\n\n=== BROWSER TEST ===');
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    
    const page = await context.newPage();
    
    console.log('1️⃣ Navigating to site...');
    const response = await page.goto('https://queuemanagement-vtc2.onrender.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    console.log(`   Status: ${response.status()}`);
    console.log(`   URL: ${page.url()}`);
    
    // Check if we're redirected to login
    if (page.url().includes('/auth/login')) {
      console.log('   ✅ Redirected to login page');
      
      // Try to login
      console.log('\n2️⃣ Attempting login...');
      await page.fill('input[name="email"]', 'demo@smartqueue.com');
      await page.fill('input[name="password"]', 'demo123456');
      
      // Click login with navigation wait
      await Promise.all([
        page.waitForNavigation({ 
          waitUntil: 'domcontentloaded',
          timeout: 10000 
        }).catch(e => console.log('   Navigation:', e.message)),
        page.click('button[type="submit"]')
      ]);
      
      // Check final URL
      console.log(`   Final URL: ${page.url()}`);
      
      // Take screenshot
      await page.screenshot({ path: 'final-test-result.png' });
      console.log('   📸 Screenshot saved as final-test-result.png');
    }
    
  } catch (error) {
    console.error('Browser Test Error:', error.message);
  } finally {
    await browser.close();
  }
  
  console.log('\n✅ Test completed');
}

comprehensiveTest();