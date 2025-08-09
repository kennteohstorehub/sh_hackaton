const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    console.log('1. Navigating to registration page...');
    await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle2' });
    
    console.log('2. Filling out registration form...');
    
    // Fill in the form
    await page.type('#fullName', 'John Doe');
    await page.type('#email', `john.doe.${Date.now()}@example.com`);
    await page.type('#phone', '+1234567890');
    await page.type('#businessName', 'Test Restaurant');
    await page.type('#subdomain', `test-${Date.now()}`);
    await page.select('#businessType', 'restaurant');
    await page.type('#password', 'SecurePass123!');
    await page.type('#confirmPassword', 'SecurePass123!');
    
    // Check the terms checkbox
    await page.click('#agreeToTerms');
    
    console.log('3. Submitting form...');
    
    // Submit the form
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('button[type="submit"]')
    ]);
    
    // Check if we're on the success page
    const currentUrl = page.url();
    console.log('4. Current URL after submission:', currentUrl);
    
    // Get page content to check for success
    const pageContent = await page.content();
    
    if (pageContent.includes('Registration Successful') || pageContent.includes('Welcome to StoreHub')) {
      console.log('✅ Registration successful!');
      
      // Try to get the tenant URL
      const loginUrlElement = await page.$('.info-value.url');
      if (loginUrlElement) {
        const loginUrl = await page.evaluate(el => el.textContent, loginUrlElement);
        console.log('5. Login URL for new tenant:', loginUrl);
        
        // Test accessing the tenant login page
        console.log('6. Testing tenant login page...');
        await page.goto(loginUrl, { waitUntil: 'networkidle2' });
        
        const loginPageUrl = page.url();
        console.log('7. Login page URL:', loginPageUrl);
        
        // Check if we're on a login page
        const loginPageContent = await page.content();
        if (loginPageContent.includes('Sign In') || loginPageContent.includes('Login')) {
          console.log('✅ Tenant login page is accessible!');
        }
      }
    } else if (pageContent.includes('error') || pageContent.includes('Error')) {
      console.log('❌ Registration failed with error');
      
      // Try to extract error message
      const errorElement = await page.$('.alert-danger, .error-message');
      if (errorElement) {
        const errorText = await page.evaluate(el => el.textContent, errorElement);
        console.log('Error message:', errorText);
      }
    } else {
      console.log('⚠️ Unexpected result');
      console.log('Page title:', await page.title());
    }
    
    // Wait for user to see the result
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
})();