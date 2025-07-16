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
    enum: ['restaurant', 'retail'],
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
    // Restaurant capacity
    seatingCapacity: {
      type: Number,
      default: 50
    },
    avgMealDuration: {
      type: Number, // in minutes
      default: 45
    },
    
    // Queue behavior settings
    queue: {
      maxQueueSize: {
        type: Number,
        default: 50
      },
      autoPauseThreshold: {
        type: Number, // percentage
        default: 90
      },
      noShowTimeout: {
        type: Number, // in minutes
        default: 15
      },
      gracePeriod: {
        type: Number, // in minutes
        default: 5
      },
      joinCutoffTime: {
        type: Number, // minutes before closing
        default: 30
      },
      advanceBookingHours: {
        type: Number, // 0 = same day only
        default: 0
      },
      partySize: {
        regular: {
          min: { type: Number, default: 1 },
          max: { type: Number, default: 8 }
        },
        peak: {
          min: { type: Number, default: 1 },
          max: { type: Number, default: 4 }
        }
      }
    },
    
    // Notification settings
    notifications: {
      timing: {
        firstNotification: {
          type: Number, // minutes before turn
          default: 10
        },
        finalNotification: {
          type: Number, // 0 = when ready, >0 = minutes before
          default: 0
        },
        adjustForPeakHours: {
          type: Boolean,
          default: true
        },
        sendNoShowWarning: {
          type: Boolean,
          default: true
        },
        confirmTableAcceptance: {
          type: Boolean,
          default: true
        }
      },
      templates: {
        join: {
          type: String,
          default: 'Welcome to {RestaurantName}! 🍽️ You\'re #{Position} in queue (Party of {PartySize}). Estimated wait: ~{WaitTime} minutes. We\'ll notify you when your table is ready!'
        },
        almostReady: {
          type: String,
          default: 'Hi {CustomerName}! Your table at {RestaurantName} will be ready in ~{Minutes} minutes. Please start making your way to the restaurant 🚶‍♂️'
        },
        tableReady: {
          type: String,
          default: '🎉 {CustomerName}, your table is NOW READY! Please see our host at {RestaurantName}. You have {Timeout} minutes to claim your table.'
        },
        noShowWarning: {
          type: String,
          default: '⚠️ {CustomerName}, we\'ve been holding your table for {Minutes} minutes. Please respond within {Remaining} minutes or we\'ll need to release your table to the next guest.'
        }
      }
    },
    
    // Operations settings
    operations: {
      peakHours: {
        monday: [String], // ['lunch', 'dinner']
        tuesday: [String],
        wednesday: [String],
        thursday: [String],
        friday: [String],
        saturday: [String],
        sunday: [String]
      },
      peakMultiplier: {
        type: Number,
        default: 1.5
      },
      priority: {
        enabled: {
          type: Boolean,
          default: false
        },
        slots: {
          type: Number,
          default: 2
        },
        skipRegular: {
          type: Boolean,
          default: true
        },
        notifyFirst: {
          type: Boolean,
          default: false
        },
        longerGrace: {
          type: Boolean,
          default: true
        }
      }
    },
    
    // Legacy settings (kept for backward compatibility)
    maxQueueSize: {
      type: Number,
      default: 50
    },
    autoNotifications: {
      type: Boolean,
      default: true
    },
    notificationInterval: {
      type: Number,
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

// Check if current time is peak hours
merchantSchema.methods.isPeakHour = function() {
  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const currentHour = now.getHours();
  
  const peakHours = this.settings?.operations?.peakHours?.[dayOfWeek] || [];
  
  // Check if current hour falls in any peak period
  for (const period of peakHours) {
    if (period === 'lunch' && currentHour >= 12 && currentHour <= 14) return true;
    if (period === 'dinner' && currentHour >= 18 && currentHour <= 21) return true;
  }
  
  return false;
};

// Get current party size limits
merchantSchema.methods.getPartySizeLimits = function() {
  const isPeak = this.isPeakHour();
  return isPeak ? this.settings?.queue?.partySize?.peak : this.settings?.queue?.partySize?.regular;
};

// Check if queue should auto-pause based on capacity
merchantSchema.methods.shouldAutoPause = function(currentOccupancy) {
  const threshold = this.settings?.queue?.autoPauseThreshold || 90;
  const capacity = this.settings?.seatingCapacity || 50;
  const occupancyPercentage = (currentOccupancy / capacity) * 100;
  
  return occupancyPercentage >= threshold;
};

// Get wait time multiplier for current conditions
merchantSchema.methods.getWaitTimeMultiplier = function() {
  if (this.isPeakHour()) {
    return this.settings?.operations?.peakMultiplier || 1.5;
  }
  return 1.0;
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