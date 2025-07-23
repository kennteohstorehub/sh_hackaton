require('dotenv').config();
const Merchant = require('./server/models/Merchant');
const bcrypt = require('bcryptjs');
const logger = require('./server/utils/logger');

async function testLogin() {
  console.log('Testing login functionality...\n');
  
  try {
    // Test 1: Find merchant by email
    console.log('1. Testing Merchant.findOne with email...');
    const email = 'demo@smartqueue.com';
    const merchant = await Merchant.findOne({ email });
    
    if (!merchant) {
      console.log('❌ Merchant not found with email:', email);
      return;
    }
    
    console.log('✅ Merchant found:', {
      id: merchant.id,
      _id: merchant._id,
      email: merchant.email,
      businessName: merchant.businessName,
      hasPassword: !!merchant.password
    });
    
    // Test 2: Check password comparison
    console.log('\n2. Testing password comparison...');
    const testPassword = 'Demo123!';
    const isValid = await bcrypt.compare(testPassword, merchant.password);
    console.log('Password valid:', isValid ? '✅' : '❌');
    
    // Test 3: Test the comparePassword method
    console.log('\n3. Testing merchant.comparePassword method...');
    const isValidMethod = await merchant.comparePassword(testPassword);
    console.log('comparePassword method result:', isValidMethod ? '✅' : '❌');
    
    // Test 4: Test findById with .select() issue
    console.log('\n4. Testing Merchant.findById...');
    try {
      const merchantById = await Merchant.findById(merchant.id).select('-password');
      console.log('findById with .select():', merchantById);
    } catch (error) {
      console.log('❌ Error with .select():', error.message);
      console.log('This is the issue - .select() is not a method on our Merchant model');
      
      // Try without .select()
      const merchantById = await Merchant.findById(merchant.id);
      console.log('✅ findById without .select() works:', {
        id: merchantById.id,
        email: merchantById.email
      });
    }
    
    // Test 5: Check toObject method
    console.log('\n5. Testing toObject method...');
    const obj = merchant.toObject();
    console.log('toObject result:', {
      hasId: !!obj.id,
      has_id: !!obj._id,
      email: obj.email
    });
    
    // Test 6: Check related data
    console.log('\n6. Checking related data...');
    console.log('Settings:', merchant.settings ? '✅ Present' : '❌ Missing');
    console.log('Subscription:', merchant.subscription ? '✅ Present' : '❌ Missing');
    console.log('Integrations:', merchant.integrations ? '✅ Present' : '❌ Missing');
    
  } catch (error) {
    console.error('Error during testing:', error);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

testLogin();