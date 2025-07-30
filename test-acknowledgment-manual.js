const axios = require('axios');
const readline = require('readline');

const BASE_URL = 'http://localhost:3838';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function log(message) {
    console.log(message);
}

async function testAcknowledgmentFlow() {
    log('\n=== ACKNOWLEDGMENT UI MANUAL TEST ===');
    log('This test will help diagnose why the acknowledgment UI is not showing.\n');

    try {
        // Step 1: Create a test queue entry
        log('Step 1: Creating test queue entry...');
        
        const testData = {
            customerName: 'Test Customer',
            customerPhone: '+60123456789',
            partySize: 2,
            merchantId: '507f1f77bcf86cd799439011',
            queueId: '507f1f77bcf86cd799439012'
        };

        const joinResponse = await axios.post(BASE_URL + '/api/customer/join-queue', testData);
        
        if (\!joinResponse.data.success) {
            log('Failed to join queue\!');
            return;
        }

        const sessionId = joinResponse.data.sessionId;
        const entryId = joinResponse.data.entryId;
        const verificationCode = joinResponse.data.verificationCode;
        const position = joinResponse.data.position;
        
        log('✓ Queue entry created successfully\!');
        log('  Entry ID: ' + entryId);
        log('  Session ID: ' + sessionId);
        log('  Verification Code: ' + verificationCode);
        log('  Position: ' + position);

        // Step 2: Open browser
        log('\nStep 2: Open browser for testing');
        log('Please open your browser and navigate to:');
        log(BASE_URL + '/queue-chat');
        log('\nThen open Developer Tools (F12) and go to the Console tab.');
        
        await new Promise(resolve => {
            rl.question('\nPress Enter when you have the page open with DevTools console visible...', resolve);
        });

        // Step 3: Check console logs
        log('\nStep 3: Watch the browser console for debug messages');
        log('You should see messages with [OVERLAY], [NOTIFICATION], and [DEBUG] tags.');
        log('\nI will now call the customer to trigger the notification...');
        
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 4: Call the customer
        log('\nStep 4: Calling customer...');
        
        const callResponse = await axios.post(BASE_URL + '/api/queue/' + entryId + '/call', {
            merchantId: testData.merchantId
        });

        if (callResponse.data.success) {
            log('✓ Customer called successfully\!');
            log('  New verification code: ' + callResponse.data.verificationCode);
            
            log('\n=== PLEASE CHECK IN YOUR BROWSER ===');
            log('1. Do you see console logs with [OVERLAY] tags?');
            log('2. Is there a message saying "showAcknowledgmentOverlay called"?');
            log('3. Do you see "Acknowledgment overlay added to DOM"?');
            log('4. Is there an overlay visible on the screen?');
            
            log('\nIn DevTools Console, run this command:');
            log('document.querySelector(".acknowledgment-overlay")');
            log('\nThis will show if the overlay element exists in the DOM.');
            
            log('\nAlso run:');
            log('window.getComputedStyle(document.querySelector(".acknowledgment-overlay")).display');
            log('\nThis will show if the overlay is set to display.');

            await new Promise(resolve => {
                rl.question('\nPress Enter after checking the browser...', resolve);
            });

            // Step 5: Check for common issues
            log('\n=== COMMON ISSUES TO CHECK ===');
            log('1. CSS File Loading:');
            log('   In DevTools Network tab, check if queue-chat.css loaded successfully');
            
            log('\n2. Z-Index Issues:');
            log('   Run in console to find elements with higher z-index:');
            log('   Array.from(document.querySelectorAll("*")).filter(el => {');
            log('     const z = window.getComputedStyle(el).zIndex;');
            log('     return z && z \!== "auto" && parseInt(z) > 10000;');
            log('   })');
            
            log('\n3. JavaScript Errors:');
            log('   Check for any red error messages in the console');
            
            log('\n4. Mobile Viewport:');
            log('   Try resizing browser to mobile size (390x844)');

            // Cleanup
            await new Promise(resolve => {
                rl.question('\nPress Enter to clean up test data...', resolve);
            });

            await axios.post(BASE_URL + '/api/webchat/cancel/' + sessionId);
            log('\n✓ Test data cleaned up');
            
        } else {
            log('✗ Failed to call customer');
        }

    } catch (error) {
        log('\nError: ' + error.message);
        if (error.response && error.response.data) {
            log('Response: ' + JSON.stringify(error.response.data));
        }
    } finally {
        rl.close();
    }
}

// Check if server is running
axios.get(BASE_URL + '/health')
    .then(() => {
        testAcknowledgmentFlow();
    })
    .catch(() => {
        log('Error: Server is not running on ' + BASE_URL);
        log('Please start the server with: npm run dev');
        rl.close();
        process.exit(1);
    });
ENDFILE < /dev/null