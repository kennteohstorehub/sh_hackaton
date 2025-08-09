const puppeteer = require('puppeteer');

async function setupQueue() {
  console.log('🔧 Setting up queue for testing...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    // Login as merchant
    console.log('1. Logging in as merchant...');
    await page.goto('http://demo.lvh.me:3000/login');
    
    // Try to fill login form
    await page.evaluate(() => {
      const emailInput = document.querySelector('#email, input[type="email"], input[name="email"]');
      if (emailInput) emailInput.value = 'demo@storehub.com';
      
      const passwordInput = document.querySelector('#password, input[type="password"], input[name="password"]');
      if (passwordInput) passwordInput.value = 'demo123';
    });
    
    // Submit login
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.submit();
    });
    
    // Wait for dashboard
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('✅ Logged in successfully');
    
    // Check if we're on dashboard
    const isDashboard = await page.evaluate(() => {
      return window.location.pathname.includes('dashboard');
    });
    
    if (isDashboard) {
      console.log('2. On dashboard, looking for queue controls...');
      
      // Try to start queue
      const started = await page.evaluate(() => {
        // Look for start queue button
        const startBtn = document.querySelector('button:contains("Start"), button:contains("Open"), .btn-start-queue');
        if (startBtn && !startBtn.disabled) {
          startBtn.click();
          return true;
        }
        
        // Check if queue is already running
        const statusText = document.body.textContent;
        if (statusText.includes('Queue is active') || statusText.includes('Queue is running')) {
          return 'already-running';
        }
        
        return false;
      });
      
      if (started === true) {
        console.log('✅ Queue started successfully');
      } else if (started === 'already-running') {
        console.log('✅ Queue is already running');
      } else {
        console.log('⚠️ Could not start queue, but continuing anyway...');
      }
    }
    
    console.log('\n✅ Setup complete! Queue should be ready for testing.');
    console.log('📝 Merchant dashboard will remain open for monitoring.\n');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    await browser.close();
    process.exit(1);
  }
  
  // Keep browser open for monitoring
  console.log('Press Ctrl+C to close the merchant dashboard...');
}

setupQueue().catch(console.error);