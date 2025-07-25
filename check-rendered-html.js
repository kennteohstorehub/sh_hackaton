const puppeteer = require('puppeteer');

async function checkRenderedHTML() {
    const browser = await puppeteer.launch({ headless: true });
    
    try {
        const page = await browser.newPage();
        
        // Login
        await page.goto('http://localhost:3838/auth/login');
        await page.waitForSelector('#email', { timeout: 10000 });
        await page.type('#email', 'demo@storehub.com');
        await page.type('#password', 'demo123');
        
        await Promise.all([
            page.waitForNavigation(),
            page.click('button[type="submit"]')
        ]);
        
        // Go to settings-improved
        await page.goto('http://localhost:3838/dashboard/settings-improved');
        await page.waitForTimeout(2000);
        
        // Get the HTML around notification features
        const notificationHTML = await page.evaluate(() => {
            const heading = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Smart Notification Features'));
            if (heading) {
                const parent = heading.parentElement;
                return parent ? parent.outerHTML : 'Heading found but no parent';
            }
            return 'Smart Notification Features heading not found';
        });
        
        console.log('Notification Section HTML:');
        console.log(notificationHTML);
        
        // Check if CSS is loaded
        const cssInfo = await page.evaluate(() => {
            const sheets = Array.from(document.styleSheets);
            const settingsCSS = sheets.find(s => s.href && s.href.includes('settings.css'));
            if (settingsCSS) {
                try {
                    const rules = Array.from(settingsCSS.cssRules || settingsCSS.rules || []);
                    const featureCheckboxRule = rules.find(r => r.selectorText === '.feature-checkbox');
                    return {
                        loaded: true,
                        href: settingsCSS.href,
                        ruleCount: rules.length,
                        hasFeatureCheckbox: !!featureCheckboxRule,
                        featureCheckboxStyle: featureCheckboxRule ? featureCheckboxRule.style.cssText : null
                    };
                } catch (e) {
                    return { loaded: true, href: settingsCSS.href, error: e.message };
                }
            }
            return { loaded: false };
        });
        
        console.log('\nCSS Info:', cssInfo);
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await browser.close();
    }
}

checkRenderedHTML().catch(console.error);