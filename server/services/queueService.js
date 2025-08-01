const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { TenantAwarePrisma, TenantSecurityLogger } = require('../middleware/tenant-isolation');

class QueueService {
  /**
   * Get tenant-aware Prisma client
   */
  _getTenantPrisma(tenantId) {
    if (!tenantId) {
      TenantSecurityLogger.warn('QUEUE_SERVICE_NO_TENANT_CONTEXT', {
        message: 'Using regular Prisma client without tenant filtering - backward compatibility mode'
      });
      return prisma;
    }
    return TenantAwarePrisma.create(tenantId);
  }

  /**
   * Find queue by ID with tenant isolation
   */
  async findById(id, include = {}, tenantId = null) {
    const db = this._getTenantPrisma(tenantId);
    
    TenantSecurityLogger.info('QUEUE_FIND_BY_ID', {
      queueId: id,
      tenantId,
      hasInclude: Object.keys(include).length > 0
    });

    return db.queue.findUnique({
      where: { id },
      include
    });
  }

  /**
   * Find queue by merchant ID and queue ID with tenant validation
   */
  async findByMerchantAndId(merchantId, queueId, tenantId = null) {
    const db = this._getTenantPrisma(tenantId);
    
    TenantSecurityLogger.info('QUEUE_FIND_BY_MERCHANT_AND_ID', {
      merchantId,
      queueId,
      tenantId
    });

    return db.queue.findFirst({
      where: {
        id: queueId,
        merchantId
      },
      include: {
        merchant: true
      }
    });
  }

