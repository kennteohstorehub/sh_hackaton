const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3000';
const MERCHANT_EMAIL = 'demo@example.com';
const MERCHANT_PASSWORD = 'password123';

async function testSeatButton() {
  console.log('🔍 Testing Seat Customer Button...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--window-size=1920,1080']
  });

  try {
    const page = await browser.newPage();
    
    // Login as merchant
    console.log('1️⃣ Logging in as merchant...');
    await page.goto(`${BASE_URL}/auth/login`);
    await page.waitForSelector('input[name="email"]');
    await page.type('input[name="email"]', MERCHANT_EMAIL);
    await page.type('input[name="password"]', MERCHANT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    console.log('✅ Logged in successfully\n');
    
    // Check dashboard
    console.log('2️⃣ Checking dashboard for called customers...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Look for the "Seat Customer" button
    const seatButtons = await page.$$eval('button', buttons => 
      buttons.filter(btn => btn.textContent.includes('Seat Customer'))
        .map(btn => ({
          text: btn.textContent.trim(),
          style: btn.getAttribute('style'),
          onclick: btn.getAttribute('onclick')
        }))
    );
    
    if (seatButtons.length > 0) {
      console.log('✅ Found "Seat Customer" button(s)!');
      console.log(`   Count: ${seatButtons.length}`);
      seatButtons.forEach((btn, index) => {
        console.log(`   Button ${index + 1}:`);
        console.log(`     Text: ${btn.text}`);
        console.log(`     Style: ${btn.style || 'default'}`);
      });
      
      // Check for old "Pending Arrival" buttons
      const pendingButtons = await page.$$eval('button', buttons => 
        buttons.filter(btn => btn.textContent.includes('Pending Arrival')).length
      );
      
      if (pendingButtons > 0) {
        console.log(`\n⚠️  Warning: Still found ${pendingButtons} "Pending Arrival" button(s)`);
      }
      
      // Try clicking the Seat Customer button
      console.log('\n3️⃣ Testing button click...');
      const buttonClicked = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent.includes('Seat Customer'));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
      
      if (buttonClicked) {
        console.log('✅ Clicked "Seat Customer" button');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if modal opened
        const modalVisible = await page.evaluate(() => {
          const modal = document.querySelector('.verification-modal');
          return modal && modal.offsetParent !== null;
        });
        
        if (modalVisible) {
          console.log('✅ Table assignment modal opened successfully');
          
          // Check modal content
          const modalTitle = await page.$eval('.verification-header h2', el => el.textContent);
          console.log(`   Modal title: ${modalTitle}`);
          
          // Close modal
          await page.evaluate(() => {
            const closeBtn = document.querySelector('.verification-modal .close-btn');
            if (closeBtn) closeBtn.click();
          });
          console.log('✅ Modal closed');
        }
      }
    } else {
      console.log('❌ No "Seat Customer" buttons found');
      
      // Check what buttons are present for called customers
      const calledCustomerButtons = await page.$$eval('.notified-customer .actions button', 
        buttons => buttons.map(btn => btn.textContent.trim())
      ).catch(() => []);
      
      if (calledCustomerButtons.length > 0) {
        console.log('\nButtons found for called customers:');
        calledCustomerButtons.forEach(btn => console.log(`  - ${btn}`));
      } else {
        console.log('\nNo called customers in the queue currently.');
        console.log('Add a customer and call them to see the "Seat Customer" button.');
      }
    }
    
    console.log('\n✨ Test completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

testSeatButton().catch(console.error);