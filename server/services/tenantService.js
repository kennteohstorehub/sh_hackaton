const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

class TenantService {
  /**
   * Find tenant by ID with optional includes
   */
  async findById(id, include = {}) {
    return prisma.tenant.findUnique({
      where: { id },
      include: {
        subscription: true,
        merchants: {
          select: {
            id: true,
            businessName: true,
            email: true,
            isActive: true,
            createdAt: true
          }
        },
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            merchants: true,
            users: true
          }
        },
        ...include
      }
    });
  }

  /**
   * Find all tenants with pagination and filtering
   */
  async findAll(options = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = 'all',
      plan = 'all'
    } = options;

    const where = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (status !== 'all') {
      where.isActive = status === 'active';
    }

    if (plan !== 'all') {
      where.subscription = {
        plan: plan
      };
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: {
          subscription: true,
          _count: {
            select: {
              merchants: true,
              users: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.tenant.count({ where })
    ]);

    return {
      tenants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Create new tenant with subscription
   */
  async create(data) {
    const {
      name,
      domain,
      plan = 'free',
      billingCycle = 'monthly',
      maxMerchants = 1,
      maxQueuesPerMerchant = 1,
      maxCustomersPerQueue = 50,
      aiFeatures = false,
      analytics = false,
      customBranding = false
    } = data;

    // Check if domain is already taken
    if (domain) {
      const existingTenant = await prisma.tenant.findUnique({
        where: { domain }
      });
      if (existingTenant) {
        throw new Error('Domain is already taken');
      }
    }

    return prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name,
          domain,
          isActive: true
        }
      });

      // Create subscription
      const subscription = await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          plan,
          billingCycle,
          maxMerchants,
          maxQueuesPerMerchant,
          maxCustomersPerQueue,
          aiFeatures,
          analytics,
          customBranding,
          status: 'active',
          startDate: new Date(),
          nextBillingDate: this.calculateNextBillingDate(billingCycle)
        }
      });

      logger.info(`New tenant created: ${tenant.name} (${tenant.id})`);
      
      return { ...tenant, subscription };
    });
  }

  /**
   * Update tenant
   */
  async update(id, data) {
    const {
      name,
      domain,
      isActive,
      subscription: subscriptionData,
      ...tenantData
    } = data;

    // Check if domain is already taken by another tenant
    if (domain) {
      const existingTenant = await prisma.tenant.findFirst({
        where: {
          domain,
          NOT: { id }
        }
      });
      if (existingTenant) {
        throw new Error('Domain is already taken by another tenant');
      }
    }

    return prisma.$transaction(async (tx) => {
      // Update tenant
      const tenant = await tx.tenant.update({
        where: { id },
        data: {
          name,
          domain,
          isActive,
          ...tenantData
        }
      });

      // Update subscription if provided
      if (subscriptionData) {
        await tx.tenantSubscription.upsert({
          where: { tenantId: id },
          update: {
            ...subscriptionData,
            nextBillingDate: subscriptionData.billingCycle ? 
              this.calculateNextBillingDate(subscriptionData.billingCycle) : 
              undefined
          },
          create: {
            tenantId: id,
            ...subscriptionData,
            nextBillingDate: this.calculateNextBillingDate(subscriptionData.billingCycle || 'monthly')
          }
        });
      }

      return tenant;
    });
  }

  /**
   * Delete tenant (soft delete by deactivating)
   */
  async delete(id) {
    // Instead of hard delete, deactivate the tenant
    return this.update(id, { isActive: false });
  }

  /**
   * Hard delete tenant (use with caution)
   */
  async hardDelete(id) {
    return prisma.$transaction(async (tx) => {
      // Delete in order due to foreign key constraints
      await tx.tenantSubscription.deleteMany({ where: { tenantId: id } });
      await tx.tenantUser.deleteMany({ where: { tenantId: id } });
      
      // Update merchants to remove tenant association
      await tx.merchant.updateMany({
        where: { tenantId: id },
        data: { tenantId: null }
      });

      return tx.tenant.delete({ where: { id } });
    });
  }

  /**
   * Get tenant usage statistics
   */
  async getUsageStats(tenantId) {
    const [
      merchantCount,
      queueCount,
      activeQueueCount,
      totalCustomersToday,
      totalCustomersThisMonth
    ] = await Promise.all([
      // Merchant count
      prisma.merchant.count({
        where: { tenantId, isActive: true }
      }),
      
      // Queue count
      prisma.queue.count({
        where: { 
          merchant: { tenantId },
          isActive: true
        }
      }),

      // Active queues with customers
      prisma.queue.count({
        where: {
          merchant: { tenantId },
          isActive: true,
          entries: {
            some: {
              status: 'waiting'
            }
          }
        }
      }),

      // Customers today
      prisma.queueEntry.count({
        where: {
          queue: {
            merchant: { tenantId }
          },
          joinedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),

      // Customers this month
      prisma.queueEntry.count({
        where: {
          queue: {
            merchant: { tenantId }
          },
          joinedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      })
    ]);

    return {
      merchants: merchantCount,
      queues: queueCount,
      activeQueues: activeQueueCount,
      customersToday: totalCustomersToday,
      customersThisMonth: totalCustomersThisMonth
    };
  }

  /**
   * Get system-wide statistics
   */
  async getSystemStats() {
    const [
      totalTenants,
      activeTenants,
      totalMerchants,
      activeMerchants,
      totalQueues,
      activeQueues,
      totalCustomersToday
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { isActive: true } }),
      prisma.merchant.count(),
      prisma.merchant.count({ where: { isActive: true } }),
      prisma.queue.count(),
      prisma.queue.count({ where: { isActive: true } }),
      prisma.queueEntry.count({
        where: {
          joinedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ]);

    return {
      tenants: { total: totalTenants, active: activeTenants },
      merchants: { total: totalMerchants, active: activeMerchants },
      queues: { total: totalQueues, active: activeQueues },
      customersToday: totalCustomersToday
    };
  }

  /**
   * Check if tenant is within subscription limits
   */
  async checkSubscriptionLimits(tenantId) {
    const tenant = await this.findById(tenantId);
    if (!tenant || !tenant.subscription) {
      return { withinLimits: false, errors: ['No subscription found'] };
    }

    const usage = await this.getUsageStats(tenantId);
    const limits = tenant.subscription;
    const errors = [];

    if (usage.merchants > limits.maxMerchants) {
      errors.push(`Merchant limit exceeded: ${usage.merchants}/${limits.maxMerchants}`);
    }

    // Check queue limits per merchant
    const merchantsWithQueues = await prisma.merchant.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { queues: true }
        }
      }
    });

    for (const merchant of merchantsWithQueues) {
      if (merchant._count.queues > limits.maxQueuesPerMerchant) {
        errors.push(`Queue limit exceeded for ${merchant.businessName}: ${merchant._count.queues}/${limits.maxQueuesPerMerchant}`);
      }
    }

    return {
      withinLimits: errors.length === 0,
      errors,
      usage,
      limits
    };
  }

  /**
   * Calculate next billing date
   */
  calculateNextBillingDate(billingCycle) {
    const now = new Date();
    const nextBilling = new Date(now);

    if (billingCycle === 'monthly') {
      nextBilling.setMonth(nextBilling.getMonth() + 1);
    } else if (billingCycle === 'yearly') {
      nextBilling.setFullYear(nextBilling.getFullYear() + 1);
    }

    return nextBilling;
  }

  /**
   * Bulk operations
   */
  async bulkUpdate(tenantIds, updateData) {
    return prisma.tenant.updateMany({
      where: {
        id: { in: tenantIds }
      },
      data: updateData
    });
  }

  /**
   * Search tenants by name or domain
   */
  async search(query, limit = 10) {
    return prisma.tenant.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { domain: { contains: query, mode: 'insensitive' } }
        ],
        isActive: true
      },
      include: {
        subscription: true,
        _count: {
          select: {
            merchants: true,
            users: true
          }
        }
      },
      take: limit,
      orderBy: { name: 'asc' }
    });
  }
}

module.exports = new TenantService();