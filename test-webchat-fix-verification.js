const io = require('socket.io-client');
const fetch = require('node-fetch');
const chalk = require('chalk');

console.log(chalk.blue.bold('\n=== WEBCHAT NOTIFICATION FIX VERIFICATION ===\n'));

const BASE_URL = 'http://localhost:3838';
const MERCHANT_ID = '6540e8d5861e79dc6ef4f88e';
const QUEUE_ID = '6540e907861e79dc6ef4f895';

// Test data
const sessionId = 'qc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
const testUser = {
    customerName: 'Fix Verification User',
    customerPhone: '+60199887766',
    partySize: 2,
    sessionId: sessionId
};

async function runTest() {
    console.log(chalk.yellow('Test Configuration:'));
    console.log(`- Session ID: ${sessionId}`);
    console.log(`- Customer: ${testUser.customerName}`);
    console.log(`- Phone: ${testUser.customerPhone}\n`);
    
    // Step 1: Join queue
    console.log(chalk.cyan('Step 1: Joining queue...'));
    
    const joinResponse = await fetch(`${BASE_URL}/api/customer/join-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...testUser,
            queueId: QUEUE_ID,
            platform: 'webchat'
        })
    });
    
    const joinResult = await joinResponse.json();
    
    if (!joinResult.success) {
        console.error(chalk.red('❌ Failed to join queue:'), joinResult.message);
        process.exit(1);
    }
    
    console.log(chalk.green('✅ Successfully joined queue'));
    console.log(`- Entry ID: ${joinResult.entryId}`);
    console.log(`- Position: #${joinResult.position}`);
    console.log(`- Chat URL: ${BASE_URL}${joinResult.chatUrl}\n`);
    
    // Step 2: Connect WebSocket
    console.log(chalk.cyan('Step 2: Connecting to WebSocket...'));
    
    const socket = io(BASE_URL, {
        transports: ['websocket', 'polling']
    });
    
    let notificationReceived = false;
    
    socket.on('connect', () => {
        console.log(chalk.green('✅ Connected to server'));
        console.log(`- Socket ID: ${socket.id}\n`);
        
        // Join rooms
        console.log(chalk.cyan('Step 3: Joining notification rooms...'));
        
        socket.emit('join-customer-room', {
            entryId: joinResult.entryId,
            sessionId: sessionId
        });
        
        socket.emit('join-queue', {
            queueId: QUEUE_ID,
            sessionId: sessionId,
            entryId: joinResult.entryId,
            platform: 'webchat',
            merchantId: MERCHANT_ID
        });
        
        console.log(chalk.green('✅ Room join requests sent\n'));
    });
    
    // Listen for notification
    socket.on('customer-called', (data) => {
        console.log(chalk.green.bold('\n🎉 NOTIFICATION RECEIVED!'));
        console.log(chalk.white('Notification data:'));
        console.log(JSON.stringify(data, null, 2));
        
        notificationReceived = true;
        
        // Verify notification data
        if (data.entryId === joinResult.entryId) {
            console.log(chalk.green('\n✅ Entry ID matches!'));
        } else {
            console.log(chalk.yellow('\n⚠️  Entry ID mismatch'));
        }
        
        if (data.verificationCode) {
            console.log(chalk.green(`✅ Verification code: ${data.verificationCode}`));
        }
        
        console.log(chalk.green.bold('\n✅ WEBCHAT NOTIFICATION SYSTEM IS WORKING!\n'));
        
        setTimeout(() => process.exit(0), 1000);
    });
    
    // Instructions
    console.log(chalk.yellow.bold('MANUAL STEPS REQUIRED:'));
    console.log(chalk.white('1. Open browser and go to:'), chalk.blue.underline(`${BASE_URL}/dashboard`));
    console.log(chalk.white('2. Find customer:'), chalk.yellow(testUser.customerName));
    console.log(chalk.white('3. Click the'), chalk.green('"Notify"'), chalk.white('button'));
    console.log(chalk.white('4. Watch this terminal for the notification\n'));
    
    console.log(chalk.gray('Alternatively, open the chat interface:'));
    console.log(chalk.blue.underline(`${BASE_URL}${joinResult.chatUrl}\n`));
    
    console.log(chalk.cyan('Waiting for notification...'));
    
    // Timeout after 5 minutes
    setTimeout(() => {
        if (!notificationReceived) {
            console.log(chalk.red('\n❌ No notification received after 5 minutes'));
            console.log(chalk.yellow('Please check:'));
            console.log('- Server is running on port 3838');
            console.log('- You clicked Notify for the correct customer');
            console.log('- Check server logs for errors');
        }
        process.exit(1);
    }, 300000);
}

// Error handling
process.on('unhandledRejection', (error) => {
    console.error(chalk.red('\n❌ Error:'), error.message);
    process.exit(1);
});

// Run test
runTest().catch(console.error);