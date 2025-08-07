const puppeteer = require('puppeteer');

async function testStopQueueModal() {
  console.log('Starting modal visibility test...');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Login as merchant
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:3000/auth/login');
    
    console.log('2. Logging in as merchant...');
    await page.type('#email', 'merchant@demo.com');
    await page.type('#password', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    console.log('3. Waiting for dashboard to load...');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    await page.waitForTimeout(2000);
    
    // Check if we need to start the queue first
    const startButton = await page.$('#startQueueBtn');
    if (startButton) {
      console.log('4. Queue is stopped, starting it first...');
      await startButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Now find and click stop button
    console.log('5. Looking for stop queue button...');
    const stopButton = await page.$('#stopQueueBtn');
    
    if (stopButton) {
      console.log('6. Clicking stop queue button...');
      await stopButton.click();
      
      // Wait for modal to appear
      await page.waitForTimeout(1000);
      
      // Check modal visibility
      const modalVisible = await page.evaluate(() => {
        const modal = document.querySelector('.stop-queue-modal');
        if (!modal) return { found: false };
        
        const rect = modal.getBoundingClientRect();
        const styles = window.getComputedStyle(modal);
        
        // Check the content box too
        const content = modal.querySelector('.stop-queue-content');
        const contentRect = content ? content.getBoundingClientRect() : null;
        
        return {
          found: true,
          modal: {
            visible: styles.display !== 'none' && styles.visibility !== 'hidden',
            display: styles.display,
            visibility: styles.visibility,
            opacity: styles.opacity,
            zIndex: styles.zIndex,
            position: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            }
          },
          content: contentRect ? {
            position: {
              top: contentRect.top,
              left: contentRect.left,
              width: contentRect.width,
              height: contentRect.height
            },
            centered: Math.abs(contentRect.left + contentRect.width/2 - window.innerWidth/2) < 50
          } : null,
          windowSize: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        };
      });
      
      console.log('\n=== MODAL VISIBILITY TEST RESULTS ===');
      console.log(JSON.stringify(modalVisible, null, 2));
      
      if (modalVisible.found) {
        console.log('\n✅ Modal found!');
        console.log(`Display: ${modalVisible.modal.display}`);
        console.log(`Visibility: ${modalVisible.modal.visibility}`);
        console.log(`Opacity: ${modalVisible.modal.opacity}`);
        console.log(`Z-Index: ${modalVisible.modal.zIndex}`);
        
        if (modalVisible.modal.visible) {
          console.log('✅ Modal is VISIBLE');
        } else {
          console.log('❌ Modal is NOT VISIBLE');
        }
        
        if (modalVisible.content && modalVisible.content.centered) {
          console.log('✅ Modal content is CENTERED');
        } else {
          console.log('❌ Modal content is NOT CENTERED');
        }
      } else {
        console.log('❌ Modal NOT FOUND');
      }
      
      // Take screenshot
      await page.screenshot({ 
        path: 'modal-test-result.png', 
        fullPage: true 
      });
      console.log('\n📸 Screenshot saved as modal-test-result.png');
      
      // Test the input field
      const canTypeInput = await page.evaluate(() => {
        const input = document.querySelector('#stopQueueConfirmInput');
        if (input) {
          input.value = 'Test typing';
          return true;
        }
        return false;
      });
      
      if (canTypeInput) {
        console.log('✅ Input field is accessible');
      } else {
        console.log('❌ Cannot access input field');
      }
      
    } else {
      console.log('❌ Stop queue button not found');
    }
    
    console.log('\nTest complete. Browser will close in 5 seconds...');
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await browser.close();
  }
}

testStopQueueModal();