// Demo the working chat interface
const { exec } = require('child_process');
const fetch = require('node-fetch');

async function demoWorkingChat() {
    console.log('🎯 Demo: Working Chat Interface');
    console.log('=====================================\n');
    
    // 1. Join queue
    const testData = {
        name: 'Demo Customer ' + Date.now(),
        phone: '+60' + Math.floor(100000000 + Math.random() * 900000000),
        partySize: 3,
        specialRequests: 'Demo of working notifications'
    };
    
    console.log('1️⃣ Creating demo customer...');
    const joinResponse = await fetch('http://localhost:3838/api/customer/join/453b1b29-7d3b-4c0e-92d6-d86cc9952f8e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
    });
    
    const result = await joinResponse.json();
    
    if (!result.success) {
        console.error('Failed to join queue:', result);
        return;
    }
    
    console.log('\n✅ Demo customer created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Entry ID:', result.entryId);
    console.log('Position: #' + result.position);
    console.log('Verification Code: ' + result.customer.verificationCode);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const chatUrl = `http://localhost:3838${result.chatUrl}`;
    console.log('\n2️⃣ Opening chat interface in browser...');
    console.log('URL:', chatUrl);
    
    // Open in default browser
    const command = process.platform === 'darwin' ? 'open' : 
                    process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${command} "${chatUrl}"`);
    
    console.log('\n📱 The chat interface should now be open in your browser!');
    console.log('\nYou should see:');
    console.log('✓ Welcome message with your name');
    console.log('✓ Queue position and wait time');
    console.log('✓ Verification code (' + result.customer.verificationCode + ') in the header');
    console.log('✓ Quick action buttons (Check Status, Cancel Queue, Contact Business)');
    
    console.log('\n3️⃣ To test notifications:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Option A - Use the merchant dashboard:');
    console.log('1. Open: http://localhost:3838/dashboard');
    console.log('2. Find customer at position #' + result.position);
    console.log('3. Click the "Notify" button');
    
    console.log('\nOption B - Use this command:');
    console.log(`curl -X POST http://localhost:3838/api/queue/notify \\
  -H "Content-Type: application/json" \\
  -d '{
    "queueId": "${result.customer.queueId}",
    "customerId": "${result.customer.customerId}",
    "entryId": "${result.entryId}"
  }'`);
    
    console.log('\n4️⃣ Expected notification behavior:');
    console.log('• Full-screen notification in chat');
    console.log('• Notification sound (if enabled)');
    console.log('• Screen flash effect');
    console.log('• Browser notification (if permissions granted)');
    
    // Save for easy testing
    const fs = require('fs');
    fs.writeFileSync('demo-customer.json', JSON.stringify({
        entryId: result.entryId,
        customerId: result.customer.customerId,
        queueId: result.customer.queueId,
        position: result.position,
        verificationCode: result.customer.verificationCode,
        chatUrl: chatUrl,
        notifyCommand: `curl -X POST http://localhost:3838/api/queue/notify -H "Content-Type: application/json" -d '{"queueId":"${result.customer.queueId}","customerId":"${result.customer.customerId}","entryId":"${result.entryId}"}'`
    }, null, 2));
    
    console.log('\n💾 Demo details saved to demo-customer.json');
}

demoWorkingChat().catch(console.error);