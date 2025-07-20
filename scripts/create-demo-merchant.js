const mongoose = require('mongoose');
const Merchant = require('../server/models/Merchant');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/smart-queue-manager');

// Use a fixed ObjectId for demo merchant
const demoMerchantId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');

async function createDemoMerchant() {
  try {
    // Check if demo merchant already exists
    const existingMerchant = await Merchant.findById(demoMerchantId);
    
    if (existingMerchant) {
      console.log('Demo merchant already exists, updating business hours...');
      
      // Always update business hours to ensure they're properly set
      existingMerchant.businessHours = {
        monday: { start: '09:00', end: '18:00', closed: false },
        tuesday: { start: '09:00', end: '18:00', closed: false },
        wednesday: { start: '09:00', end: '18:00', closed: false },
        thursday: { start: '09:00', end: '18:00', closed: false },
        friday: { start: '09:00', end: '21:00', closed: false },
        saturday: { start: '10:00', end: '21:00', closed: false },
        sunday: { start: '11:00', end: '17:00', closed: true }
      };
      
      await existingMerchant.save();
      console.log('Business hours updated for demo merchant');
      
      return;
    }

    // Create demo merchant
    const demoMerchant = new Merchant({
      _id: demoMerchantId,
      email: 'demo@smartqueue.com',
      password: 'demo123456', // This will be hashed automatically
      businessName: 'Demo Restaurant',
      businessType: 'restaurant',
      phone: '+1234567890',
      address: {
        street: '123 Demo Street',
        city: 'Demo City',
        state: 'Demo State',
        zipCode: '12345',
        country: 'Demo Country'
      },
      businessHours: {
        monday: { start: '09:00', end: '18:00', closed: false },
        tuesday: { start: '09:00', end: '18:00', closed: false },
        wednesday: { start: '09:00', end: '18:00', closed: false },
        thursday: { start: '09:00', end: '18:00', closed: false },
        friday: { start: '09:00', end: '21:00', closed: false },
        saturday: { start: '10:00', end: '21:00', closed: false },
        sunday: { start: '11:00', end: '17:00', closed: true }
      },
      serviceTypes: [
        {
          name: 'Dine In',
          estimatedDuration: 45,
          description: 'Table service dining',
          isActive: true
        },
        {
          name: 'Takeout',
          estimatedDuration: 15,
          description: 'Food pickup orders',
          isActive: true
        }
      ],
      integrations: {
        whatsapp: {
          enabled: true,
          phoneNumber: '+1234567890'
        },
        messenger: {
          enabled: false
        }
      },
      settings: {
        maxQueueSize: 100,
        autoNotifications: true,
        notificationInterval: 5,
        allowCustomerCancellation: true,
        requireCustomerConfirmation: true,
        language: 'en',
        welcomeMessage: 'Welcome to Demo Restaurant! Please select a service to join the queue.'
      },
      subscription: {
        plan: 'premium',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        isActive: true,
        features: {
          maxQueues: 10,
          maxCustomersPerQueue: 100,
          aiFeatures: true,
          analytics: true,
          customBranding: true
        }
      },
      emailVerified: true,
      isActive: true
    });

    await demoMerchant.save();
    console.log('Demo merchant created successfully');
    
  } catch (error) {
    console.error('Error creating demo merchant:', error);
  } finally {
    mongoose.connection.close();
  }
}

createDemoMerchant(); 