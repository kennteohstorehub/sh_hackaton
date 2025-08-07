#!/usr/bin/env node

/**
 * Manual Debug Test for BackOffice Login Issues
 * Focus on investigating the dashboard error
 */

const { chromium } = require('playwright');

async function debugBackOfficeLogin() {
  console.log('🔍 Starting BackOffice Login Debug Session...\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Enable detailed logging
  page.on('console', msg => {
    console.log(`🖥️  Console ${msg.type()}: ${msg.text()}`);
  });
  
  page.on('requestfailed', request => {
    console.log(`🔴 Network Error: ${request.url()} - ${request.failure().errorText}`);
  });
  
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log(`🔴 HTTP Error: ${response.status()} ${response.url()}`);
    }
  });
  
  try {
    console.log('📍 Step 1: Navigate to admin site');
    await page.goto('http://admin.lvh.me:3838', { 
      waitUntil: 'networkidle',
      timeout: 15000 
    });
    console.log(`✅ Current URL: ${page.url()}`);
    
    console.log('\n📍 Step 2: Check login page');
    await page.waitForSelector('form', { timeout: 5000 });
    console.log('✅ Login form found');
    
    console.log('\n📍 Step 3: Fill login credentials');
    await page.fill('input[type="email"], input[name="email"]', 'backoffice@storehubqms.local');
    await page.fill('input[type="password"], input[name="password"]', 'BackOffice123!@#');
    console.log('✅ Credentials filled');
    
    console.log('\n📍 Step 4: Submit login form');
    await page.click('button[type="submit"], input[type="submit"]');
    
    // Wait for navigation or error
    await page.waitForTimeout(5000);
    console.log(`✅ After login URL: ${page.url()}`);
    
    console.log('\n📍 Step 5: Check page title and content');
    const title = await page.title();
    console.log(`📄 Page Title: "${title}"`);
    
    // Get page content for debugging
    const bodyText = await page.evaluate(() => {
      return document.body.innerText.substring(0, 500);
    });
    console.log(`📄 Page Content Preview:\n${bodyText}\n`);
    
    // Check for error messages
    const errorElements = await page.locator('.error, .alert-danger, [class*="error"]').count();
    console.log(`⚠️  Error elements found: ${errorElements}`);
    
    if (errorElements > 0) {
      const errorText = await page.locator('.error, .alert-danger, [class*="error"]').first().textContent();
      console.log(`🔴 Error message: ${errorText}`);
    }
    
    // Check if we can find typical dashboard elements
    const navElement = await page.locator('nav').count();
    const sidebarElement = await page.locator('[class*="sidebar"]').count();
    const headerElement = await page.locator('header, [class*="header"]').count();
    
    console.log(`📊 Dashboard elements:`);
    console.log(`  - Nav elements: ${navElement}`);
    console.log(`  - Sidebar elements: ${sidebarElement}`);
    console.log(`  - Header elements: ${headerElement}`);
    
    // Check for specific BackOffice elements
    const backofficeElements = await page.locator('[class*="backoffice"], [class*="admin"], [class*="dashboard"]').count();
    console.log(`  - BackOffice elements: ${backofficeElements}`);
    
    console.log('\n📍 Step 6: Check network requests');
    // Wait a bit more to see if there are any failed requests
    await page.waitForTimeout(3000);
    
    console.log('\n✅ Debug session complete. Browser will stay open for manual inspection.');
    console.log('Press Ctrl+C to close when you\'re done inspecting.');
    
    // Keep browser open for manual inspection
    await new Promise(() => {});
    
  } catch (error) {
    console.error('🔥 Error during debug session:', error.message);
  } finally {
    await browser.close();
  }
}

debugBackOfficeLogin();