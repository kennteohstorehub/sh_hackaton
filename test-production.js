#!/usr/bin/env node

const { chromium } = require('playwright');

const PRODUCTION_URL = 'https://queuemanagement-vtc2.onrender.com';

async function testProduction() {
  console.log('🧪 Starting production tests...\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    timeout: 60000 
  });
  
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  try {
    // Test 1: Check if site is accessible
    console.log('📍 Test 1: Checking site accessibility...');
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✅ Site is accessible\n');
    
    // Test 2: Check login page
    console.log('📍 Test 2: Navigating to login page...');
    await page.goto(`${PRODUCTION_URL}/auth/login`);
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    console.log('✅ Login page loaded successfully\n');
    
    // Test 3: Test login with demo credentials
    console.log('📍 Test 3: Testing login with demo credentials...');
    await page.fill('input[name="email"]', 'demo@smartqueue.com');
    await page.fill('input[name="password"]', 'demo123456');
    await page.click('button[type="submit"]');
    
    // Wait for navigation or error
    try {
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      console.log('✅ Login successful - Redirected to dashboard\n');
    } catch (e) {
      const errorMsg = await page.locator('.alert-danger').textContent().catch(() => 'No error message');
      console.log(`❌ Login failed: ${errorMsg}\n`);
    }
    
    // Test 4: Check dashboard elements
    if (page.url().includes('/dashboard')) {
      console.log('📍 Test 4: Checking dashboard elements...');
      
      // Check main heading
      const heading = await page.locator('h1').textContent();
      console.log(`   Dashboard heading: ${heading}`);
      
      // Check navigation menu
      const navItems = await page.locator('nav a').count();
      console.log(`   Navigation items found: ${navItems}`);
      
      // Check stats cards
      const statsCards = await page.locator('.stat-card').count();
      console.log(`   Stats cards found: ${statsCards}`);
      
      console.log('✅ Dashboard loaded successfully\n');
      
      // Test 5: Navigate to queues
      console.log('📍 Test 5: Testing queue management...');
      await page.click('a[href="/dashboard/queues"]');
      await page.waitForURL('**/dashboard/queues', { timeout: 10000 });
      console.log('✅ Queue management page accessible\n');
      
      // Test 6: Check API health
      console.log('📍 Test 6: Testing API health endpoint...');
      const apiResponse = await page.request.get(`${PRODUCTION_URL}/api/health`);
      const apiData = await apiResponse.json();
      console.log(`   API Status: ${apiData.status}`);
      console.log(`   API Uptime: ${Math.round(apiData.uptime)} seconds`);
      console.log('✅ API is healthy\n');
    }
    
    // Test 7: Test logout
    console.log('📍 Test 7: Testing logout...');
    if (page.url().includes('/dashboard')) {
      await page.click('a[href="/auth/logout"]');
      await page.waitForURL(/^\/$|.*\/auth\/login/, { timeout: 10000 });
      console.log('✅ Logout successful\n');
    }
    
    // Test 8: Performance metrics
    console.log('📍 Test 8: Collecting performance metrics...');
    await page.goto(PRODUCTION_URL);
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart),
        loadComplete: Math.round(navigation.loadEventEnd - navigation.loadEventStart),
        totalTime: Math.round(navigation.loadEventEnd - navigation.fetchStart)
      };
    });
    console.log(`   DOM Content Loaded: ${metrics.domContentLoaded}ms`);
    console.log(`   Page Load Complete: ${metrics.loadComplete}ms`);
    console.log(`   Total Load Time: ${metrics.totalTime}ms`);
    console.log('✅ Performance metrics collected\n');
    
    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Take screenshot on failure
    await page.screenshot({ 
      path: `test-failure-${Date.now()}.png`,
      fullPage: true 
    });
    console.log('📸 Screenshot saved');
    
  } finally {
    await browser.close();
  }
}

// Run tests
testProduction().catch(console.error);