const merchantService = require('./server/services/merchantService');
const prisma = require('./server/utils/prisma');

async function testPhoneUpdate() {
  console.log('Testing merchant phone number update fix...\n');
  
  try {
    // Step 1: Get a test merchant
    console.log('1. Finding test merchant...');
    const merchant = await merchantService.findByEmail('admin@storehub.com');
    
    if (!merchant) {
      throw new Error('Demo merchant not found');
    }
    
    console.log('✓ Found merchant:', merchant.businessName);
    console.log('  Current phone:', merchant.phone);
    console.log();
    
    // Step 2: Update the phone number directly
    console.log('2. Updating phone number...');
    const newPhone = '+1 (555) 987-6543';
    
    try {
      // This should work without the "Argument 'address' must not be null" error
      await merchantService.update(merchant.id, { phone: newPhone });
      console.log('✓ Phone update succeeded!');
    } catch (error) {
      console.error('❌ Phone update failed:', error.message);
      throw error;
    }
    
    // Step 3: Verify the update
    console.log('\n3. Verifying update...');
    const updatedMerchant = await merchantService.findById(merchant.id);
    console.log('  Updated phone:', updatedMerchant.phone);
    
    if (updatedMerchant.phone === newPhone) {
      console.log('\n✅ Phone update test PASSED!');
      console.log('\nThe fix is working correctly:');
      console.log('- Phone number can be updated without errors');
      console.log('- The "Argument \'address\' must not be null" error is resolved');
      console.log('- Direct merchant fields are updated properly');
    } else {
      console.log('\n❌ Phone update test FAILED!');
      console.log(`Expected: ${newPhone}`);
      console.log(`Got: ${updatedMerchant.phone}`);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    // Close the database connection
    await prisma.$disconnect();
  }
}

// Run the test
testPhoneUpdate();