  /**
   * Get all queues for a merchant with tenant isolation
   */
  async findByMerchant(merchantId, includeEntries = false, tenantId = null) {
    const db = this._getTenantPrisma(tenantId);
    
    TenantSecurityLogger.info('QUEUE_FIND_BY_MERCHANT', {
      merchantId,
      tenantId,
      includeEntries
    });

    return db.queue.findMany({
      where: { merchantId },
      include: {
        entries: includeEntries ? {
          where: {
            status: 'waiting'
          },
          orderBy: {
            position: 'asc'
          }
        } : false,
        analytics: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Create a new queue with tenant validation
   */
  async create(merchantId, data, tenantId = null) {
    TenantSecurityLogger.info('QUEUE_CREATE', {
      merchantId,
      tenantId,
      queueName: data.name
    });

    // First validate merchant belongs to tenant
    const merchantService = require('./merchantService');
    const merchant = await merchantService.findById(merchantId, {}, tenantId);
    
    if (!merchant) {
      TenantSecurityLogger.error('QUEUE_CREATE_INVALID_MERCHANT', {
        merchantId,
        tenantId
      });
      throw new Error('Merchant not found or access denied');
    }

    return prisma.queue.create({
      data: {
        merchantId,
        ...data
      }
    });
  }

  /**
   * Update queue with tenant validation
   */
  async update(id, data, tenantId = null) {
    const db = this._getTenantPrisma(tenantId);
    
    TenantSecurityLogger.info('QUEUE_UPDATE', {
      queueId: id,
      tenantId,
      updateFields: Object.keys(data)
    });

    // First verify queue exists and belongs to tenant
    const existingQueue = await db.queue.findFirst({
      where: { id }
    });

    if (!existingQueue) {
      TenantSecurityLogger.error('QUEUE_UPDATE_NOT_FOUND', {
        queueId: id,
        tenantId
      });
      throw new Error('Queue not found or access denied');
    }

    return db.queue.update({
      where: { id },
      data
    });
  }

  /**
   * Delete queue with tenant validation
   */
  async delete(id, tenantId = null) {
    const db = this._getTenantPrisma(tenantId);
    
    TenantSecurityLogger.warn('QUEUE_DELETE', {
      queueId: id,
      tenantId
    });

    // First verify queue exists and belongs to tenant
    const existingQueue = await db.queue.findFirst({
      where: { id },
      include: {
        entries: { select: { id: true } }
      }
    });

    if (!existingQueue) {
      TenantSecurityLogger.error('QUEUE_DELETE_NOT_FOUND', {
        queueId: id,
        tenantId
      });
      throw new Error('Queue not found or access denied');
    }

    TenantSecurityLogger.warn('QUEUE_DELETE_EXECUTED', {
      queueId: id,
      tenantId,
      entryCount: existingQueue.entries.length
    });

    return db.queue.delete({
      where: { id }
    });
  }

  /**
   * Get queue with waiting entries with tenant isolation
   */
  async getQueueWithEntries(queueId, tenantId = null) {
    const db = this._getTenantPrisma(tenantId);
    
    TenantSecurityLogger.info('QUEUE_GET_WITH_ENTRIES', {
      queueId,
      tenantId
    });

    return db.queue.findUnique({
      where: { id: queueId },
      include: {
        entries: {
          where: {
            status: 'waiting'
          },
          orderBy: {
            position: 'asc'
          }
        },
        merchant: true
      }
    });
  }

  /**
   * Call next customer in queue with tenant validation
   */
  async callNext(queueId, tenantId = null) {
    const db = this._getTenantPrisma(tenantId);
    
    TenantSecurityLogger.info('QUEUE_CALL_NEXT', {
      queueId,
      tenantId
    });

    // First validate queue belongs to tenant
    const queue = await db.queue.findFirst({
      where: { id: queueId }
    });

    if (!queue) {
      TenantSecurityLogger.error('QUEUE_CALL_NEXT_INVALID_QUEUE', {
        queueId,
        tenantId
      });
      throw new Error('Queue not found or access denied');
    }

    // Get next waiting customer using tenant-aware client
    const nextCustomer = await db.queueEntry.findFirst({
      where: {
        queueId,
        status: 'waiting'
      },
      orderBy: {
        position: 'asc'
      }
    });

    if (!nextCustomer) {
      return null;
    }

    // Generate verification code
    const verificationCode = this.generateVerificationCode();

    // Update customer status
    const updatedCustomer = await db.queueEntry.update({
      where: { id: nextCustomer.id },
      data: {
        status: 'called',
        calledAt: new Date(),
        verificationCode
      }
    });

    TenantSecurityLogger.info('QUEUE_CUSTOMER_CALLED', {
      queueId,
      customerId: nextCustomer.id,
      customerName: nextCustomer.name,
      tenantId,
      verificationCode
    });

    return updatedCustomer;
  }

  /**
   * Call specific customer with tenant validation
   */
  async callSpecific(queueId, customerId, tenantId = null) {
    const db = this._getTenantPrisma(tenantId);
    
    TenantSecurityLogger.info('QUEUE_CALL_SPECIFIC', {
      queueId,
      customerId,
      tenantId
    });

    // First validate queue belongs to tenant
    const queue = await db.queue.findFirst({
      where: { id: queueId }
    });

    if (!queue) {
      TenantSecurityLogger.error('QUEUE_CALL_SPECIFIC_INVALID_QUEUE', {
        queueId,
        tenantId
      });
      throw new Error('Queue not found or access denied');
    }

    const customer = await db.queueEntry.findFirst({
      where: {
        id: customerId,
        queueId,
        status: 'waiting'
      }
    });

    if (!customer) {
      TenantSecurityLogger.warn('QUEUE_CALL_SPECIFIC_CUSTOMER_NOT_FOUND', {
        queueId,
        customerId,
        tenantId
      });
      return null;
    }

    // Generate verification code if not present
    const verificationCode = customer.verificationCode || this.generateVerificationCode();

    // Update customer status
    const updatedCustomer = await db.queueEntry.update({
      where: { id: customerId },
      data: {
        status: 'called',
        calledAt: new Date(),
        verificationCode
      }
    });

    TenantSecurityLogger.info('QUEUE_SPECIFIC_CUSTOMER_CALLED', {
      queueId,
      customerId,
      customerName: customer.name,
      tenantId,
      verificationCode
    });

    return updatedCustomer;
  }

  /**
   * Add customer to queue with tenant validation
   */
  async addCustomer(queueId, customerData, restorePosition = null, tenantId = null) {
    TenantSecurityLogger.info('QUEUE_ADD_CUSTOMER', {
      queueId,
      customerName: customerData.name,
      customerPhone: customerData.phone,
      tenantId,
      restorePosition
    });

    // First validate queue belongs to tenant
    const queue = await this.findById(queueId, {}, tenantId);
    if (!queue) {
      TenantSecurityLogger.error('QUEUE_ADD_CUSTOMER_INVALID_QUEUE', {
        queueId,
        tenantId
      });
      throw new Error('Queue not found or access denied');
    }

    // Use a transaction to prevent race conditions
    return prisma.$transaction(async (tx) => {
      // Get current queue stats with transaction
      const queueStats = await tx.queueEntry.aggregate({
        where: {
          queueId,
          status: 'waiting'
        },
        _max: {
          position: true
        },
        _count: {
          id: true
        }
      });

      // Use restored position if provided (grace period), otherwise assign next position
      const position = restorePosition || (queueStats._max.position || 0) + 1;
      const estimatedWaitTime = position * (queue?.averageServiceTime || 15);

      // Create entry within the same transaction
      const newEntry = await tx.queueEntry.create({
        data: {
          queueId,
          position,
          estimatedWaitTime,
          status: 'waiting',
          ...customerData
        }
      });

      TenantSecurityLogger.info('QUEUE_CUSTOMER_ADDED', {
        queueId,
        customerId: newEntry.id,
        customerName: customerData.name,
        position,
        estimatedWaitTime,
        tenantId
      });

      return newEntry;
    });
  }

  /**
   * Remove customer from queue with tenant validation
   */
  async removeCustomer(customerId, status = 'completed', tenantId = null) {
    const db = this._getTenantPrisma(tenantId);
    
    TenantSecurityLogger.info('QUEUE_REMOVE_CUSTOMER', {
      customerId,
      status,
      tenantId
    });

    // First validate customer exists in a queue that belongs to tenant
    const customer = await db.queueEntry.findFirst({
      where: { id: customerId },
      include: {
        queue: {
          include: {
            merchant: true
          }
        }
      }
    });

    if (!customer) {
      TenantSecurityLogger.error('QUEUE_REMOVE_CUSTOMER_NOT_FOUND', {
        customerId,
        tenantId
      });
      throw new Error('Customer not found or access denied');
    }

    const updatedCustomer = await db.queueEntry.update({
      where: { id: customerId },
      data: {
        status,
        completedAt: new Date()
      }
    });

    TenantSecurityLogger.info('QUEUE_CUSTOMER_REMOVED', {
      customerId,
      customerName: customer.name,
      queueId: customer.queueId,
      status,
      tenantId
    });

    return updatedCustomer;
  }

  /**
   * Get queue statistics with tenant validation
   */
  async getQueueStats(queueId, tenantId = null) {
    TenantSecurityLogger.info('QUEUE_GET_STATS', {
      queueId,
      tenantId
    });

    // First validate queue belongs to tenant
    const queue = await this.findById(queueId, {}, tenantId);
    if (!queue) {
      TenantSecurityLogger.error('QUEUE_STATS_INVALID_QUEUE', {
        queueId,
        tenantId
      });
      throw new Error('Queue not found or access denied');
    }

    const [waitingCount, servedToday, avgWaitTime] = await Promise.all([
      // Count waiting customers
      prisma.queueEntry.count({
        where: {
          queueId,
          status: 'waiting'
        }
      }),
      // Count served today
      prisma.queueEntry.count({
        where: {
          queueId,
          status: 'completed',
          completedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      // Calculate average wait time
      prisma.$queryRaw`
        SELECT AVG(EXTRACT(EPOCH FROM ("completedAt" - "joinedAt"))/60) as avg_wait
        FROM "QueueEntry"
        WHERE "queueId" = ${queueId}
        AND status = 'completed'
        AND "completedAt" >= CURRENT_DATE
      `
    ]);

    const stats = {
      waitingCount,
      servedToday,
      averageWaitTime: avgWaitTime[0]?.avg_wait || 0
    };

    TenantSecurityLogger.info('QUEUE_STATS_RETRIEVED', {
      queueId,
      tenantId,
      ...stats
    });

    return stats;
  }

  /**
   * Generate verification code
   */
  generateVerificationCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Get active queues with recent entries (for dashboard) with tenant isolation
   */
  async findActiveWithRecentEntries(merchantId, sinceDate, tenantId = null) {
    const db = this._getTenantPrisma(tenantId);
    
    TenantSecurityLogger.info('QUEUE_FIND_ACTIVE_WITH_RECENT_ENTRIES', {
      merchantId,
      sinceDate,
      tenantId
    });

    return db.queue.findMany({
      where: {
        merchantId,
        isActive: true
      },
      include: {
        entries: {
          where: {
            joinedAt: {
              gte: sinceDate
            }
          },
          orderBy: {
            position: 'asc'
          }
        }
      }
    });
  }

  /**
   * Get tenant-wide queue statistics (admin feature)
   */
  async getTenantQueueStats(tenantId, dateRange = {}) {
    TenantSecurityLogger.info('QUEUE_GET_TENANT_STATS', {
      tenantId,
      dateRange
    });

    const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date() } = dateRange;

    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT q.id) as total_queues,
        COUNT(DISTINCT q."merchantId") as total_merchants,
        COUNT(qe.id) as total_entries,
        COUNT(CASE WHEN qe.status = 'waiting' THEN 1 END) as waiting_customers,
        COUNT(CASE WHEN qe.status = 'completed' THEN 1 END) as completed_customers,
        AVG(CASE WHEN qe.status = 'completed' THEN EXTRACT(EPOCH FROM (qe."completedAt" - qe."joinedAt"))/60 END) as avg_wait_time
      FROM "Queue" q
      LEFT JOIN "QueueEntry" qe ON q.id = qe."queueId"
      LEFT JOIN "Merchant" m ON q."merchantId" = m.id
      WHERE m."tenantId" = ${tenantId}
      AND qe."joinedAt" >= ${startDate}
      AND qe."joinedAt" <= ${endDate}
    `;

    TenantSecurityLogger.info('QUEUE_TENANT_STATS_RETRIEVED', {
      tenantId,
      stats: stats[0]
    });

    return stats[0];
  }

  /**
   * Bulk operations for queue entries (admin feature)
   */
  async bulkUpdateQueueEntries(queueId, entryIds, updateData, tenantId = null) {
    const db = this._getTenantPrisma(tenantId);
    
    TenantSecurityLogger.warn('QUEUE_BULK_UPDATE_ENTRIES', {
      queueId,
      entryIds,
      updateData: Object.keys(updateData),
      entryCount: entryIds.length,
      tenantId
    });

    // First validate queue belongs to tenant
    const queue = await db.queue.findFirst({
      where: { id: queueId }
    });

    if (!queue) {
      TenantSecurityLogger.error('QUEUE_BULK_UPDATE_INVALID_QUEUE', {
        queueId,
        tenantId
      });
      throw new Error('Queue not found or access denied');
    }

    // Perform bulk update
    const result = await db.queueEntry.updateMany({
      where: {
        id: { in: entryIds },
        queueId: queueId
      },
      data: updateData
    });

    TenantSecurityLogger.warn('QUEUE_BULK_UPDATE_COMPLETED', {
      queueId,
      tenantId,
      updatedCount: result.count,
      requestedCount: entryIds.length
    });

    return result;
  }

  /**
   * Archive old queue entries (maintenance operation)
   */
  async archiveOldEntries(tenantId, olderThanDays = 90) {
    TenantSecurityLogger.info('QUEUE_ARCHIVE_OLD_ENTRIES', {
      tenantId,
      olderThanDays
    });

    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await prisma.$queryRaw`
      UPDATE "QueueEntry" 
      SET status = 'archived', "updatedAt" = NOW()
      FROM "Queue" q, "Merchant" m
      WHERE "QueueEntry"."queueId" = q.id
      AND q."merchantId" = m.id
      AND m."tenantId" = ${tenantId}
      AND "QueueEntry"."completedAt" IS NOT NULL
      AND "QueueEntry"."completedAt" < ${cutoffDate}
      AND "QueueEntry".status = 'completed'
    `;

    TenantSecurityLogger.info('QUEUE_ARCHIVE_COMPLETED', {
      tenantId,
      olderThanDays,
      cutoffDate,
      archivedCount: result.count || 0
    });

    return result;
  }
}

module.exports = new QueueService();