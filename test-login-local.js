require('dotenv').config({ path: '/Users/kennteoh/Development/Hack/.env' });
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Merchant = require('./server/models/Merchant');

async function testLoginFlow() {
  console.log('Testing login flow locally...\n');
  
  try {
    // Step 1: Find merchant
    console.log('1. Finding merchant...');
    const merchant = await Merchant.findOne({ email: 'demo@smartqueue.com' });
    
    if (!merchant) {
      console.log('❌ Merchant not found');
      return;
    }
    
    console.log('✅ Merchant found:', {
      id: merchant.id,
      _id: merchant._id,
      email: merchant.email,
      businessName: merchant.businessName
    });
    
    // Step 2: Verify password
    console.log('\n2. Verifying password...');
    const isValid = await bcrypt.compare('demo123456', merchant.password);
    console.log('Password valid:', isValid ? '✅' : '❌');
    
    // Step 3: Test session creation
    console.log('\n3. Testing session data structure...');
    const sessionData = {
      userId: merchant.id || merchant._id?.toString(),
      user: {
        id: merchant.id || merchant._id?.toString(),
        email: merchant.email,
        businessName: merchant.businessName,
        merchantId: merchant.id || merchant._id?.toString()
      }
    };
    console.log('Session data:', sessionData);
    
    // Step 4: Test loadUser simulation
    console.log('\n4. Simulating loadUser middleware...');
    const loadedUser = await Merchant.findById(sessionData.userId);
    if (loadedUser) {
      console.log('✅ User loaded successfully');
      
      // Test the _id assignment
      if (loadedUser.id && !loadedUser._id) {
        loadedUser._id = loadedUser.id;
      }
      
      console.log('User object for routes:', {
        id: loadedUser.id,
        _id: loadedUser._id,
        email: loadedUser.email
      });
    } else {
      console.log('❌ Failed to load user');
    }
    
    // Step 5: Test queue finding
    console.log('\n5. Testing queue finding...');
    const Queue = require('./server/models/Queue');
    const merchantId = loadedUser.id || loadedUser._id;
    const queues = await Queue.find({ merchantId });
    console.log(`Found ${queues.length} queues for merchant`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

testLoginFlow();