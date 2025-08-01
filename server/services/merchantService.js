const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const { TenantAwarePrisma, TenantSecurityLogger } = require('../middleware/tenant-isolation');

class MerchantService {
  /**
   * Get tenant-aware Prisma client
   */
  _getTenantPrisma(tenantId) {
    if (!tenantId) {
      TenantSecurityLogger.warn('MERCHANT_SERVICE_NO_TENANT_CONTEXT', {
        message: 'Using regular Prisma client without tenant filtering - backward compatibility mode'
      });
      return prisma;
    }
    return TenantAwarePrisma.create(tenantId);
  }

  /**
   * Find merchant by ID with tenant isolation
   */
  async findById(id, include = {}, tenantId = null) {
    const db = this._getTenantPrisma(tenantId);
    
    TenantSecurityLogger.info('MERCHANT_FIND_BY_ID', {
      merchantId: id,
      tenantId,
      hasInclude: Object.keys(include).length > 0
    });

    return db.merchant.findUnique({
      where: { id },
      include
    });
  }

  /**
   * Find merchant by email with tenant isolation
   */
  async findByEmail(email, tenantId = null) {
    const db = this._getTenantPrisma(tenantId);
    
    TenantSecurityLogger.info('MERCHANT_FIND_BY_EMAIL', {
      email,
      tenantId
    });

    return db.merchant.findFirst({
      where: { email }
    });
  }

  /**
   * Create new merchant with tenant assignment
   */
  async create(data, tenantId = null) {
    const { password, ...merchantData } = data;
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Ensure tenant assignment for new merchants
    const createData = {
      ...merchantData,
      password: hashedPassword
    };

    if (tenantId) {
      createData.tenantId = tenantId;
    }

    TenantSecurityLogger.info('MERCHANT_CREATE', {
      email: merchantData.email,
      businessName: merchantData.businessName,
      tenantId,
      hasTenantAssignment: !!tenantId
    });

    const db = this._getTenantPrisma(tenantId);
    return db.merchant.create({
      data: createData
    });
  }

  /**
   * Update merchant with tenant validation
   */
  async update(id, data, tenantId = null) {
    const { password, ...updateData } = data;
    
    // If password is being updated, hash it
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }
    
    TenantSecurityLogger.info('MERCHANT_UPDATE', {
      merchantId: id,
      tenantId,
      hasPasswordUpdate: !!password,
      updateFields: Object.keys(updateData)
    });

    const db = this._getTenantPrisma(tenantId);
    
    // First verify merchant exists and belongs to tenant
    const existingMerchant = await db.merchant.findFirst({
      where: { id }
    });

    if (!existingMerchant) {
      TenantSecurityLogger.error('MERCHANT_UPDATE_NOT_FOUND', {
        merchantId: id,
        tenantId
      });
      throw new Error('Merchant not found or access denied');
    }

