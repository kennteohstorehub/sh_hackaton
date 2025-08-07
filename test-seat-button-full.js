const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';
const QUEUE_ID = 'bb6aec56-d06d-4706-a793-1cfa9e9a1ad9';
const MERCHANT_EMAIL = 'demo@example.com';
const MERCHANT_PASSWORD = 'password123';

async function testSeatButtonFlow() {
  console.log('🚀 Starting Complete Seat Button Test\n');
  console.log('='.repeat(50));
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--window-size=1920,1080'],
    slowMo: 50
  });

  try {
    // Step 1: Create a test customer directly in database with 'called' status
    console.log('\n1️⃣ Creating test customer with CALLED status...');
    
    const testCustomer = await prisma.queueEntry.create({
      data: {
        queueId: QUEUE_ID,
        customerId: 'test-seat-' + Date.now(),
        customerName: 'Test Seat Customer',
        customerPhone: '+60123456789',
        partySize: 2,
        position: 1,
        status: 'called',  // Set directly to called
        platform: 'web',
        joinedAt: new Date(),
        calledAt: new Date(),  // Mark as called
        verificationCode: 'TEST',
        estimatedWaitTime: 0
      }
    });
    
    console.log(`✅ Created customer: ${testCustomer.customerName}`);
    console.log(`   ID: ${testCustomer.id}`);
    console.log(`   Status: ${testCustomer.status}`);
    console.log(`   Verification Code: ${testCustomer.verificationCode}`);
    
    // Step 2: Login as merchant
    console.log('\n2️⃣ Logging in as merchant...');
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser Error:', msg.text());
      }
    });
    
    await page.goto(`${BASE_URL}/auth/login`);
    await page.waitForSelector('input[name="email"]');
    await page.type('input[name="email"]', MERCHANT_EMAIL);
    await page.type('input[name="password"]', MERCHANT_PASSWORD);
    
    // Take screenshot before login
    await page.screenshot({ path: 'screenshots/before-login.png' });
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]')
    ]);
    
    console.log('✅ Logged in successfully');
    
    // Wait for dashboard to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 3: Check dashboard content
    console.log('\n3️⃣ Checking dashboard for called customer...');
    
    // Take screenshot of dashboard
    await page.screenshot({ path: 'screenshots/dashboard-with-called.png', fullPage: true });
    
    // Check if our test customer appears
    const customerVisible = await page.evaluate((customerName) => {
      const elements = document.querySelectorAll('*');
      for (let el of elements) {
        if (el.textContent && el.textContent.includes(customerName)) {
          return true;
        }
      }
      return false;
    }, testCustomer.customerName);
    
    if (customerVisible) {
      console.log('✅ Test customer visible on dashboard');
    } else {
      console.log('❌ Test customer NOT visible on dashboard');
    }
    
    // Check for CALLED status badge
    const calledBadge = await page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll('.status-badge, .badge, [class*="status"]'));
      return badges.find(b => b.textContent.includes('CALLED') || b.textContent.includes('called'));
    });
    
    if (calledBadge) {
      console.log('✅ CALLED status badge found');
    } else {
      console.log('❌ CALLED status badge not found');
    }
    
    // Step 4: Look for action buttons
    console.log('\n4️⃣ Checking for action buttons...');
    
    // Get all buttons on the page
    const allButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.map(btn => ({
        text: btn.textContent.trim(),
        classes: btn.className,
        onclick: btn.getAttribute('onclick'),
        style: btn.getAttribute('style')
      }));
    });
    
    console.log(`\nFound ${allButtons.length} total buttons on page:`);
    allButtons.forEach((btn, i) => {
      if (btn.text) {
        console.log(`  ${i + 1}. "${btn.text}"`);
        if (btn.style) console.log(`     Style: ${btn.style}`);
      }
    });
    
    // Look specifically for Seat Customer button
    const seatButton = allButtons.find(btn => 
      btn.text.includes('Seat') || 
      btn.text.includes('seat') ||
      btn.text.includes('Pending Arrival')
    );
    
    if (seatButton) {
      console.log(`\n✅ Found seating-related button: "${seatButton.text}"`);
      
      // Try to click it
      const clicked = await page.evaluate((buttonText) => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent.includes(buttonText));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      }, seatButton.text.split(' ')[0]); // Use first word to match
      
      if (clicked) {
        console.log('✅ Clicked the button');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if modal opened
        const modalVisible = await page.evaluate(() => {
          const modals = document.querySelectorAll('.modal, .verification-modal, [class*="modal"]');
          return Array.from(modals).some(m => m.offsetParent !== null);
        });
        
        if (modalVisible) {
          console.log('✅ Modal opened successfully');
          await page.screenshot({ path: 'screenshots/modal-opened.png' });
        }
      }
    } else {
      console.log('\n❌ No Seat Customer or related button found');
      
      // Debug: Check the HTML structure for called customers
      const calledCustomerHTML = await page.evaluate(() => {
        const notifiedRows = document.querySelectorAll('.notified-customer, [class*="called"]');
        if (notifiedRows.length > 0) {
          return notifiedRows[0].innerHTML;
        }
        return null;
      });
      
      if (calledCustomerHTML) {
        console.log('\n📋 HTML of called customer row:');
        console.log(calledCustomerHTML.substring(0, 500) + '...');
      }
    }
    
    // Step 5: Check what's in the actions column for called customers
    console.log('\n5️⃣ Checking action buttons for called customers...');
    
    const actionButtons = await page.evaluate(() => {
      // Look for customer rows with called status
      const rows = document.querySelectorAll('.customer-row');
      const calledRows = Array.from(rows).filter(row => {
        const text = row.textContent;
        return text.includes('CALLED') || text.includes('called') || text.includes('TEST');
      });
      
      if (calledRows.length > 0) {
        const actions = calledRows[0].querySelector('.actions');
        if (actions) {
          const buttons = actions.querySelectorAll('button');
          return Array.from(buttons).map(b => b.textContent.trim());
        }
      }
      return [];
    });
    
    if (actionButtons.length > 0) {
      console.log('Action buttons found for called customer:');
      actionButtons.forEach(btn => console.log(`  - "${btn}"`));
    } else {
      console.log('No action buttons found in called customer row');
    }
    
    // Cleanup
    console.log('\n6️⃣ Cleaning up test data...');
    await prisma.queueEntry.delete({
      where: { id: testCustomer.id }
    });
    console.log('✅ Test customer removed');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
    console.log('\n✨ Test completed! Browser will close in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    await browser.close();
  }
}

// Create screenshots directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('screenshots')) {
  fs.mkdirSync('screenshots');
}

testSeatButtonFlow().catch(console.error);