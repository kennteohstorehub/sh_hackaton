const mongoose = require('mongoose');

const queueEntrySchema = new mongoose.Schema({
  customerId: {
    type: String,
    required: true,
    index: true
  },
  customerName: {
    type: String,
    required: true
  },
  customerPhone: {
    type: String,
    required: true
  },
  platform: {
    type: String,
    enum: ['whatsapp', 'messenger', 'web'],
    required: true
  },
  position: {
    type: Number,
    required: true
  },
  estimatedWaitTime: {
    type: Number, // in minutes
    default: 0
  },
  status: {
    type: String,
    enum: ['waiting', 'called', 'serving', 'completed', 'cancelled', 'no-show'],
    default: 'waiting'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  serviceType: {
    type: String,
    required: true
  },
  partySize: {
    type: Number,
    required: true,
    min: 1,
    max: 20,
    default: 1
  },
  notes: {
    type: String,
    default: ''
  },
  specialRequests: {
    type: String,
    default: ''
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  calledAt: {
    type: Date
  },
  servedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  requeuedAt: {
    type: Date
  },
  lastNotified: {
    type: Date
  },
  notificationCount: {
    type: Number,
    default: 0
  },
  sentimentScore: {
    type: Number,
    min: -1,
    max: 1,
    default: 0
  },
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    submittedAt: Date
  }
});

const queueSchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  maxCapacity: {
    type: Number,
    default: 100
  },
  averageServiceTime: {
    type: Number, // in minutes
    default: 15
  },
  currentServing: {
    type: Number,
    default: 0
  },
  entries: [queueEntrySchema],
  settings: {
    autoNotifications: {
      type: Boolean,
      default: true
    },
    notificationInterval: {
      type: Number, // in minutes
      default: 5
    },
    allowCancellation: {
      type: Boolean,
      default: true
    },
    requireConfirmation: {
      type: Boolean,
      default: true
    },
    businessHours: {
      start: {
        type: String,
        default: '09:00'
      },
      end: {
        type: String,
        default: '17:00'
      },
      timezone: {
        type: String,
        default: 'UTC'
      }
    }
  },
  analytics: {
    totalServed: {
      type: Number,
      default: 0
    },
    averageWaitTime: {
      type: Number,
      default: 0
    },
    averageServiceTime: {
      type: Number,
      default: 0
    },
    customerSatisfaction: {
      type: Number,
      default: 0
    },
    noShowRate: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
queueSchema.index({ merchantId: 1, isActive: 1 });
queueSchema.index({ 'entries.customerId': 1 });
queueSchema.index({ 'entries.status': 1 });
queueSchema.index({ 'entries.joinedAt': 1 });

// Virtual for current queue length
queueSchema.virtual('currentLength').get(function() {
  return this.entries.filter(entry => entry.status === 'waiting').length;
});

// Virtual for next position
queueSchema.virtual('nextPosition').get(function() {
  const waitingEntries = this.entries.filter(entry => entry.status === 'waiting');
  return waitingEntries.length > 0 ? Math.max(...waitingEntries.map(e => e.position)) + 1 : 1;
});

// Method to add customer to queue
queueSchema.methods.addCustomer = function(customerData) {
  const position = this.nextPosition;
  const estimatedWaitTime = this.calculateEstimatedWaitTime(position);
  
  const newEntry = {
    ...customerData,
    position,
    estimatedWaitTime,
    joinedAt: new Date()
  };
  
  this.entries.push(newEntry);
  return newEntry;
};

// Method to calculate estimated wait time
queueSchema.methods.calculateEstimatedWaitTime = function(position) {
  const waitingAhead = position - 1;
  const avgServiceTime = this.averageServiceTime || 15;
  return waitingAhead * avgServiceTime;
};

// Method to update queue positions
queueSchema.methods.updatePositions = function() {
  const waitingEntries = this.entries
    .filter(entry => entry.status === 'waiting')
    .sort((a, b) => a.joinedAt - b.joinedAt);
  
  waitingEntries.forEach((entry, index) => {
    entry.position = index + 1;
    entry.estimatedWaitTime = this.calculateEstimatedWaitTime(entry.position);
  });
};

// Method to call next customer
queueSchema.methods.callNext = function() {
  const nextCustomer = this.entries
    .filter(entry => entry.status === 'waiting')
    .sort((a, b) => a.position - b.position)[0];
  
  if (nextCustomer) {
    nextCustomer.status = 'called';
    nextCustomer.calledAt = new Date();
    this.currentServing = nextCustomer.position;
    this.updatePositions();
    return nextCustomer;
  }
  
  return null;
};

// Method to get customer by ID
queueSchema.methods.getCustomer = function(customerId) {
  return this.entries.find(entry => entry.customerId === customerId);
};

// Method to remove customer from queue
queueSchema.methods.removeCustomer = function(customerId, reason = 'cancelled') {
  const customerIndex = this.entries.findIndex(entry => entry.customerId === customerId);
  
  if (customerIndex !== -1) {
    const customer = this.entries[customerIndex];
    customer.status = reason;
    customer.completedAt = new Date();
    
    // Keep the customer in entries for daily statistics, don't remove from array
    // This ensures "Customers Today" count remains accurate
    
    // Update positions for remaining waiting customers
    this.updatePositions();
    
    return customer;
  }
  
  return null;
};

module.exports = mongoose.model('Queue', queueSchema); 