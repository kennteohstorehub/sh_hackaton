const puppeteer = require('puppeteer');

async function checkNotificationsTab() {
    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: { width: 1400, height: 900 }
    });
    
    try {
        const page = await browser.newPage();
        
        // Login
        console.log('1. Logging in...');
        await page.goto('http://localhost:3838/auth/login');
        await page.waitForSelector('#email', { timeout: 10000 });
        await page.type('#email', 'demo@storehub.com');
        await page.type('#password', 'demo123');
        
        await Promise.all([
            page.waitForNavigation(),
            page.click('button[type="submit"]')
        ]);
        console.log('✅ Logged in');
        
        // Go to settings (which renders settings-improved.ejs)
        console.log('\n2. Going to settings...');
        await page.goto('http://localhost:3838/dashboard/settings', { waitUntil: 'networkidle0' });
        await page.waitForTimeout(2000);
        
        // Check current URL
        console.log('Current URL:', page.url());
        
        // Look for tabs
        const tabs = await page.evaluate(() => {
            const buttons = document.querySelectorAll('button[data-tab]');
            return Array.from(buttons).map(btn => ({
                text: btn.textContent.trim(),
                dataTab: btn.getAttribute('data-tab'),
                isActive: btn.classList.contains('active')
            }));
        });
        console.log('\nFound tabs:', tabs);
        
        // Try to click notifications tab
        const notifTab = await page.$('button[data-tab="notifications"]');
        if (notifTab) {
            console.log('\n3. Clicking Notifications tab...');
            await notifTab.click();
            await page.waitForTimeout(1000);
            
            // Check if notifications content is visible
            const notifVisible = await page.evaluate(() => {
                const notifDiv = document.getElementById('notificationsTab');
                return notifDiv ? {
                    exists: true,
                    display: window.getComputedStyle(notifDiv).display,
                    hasContent: notifDiv.innerHTML.length > 100
                } : { exists: false };
            });
            console.log('Notifications tab visibility:', notifVisible);
            
            // Look for feature checkboxes
            const checkboxInfo = await page.evaluate(() => {
                // Search in entire document
                const allLabels = document.querySelectorAll('label');
                const featureLabels = Array.from(allLabels).filter(label => 
                    label.className.includes('feature-checkbox')
                );
                
                // Also search for the heading
                const headings = Array.from(document.querySelectorAll('h3'));
                const smartHeading = headings.find(h => h.textContent.includes('Smart Notification Features'));
                
                return {
                    totalLabels: allLabels.length,
                    featureCheckboxes: featureLabels.length,
                    smartHeadingFound: !!smartHeading,
                    notificationDivContent: document.getElementById('notificationsTab')?.innerHTML.substring(0, 500)
                };
            });
            
            console.log('\nCheckbox search results:', {
                totalLabels: checkboxInfo.totalLabels,
                featureCheckboxes: checkboxInfo.featureCheckboxes,
                smartHeadingFound: checkboxInfo.smartHeadingFound
            });
            
            if (checkboxInfo.notificationDivContent) {
                console.log('\nFirst 500 chars of notifications tab:');
                console.log(checkboxInfo.notificationDivContent);
            }
        } else {
            console.log('❌ Notifications tab button not found!');
        }
        
        console.log('\n✅ Check complete. Browser will stay open for inspection.');
        await page.waitForTimeout(30000);
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await browser.close();
    }
}

checkNotificationsTab().catch(console.error);