// Test script to login by calling the auth logic directly
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Merchant = require('./server/models/Merchant');

async function testDirectLogin() {
  try {
    console.log('🧪 Direct Login Test - Bypassing HTTP');
    console.log('='.repeat(50));
    
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/storehub-queue');
    console.log('✅ Connected to MongoDB');
    
    // Find demo user
    console.log('\nLooking for demo user...');
    const merchant = await Merchant.findOne({ email: 'demo@smartqueue.com' });
    
    if (!merchant) {
      console.log('❌ Demo user not found!');
      return;
    }
    
    console.log('✅ Found demo user:', merchant.businessName);
    
    // Test password
    console.log('\nTesting password...');
    const isValid = await bcrypt.compare('demo123456', merchant.password);
    
    if (isValid) {
      console.log('✅ Password is correct!');
      console.log('\n✨ LOGIN WOULD BE SUCCESSFUL! ✨');
      console.log('\nThe issue is with CSRF validation, not with the user credentials.');
    } else {
      console.log('❌ Password is incorrect');
      
      // Try to check what the hash looks like
      console.log('\nPassword hash info:');
      console.log('- Stored hash:', merchant.password.substring(0, 20) + '...');
      console.log('- Hash length:', merchant.password.length);
      console.log('- Starts with $2:', merchant.password.startsWith('$2'));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

testDirectLogin();