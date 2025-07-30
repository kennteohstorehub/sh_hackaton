const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

class QueueService {
  /**
   * Find queue by ID with optional relations
   */
  async findById(id, include = {}) {
    return prisma.queue.findUnique({
      where: { id },
      include
    });
  }

  /**
   * Find queue by merchant ID and queue ID
   */
  async findByMerchantAndId(merchantId, queueId) {
    return prisma.queue.findFirst({
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
   * Get all queues for a merchant
   */
  async findByMerchant(merchantId, includeEntries = false) {
    return prisma.queue.findMany({
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
   * Create a new queue
   */
  async create(merchantId, data) {
    return prisma.queue.create({
      data: {
        merchantId,
        ...data
      }
    });
  }

  /**
   * Update queue
   */
  async update(id, data) {
    return prisma.queue.update({
      where: { id },
      data
    });
  }

  /**
   * Delete queue
   */
  async delete(id) {
    return prisma.queue.delete({
      where: { id }
    });
  }

  /**
   * Get queue with waiting entries
   */
  async getQueueWithEntries(queueId) {
    return prisma.queue.findUnique({
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
   * Call next customer in queue
   */
  async callNext(queueId) {
    // Get next waiting customer
    const nextCustomer = await prisma.queueEntry.findFirst({
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
    const updatedCustomer = await prisma.queueEntry.update({
      where: { id: nextCustomer.id },
      data: {
        status: 'called',
        calledAt: new Date(),
        verificationCode
      }
    });

    return updatedCustomer;
  }

  /**
   * Call specific customer
   */
  async callSpecific(queueId, customerId) {
    const customer = await prisma.queueEntry.findFirst({
      where: {
        id: customerId,
        queueId,
        status: 'waiting'
      }
    });

    if (!customer) {
      return null;
    }

    // Generate verification code if not present
    const verificationCode = customer.verificationCode || this.generateVerificationCode();

    // Update customer status
    const updatedCustomer = await prisma.queueEntry.update({
      where: { id: customerId },
      data: {
        status: 'called',
        calledAt: new Date(),
        verificationCode
      }
    });

    return updatedCustomer;
  }

  /**
   * Add customer to queue
   */
  async addCustomer(queueId, customerData) {
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

      const position = (queueStats._max.position || 0) + 1;
      const queue = await this.findById(queueId);
      const estimatedWaitTime = position * (queue?.averageServiceTime || 15);

      // Create entry within the same transaction
      return tx.queueEntry.create({
        data: {
          queueId,
          position,
          estimatedWaitTime,
          status: 'waiting',
          ...customerData
        }
      });
    });
  }

  /**
   * Remove customer from queue
   */
  async removeCustomer(customerId, status = 'completed') {
    return prisma.queueEntry.update({
      where: { id: customerId },
      data: {
        status,
        completedAt: new Date()
      }
    });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueId) {
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

    return {
      waitingCount,
      servedToday,
      averageWaitTime: avgWaitTime[0]?.avg_wait || 0
    };
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
   * Get active queues with recent entries (for dashboard)
   */
  async findActiveWithRecentEntries(merchantId, sinceDate) {
    return prisma.queue.findMany({
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
}

module.exports = new QueueService();