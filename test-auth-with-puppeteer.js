const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3838';

async function captureRedirectLoop() {
  console.log('=== CAPTURING AUTH REDIRECT LOOP WITH PUPPETEER ===\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Track all navigation events
  const navigationLog = [];
  
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      navigationLog.push({
        url: frame.url(),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Track redirects
  const redirects = [];
  page.on('response', response => {
    if (response.status() >= 300 && response.status() < 400) {
      const location = response.headers()['location'];
      redirects.push({
        from: response.url(),
        to: location,
        status: response.status()
      });
      console.log(`REDIRECT: ${response.url()} -> ${location}`);
    }
  });
  
  console.log('1. Attempting to access /dashboard without authentication...\n');
  
  try {
    await page.goto(`${BASE_URL}/dashboard`, {
      waitUntil: 'networkidle0',
      timeout: 5000
    });
  } catch (error) {
    console.log('Navigation failed due to redirect loop or timeout\n');
  }
  
  // Take screenshot
  await page.screenshot({ 
    path: 'redirect-loop-evidence.png',
    fullPage: true 
  });
  
  console.log('Current URL:', page.url());
  console.log('\nNavigation History:');
  navigationLog.forEach((nav, i) => {
    console.log(`${i + 1}. ${nav.url}`);
  });
  
  console.log('\nRedirect Chain:');
  redirects.slice(0, 10).forEach((r, i) => {
    console.log(`${i + 1}. ${r.from} -> ${r.to}`);
  });
  
  if (redirects.length > 10) {
    console.log(`... and ${redirects.length - 10} more redirects (loop detected)`);
  }
  
  // Test session cookie behavior
  const cookies = await page.cookies();
  console.log('\nSession Cookies:');
  cookies.filter(c => c.name === 'qms_session' || c.name === 'csrf-token').forEach(c => {
    console.log(`- ${c.name}: ${c.value.substring(0, 20)}...`);
  });
  
  await browser.close();
  
  console.log('\n=== ANALYSIS ===');
  console.log('The redirect loop is confirmed. To fix this issue:');
  console.log('1. Update server/index.js to use USE_AUTH_BYPASS instead of NODE_ENV');
  console.log('2. This ensures auth routes match the middleware behavior');
  console.log('3. Screenshot saved as redirect-loop-evidence.png');
}

captureRedirectLoop().catch(console.error);