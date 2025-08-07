const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const renderApiService = require('./renderApiService');
const emailService = require('./emailService');

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
            fullName: true,
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
        priority: plan === 'enterprise' ? 'enterprise' : plan === 'premium' ? 'high' : 'standard'
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
      slug,
      adminEmail,
      adminName,
      adminPassword,
      plan = 'free',
      billingCycle = 'monthly',
      maxMerchants = 1,
      maxQueuesPerMerchant = 1,
      maxCustomersPerQueue = 50,
      aiFeatures = false,
      analytics = false,
      customBranding = false,
      businessType = 'restaurant'
    } = data;

    // Check if domain/slug is already taken
    if (domain || slug) {
      const existingTenant = await prisma.tenant.findFirst({
        where: {
          OR: [
            domain ? { domain } : {},
            slug ? { slug } : {}
          ].filter(Boolean)
        }
      });
      if (existingTenant) {
        throw new Error('Domain or subdomain is already taken');
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name,
          domain,
          slug: slug || this.generateSlug(name),
          isActive: true
        }
      });

      // Create subscription
      const subscription = await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          status: 'active',
          priority: plan === 'enterprise' ? 'enterprise' : plan === 'premium' ? 'high' : 'standard',
          billingCycle,
          maxMerchants,
          maxQueuesPerMerchant,
          maxUsersPerTenant: maxCustomersPerQueue, // Map to available field
          aiFeatures,
          analytics,
          customBranding,
          startDate: new Date()
        }
      });

      // Create admin user if provided
      let adminUser = null;
      if (adminEmail && adminPassword) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        adminUser = await tx.tenantUser.create({
          data: {
            tenantId: tenant.id,
            email: adminEmail,
            password: hashedPassword,
            fullName: adminName || 'Admin',
            role: 'admin',
            isActive: true,
            emailVerified: false
          }
        });

        // Create first merchant account
        const merchant = await tx.merchant.create({
          data: {
            tenantId: tenant.id,
            businessName: name,
            email: adminEmail,
            password: hashedPassword,
            phone: data.phone || '',
            businessType,
            timezone: data.timezone || 'Asia/Kuala_Lumpur',
            isActive: true
          }
        });

        // Create default merchant settings
        await tx.merchantSettings.create({
          data: {
            merchantId: merchant.id
          }
        });

        // Create default queue
        await tx.queue.create({
          data: {
            merchantId: merchant.id,
            name: 'Main Queue',
            description: 'Default queue for walk-in customers',
            isActive: true
          }
        });
      }

      logger.info(`New tenant created: ${tenant.name} (${tenant.id})`);
      
      return { tenant, subscription, adminUser };
    });

    // Provision subdomain on Render (outside transaction)
    if (result.tenant.slug && process.env.NODE_ENV === 'production') {
      try {
        await renderApiService.provisionSubdomain(result.tenant);
        logger.info(`Subdomain provisioned: ${result.tenant.slug}.storehubqms.com`);
      } catch (error) {
        logger.error('Failed to provision subdomain:', error);
        // Don't fail tenant creation if subdomain provisioning fails
      }
    } else if (result.tenant.slug) {
      logger.info(`Skipping subdomain provisioning in development: ${result.tenant.slug}.storehubqms.com`);
    }

    // Send welcome email
    if (result.adminUser) {
      try {
        await this.sendWelcomeEmail(result.tenant, result.adminUser);
      } catch (error) {
        logger.error('Failed to send welcome email:', error);
      }
    }

    // Log audit event
    await this.logAuditEvent({
      action: 'tenant.created',
      resourceType: 'tenant',
      resourceId: result.tenant.id,
      details: { name, slug: result.tenant.slug, plan }
    });

    return result;
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
   * Get tenant-focused system statistics for BackOffice dashboard
   */
  async getSystemStats() {
    const [
      totalTenants,
      activeTenants,
      totalMerchants,
      activeMerchants,
      totalQueues,
      activeQueues,
      totalCustomersToday,
      totalCustomersThisMonth,
      newTenantsThisMonth
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
      }),
      prisma.queueEntry.count({
        where: {
          joinedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      prisma.tenant.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      })
    ]);

    // Calculate system health
    const systemHealth = await this.calculateSystemHealth();

    return {
      tenants: { total: totalTenants, active: activeTenants },
      merchants: { total: totalMerchants, active: activeMerchants },
      queues: { total: totalQueues, active: activeQueues },
      customersToday: totalCustomersToday,
      customersThisMonth: totalCustomersThisMonth,
      newTenantsThisMonth: newTenantsThisMonth,
      systemHealth
    };
  }

  /**
   * Calculate system health percentage
   */
  async calculateSystemHealth() {
    let healthScore = 100;
    const issues = [];

    try {
      // Check database connection
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      healthScore -= 50;
      issues.push('Database connection issue');
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    if (heapUsedPercent > 90) {
      healthScore -= 20;
      issues.push('High memory usage');
    } else if (heapUsedPercent > 80) {
      healthScore -= 10;
      issues.push('Elevated memory usage');
    }

    // Check error rate (simplified - in production, this would check logs)
    const recentErrors = await prisma.backOfficeAuditLog.count({
      where: {
        action: { startsWith: 'error.' },
        timestamp: { gte: new Date(Date.now() - 3600000) } // Last hour
      }
    });
    
    if (recentErrors > 100) {
      healthScore -= 30;
      issues.push('High error rate');
    } else if (recentErrors > 50) {
      healthScore -= 15;
      issues.push('Elevated error rate');
    }

    // Check queue processing (are queues being served?)
    const stuckQueues = await prisma.queueEntry.count({
      where: {
        status: 'waiting',
        joinedAt: { lt: new Date(Date.now() - 7200000) } // Waiting > 2 hours
      }
    });

    if (stuckQueues > 10) {
      healthScore -= 20;
      issues.push('Queue processing delays');
    }

    return {
      score: Math.max(0, healthScore),
      status: healthScore >= 90 ? 'healthy' : healthScore >= 70 ? 'degraded' : 'unhealthy',
      issues
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
          { domain: { contains: query, mode: 'insensitive' } },
          { slug: { contains: query, mode: 'insensitive' } }
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

  /**
   * Generate slug from name
   */
  generateSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  /**
   * Send welcome email to new tenant admin
   */
  async sendWelcomeEmail(tenant, adminUser) {
    const loginUrl = `https://${tenant.slug}.storehubqms.com/login`;
    
    await emailService.sendEmail({
      to: adminUser.email,
      subject: `Welcome to StoreHub Queue Management - ${tenant.name}`,
      html: `
        <h2>Welcome to StoreHub Queue Management!</h2>
        <p>Hi ${adminUser.fullName},</p>
        <p>Your organization's queue management system is ready!</p>
        <p><strong>Your subdomain:</strong> ${tenant.slug}.storehubqms.com</p>
        <p><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
        <p><strong>Username:</strong> ${adminUser.email}</p>
        <br>
        <p>Next steps:</p>
        <ol>
          <li>Log in to your dashboard</li>
          <li>Configure your business settings</li>
          <li>Create queues for your services</li>
          <li>Invite your team members</li>
        </ol>
        <br>
        <p>Need help? Contact our support team at support@storehubqms.com</p>
        <br>
        <p>Best regards,<br>StoreHub QMS Team</p>
      `
    });
  }

  /**
   * Log audit event
   */
  async logAuditEvent(data) {
    try {
      await prisma.backOfficeAuditLog.create({
        data: {
          backOfficeUserId: data.backOfficeUserId || null,
          tenantId: data.tenantId || null,
          action: data.action,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          details: data.details || null,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null
        }
      });
    } catch (error) {
      logger.error('Failed to log audit event:', error);
    }
  }

  /**
   * Get subscription limits for a plan
   */
  getSubscriptionLimits(plan) {
    const limits = {
      free: {
        maxMerchants: 1,
        maxQueues: 1,
        maxUsers: 3,
        maxCustomersPerDay: 50
      },
      basic: {
        maxMerchants: 1,
        maxQueues: 3,
        maxUsers: 5,
        maxCustomersPerDay: 200
      },
      premium: {
        maxMerchants: 5,
        maxQueues: 10,
        maxUsers: 20,
        maxCustomersPerDay: 1000
      },
      enterprise: {
        maxMerchants: 999,
        maxQueues: 999,
        maxUsers: 999,
        maxCustomersPerDay: 99999
      }
    };
    
    return limits[plan] || limits.free;
  }
}

module.exports = new TenantService();