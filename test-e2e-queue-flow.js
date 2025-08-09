const puppeteer = require('puppeteer');

async function testCompleteQueueFlow() {
  console.log('🚀 Starting E2E Queue Management System Test\n');
  console.log('='.repeat(60));
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 720 }
  });
  
  const page = await browser.newPage();
  
  // Test configuration
  const TEST_CONFIG = {
    mainDomain: 'http://localhost:3000',
    subDomain: 'http://chickenrice.lvh.me:3000',
    credentials: {
      email: 'admin@demo.local',
      password: 'Password123!'
    },
    testCustomer: {
      name: 'Test Customer',
      phone: '+60123456789',
      partySize: 2
    }
  };
  
  try {
    // 1. Test Landing Page
    console.log('\n📄 TEST 1: Landing Page');
    console.log('-'.repeat(40));
    
    await page.goto(TEST_CONFIG.mainDomain, { waitUntil: 'networkidle2' });
    const landingTitle = await page.title();
    console.log(`✓ Landing page loaded: "${landingTitle}"`);
    
    // Check for key elements
    const hasGetStarted = await page.$('a[href="/register"]') !== null;
    const hasLogin = await page.$('a[href="/auth/login"]') !== null;
    console.log(`✓ Get Started button: ${hasGetStarted ? 'Found' : 'Not found'}`);
    console.log(`✓ Login link: ${hasLogin ? 'Found' : 'Not found'}`);
    
    // 2. Test Merchant Dashboard Access
    console.log('\n🏪 TEST 2: Merchant Dashboard Access');
    console.log('-'.repeat(40));
    
    // Navigate to subdomain
    await page.goto(TEST_CONFIG.subDomain, { waitUntil: 'networkidle2' });
    const currentUrl = page.url();
    console.log(`✓ Navigated to: ${currentUrl}`);
    
    // Should redirect to merchant login
    if (currentUrl.includes('/auth/merchant-login')) {
      console.log('✓ Correctly redirected to merchant login page');
    } else {
      console.log(`✗ Wrong redirect: ${currentUrl}`);
    }
    
    // Wait for login form
    await page.waitForSelector('#email', { timeout: 5000 });
    
    // Fill login form
    await page.type('#email', TEST_CONFIG.credentials.email);
    await page.type('#password', TEST_CONFIG.credentials.password);
    console.log(`✓ Filled login form with: ${TEST_CONFIG.credentials.email}`);
    
    // Submit login
    await page.click('button[type="submit"]');
    console.log('✓ Submitted login form');
    
    // Wait for navigation after login
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    
    const dashboardUrl = page.url();
    if (dashboardUrl.includes('/dashboard')) {
      console.log(`✓ Successfully logged in and redirected to dashboard`);
      console.log(`  Current URL: ${dashboardUrl}`);
    } else {
      console.log(`✗ Login failed or wrong redirect: ${dashboardUrl}`);
    }
    
    // Check dashboard elements
    const dashboardTitle = await page.title();
    console.log(`✓ Dashboard title: "${dashboardTitle}"`);
    
    // 3. Test Queue Management
    console.log('\n🔢 TEST 3: Queue Management Flow');
    console.log('-'.repeat(40));
    
    // The dashboard already contains queue management - check for tabs
    const hasQueueSection = await page.$('#queue-management') !== null;
    if (hasQueueSection) {
      console.log('✓ Found queue management section on dashboard');
      
      // Check for active queue tab
      const activeQueueButton = await page.$('.tab-button');
      if (activeQueueButton) {
        console.log('✓ Found Active Queue tab');
        
        // Look for the "Add Customer" button
        const addButton = await page.$('button#add-customer-btn, button.btn-add-customer, button[onclick*="openAddCustomerModal"]');
        if (addButton) {
          console.log('✓ Found Add Customer button');
          await addButton.click();
          console.log('✓ Clicked Add Customer button');
          
          // Wait for modal to appear
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Try to fill the add customer form
          try {
            // Look for the modal form fields
            const nameInput = await page.$('input#customerName, input[name="customerName"], input[placeholder*="name"]');
            const phoneInput = await page.$('input#phoneNumber, input[name="phoneNumber"], input[placeholder*="phone"]');
            const partySizeInput = await page.$('input#partySize, input[name="partySize"], select#partySize');
            
            if (nameInput && phoneInput && partySizeInput) {
              await nameInput.type(TEST_CONFIG.testCustomer.name);
              await phoneInput.type(TEST_CONFIG.testCustomer.phone);
              
              // Handle party size (could be input or select)
              const isSelect = await page.$('select#partySize') !== null;
              if (isSelect) {
                await page.select('select#partySize', TEST_CONFIG.testCustomer.partySize.toString());
              } else {
                await partySizeInput.type(TEST_CONFIG.testCustomer.partySize.toString());
              }
              
              console.log('✓ Filled customer form');
              
              // Submit the form
              const submitButton = await page.$('button[type="submit"], button.btn-primary:not(#add-customer-btn)');
              if (submitButton) {
                await submitButton.click();
                console.log('✓ Submitted customer to queue');
                
                // Wait for the customer to appear
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Check if customer appears in the queue
                const queueContent = await page.content();
                if (queueContent.includes(TEST_CONFIG.testCustomer.name)) {
                  console.log('✓ Customer successfully added to queue');
                  
                  // Try to find action buttons for the customer
                  const callButton = await page.$('button[onclick*="callCustomer"], button.btn-call');
                  const seatButton = await page.$('button[onclick*="seatCustomer"], button.btn-seat');
                  
                  if (callButton) {
                    console.log('✓ Found Call Customer button');
                    await callButton.click();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    console.log('✓ Called customer');
                  }
                  
                  if (seatButton) {
                    console.log('✓ Found Seat Customer button');
                    await seatButton.click();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    console.log('✓ Seated customer');
                  }
                } else {
                  console.log('✗ Customer not found in queue after submission');
                }
              } else {
                console.log('✗ Submit button not found');
              }
            } else {
              console.log('✗ Form fields not found');
              console.log(`  Name input: ${nameInput ? 'found' : 'not found'}`);
              console.log(`  Phone input: ${phoneInput ? 'found' : 'not found'}`);
              console.log(`  Party size input: ${partySizeInput ? 'found' : 'not found'}`);
            }
          } catch (formError) {
            console.log('✗ Error filling customer form:', formError.message);
          }
        } else {
          console.log('✗ Add Customer button not found');
          
          // List all buttons found for debugging
          const allButtons = await page.$$eval('button', buttons => 
            buttons.map(btn => btn.innerText || btn.textContent).filter(text => text)
          );
          console.log('  Available buttons:', allButtons.slice(0, 5).join(', '));
        }
      } else {
        console.log('✗ Active Queue tab not found');
      }
    } else {
      console.log('✗ Queue management section not found on dashboard');
    }
    
    // 4. Test Session and Logout
    console.log('\n🔐 TEST 4: Session and Logout');
    console.log('-'.repeat(40));
    
    // Refresh page to test session persistence
    await page.reload({ waitUntil: 'networkidle2' });
    const urlAfterRefresh = page.url();
    
    if (urlAfterRefresh.includes('/dashboard') || !urlAfterRefresh.includes('/login')) {
      console.log('✓ Session persisted after refresh');
    } else {
      console.log('✗ Session lost after refresh');
    }
    
    // Look for logout button
    const logoutLinks = await page.$$eval('a, button', elements => 
      elements.map(el => ({ tag: el.tagName, text: el.innerText, href: el.href || '' }))
        .filter(el => el.text.toLowerCase().includes('logout') || el.text.toLowerCase().includes('sign out'))
    );
    
    if (logoutLinks.length > 0) {
      console.log(`✓ Found logout option: ${logoutLinks[0].text}`);
      
      // Click logout
      await page.evaluate(() => {
        const logoutEl = Array.from(document.querySelectorAll('a, button'))
          .find(el => el.innerText.toLowerCase().includes('logout') || el.innerText.toLowerCase().includes('sign out'));
        if (logoutEl) logoutEl.click();
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const finalUrl = page.url();
      if (finalUrl.includes('/login') || finalUrl === TEST_CONFIG.mainDomain + '/') {
        console.log('✓ Successfully logged out');
      } else {
        console.log(`✓ Logged out to: ${finalUrl}`);
      }
    } else {
      console.log('✗ No logout button found');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ E2E TEST COMPLETED');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Stack:', error.stack);
    
    // Take screenshot on error
    await page.screenshot({ path: 'test-error.png' });
    console.log('Screenshot saved as test-error.png');
  } finally {
    await browser.close();
  }
}

// Run the test
testCompleteQueueFlow().catch(console.error);