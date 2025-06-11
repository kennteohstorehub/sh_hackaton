#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testWhatsAppService() {
  console.log('🧪 Testing WhatsApp Service Integration...\n');

  try {
    // Test 1: Check initial status
    console.log('1️⃣ Testing initial status...');
    const statusResponse = await axios.get(`${BASE_URL}/whatsapp/status`);
    console.log('✅ Status:', statusResponse.data);
    console.log('');

    // Test 2: Get QR code
    console.log('2️⃣ Testing QR code endpoint...');
    const qrResponse = await axios.get(`${BASE_URL}/whatsapp/qr`);
    console.log('✅ QR Code:', {
      hasQR: !!qrResponse.data.qr,
      hasQRDataURL: !!qrResponse.data.qrDataURL,
      isReady: qrResponse.data.isReady,
      message: qrResponse.data.message
    });
    console.log('');

    // Test 3: Send test message
    console.log('3️⃣ Testing message sending...');
    const messageResponse = await axios.post(`${BASE_URL}/whatsapp/send`, {
      phoneNumber: '1234567890',
      message: 'Test message from WhatsApp service test script'
    });
    console.log('✅ Message sent:', messageResponse.data);
    console.log('');

    // Test 4: Check sessions
    console.log('4️⃣ Testing sessions endpoint...');
    const sessionsResponse = await axios.get(`${BASE_URL}/whatsapp/sessions`);
    console.log('✅ Sessions:', sessionsResponse.data);
    console.log('');

    // Test 5: Test queue integration
    console.log('5️⃣ Testing queue integration...');
    
    // Get queue ID
    const queueResponse = await axios.get(`${BASE_URL}/queue`);
    const queueId = queueResponse.data.queues[0]._id;
    console.log('📋 Queue ID:', queueId);

    // Add customer
    const customerResponse = await axios.post(`${BASE_URL}/customer/join/${queueId}`, {
      name: 'WhatsApp Integration Test',
      phone: '9876543210',
      partySize: 3,
      specialRequests: 'Testing WhatsApp notifications'
    });
    console.log('👤 Customer added:', customerResponse.data.success);

    // Notify customer
    const notifyResponse = await axios.post(`${BASE_URL}/queue/${queueId}/call-next`);
    console.log('📢 Customer notified:', notifyResponse.data.success);
    console.log('');

    // Test 6: Disconnect
    console.log('6️⃣ Testing disconnect...');
    const disconnectResponse = await axios.post(`${BASE_URL}/whatsapp/disconnect`);
    console.log('✅ Disconnect:', disconnectResponse.data);
    console.log('');

    // Test 7: Check status after disconnect
    console.log('7️⃣ Testing status after disconnect...');
    const finalStatusResponse = await axios.get(`${BASE_URL}/whatsapp/status`);
    console.log('✅ Final status:', finalStatusResponse.data);
    console.log('');

    console.log('🎉 All WhatsApp service tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run tests
testWhatsAppService(); 