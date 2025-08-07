const axios = require('axios');
const cheerio = require('cheerio');

async function testRenderedPage() {
    console.log('🔍 Analyzing Rendered Dashboard Page');
    console.log('=====================================\n');
    
    try {
        // Get login page first
        const loginResponse = await axios.get('http://localhost:3000/auth/login');
        const cookies = loginResponse.headers['set-cookie'] || [];
        
        // Login
        const loginData = new URLSearchParams({
            email: 'demo@storehub.com',
            password: 'demo1234'
        });
        
        const authResponse = await axios.post('http://localhost:3000/auth/login', loginData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookies.join('; ')
            },
            maxRedirects: 0,
            validateStatus: status => status < 400
        });
        
        const authCookies = authResponse.headers['set-cookie'] || [];
        
        // Get dashboard
        const dashboardResponse = await axios.get('http://localhost:3000/dashboard', {
            headers: {
                'Cookie': authCookies.join('; ')
            }
        });
        
        const $ = cheerio.load(dashboardResponse.data);
        
        console.log('1️⃣ Checking for hardcoded URLs in page:');
        console.log('=========================================');
        
        // Search for demo.lvh.me in the HTML
        const htmlContent = dashboardResponse.data;
        if (htmlContent.includes('demo.lvh.me')) {
            console.log('❌ Found "demo.lvh.me" in HTML!');
            
            // Find context around demo.lvh.me
            const lines = htmlContent.split('\n');
            lines.forEach((line, index) => {
                if (line.includes('demo.lvh.me')) {
                    console.log(`   Line ${index + 1}: ${line.trim()}`);
                }
            });
        } else {
            console.log('✅ No "demo.lvh.me" found in HTML');
        }
        
        console.log('\n2️⃣ Checking Socket.io initialization:');
        console.log('=====================================');
        
        // Find all script tags
        $('script').each((i, elem) => {
            const scriptContent = $(elem).html();
            if (scriptContent && scriptContent.includes('io(')) {
                const lines = scriptContent.split('\n');
                lines.forEach(line => {
                    if (line.includes('io(') || line.includes('socket')) {
                        console.log('   Found:', line.trim());
                    }
                });
            }
        });
        
        console.log('\n3️⃣ Checking for global variables:');
        console.log('==================================');
        
        // Check for any global config
        $('script').each((i, elem) => {
            const scriptContent = $(elem).html();
            if (scriptContent) {
                // Look for any URL or config assignments
                const urlPatterns = [
                    /var\s+\w*[Uu]rl\s*=/g,
                    /const\s+\w*[Uu]rl\s*=/g,
                    /let\s+\w*[Uu]rl\s*=/g,
                    /window\.\w*[Uu]rl\s*=/g,
                    /var\s+\w*[Hh]ost\s*=/g,
                    /const\s+\w*[Hh]ost\s*=/g
                ];
                
                urlPatterns.forEach(pattern => {
                    const matches = scriptContent.match(pattern);
                    if (matches) {
                        matches.forEach(match => {
                            const lineIndex = scriptContent.indexOf(match);
                            const lineEnd = scriptContent.indexOf('\n', lineIndex);
                            const line = scriptContent.substring(lineIndex, lineEnd > 0 ? lineEnd : undefined);
                            console.log('   Variable:', line.trim());
                        });
                    }
                });
            }
        });
        
        console.log('\n4️⃣ Checking meta tags:');
        console.log('======================');
        
        $('meta').each((i, elem) => {
            const name = $(elem).attr('name');
            const content = $(elem).attr('content');
            if (name && (name.includes('url') || name.includes('host') || name.includes('api'))) {
                console.log(`   ${name}: ${content}`);
            }
        });
        
        console.log('\n5️⃣ Checking data attributes:');
        console.log('============================');
        
        $('[data-url], [data-host], [data-api], [data-socket]').each((i, elem) => {
            const attrs = elem.attribs;
            Object.keys(attrs).forEach(key => {
                if (key.startsWith('data-')) {
                    console.log(`   ${key}: ${attrs[key]}`);
                }
            });
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testRenderedPage();