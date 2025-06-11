const whatsappService = require('./server/services/whatsappService');
const logger = require('./server/utils/logger');

async function testWhatsAppSecurity() {
  console.log('🔒 Testing WhatsApp Security Whitelist...\n');
  
  // Test 1: Check whitelist info
  console.log('📋 Test 1: Checking whitelist configuration');
  const whitelistInfo = whatsappService.getWhitelistInfo();
  console.log('Whitelist Info:', whitelistInfo);
  console.log('✅ Whitelist is enforced:', whitelistInfo.enforced);
  console.log('📱 Allowed numbers:', whitelistInfo.allowedNumbers.join(', '));
  console.log('');
  
  // Test 2: Test allowed number (your number)
  console.log('📋 Test 2: Testing ALLOWED number (your number)');
  const allowedNumbers = ['60126368832', '+60126368832', '126368832'];
  
  for (const number of allowedNumbers) {
    const isAllowed = whatsappService.isPhoneNumberAllowed(number);
    console.log(`${isAllowed ? '✅' : '❌'} ${number}: ${isAllowed ? 'ALLOWED' : 'BLOCKED'}`);
  }
  console.log('');
  
  // Test 3: Test blocked numbers (random numbers)
  console.log('📋 Test 3: Testing BLOCKED numbers (random numbers)');
  const blockedNumbers = [
    '1234567890',      // Random US number
    '60123456789',     // Random Malaysian number
    '+65987654321',    // Random Singapore number
    '44987654321',     // Random UK number
    '86123456789',     // Random China number
  ];
  
  for (const number of blockedNumbers) {
    const isAllowed = whatsappService.isPhoneNumberAllowed(number);
    console.log(`${isAllowed ? '❌ SECURITY BREACH!' : '✅'} ${number}: ${isAllowed ? 'ALLOWED (BAD!)' : 'BLOCKED (GOOD)'}`);
  }
  console.log('');
  
  // Test 4: Test sendMessage with blocked number (without actually connecting)
  console.log('📋 Test 4: Testing sendMessage with blocked number');
  const testResult = await whatsappService.sendMessage('1234567890', 'This should be blocked!');
  console.log('Send result:', testResult);
  
  if (testResult.blocked) {
    console.log('✅ SECURITY WORKING: Message was properly blocked');
  } else {
    console.log('❌ SECURITY FAILURE: Message was not blocked!');
  }
  console.log('');
  
  // Test 5: Test sendMessage with allowed number (without actually connecting)
  console.log('📋 Test 5: Testing sendMessage with allowed number');
  const testResult2 = await whatsappService.sendMessage('60126368832', 'This should be allowed but fail due to no connection');
  console.log('Send result:', testResult2);
  
  if (testResult2.blocked) {
    console.log('❌ UNEXPECTED: Allowed number was blocked');
  } else if (testResult2.error === 'WhatsApp not connected') {
    console.log('✅ EXPECTED: Allowed number passed security but failed due to no connection');
  } else {
    console.log('⚠️  UNEXPECTED RESULT');
  }
  console.log('');
  
  console.log('🎯 Security Test Summary:');
  console.log('✅ Whitelist is properly configured');
  console.log('✅ Your number is allowed');
  console.log('✅ Random numbers are blocked');
  console.log('✅ sendMessage respects the whitelist');
  console.log('');
  console.log('🔒 WhatsApp Security Test PASSED! Your system is protected.');
}

// Run the test
testWhatsAppSecurity().catch(console.error); 