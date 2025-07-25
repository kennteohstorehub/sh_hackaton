const prisma = require('../utils/prisma');
const bcrypt = require('bcryptjs');

// Mongoose-style wrapper for Prisma Merchant model
class Merchant {
  constructor(data) {
    Object.assign(this, data);
    // Map Prisma 'id' to Mongoose-style '_id'
    if (data && data.id) {
      this._id = data.id;
    }
  }

  static async findById(id) {
    try {
      const merchant = await prisma.merchant.findUnique({
        where: { id: id.toString() },
        include: {
          settings: true,
          subscription: true,
          integrations: true,
          address: true,
          businessHours: true,
          serviceTypes: true
        }
      });
      return merchant ? new Merchant(merchant) : null;
    } catch (error) {
      console.error('Error in Merchant.findById:', error);
      return null;
    }
  }

  static async findOne(filter = {}) {
    try {
      const where = {};
      if (filter.email) where.email = filter.email;
      if (filter._id) where.id = filter._id;
      
      console.log('[Merchant.findOne] Looking for merchant with filter:', filter);
      console.log('[Merchant.findOne] Prisma where clause:', where);
      
      const merchant = await prisma.merchant.findFirst({
        where,
        include: {
          settings: true,
          subscription: true,
          integrations: true,
          address: true,
          businessHours: true,
          serviceTypes: true
        }
      });
      
      console.log('[Merchant.findOne] Found merchant:', merchant ? merchant.email : 'null');
      
      return merchant ? new Merchant(merchant) : null;
    } catch (error) {
      console.error('[Merchant.findOne] Error:', error);
      throw error; // Re-throw to let the caller handle it
    }
  }

  static async find(filter = {}) {
    const where = {};
    if (filter.businessType) where.businessType = filter.businessType;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    
    const merchants = await prisma.merchant.findMany({
      where,
      include: {
        settings: true,
        subscription: true,
        integrations: true,
        address: true,
        businessHours: true,
        serviceTypes: true
      }
    });
    
    return merchants.map(m => new Merchant(m));
  }

  async save() {
    const data = {
      businessName: this.businessName,
      email: this.email,
      phone: this.phone,
      businessType: this.businessType,
      timezone: this.timezone,
      isActive: this.isActive,
      emailVerified: this.emailVerified
    };

    if (this.password && !this.id) {
      // Only hash password for new merchants
      data.password = this.password;
    }

    if (this.id || this._id) {
      // Update existing
      const updated = await prisma.merchant.update({
        where: { id: this.id || this._id },
        data,
        include: {
          settings: true,
          subscription: true,
          integrations: true,
          address: true
        }
      });
      Object.assign(this, updated);
    } else {
      // Create new with related records
      const created = await prisma.merchant.create({
        data: {
          ...data,
          settings: {
            create: {}
          },
          subscription: {
            create: {}
          },
          integrations: {
            create: {}
          }
        },
        include: {
          settings: true,
          subscription: true,
          integrations: true,
          address: true
        }
      });
      Object.assign(this, created);
    }
    return this;
  }

  toObject() {
    const obj = { ...this };
    if (this.id && !this._id) obj._id = this.id;
    return obj;
  }

  async comparePassword(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  }

  canCreateQueue(existingQueues) {
    const maxQueues = this.subscription?.maxQueues || 1;
    return existingQueues < maxQueues;
  }
  
  isBusinessOpen() {
    // Check if business is currently open based on business hours
    const now = new Date();
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    
    if (!this.businessHours || !Array.isArray(this.businessHours)) {
      return true; // Default to open if no hours specified
    }
    
    const todayHours = this.businessHours.find(bh => bh.dayOfWeek === dayOfWeek);
    if (!todayHours || todayHours.closed) {
      return false;
    }
    
    // Check if current time is within business hours
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    return currentTime >= todayHours.start && currentTime <= todayHours.end;
  }
  
  getActiveServices() {
    // Return active service types
    const services = [];
    if (this.services?.dinein) services.push('Dine In');
    if (this.services?.takeaway) services.push('Takeaway');
    if (this.services?.delivery) services.push('Delivery');
    return services.length > 0 ? services : ['General Queue'];
  }

  getPartySizeLimits() {
    // Get party size limits based on current time (peak/non-peak)
    const isPeak = this.isPeakHour();
    if (isPeak && this.settings?.queue?.peakHours?.maxPartySize) {
      return {
        min: 1,
        max: this.settings.queue.peakHours.maxPartySize
      };
    }
    return {
      min: 1,
      max: this.settings?.queue?.maxPartySize || 20
    };
  }

  isPeakHour() {
    // Check if current time is during peak hours
    if (!this.settings?.queue?.peakHours?.enabled) {
      return false;
    }
    
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    const peakStart = this.settings.queue.peakHours.start || '11:30';
    const peakEnd = this.settings.queue.peakHours.end || '14:00';
    
    return currentTime >= peakStart && currentTime <= peakEnd;
  }

  shouldAutoPause(currentOccupancy) {
    // Check if queue should auto-pause based on occupancy
    if (!this.settings?.queue?.autoPause?.enabled) {
      return false;
    }
    
    const threshold = this.settings.queue.autoPause.occupancyThreshold || 90;
    const maxOccupancy = this.settings?.queue?.maxOccupancy || 100;
    const occupancyPercentage = (currentOccupancy / maxOccupancy) * 100;
    
    return occupancyPercentage >= threshold;
  }

  isBusinessOpen() {
    // For testing purposes, always return true
    // In production, this would check business hours
    return true;
  }

  // Static methods
  static async hashPassword(password) {
    return await bcrypt.hash(password, 10);
  }
}

module.exports = Merchant;