const prisma = require('../utils/prisma');
const bcrypt = require('bcryptjs');

// Mongoose-style wrapper for Prisma Merchant model
class Merchant {
  constructor(data) {
    Object.assign(this, data);
  }

  static async findById(id) {
    const merchant = await prisma.merchant.findUnique({
      where: { id },
      include: {
        settings: true,
        subscription: true,
        integrations: true,
        address: true
      }
    });
    return merchant ? new Merchant(merchant) : null;
  }

  static async findOne(filter = {}) {
    const where = {};
    if (filter.email) where.email = filter.email;
    if (filter._id) where.id = filter._id;
    
    const merchant = await prisma.merchant.findFirst({
      where,
      include: {
        settings: true,
        subscription: true,
        integrations: true,
        address: true
      }
    });
    
    return merchant ? new Merchant(merchant) : null;
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
        address: true
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

  // Static methods
  static async hashPassword(password) {
    return await bcrypt.hash(password, 10);
  }
}

module.exports = Merchant;