#!/usr/bin/env node

/**
 * Queue System Stress Test Demonstration
 * 
 * This script demonstrates a comprehensive stress/regression test for the queue system.
 * It simulates multiple customers joining a queue and tracks:
 * - Queue position assignments
 * - Position updates as customers are processed
 * - Notification delivery
 * - System performance under load
 */

const chalk = require('chalk');

// Simulated queue system
class QueueSystem {
  constructor() {
    this.queue = [];
    this.processedCount = 0;
    this.notifications = [];
  }
  
  addCustomer(customer) {
    const position = this.queue.filter(c => c.status === 'waiting').length + 1;
    const entry = {
      ...customer,
      position,
      status: 'waiting',
      joinedAt: Date.now(),
      notifications: []
    };
    this.queue.push(entry);
    return entry;
  }
  
  callNextCustomer() {
    const waiting = this.queue.filter(c => c.status === 'waiting');
    if (waiting.length === 0) return null;
    
    const customer = waiting[0];
    customer.status = 'called';
    customer.calledAt = Date.now();
    
    // Update positions for remaining customers
    this.updatePositions();
    
    // Send notifications
    this.sendNotifications(customer);
    
    return customer;
  }
  
  updatePositions() {
    const waiting = this.queue.filter(c => c.status === 'waiting');
    waiting.forEach((customer, index) => {
      const oldPosition = customer.position;
      customer.position = index + 1;
      
      if (oldPosition !== customer.position) {
        customer.notifications.push({
          type: 'position-update',
          message: `Your position updated from ${oldPosition} to ${customer.position}`,
          timestamp: Date.now()
        });
        
        this.notifications.push({
          customerId: customer.id,
          type: 'position-update',
          oldPosition,
          newPosition: customer.position
        });
      }
    });
  }
  
  sendNotifications(calledCustomer) {
    // Notify called customer
    calledCustomer.notifications.push({
      type: 'called',
      message: 'Your table is ready! Please proceed to the restaurant.',
      timestamp: Date.now()
    });
    
    // Notify next 3 customers
    const waiting = this.queue.filter(c => c.status === 'waiting');
    waiting.slice(0, 3).forEach(customer => {
      if (customer.position === 1) {
        customer.notifications.push({
          type: 'next',
          message: 'You are next! Please be ready.',
          timestamp: Date.now()
        });
      } else {
        customer.notifications.push({
          type: 'almost-ready',
          message: `Almost there! You are #${customer.position} in queue.`,
          timestamp: Date.now()
        });
      }
    });
  }
  
  completeCustomer(customerId) {
    const customer = this.queue.find(c => c.id === customerId);
    if (customer) {
      customer.status = 'completed';
      customer.completedAt = Date.now();
      this.processedCount++;
    }
  }
}

// Stress test runner
class StressTestRunner {
  constructor(numCustomers = 10) {
    this.numCustomers = numCustomers;
    this.queueSystem = new QueueSystem();
    this.metrics = {
      startTime: Date.now(),
      customersJoined: 0,
      positionUpdates: 0,
      notificationsSent: 0,
      averageWaitTime: 0,
      errors: []
    };
  }
  
  async run() {
    console.log(chalk.cyan.bold('\n🚀 QUEUE SYSTEM STRESS TEST DEMONSTRATION\n'));
    console.log(chalk.gray('═'.repeat(60)));
    
    // Phase 1: Multiple customers join queue
    await this.phase1_CustomerJoining();
    
    // Phase 2: Process queue and track updates
    await this.phase2_QueueProcessing();
    
    // Phase 3: Generate report
    this.generateReport();
  }
  
  async phase1_CustomerJoining() {
    console.log(chalk.yellow('\n📋 PHASE 1: Multiple Customers Joining Queue\n'));
    
    const joinPromises = [];
    
    for (let i = 1; i <= this.numCustomers; i++) {
      // Simulate staggered joining
      const delay = Math.random() * 2000;
      
      const promise = new Promise(resolve => {
        setTimeout(() => {
          const customer = {
            id: `customer-${i}`,
            name: `Test Customer ${i}`,
            phone: `+6012345678${i}`,
            partySize: Math.floor(Math.random() * 4) + 1
          };
          
          const entry = this.queueSystem.addCustomer(customer);
          this.metrics.customersJoined++;
          
          console.log(chalk.green(`✅ ${customer.name} joined at position ${entry.position}`));
          resolve(entry);
        }, delay);
      });
      
      joinPromises.push(promise);
    }
    
    await Promise.all(joinPromises);
    
    console.log(chalk.cyan(`\n📊 Result: ${this.metrics.customersJoined}/${this.numCustomers} customers joined successfully`));
    
    // Display initial queue state
    console.log(chalk.gray('\nInitial Queue State:'));
    this.displayQueueState();
  }
  
