const mongoose = require('mongoose');
const Queue = require('../server/models/Queue');
const logger = require('../server/utils/logger');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-queue-manager');

async function cleanupOldQueueEntries() {
  try {
    console.log('🧹 Starting queue entries cleanup...\n');
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    
    // Get all queues
    const queues = await Queue.find({});
    console.log(`Found ${queues.length} queues to process\n`);
    
    let totalEntriesRemoved = 0;
    let totalEntriesBefore = 0;
    
    for (const queue of queues) {
      const entriesBefore = queue.entries.length;
      totalEntriesBefore += entriesBefore;
      
      console.log(`📋 Processing queue: ${queue.name}`);
      console.log(`   - Total entries before: ${entriesBefore}`);
      
      // Count entries by status before cleanup
      const statusCounts = {
        waiting: queue.entries.filter(e => e.status === 'waiting').length,
        completed: queue.entries.filter(e => e.status === 'completed').length,
        cancelled: queue.entries.filter(e => e.status === 'cancelled').length,
        'no-show': queue.entries.filter(e => e.status === 'no-show').length,
        called: queue.entries.filter(e => e.status === 'called').length
      };
      
      console.log('   - Status breakdown:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        if (count > 0) console.log(`     ${status}: ${count}`);
      });
      
      // Remove old completed, cancelled, and no-show entries (older than 7 days)
      const entriesToKeep = queue.entries.filter(entry => {
        const entryDate = new Date(entry.joinedAt);
        const isOld = entryDate < sevenDaysAgo;
        const isFinalized = ['completed', 'cancelled', 'no-show'].includes(entry.status);
        
        // Keep if: not old OR not finalized (waiting/called entries)
        return !isOld || !isFinalized;
      });
      
      // Also remove very old waiting/called entries (older than 3 days) as they're likely stale
      const finalEntriesToKeep = entriesToKeep.filter(entry => {
        const entryDate = new Date(entry.joinedAt);
        const isVeryOld = entryDate < threeDaysAgo;
        const isActive = ['waiting', 'called'].includes(entry.status);
        
        // Keep if: not very old OR not active (completed entries within 7 days)
        return !isVeryOld || !isActive;
      });
      
      const removedCount = entriesBefore - finalEntriesToKeep.length;
      totalEntriesRemoved += removedCount;
      
      if (removedCount > 0) {
        // Update the queue with cleaned entries
        queue.entries = finalEntriesToKeep;
        
        // Recalculate positions for remaining waiting customers
        const waitingEntries = finalEntriesToKeep.filter(e => e.status === 'waiting');
        waitingEntries.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
        waitingEntries.forEach((entry, index) => {
          entry.position = index + 1;
        });
        
        await queue.save();
        console.log(`   ✅ Removed ${removedCount} old entries`);
        console.log(`   - Entries after: ${finalEntriesToKeep.length}`);
      } else {
        console.log(`   ✅ No old entries to remove`);
      }
      
      console.log('');
    }
    
    console.log('🎉 Cleanup completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total entries before: ${totalEntriesBefore}`);
    console.log(`   - Total entries removed: ${totalEntriesRemoved}`);
    console.log(`   - Total entries after: ${totalEntriesBefore - totalEntriesRemoved}`);
    console.log(`   - Space saved: ${((totalEntriesRemoved / totalEntriesBefore) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the cleanup
cleanupOldQueueEntries(); 