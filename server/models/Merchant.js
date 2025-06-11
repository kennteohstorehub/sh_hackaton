const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const merchantSchema = new mongoose.Schema({
  businessName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    required: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  businessType: {
    type: String,
    enum: ['restaurant', 'clinic', 'salon', 'bank', 'government', 'retail', 'other'],
    required: true
  },
  businessHours: {
    monday: { start: String, end: String, closed: { type: Boolean, default: false } },
    tuesday: { start: String, end: String, closed: { type: Boolean, default: false } },
    wednesday: { start: String, end: String, closed: { type: Boolean, default: false } },
    thursday: { start: String, end: String, closed: { type: Boolean, default: false } },
    friday: { start: String, end: String, closed: { type: Boolean, default: false } },
    saturday: { start: String, end: String, closed: { type: Boolean, default: false } },
    sunday: { start: String, end: String, closed: { type: Boolean, default: true } }
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  serviceTypes: [{
    name: {
      type: String,
      required: true
    },
    estimatedDuration: {
      type: Number, // in minutes
      required: true
    },
    description: String,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  integrations: {
    whatsapp: {
      enabled: {
        type: Boolean,
        default: false
      },
      phoneNumber: String,
      sessionData: String,
      lastConnected: Date
    },
    messenger: {
      enabled: {
        type: Boolean,
        default: false
      },
      pageId: String,
      accessToken: String,
      lastConnected: Date
    }
  },
  settings: {
    maxQueueSize: {
      type: Number,
      default: 100
    },
    autoNotifications: {
      type: Boolean,
      default: true
    },
    notificationInterval: {
      type: Number, // in minutes
      default: 5
    },
    allowCustomerCancellation: {
      type: Boolean,
      default: true
    },
    requireCustomerConfirmation: {
      type: Boolean,
      default: true
    },
    language: {
      type: String,
      default: 'en'
    },
    welcomeMessage: {
      type: String,
      default: 'Welcome! Please select a service to join the queue.'
    },
    customMessages: {
      queueJoined: String,
      positionUpdate: String,
      nowServing: String,
      cancelled: String,
      completed: String
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'],
      default: 'free'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: Date,
    isActive: {
      type: Boolean,
      default: true
    },
    features: {
      maxQueues: {
        type: Number,
        default: 1
      },
      maxCustomersPerQueue: {
        type: Number,
        default: 50
      },
      aiFeatures: {
        type: Boolean,
        default: false
      },
      analytics: {
        type: Boolean,
        default: false
      },
      customBranding: {
        type: Boolean,
        default: false
      }
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date
}, {
  timestamps: true
});

// Indexes
merchantSchema.index({ email: 1 });
merchantSchema.index({ businessName: 1 });
merchantSchema.index({ businessType: 1 });

// Hash password before saving
merchantSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
merchantSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if business is currently open
merchantSchema.methods.isBusinessOpen = function() {
  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  const todayHours = this.businessHours[dayOfWeek];
  
  if (!todayHours || todayHours.closed) return false;
  
  return currentTime >= todayHours.start && currentTime <= todayHours.end;
};

// Get active service types
merchantSchema.methods.getActiveServices = function() {
  return this.serviceTypes.filter(service => service.isActive);
};

// Check subscription limits
merchantSchema.methods.canCreateQueue = function(currentQueueCount) {
  return currentQueueCount < this.subscription.features.maxQueues;
};

merchantSchema.methods.canAddCustomer = function(currentCustomerCount) {
  return currentCustomerCount < this.subscription.features.maxCustomersPerQueue;
};

// Remove password from JSON output
merchantSchema.methods.toJSON = function() {
  const merchant = this.toObject();
  delete merchant.password;
  delete merchant.emailVerificationToken;
  delete merchant.passwordResetToken;
  delete merchant.passwordResetExpires;
  return merchant;
};

module.exports = mongoose.model('Merchant', merchantSchema); 