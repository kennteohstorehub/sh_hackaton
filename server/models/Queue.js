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
        },
        merchant: true
      }
    });
    
    return queues.map(q => {
      const queueInstance = new Queue(q);
      // Map merchant to merchantId for backward compatibility
      if (q.merchant) {
        queueInstance.merchantId = q.merchant;
      }
      return queueInstance;
    });
  }
  
  // Alias for Prisma-style usage
  static findMany = Queue.find;

  static findById(id) {
    // Create a chainable object that can handle .populate()
    const query = {
      _id: id,
      _populateFields: [],
      
      populate(field) {
        this._populateFields.push(field);
        return this;
      },
      
      async then(resolve, reject) {
        try {
          const includeOptions = {
            entries: {
              orderBy: { position: 'asc' }
            }
          };
          
          // Check if merchantId should be populated
          if (this._populateFields.includes('merchantId')) {
            includeOptions.merchant = true;
          }
          
          const queue = await prisma.queue.findUnique({
            where: { id: this._id },
            include: includeOptions
          });
          
          if (!queue) {
            resolve(null);
            return;
          }
          
          const queueInstance = new Queue(queue);
          // Map merchant to merchantId for backward compatibility
          if (queue.merchant) {
            queueInstance.merchantId = queue.merchant;
          }
          resolve(queueInstance);
        } catch (error) {
          reject(error);
        }
      },
      
      catch(onRejected) {
        return this.then(undefined, onRejected);
      }
    };
    
    return query;
  }

  // Add populate method for Mongoose compatibility
  populate(field) {
    // Store the populate field for later use
    this._populateField = field;
    return this;
  }

  // Static method to handle populate for findById
  static async findByIdWithPopulate(id, populateField) {
    const queue = await prisma.queue.findUnique({
      where: { id },
      include: {
        entries: {
          orderBy: { position: 'asc' }
        },
        merchant: populateField === 'merchantId'
      }
    });
    
    if (!queue) return null;
    
    const queueInstance = new Queue(queue);
    // Map merchant to merchantId for backward compatibility
    if (queue.merchant && populateField === 'merchantId') {
      queueInstance.merchantId = queue.merchant;
    }
    return queueInstance;
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
        },
        merchant: true
      }
    });
    
    if (!queue) return null;
    
    const queueInstance = new Queue(queue);
    // Map merchant to merchantId for backward compatibility
    if (queue.merchant) {
      queueInstance.merchantId = queue.merchant;
    }
    return queueInstance;
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
          currentServing: this.currentServing,
          acceptingCustomers: this.acceptingCustomers
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

    // Generate unique 4-digit alphanumeric code
    let verificationCode;
    let codeIsUnique = false;
    let attempts = 0;
    
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    while (!codeIsUnique && attempts < 50) {
      verificationCode = this.generateAlphanumericCode(4);
      
      // Check if code is already used today
      const existingCode = await prisma.queueEntry.findFirst({
        where: {
          verificationCode: verificationCode,
          calledAt: {
            gte: today,
            lt: tomorrow
          }
        }
      });
      
      if (!existingCode) {
        codeIsUnique = true;
      }
      attempts++;
    }

    await prisma.queueEntry.update({
      where: { id: nextCustomer.id },
      data: {
        status: 'called',
        calledAt: new Date(),
        verificationCode: verificationCode
      }
    });

    nextCustomer.status = 'called';
    nextCustomer.calledAt = new Date();
    nextCustomer.verificationCode = verificationCode;
    return nextCustomer;
  }

  generateAlphanumericCode(length) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing characters (I,O,0,1)
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
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

  async addCustomer(customerData) {
    // Get next position
    const position = this.nextPosition;
    
    // Create the queue entry
    const entry = await prisma.queueEntry.create({
      data: {
        queueId: this.id,
        customerId: customerData.customerId,
        customerName: customerData.customerName,
        customerPhone: customerData.customerPhone,
        partySize: customerData.partySize || 1,
        specialRequests: customerData.specialRequests || '',
        position: position,
        status: 'waiting',
        joinedAt: new Date(),
        estimatedWaitTime: this.getEstimatedWaitTime(position),
        platform: customerData.platform || 'web',
        serviceTypeId: customerData.serviceTypeId || null
      }
    });
    
    // Add to entries array if it exists
    if (this.entries) {
      this.entries.push(entry);
    }
    
    return entry;
  }

  getCustomer(customerId) {
    return this.entries?.find(e => 
      e.customerId === customerId || 
      e.id === customerId ||
      e.customerPhone === customerId
    );
  }
}

module.exports = Queue;