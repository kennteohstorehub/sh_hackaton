// Test data for E2E tests
module.exports = {
  users: {
    demo: {
      email: 'demo@smartqueue.com',
      password: 'demo123456',
      businessName: 'Demo Restaurant'
    },
    invalid: {
      email: 'invalid@test.com',
      password: 'wrongpassword'
    }
  },
  
  queues: {
    default: {
      name: 'Test Queue',
      description: 'Default test queue',
      maxCapacity: 50,
      averageServiceTime: 30
    },
    small: {
      name: 'Small Queue',
      description: 'Small capacity queue',
      maxCapacity: 10,
      averageServiceTime: 15
    }
  },
  
  customers: {
    regular: {
      name: 'John Doe',
      phone: '+60123456789',
      partySize: 2,
      notes: 'Regular customer'
    },
    vip: {
      name: 'VIP Customer',
      phone: '+60198765432',
      partySize: 4,
      notes: 'VIP treatment required'
    },
    large: {
      name: 'Large Party',
      phone: '+60111111111',
      partySize: 8,
      notes: 'Birthday celebration'
    }
  }
};