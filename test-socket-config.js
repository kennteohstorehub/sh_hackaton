const puppeteer = require('puppeteer');

async function testSocketConfiguration() {
    console.log('🔍 Testing Socket.io Configuration');
    console.log('==================================\n');
    
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Intercept console logs
        const consoleLogs = [];
        page.on('console', msg => {
            consoleLogs.push(msg.text());
        });
        
        // Intercept network requests
        const socketRequests = [];
        page.on('request', request => {
            const url = request.url();
            if (url.includes('socket.io')) {
                socketRequests.push(url);
                console.log('🔌 Socket.io request detected:', url);
            }
        });
        
        console.log('1️⃣ Navigating to localhost dashboard...');
        await page.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle0' });
        
        // Login
        console.log('2️⃣ Logging in...');
        await page.type('input[name="email"]', 'demo@storehub.com');
        await page.type('input[name="password"]', 'demo1234');
        await page.click('button[type="submit"]');
        
        // Wait for dashboard
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        console.log('3️⃣ Reached dashboard:', page.url());
        
        // Get Socket.io initialization code
        console.log('\n4️⃣ Checking Socket.io initialization code...');
        const socketCode = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script'));
            for (const script of scripts) {
                const text = script.innerHTML;
                if (text.includes('io(')) {
                    const lines = text.split('\n');
                    const socketLine = lines.find(line => line.includes('const socket') || line.includes('= io('));
                    if (socketLine) {
                        return socketLine.trim();
                    }
                }
            }
            return 'Socket.io initialization not found';
        });
        
        console.log('   Socket.io init code:', socketCode);
        
        // Check window.location
        const locationInfo = await page.evaluate(() => {
            return {
                origin: window.location.origin,
                hostname: window.location.hostname,
                port: window.location.port,
                href: window.location.href
            };
        });
        
        console.log('\n5️⃣ Window location info:');
        console.log('   Origin:', locationInfo.origin);
        console.log('   Hostname:', locationInfo.hostname);
        console.log('   Port:', locationInfo.port);
        console.log('   Full URL:', locationInfo.href);
        
        // Wait a bit for Socket.io to attempt connection
        await page.waitForTimeout(3000);
        
        console.log('\n6️⃣ Socket.io requests made:');
        if (socketRequests.length === 0) {
            console.log('   ❌ No Socket.io requests detected');
        } else {
            socketRequests.forEach(url => {
                console.log('   -', url);
            });
        }
        
        console.log('\n7️⃣ Console logs from page:');
        consoleLogs.slice(0, 10).forEach(log => {
            console.log('   -', log);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await browser.close();
    }
}

testSocketConfiguration();