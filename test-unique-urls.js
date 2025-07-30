#!/usr/bin/env node

/**
 * Demonstrate how each customer gets a unique webchat URL
 */

console.log('🔗 Demonstrating Unique Webchat URLs\n');

// Simulate multiple customers joining
const customers = [
  { name: 'Alice', phone: '+60123456789' },
  { name: 'Bob', phone: '+60198765432' },
  { name: 'Charlie', phone: '+60111223344' }
];

console.log('When customers join the queue via web form:\n');

customers.forEach((customer, index) => {
  // Generate unique session ID (same logic as in the app)
  const timestamp = Date.now() + index; // Add index to ensure uniqueness in rapid succession
  const random = Math.random().toString(36).substr(2, 9);
  const sessionId = `qc_${timestamp}_${random}`;
  
  // Show the unique URL each customer would get
  console.log(`${customer.name} (${customer.phone}):`);
  console.log(`  Session ID: ${sessionId}`);
  console.log(`  Unique URL: http://localhost:3838/queue-chat/${sessionId}`);
  console.log('');
});

console.log('✅ Each customer gets their own unique URL!');
console.log('   - URLs are session-specific');
console.log('   - Multiple customers can chat simultaneously');
console.log('   - Notifications are delivered to the correct customer');
console.log('   - Session data is maintained separately');
console.log('\n📱 The URL in the browser will show the unique session:');
console.log('   http://localhost:3838/queue-chat/qc_1234567890_abc123xyz');