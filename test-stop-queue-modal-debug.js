const puppeteer = require('puppeteer');

async function testStopQueueModal() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    devtools: true
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Login as merchant
    console.log('Logging in as merchant...');
    await page.goto('http://localhost:3000/auth/login');
    
    // Take screenshot of login page
    await page.screenshot({ path: 'login-page.png' });
    
    await page.type('#email', 'merchant@demo.com');
    await page.type('#password', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for navigation with longer timeout
    console.log('Waiting for navigation after login...');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
    
    // Take screenshot after navigation
    await page.screenshot({ path: 'after-login.png', fullPage: true });
    
    // Get current URL
    const currentUrl = page.url();
    console.log('Current URL after login:', currentUrl);
    
    // Check what's on the page
    const pageContent = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        hasStopButton: !!document.querySelector('#stopQueueBtn'),
        hasStartButton: !!document.querySelector('#startQueueBtn'),
        bodyClasses: document.body.className,
        mainHeading: document.querySelector('h1')?.textContent || 'No h1 found'
      };
    });
    
    console.log('Page content:', JSON.stringify(pageContent, null, 2));
    
    // Try to find stop or start queue button
    let button = await page.$('#stopQueueBtn');
    if (!button) {
      console.log('Stop button not found, looking for start button...');
      button = await page.$('#startQueueBtn');
      
      if (button) {
        console.log('Found start button, clicking to start queue first...');
        await button.click();
        await page.waitForTimeout(2000);
        
        // Now look for stop button
        button = await page.$('#stopQueueBtn');
      }
    }
    
    if (button) {
      console.log('Found stop queue button, clicking...');
      await button.click();
      
      // Wait for modal
      await page.waitForTimeout(2000);
      
      // Take screenshot
      await page.screenshot({ path: 'stop-modal-visible.png', fullPage: true });
      
      // Check modal visibility and structure
      const modalInfo = await page.evaluate(() => {
        // Look for any element with stop-queue-modal class
        const stopModal = document.querySelector('.stop-queue-modal');
        if (stopModal) {
          const rect = stopModal.getBoundingClientRect();
          const styles = window.getComputedStyle(stopModal);
          return {
            found: true,
            selector: '.stop-queue-modal',
            position: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            display: styles.display,
            visibility: styles.visibility,
            opacity: styles.opacity,
            zIndex: styles.zIndex
          };
        }
        
        // Look for modal with id
        const modalById = document.querySelector('#stopQueueModal');
        if (modalById) {
          const rect = modalById.getBoundingClientRect();
          const styles = window.getComputedStyle(modalById);
          return {
            found: true,
            selector: '#stopQueueModal',
            position: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            display: styles.display,
            visibility: styles.visibility,
            opacity: styles.opacity,
            zIndex: styles.zIndex
          };
        }
        
        // Look for any modal
        const anyModal = document.querySelector('.modal');
        if (anyModal) {
          const rect = anyModal.getBoundingClientRect();
          const styles = window.getComputedStyle(anyModal);
          return {
            found: true,
            selector: '.modal',
            position: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            display: styles.display,
            visibility: styles.visibility,
            opacity: styles.opacity,
            zIndex: styles.zIndex,
            innerHTML: anyModal.innerHTML.substring(0, 200)
          };
        }
        
        return { found: false, message: 'No modal found' };
      });
      
      console.log('Modal info:', JSON.stringify(modalInfo, null, 2));
      
    } else {
      console.log('Could not find queue control buttons');
    }
    
    // Keep browser open for inspection
    console.log('Browser staying open for inspection. Close manually when done.');
    await page.waitForTimeout(60000);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testStopQueueModal();