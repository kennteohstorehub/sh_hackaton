const puppeteer = require('puppeteer');

async function testStopQueueModal() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Login as merchant
    console.log('Logging in as merchant...');
    await page.goto('http://localhost:3000/auth/login');
    
    await page.type('#email', 'merchant@demo.com');
    await page.type('#password', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await page.waitForNavigation();
    await page.waitForSelector('.dashboard-container', { timeout: 10000 });
    
    console.log('Dashboard loaded, looking for stop queue button...');
    
    // Take screenshot before clicking
    await page.screenshot({ path: 'before-stop-modal.png', fullPage: true });
    
    // Find and click the stop queue button
    const stopButton = await page.$('#stopQueueBtn');
    if (stopButton) {
      console.log('Found stop queue button, clicking...');
      await stopButton.click();
      
      // Wait a moment for modal to appear
      await page.waitForTimeout(1000);
      
      // Take screenshot of modal
      await page.screenshot({ path: 'stop-queue-modal.png', fullPage: true });
      
      // Get modal styles and position
      const modalInfo = await page.evaluate(() => {
        const modal = document.querySelector('.stop-queue-modal');
        if (modal) {
          const rect = modal.getBoundingClientRect();
          const styles = window.getComputedStyle(modal);
          return {
            found: true,
            position: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            },
            display: styles.display,
            visibility: styles.visibility,
            zIndex: styles.zIndex,
            backgroundColor: styles.backgroundColor
          };
        }
        
        // Also check for the modal content
        const modalContent = document.querySelector('.modal-content');
        if (modalContent) {
          const rect = modalContent.getBoundingClientRect();
          const styles = window.getComputedStyle(modalContent);
          return {
            found: true,
            isModalContent: true,
            position: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            },
            display: styles.display,
            visibility: styles.visibility,
            zIndex: styles.zIndex,
            backgroundColor: styles.backgroundColor
          };
        }
        
        return { found: false };
      });
      
      console.log('Modal info:', JSON.stringify(modalInfo, null, 2));
      
      // Check if modal is visible and centered
      const pageSize = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight
      }));
      
      if (modalInfo.found) {
        const expectedLeft = (pageSize.width - modalInfo.position.width) / 2;
        const expectedTop = (pageSize.height - modalInfo.position.height) / 2;
        
        console.log(`Page size: ${pageSize.width}x${pageSize.height}`);
        console.log(`Modal position: top=${modalInfo.position.top}, left=${modalInfo.position.left}`);
        console.log(`Expected position: top≈${expectedTop}, left≈${expectedLeft}`);
        
        if (Math.abs(modalInfo.position.left - expectedLeft) > 50) {
          console.log('❌ Modal is NOT horizontally centered');
        } else {
          console.log('✓ Modal is horizontally centered');
        }
        
        if (Math.abs(modalInfo.position.top - expectedTop) > 50) {
          console.log('❌ Modal is NOT vertically centered');
        } else {
          console.log('✓ Modal is vertically centered');
        }
      }
      
    } else {
      console.log('Stop queue button not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testStopQueueModal();