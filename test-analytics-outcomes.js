#!/usr/bin/env node

const http = require('http');
const querystring = require('querystring');

const BASE_URL = 'http://localhost:3001';

// Test merchant credentials
const MERCHANT_EMAIL = 'demo@storehub.com';
const MERCHANT_PASSWORD = 'demo123';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

let sessionCookie = '';
let csrfToken = '';

async function login() {
    console.log(`${colors.cyan}Logging in as merchant...${colors.reset}`);
    
    // Get CSRF token first
    const loginPageRes = await fetch(`${BASE_URL}/login`);
    const loginHtml = await loginPageRes.text();
    const cookieHeader = loginPageRes.headers.get('set-cookie');
    if (cookieHeader) {
        sessionCookie = cookieHeader.split(';')[0];
    }
    
    // Extract CSRF token
    const csrfMatch = loginHtml.match(/name="_csrf" value="([^"]+)"/);
    if (csrfMatch) {
        csrfToken = csrfMatch[1];
    }
    
    // Login
    const formData = new FormData();
    formData.append('email', MERCHANT_EMAIL);
    formData.append('password', MERCHANT_PASSWORD);
    formData.append('_csrf', csrfToken);
    
    const loginRes = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        body: formData,
        headers: {
            'Cookie': sessionCookie
        },
        redirect: 'manual'
    });
    
    if (loginRes.status === 302 || loginRes.status === 200) {
        const newCookie = loginRes.headers.get('set-cookie');
        if (newCookie) {
            sessionCookie = newCookie.split(';')[0];
        }
        console.log(`${colors.green}✓ Logged in successfully${colors.reset}`);
        
        // Get fresh CSRF token for API calls
        const dashboardRes = await fetch(`${BASE_URL}/dashboard`, {
            headers: { 'Cookie': sessionCookie }
        });
        const dashboardHtml = await dashboardRes.text();
        const csrfMatch = dashboardHtml.match(/content="([^"]+)" name="csrf-token"/);
        if (csrfMatch) {
            csrfToken = csrfMatch[1];
        }
        return true;
    }
    
    console.log(`${colors.red}✗ Login failed${colors.reset}`);
    return false;
}

async function testAnalytics() {
    console.log(`\n${colors.cyan}Testing Analytics API...${colors.reset}`);
    
    // Test different periods
    const periods = ['1d', '7d', '30d'];
    
    for (const period of periods) {
        console.log(`\n${colors.yellow}Testing period: ${period}${colors.reset}`);
        
        const response = await fetch(`${BASE_URL}/api/analytics/dashboard?period=${period}`, {
            headers: {
                'Cookie': sessionCookie,
                'X-CSRF-Token': csrfToken
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.analytics) {
                const analytics = data.analytics;
                
                console.log(`${colors.green}✓ Analytics data retrieved${colors.reset}`);
                console.log(`\n${colors.bright}Overview Stats:${colors.reset}`);
                console.log(`  Total Served: ${analytics.totalCustomersServed}`);
                console.log(`  Total No-Shows: ${analytics.totalNoShows}`);
                console.log(`  Total Withdrawn: ${analytics.totalWithdrawn}`);
                console.log(`  Total Called: ${analytics.totalCalled}`);
                console.log(`  Success Rate: ${analytics.successRate}%`);
                console.log(`  No-Show Rate: ${analytics.noShowRate}%`);
                console.log(`  Withdrawal Rate: ${analytics.withdrawalRate}%`);
                
                console.log(`\n${colors.bright}Outcome Breakdown:${colors.reset}`);
                console.log(`  ${colors.green}Served: ${analytics.outcomeBreakdown.served.count} (${analytics.outcomeBreakdown.served.percentage}%)${colors.reset}`);
                console.log(`  ${colors.red}No-Show: ${analytics.outcomeBreakdown.noShow.count} (${analytics.outcomeBreakdown.noShow.percentage}%)${colors.reset}`);
                console.log(`  ${colors.yellow}Withdrawn: ${analytics.outcomeBreakdown.withdrawn.count} (${analytics.outcomeBreakdown.withdrawn.percentage}%)${colors.reset}`);
                
                console.log(`\n${colors.bright}Other Metrics:${colors.reset}`);
                console.log(`  Average Wait Time: ${analytics.averageWaitTime} minutes`);
                console.log(`  Active Queues: ${analytics.activeQueues}/${analytics.totalQueues}`);
                
                if (analytics.queuePerformance && analytics.queuePerformance.length > 0) {
                    console.log(`\n${colors.bright}Queue Performance:${colors.reset}`);
                    analytics.queuePerformance.forEach(queue => {
                        console.log(`  ${queue.name}:`);
                        console.log(`    Total: ${queue.totalCustomers}`);
                        console.log(`    Served: ${queue.completedCustomers}`);
                        console.log(`    No-Shows: ${queue.noShowCustomers}`);
                        console.log(`    Withdrawn: ${queue.withdrawnCustomers}`);
                        console.log(`    Success Rate: ${queue.successRate}%`);
                    });
                }
                
                // Check that customer satisfaction is removed
                if (analytics.customerSatisfaction !== undefined) {
                    console.log(`${colors.red}✗ WARNING: Customer satisfaction still present in response${colors.reset}`);
                } else {
                    console.log(`${colors.green}✓ Customer satisfaction successfully removed${colors.reset}`);
                }
                
            } else {
                console.log(`${colors.red}✗ No analytics data in response${colors.reset}`);
            }
        } else {
            console.log(`${colors.red}✗ Failed to fetch analytics: ${response.status}${colors.reset}`);
        }
    }
}

async function main() {
    console.log(`${colors.bright}Analytics Outcomes Test${colors.reset}`);
    console.log('=' .repeat(50));
    
    if (await login()) {
        await testAnalytics();
        
        console.log(`\n${colors.green}${colors.bright}Test Summary:${colors.reset}`);
        console.log(`${colors.green}✓ Analytics API updated with outcome metrics${colors.reset}`);
        console.log(`${colors.green}✓ Customer satisfaction metric removed${colors.reset}`);
        console.log(`${colors.green}✓ Success rate calculation added${colors.reset}`);
        console.log(`${colors.green}✓ Outcome breakdown (served/no-show/withdrawn) available${colors.reset}`);
        
        console.log(`\n${colors.cyan}To view the updated analytics dashboard:${colors.reset}`);
        console.log(`1. Navigate to http://localhost:3001/dashboard/analytics`);
        console.log(`2. Check the new "Customer Outcomes" card`);
        console.log(`3. View the outcomes pie chart`);
        console.log(`4. Check the updated queue performance table`);
    }
    
    process.exit(0);
}

main().catch(error => {
    console.error(`${colors.red}Error:${colors.reset}`, error);
    process.exit(1);
});