    return db.merchant.update({
      where: { id },
      data: updateData
    });
  }

  /**
   * Delete merchant with tenant validation
   */
  async delete(id, tenantId = null) {
    TenantSecurityLogger.warn('MERCHANT_DELETE', {
      merchantId: id,
      tenantId
    });

    const db = this._getTenantPrisma(tenantId);
    
    // First verify merchant exists and belongs to tenant
    const existingMerchant = await db.merchant.findFirst({
      where: { id }
    });

    if (!existingMerchant) {
      TenantSecurityLogger.error('MERCHANT_DELETE_NOT_FOUND', {
        merchantId: id,
        tenantId
      });
      throw new Error('Merchant not found or access denied');
    }

    return db.merchant.delete({
      where: { id }
    });
  }

  /**
   * Authenticate merchant with tenant context
   */
  async authenticate(email, password, tenantId = null) {
    TenantSecurityLogger.info('MERCHANT_AUTHENTICATION_ATTEMPT', {
      email,
      tenantId,
      timestamp: new Date()
    });

    const merchant = await this.findByEmail(email, tenantId);
    
    if (!merchant) {
      TenantSecurityLogger.warn('MERCHANT_AUTH_FAILED_NO_USER', {
        email,
        tenantId
      });
      return null;
    }
    
    const isMatch = await bcrypt.compare(password, merchant.password);
    
    if (!isMatch) {
      TenantSecurityLogger.warn('MERCHANT_AUTH_FAILED_WRONG_PASSWORD', {
        email,
        merchantId: merchant.id,
        tenantId
      });
      return null;
    }

    // Validate tenant assignment if in multi-tenant mode
    if (tenantId && merchant.tenantId && merchant.tenantId !== tenantId) {
      TenantSecurityLogger.critical('MERCHANT_AUTH_TENANT_MISMATCH', {
        email,
        merchantId: merchant.id,
        merchantTenantId: merchant.tenantId,
        requestedTenantId: tenantId
      });
      return null;
    }
    
    // Update last login
    await this.update(merchant.id, {
      lastLogin: new Date()
    }, tenantId);

    TenantSecurityLogger.info('MERCHANT_AUTH_SUCCESS', {
      merchantId: merchant.id,
      email,
      tenantId,
      merchantTenantId: merchant.tenantId
    });
    
    return merchant;
  }

  /**
   * Get merchant with full details with tenant isolation
   */
  async getFullDetails(id, tenantId = null) {
    const db = this._getTenantPrisma(tenantId);
    
    TenantSecurityLogger.info('MERCHANT_GET_FULL_DETAILS', {
      merchantId: id,
      tenantId
    });

    return db.merchant.findUnique({
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
   * Check if merchant can create more queues with tenant validation
   */
  async canCreateQueue(merchantId, tenantId = null) {
    const db = this._getTenantPrisma(tenantId);
    
    TenantSecurityLogger.info('MERCHANT_CHECK_QUEUE_CREATION_LIMIT', {
      merchantId,
      tenantId
    });

    const merchant = await db.merchant.findFirst({
      where: { id: merchantId },
      include: {
        queues: true,
        subscription: true
      }
    });

    if (!merchant) {
      TenantSecurityLogger.warn('MERCHANT_QUEUE_LIMIT_CHECK_NO_MERCHANT', {
        merchantId,
        tenantId
      });
      return false;
    }

    const existingQueues = merchant.queues.length;
    const maxQueues = merchant.subscription?.maxQueues || 1;

    TenantSecurityLogger.info('MERCHANT_QUEUE_LIMIT_RESULT', {
      merchantId,
      tenantId,
      existingQueues,
      maxQueues,
      canCreate: existingQueues < maxQueues
    });

    return existingQueues < maxQueues;
  }

  /**
   * Initialize default settings for merchant with tenant context
   */
  async initializeDefaults(merchantId, tenantId = null) {
    TenantSecurityLogger.info('MERCHANT_INITIALIZE_DEFAULTS', {
      merchantId,
      tenantId
    });

    // First verify merchant exists and belongs to tenant
    const merchant = await this.findById(merchantId, {}, tenantId);
    if (!merchant) {
      TenantSecurityLogger.error('MERCHANT_INITIALIZE_DEFAULTS_NO_MERCHANT', {
        merchantId,
        tenantId
      });
      throw new Error('Merchant not found or access denied');
    }

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

    TenantSecurityLogger.info('MERCHANT_DEFAULTS_INITIALIZED', {
      merchantId,
      tenantId
    });
  }

  /**
   * List merchants for a specific tenant
   */
  async listByTenant(tenantId, options = {}) {
    const { page = 1, limit = 10, search, includeInactive = false } = options;
    const skip = (page - 1) * limit;

    TenantSecurityLogger.info('MERCHANT_LIST_BY_TENANT', {
      tenantId,
      page,
      limit,
      hasSearch: !!search,
      includeInactive
    });

    const where = {
      tenantId,
      ...(search && {
        OR: [
          { businessName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(includeInactive ? {} : { isActive: true })
    };

    const [merchants, total] = await Promise.all([
      prisma.merchant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          queues: {
            where: { isActive: true },
            select: { id: true, name: true }
          },
          subscription: {
            select: { plan: true, maxQueues: true }
          }
        }
      }),
      prisma.merchant.count({ where })
    ]);

    return {
      merchants,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Transfer merchant to different tenant (admin operation)
   */
  async transferToTenant(merchantId, newTenantId, adminUserId) {
    TenantSecurityLogger.critical('MERCHANT_TENANT_TRANSFER_ATTEMPT', {
      merchantId,
      newTenantId,
      adminUserId
    });

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        queues: { include: { entries: true } }
      }
    });

    if (!merchant) {
      throw new Error('Merchant not found');
    }

    // Verify new tenant exists
    const newTenant = await prisma.tenant.findUnique({
      where: { id: newTenantId, isActive: true }
    });

    if (!newTenant) {
      throw new Error('Target tenant not found or inactive');
    }

    // Update merchant tenant assignment
    const updatedMerchant = await prisma.merchant.update({
      where: { id: merchantId },
      data: { 
        tenantId: newTenantId,
        updatedAt: new Date()
      }
    });

    TenantSecurityLogger.critical('MERCHANT_TENANT_TRANSFER_COMPLETED', {
      merchantId,
      oldTenantId: merchant.tenantId,
      newTenantId,
      adminUserId,
      queueCount: merchant.queues.length,
      totalQueueEntries: merchant.queues.reduce((sum, q) => sum + q.entries.length, 0)
    });

    return updatedMerchant;
  }
}

module.exports = new MerchantService();