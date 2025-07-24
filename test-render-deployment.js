#!/usr/bin/env node

const { chromium } = require('playwright');

async function testRenderDeployment() {
  console.log('🧪 TESTING RENDER DEPLOYMENT');
  console.log('=' .repeat(50));
  console.log('URL: https://queuemanagement-vtc2.onrender.com');
  console.log('=' .repeat(50));
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  // Handle console messages and errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('[Browser Error]:', msg.text());
    }
  });
  
  try {
    // 1. Test Dashboard Access
    console.log('\n1️⃣ Testing Dashboard Access...');
    const dashboardResponse = await page.goto('https://queuemanagement-vtc2.onrender.com/dashboard', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log('   Response status:', dashboardResponse?.status());
    console.log('   Page URL:', page.url());
    console.log('   Page title:', await page.title());
    
    // Take screenshot
    await page.screenshot({ path: 'render-dashboard.png' });
    console.log('   📸 Screenshot saved: render-dashboard.png');
    
    // Check if auth bypass is working
    const hasUser = await page.locator('.user-section').isVisible().catch(() => false);
    console.log('   Auth bypass working:', hasUser ? '✅ YES' : '❌ NO');
    
    // Check for queue data
    const queueSection = await page.locator('.queue-section').first().isVisible().catch(() => false);
    console.log('   Queue data visible:', queueSection ? '✅ YES' : '❌ NO');
    
    // 2. Test Public View Page
    console.log('\n2️⃣ Testing Public View Page...');
    const publicResponse = await page.goto('https://queuemanagement-vtc2.onrender.com/queue/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log('   Response status:', publicResponse?.status());
    console.log('   Page URL:', page.url());
    console.log('   Page title:', await page.title());
    
    // Take screenshot
    await page.screenshot({ path: 'render-public-view.png' });
    console.log('   📸 Screenshot saved: render-public-view.png');
    
    // Check if public view loaded
    const publicContent = await page.content();
    const hasPublicView = publicContent.includes('Queue') || publicContent.includes('queue');
    console.log('   Public view loaded:', hasPublicView ? '✅ YES' : '❌ NO');
    
    // 3. Test API Endpoints
    console.log('\n3️⃣ Testing API Endpoints...');
    
    // Test health endpoint
    const healthResponse = await page.request.get('https://queuemanagement-vtc2.onrender.com/api/health');
    console.log('   Health API status:', healthResponse.status());
    if (healthResponse.ok()) {
      const healthData = await healthResponse.json();
      console.log('   Health API response:', JSON.stringify(healthData));
    }
    
    // Test queue API
    const queueResponse = await page.request.get('https://queuemanagement-vtc2.onrender.com/api/queue');
    console.log('   Queue API status:', queueResponse.status());
    
    // Test WhatsApp status
    const whatsappResponse = await page.request.get('https://queuemanagement-vtc2.onrender.com/api/whatsapp/status');
    console.log('   WhatsApp API status:', whatsappResponse.status());
    
    // 4. Test Navigation Links
    console.log('\n4️⃣ Testing Navigation Links...');
    await page.goto('https://queuemanagement-vtc2.onrender.com/dashboard');
    
    // Click View Public button
    const viewPublicButton = await page.locator('a:has-text("View Public")').first();
    if (await viewPublicButton.isVisible()) {
      const [newPage] = await Promise.all([
        context.waitForEvent('page'),
        viewPublicButton.click()
      ]);
      
      await newPage.waitForLoadState('networkidle');
      console.log('   View Public button opens:', newPage.url());
      await newPage.close();
    } else {
      console.log('   ⚠️  View Public button not found');
    }
    
    // Test other navigation links
    const navLinks = [
      { text: 'Analytics', expected: '/dashboard/analytics' },
      { text: 'WhatsApp', expected: '/dashboard/whatsapp' },
      { text: 'Settings', expected: '/dashboard/settings' },
      { text: 'Help', expected: '/dashboard/help' }
    ];
    
    for (const link of navLinks) {
      const navLink = await page.locator(`nav a:has-text("${link.text}")`).first();
      if (await navLink.isVisible()) {
        await navLink.click();
        await page.waitForLoadState('networkidle');
        const currentUrl = page.url();
        console.log(`   ${link.text} link:`, currentUrl.includes(link.expected) ? '✅' : '❌', currentUrl);
        
        // Go back to dashboard
        await page.goto('https://queuemanagement-vtc2.onrender.com/dashboard');
      }
    }
    
    // 5. Test Queue Operations
    console.log('\n5️⃣ Testing Queue Operations...');
    
    // Check for queue entries
    const customerRows = await page.locator('.customer-row').count();
    console.log('   Customer entries found:', customerRows);
    
    // Check for action buttons
    const actionButtons = await page.locator('.btn-action').count();
    console.log('   Action buttons found:', actionButtons);
    
    // Summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 DEPLOYMENT TEST SUMMARY:');
    console.log('✅ Dashboard accessible:', dashboardResponse?.status() === 200 ? 'YES' : 'NO');
    console.log('✅ Auth bypass working:', hasUser ? 'YES' : 'NO');
    console.log('✅ Queue data visible:', queueSection ? 'YES' : 'NO');
    console.log('✅ Public view accessible:', publicResponse?.status() === 200 ? 'YES' : 'NO');
    console.log('✅ API endpoints responding:', healthResponse.ok() ? 'YES' : 'NO');
    console.log('✅ Customer entries:', customerRows);
    
    // Check for specific issues
    if (publicResponse?.status() !== 200) {
      console.log('\n⚠️  PUBLIC VIEW ISSUE DETECTED');
      console.log('   Status code:', publicResponse?.status());
      console.log('   This needs to be fixed!');
    }
    
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    await page.screenshot({ path: 'render-error-screenshot.png' });
    console.log('📸 Error screenshot saved');
  } finally {
    await browser.close();
  }
}

// Run the test
testRenderDeployment().catch(console.error);