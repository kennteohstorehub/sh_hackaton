// Direct test of registration logic
const bcrypt = require('bcryptjs');
const prisma = require('./server/utils/prisma');

async function testRegistration() {
  console.log('Testing registration directly...');
  
  const timestamp = Date.now();
  const testData = {
    fullName: 'Test User',
    email: `test${timestamp}@example.com`,
    phone: '+1234567890',
    businessName: 'Test Business',
    subdomain: `test${timestamp}`,
    businessType: 'restaurant',
    password: 'Test123!@#'
  };
  
  try {
    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      console.log('1. Creating tenant...');
      
      // Calculate trial end date (14 days from now)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      // 1. Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: testData.businessName,
          slug: testData.subdomain.toLowerCase(),
          domain: `${testData.subdomain.toLowerCase()}.storehubqms.com`,
          isActive: true
        }
      });
      
      console.log('   ✅ Tenant created:', tenant.id);

      // 2. Create subscription with trial
      console.log('2. Creating subscription...');
      const subscription = await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          status: 'trial',
          priority: 'standard',
          billingCycle: 'monthly',
          startDate: new Date(),
          endDate: trialEndDate,
          maxMerchants: 1,
          maxQueuesPerMerchant: 1,
          maxUsersPerTenant: 3,
          aiFeatures: false,
          analytics: true,
          customBranding: false,
          priority_support: false
        }
      });
      
      console.log('   ✅ Subscription created:', subscription.id);

      // 3. Hash password
      console.log('3. Hashing password...');
      const hashedPassword = await bcrypt.hash(testData.password, 10);
      console.log('   ✅ Password hashed');

      // 4. Create merchant account
      console.log('4. Creating merchant...');
      const merchant = await tx.merchant.create({
        data: {
          tenant: {
            connect: { id: tenant.id }
          },
          email: testData.email,
          password: hashedPassword,
          businessName: testData.businessName,
          businessType: testData.businessType,
          phone: testData.phone,
          isActive: true,
          emailVerified: false,
          emailVerificationToken: Buffer.from(Math.random().toString()).toString('base64').slice(0, 32)
        }
      });
      
      console.log('   ✅ Merchant created:', merchant.id);

      // 5. Create default queue for the merchant
      console.log('5. Creating default queue...');
      const queue = await tx.queue.create({
        data: {
          merchantId: merchant.id,
          name: 'Main Queue',
          isActive: false,
          maxCapacity: 50,
          averageServiceTime: 15,
          autoNotifications: true,
          allowCancellation: true,
          requireConfirmation: false
        }
      });
      
      console.log('   ✅ Queue created:', queue.id);

      // 6. Log the registration in audit log
      console.log('6. Creating audit log...');
      await tx.backOfficeAuditLog.create({
        data: {
          tenantId: tenant.id,
          action: 'TENANT_CREATED',
          resourceType: 'Tenant',
          entityType: 'Tenant',
          entityId: tenant.id,
          description: `New tenant registered via test: ${testData.businessName}`,
          ipAddress: '127.0.0.1',
          userAgent: 'test-script',
          metadata: JSON.stringify({
            registrationType: 'test',
            trial: true,
            businessType: testData.businessType,
            subdomain: testData.subdomain
          })
        }
      });
      
      console.log('   ✅ Audit log created');

      return { tenant, merchant, subscription };
    });
    
    console.log('\n✅ Registration successful!');
    console.log('Tenant ID:', result.tenant.id);
    console.log('Merchant ID:', result.merchant.id);
    console.log('Login URL:', `http://localhost:3000/t/${testData.subdomain}/login`);
    
  } catch (error) {
    console.error('\n❌ Registration failed!');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testRegistration();