const prisma = require('../utils/prisma');

// Mongoose-style wrapper for Prisma Queue model
class Queue {
  constructor(data) {
    Object.assign(this, data);
  }

  static async find(filter = {}) {
    const where = {};
    if (filter.merchantId) where.merchantId = filter.merchantId;
    if (filter._id) where.id = filter._id;
    
    const queues = await prisma.queue.findMany({
      where,
      include: {
        entries: {
          orderBy: { position: 'asc' }
        }
      }
    });
    
    return queues.map(q => new Queue(q));
  }
  
  // Alias for Prisma-style usage
  static findMany = Queue.find;

  static async findById(id) {
    const queue = await prisma.queue.findUnique({
      where: { id },
      include: {
        entries: {
          orderBy: { position: 'asc' }
        }
      }
    });
    return queue ? new Queue(queue) : null;
  }

  static async findOne(filter = {}) {
    const where = {};
    if (filter.merchantId) where.merchantId = filter.merchantId;
    if (filter._id) where.id = filter._id;
    
    const queue = await prisma.queue.findFirst({
      where,
      include: {
        entries: {
          orderBy: { position: 'asc' }
        }
      }
    });
    
    return queue ? new Queue(queue) : null;
  }

  static async findByIdAndDelete(id) {
    return await prisma.queue.delete({
      where: { id }
    });
  }

  static async countDocuments(filter = {}) {
    const where = {};
    if (filter.merchantId) where.merchantId = filter.merchantId;
    
    return await prisma.queue.count({ where });
  }

  async save() {
    if (this.id || this._id) {
      // Update existing
      const updated = await prisma.queue.update({
        where: { id: this.id || this._id },
        data: {
          name: this.name,
          description: this.description,
          maxCapacity: this.maxCapacity,
          averageServiceTime: this.averageServiceTime,
          isActive: this.isActive,
          currentServing: this.currentServing
        },
        include: {
          entries: {
            orderBy: { position: 'asc' }
          }
        }
      });
      Object.assign(this, updated);
    } else {
      // Create new
      const created = await prisma.queue.create({
        data: {
          merchantId: this.merchantId,
          name: this.name,
          description: this.description,
          maxCapacity: this.maxCapacity,
          averageServiceTime: this.averageServiceTime
        },
        include: {
          entries: {
            orderBy: { position: 'asc' }
          }
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

  get currentLength() {
    return this.entries?.filter(e => e.status === 'waiting').length || 0;
  }

  get nextPosition() {
    if (!this.entries || this.entries.length === 0) return 1;
    const maxPosition = Math.max(...this.entries.map(e => e.position || 0));
    return maxPosition + 1;
  }

  async callNext() {
    const nextCustomer = this.entries?.find(e => e.status === 'waiting');
    if (!nextCustomer) return null;

    await prisma.queueEntry.update({
      where: { id: nextCustomer.id },
      data: {
        status: 'called',
        calledAt: new Date()
      }
    });

    nextCustomer.status = 'called';
    nextCustomer.calledAt = new Date();
    return nextCustomer;
  }

  async removeCustomer(customerId, status = 'completed') {
    const customer = this.entries?.find(e => e.customerId === customerId || e.id === customerId);
    if (!customer) return null;

    await prisma.queueEntry.update({
      where: { id: customer.id },
      data: {
        status,
        completedAt: status === 'completed' ? new Date() : undefined
      }
    });

    customer.status = status;
    if (status === 'completed') customer.completedAt = new Date();
    return customer;
  }

  async updatePositions() {
    const waitingEntries = this.entries?.filter(e => e.status === 'waiting') || [];
    waitingEntries.sort((a, b) => a.position - b.position);
    
    for (let i = 0; i < waitingEntries.length; i++) {
      waitingEntries[i].position = i + 1;
      await prisma.queueEntry.update({
        where: { id: waitingEntries[i].id },
        data: { position: i + 1 }
      });
    }
  }

  // Instance methods expected by dashboard
  getWaitingCustomers() {
    return this.entries?.filter(e => e.status === 'waiting') || [];
  }

  getCurrentLength() {
    return this.getWaitingCustomers().length;
  }

  getAverageWaitTime() {
    // If no average service time set, use default
    const avgServiceTime = this.averageServiceTime || 15;
    const waitingCount = this.getCurrentLength();
    
    // Simple calculation: average service time * number of customers ahead
    return waitingCount * avgServiceTime;
  }

  // Additional helper methods that might be used
  getServedCustomers() {
    return this.entries?.filter(e => e.status === 'completed') || [];
  }

  getCalledCustomers() {
    return this.entries?.filter(e => e.status === 'called') || [];
  }

  getActiveCustomers() {
    return this.entries?.filter(e => ['waiting', 'called', 'serving'].includes(e.status)) || [];
  }

  isQueueFull() {
    const activeCount = this.getActiveCustomers().length;
    return activeCount >= this.maxCapacity;
  }

  getEstimatedWaitTime(position) {
    // Calculate wait time based on position in queue
    const avgServiceTime = this.averageServiceTime || 15;
    return (position - 1) * avgServiceTime;
  }
}

module.exports = Queue;