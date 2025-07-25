const puppeteer = require('puppeteer');

async function debugCheckboxStyles() {
    console.log('🔍 Debugging Checkbox Styles...\n');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: { width: 1400, height: 900 }
    });
    
    try {
        const page = await browser.newPage();
        
        // Enable console logging
        page.on('console', msg => {
            if (msg.type() === 'log') {
                console.log('Browser:', msg.text());
            }
        });
        
        // Login
        console.log('1. Logging in...');
        await page.goto('http://localhost:3838/auth/login');
        await page.waitForSelector('#email', { timeout: 10000 });
        await page.type('#email', 'demo@storehub.com');
        await page.type('#password', 'demo123');
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);
        console.log('✅ Login successful\n');
        
        // Navigate to improved settings
        console.log('2. Navigating to Settings...');
        // First navigate to dashboard
        await page.goto('http://localhost:3838/dashboard');
        await page.waitForTimeout(1000);
        
        // Click on Settings link
        await page.click('a[href="/dashboard/settings"]');
        await page.waitForTimeout(2000);
        
        // Check current URL
        const currentUrl = page.url();
        console.log('   Current URL:', currentUrl);
        
        // If on old settings, navigate to improved
        if (!currentUrl.includes('settings-improved')) {
            await page.goto('http://localhost:3838/dashboard/settings-improved');
            await page.waitForTimeout(2000);
        }
        
        // Click on Notifications tab
        console.log('3. Clicking Notifications tab...');
        const notifButton = await page.waitForSelector('button[data-tab="notifications"]', { timeout: 5000 });
        await notifButton.click();
        await page.waitForTimeout(1000);
        
        // Check if elements exist and get computed styles
        console.log('4. Checking checkbox elements...\n');
        
        const checkboxInfo = await page.evaluate(() => {
            const results = {};
            
            // Check if feature checkboxes exist
            const featureCheckboxes = document.querySelectorAll('.feature-checkbox');
            results.featureCheckboxCount = featureCheckboxes.length;
            
            if (featureCheckboxes.length > 0) {
                const firstCheckbox = featureCheckboxes[0];
                const styles = window.getComputedStyle(firstCheckbox);
                
                results.featureCheckboxStyles = {
                    display: styles.display,
                    padding: styles.padding,
                    background: styles.background,
                    border: styles.border,
                    borderRadius: styles.borderRadius
                };
                
                // Check custom checkbox
                const customCheckbox = firstCheckbox.querySelector('.checkbox-custom');
                if (customCheckbox) {
                    const customStyles = window.getComputedStyle(customCheckbox);
                    results.customCheckboxStyles = {
                        width: customStyles.width,
                        height: customStyles.height,
                        background: customStyles.background,
                        border: customStyles.border
                    };
                }
                
                // Check if CSS file is loaded
                const styleSheets = Array.from(document.styleSheets);
                results.cssFiles = styleSheets
                    .filter(sheet => sheet.href)
                    .map(sheet => sheet.href);
            }
            
            return results;
        });
        
        console.log('Feature Checkbox Count:', checkboxInfo.featureCheckboxCount);
        console.log('\nFeature Checkbox Styles:', checkboxInfo.featureCheckboxStyles);
        console.log('\nCustom Checkbox Styles:', checkboxInfo.customCheckboxStyles);
        console.log('\nLoaded CSS Files:', checkboxInfo.cssFiles);
        
        // Take screenshot
        console.log('\n5. Taking screenshot...');
        await page.screenshot({ 
            path: 'debug-checkbox-notifications.png',
            fullPage: false,
            clip: { x: 0, y: 200, width: 1400, height: 600 }
        });
        console.log('📸 Screenshot saved as debug-checkbox-notifications.png');
        
        // Check for any CSS errors
        const cssLoadErrors = await page.evaluate(() => {
            const errors = [];
            const links = document.querySelectorAll('link[rel="stylesheet"]');
            links.forEach(link => {
                if (link.sheet === null) {
                    errors.push(`Failed to load: ${link.href}`);
                }
            });
            return errors;
        });
        
        if (cssLoadErrors.length > 0) {
            console.log('\n⚠️  CSS Load Errors:', cssLoadErrors);
        }
        
        console.log('\n✅ Debug complete! Browser will stay open for 10 seconds.');
        await page.waitForTimeout(10000);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await browser.close();
    }
}

console.log('Make sure your server is running on http://localhost:3838\n');
debugCheckboxStyles().catch(console.error);