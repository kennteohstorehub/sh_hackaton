const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

class MerchantService {
  /**
   * Find merchant by ID
   */
  async findById(id, include = {}) {
    return prisma.merchant.findUnique({
      where: { id },
      include
    });
  }

  /**
   * Find merchant by email
   */
  async findByEmail(email) {
    return prisma.merchant.findUnique({
      where: { email }
    });
  }

  /**
   * Create new merchant
   */
  async create(data) {
    const { password, ...merchantData } = data;
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    return prisma.merchant.create({
      data: {
        ...merchantData,
        password: hashedPassword
      }
    });
  }

  /**
   * Update merchant
   */
  async update(id, data) {
    const { password, ...updateData } = data;
    
    // If password is being updated, hash it
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }
    
    return prisma.merchant.update({
      where: { id },
      data: updateData
    });
  }

  /**
   * Delete merchant
   */
  async delete(id) {
    return prisma.merchant.delete({
      where: { id }
    });
  }

  /**
   * Authenticate merchant
   */
  async authenticate(email, password) {
    const merchant = await this.findByEmail(email);
    
    if (!merchant) {
      return null;
    }
    
    const isMatch = await bcrypt.compare(password, merchant.password);
    
    if (!isMatch) {
      return null;
    }
    
    // Update last login
    await this.update(merchant.id, {
      lastLogin: new Date()
    });
    
    return merchant;
  }

  /**
   * Get merchant with full details
   */
  async getFullDetails(id) {
    return prisma.merchant.findUnique({
      where: { id },
      include: {
        businessHours: true,
        address: true,
        integrations: true,
        settings: {
          include: {
            notificationTemplates: true
          }
        },
        subscription: true,
        queues: {
          where: { isActive: true },
          include: {
            entries: {
              where: { status: 'waiting' },
              orderBy: { position: 'asc' }
            }
          }
        },
        serviceTypes: {
          where: { isActive: true }
        }
      }
    });
  }

  /**
   * Check if merchant can create more queues
   */
  async canCreateQueue(merchantId) {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        queues: true,
        subscription: true
      }
    });

    if (!merchant) {
      return false;
    }

    const existingQueues = merchant.queues.length;
    const maxQueues = merchant.subscription?.maxQueues || 1;

    return existingQueues < maxQueues;
  }

  /**
   * Initialize default settings for merchant
   */
  async initializeDefaults(merchantId) {
    // Create default business hours
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const businessHours = daysOfWeek.map(day => ({
      merchantId,
      dayOfWeek: day,
      start: '09:00',
      end: '17:00',
      closed: false
    }));

    await prisma.businessHours.createMany({
      data: businessHours,
      skipDuplicates: true
    });

    // Create default settings
    await prisma.merchantSettings.create({
      data: {
        merchantId,
        seatingCapacity: 50,
        avgMealDuration: 45,
        maxQueueSize: 50
      }
    });

    // Create default subscription
    await prisma.merchantSubscription.create({
      data: {
        merchantId,
        plan: 'free',
        maxQueues: 1,
        maxCustomersPerQueue: 50
      }
    });
  }
}

module.exports = new MerchantService();