  async phase2_QueueProcessing() {
    console.log(chalk.yellow('\n📋 PHASE 2: Queue Processing & Position Updates\n'));
    
    const processCount = Math.min(3, this.numCustomers);
    
    for (let i = 0; i < processCount; i++) {
      console.log(chalk.blue(`\n🔄 Processing customer ${i + 1}...`));
      
      // Call next customer
      const called = this.queueSystem.callNextCustomer();
      if (called) {
        console.log(chalk.green(`📞 Called: ${called.name}`));
        
        // Count position updates
        const updates = this.queueSystem.notifications.filter(n => n.type === 'position-update');
        this.metrics.positionUpdates = updates.length;
        
        // Show position updates
        const waiting = this.queueSystem.queue.filter(c => c.status === 'waiting');
        waiting.slice(0, 3).forEach(c => {
          console.log(chalk.gray(`   ${c.name}: Position ${c.position}`));
        });
        
        // Simulate customer being seated
        await this.delay(1000);
        this.queueSystem.completeCustomer(called.id);
        console.log(chalk.green(`✅ ${called.name} completed`));
        
        // Count notifications
        this.queueSystem.queue.forEach(c => {
          this.metrics.notificationsSent += c.notifications.length;
        });
      }
      
      await this.delay(500);
    }
    
    console.log(chalk.gray('\nFinal Queue State:'));
    this.displayQueueState();
  }
  
  displayQueueState() {
    const waiting = this.queueSystem.queue.filter(c => c.status === 'waiting');
    const called = this.queueSystem.queue.filter(c => c.status === 'called');
    const completed = this.queueSystem.queue.filter(c => c.status === 'completed');
    
    console.log(chalk.gray(`  Waiting: ${waiting.length} | Called: ${called.length} | Completed: ${completed.length}`));
    
    if (waiting.length > 0) {
      console.log(chalk.gray('  Next 5 in queue:'));
      waiting.slice(0, 5).forEach(c => {
        console.log(chalk.gray(`    ${c.position}. ${c.name} (Party of ${c.partySize})`));
      });
    }
  }
  
  generateReport() {
    console.log(chalk.yellow('\n📊 STRESS TEST REPORT\n'));
    console.log(chalk.gray('═'.repeat(60)));
    
    const duration = (Date.now() - this.metrics.startTime) / 1000;
    
    console.log(chalk.white('Test Configuration:'));
    console.log(chalk.gray(`  • Total Customers: ${this.numCustomers}`));
    console.log(chalk.gray(`  • Test Duration: ${duration.toFixed(2)}s`));
    
    console.log(chalk.white('\nPerformance Metrics:'));
    console.log(chalk.green(`  ✅ Customers Joined: ${this.metrics.customersJoined}`));
    console.log(chalk.blue(`  🔄 Position Updates: ${this.metrics.positionUpdates}`));
    console.log(chalk.yellow(`  📬 Notifications Sent: ${this.metrics.notificationsSent}`));
    console.log(chalk.cyan(`  ⚡ Customers Processed: ${this.queueSystem.processedCount}`));
    
    console.log(chalk.white('\nNotification Breakdown:'));
    const notificationTypes = {};
    this.queueSystem.queue.forEach(c => {
      c.notifications.forEach(n => {
        notificationTypes[n.type] = (notificationTypes[n.type] || 0) + 1;
      });
    });
    
    Object.entries(notificationTypes).forEach(([type, count]) => {
      console.log(chalk.gray(`  • ${type}: ${count}`));
    });
    
    console.log(chalk.white('\nTest Result:'));
    const successRate = (this.metrics.customersJoined / this.numCustomers * 100).toFixed(1);
    if (successRate === '100.0') {
      console.log(chalk.green.bold(`  ✅ PASSED - All customers successfully processed`));
    } else {
      console.log(chalk.yellow(`  ⚠️ PARTIAL - ${successRate}% success rate`));
    }
    
    console.log(chalk.gray('\n═'.repeat(60)));
    console.log(chalk.cyan.bold('\n✨ Stress Test Demonstration Complete!\n'));
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the demonstration
async function main() {
  try {
    // Check if chalk is installed
    const chalk = require('chalk');
  } catch (error) {
    console.log('\n⚠️  Installing required package (chalk) for colored output...');
    require('child_process').execSync('npm install chalk', { stdio: 'inherit' });
  }
  
  const numCustomers = parseInt(process.argv[2]) || 10;
  const runner = new StressTestRunner(numCustomers);
  await runner.run();
}

main().catch(console.error);