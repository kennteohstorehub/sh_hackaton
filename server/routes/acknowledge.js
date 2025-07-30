const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// POST /api/queue/acknowledge - Customer acknowledges notification
router.post('/', async (req, res) => {
  try {
    const { entryId, type, eta } = req.body;
    
    if (!entryId || !type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Entry ID and acknowledgment type are required' 
      });
    }
    
    // Find the queue entry
    const queueEntry = await prisma.queueEntry.findUnique({
      where: { id: entryId },
      include: {
        queue: {
          include: {
            merchant: true
          }
        }
      }
    });
    
    if (!queueEntry) {
      return res.status(404).json({ 
        success: false, 
        error: 'Queue entry not found' 
      });
    }
    
    // Update the queue entry with acknowledgment
    const acknowledgedAt = new Date();
    let estimatedArrival = null;
    
    if (type === 'on_way' && eta) {
      estimatedArrival = new Date(acknowledgedAt.getTime() + eta * 60 * 1000);
    }
    
    const updatedEntry = await prisma.queueEntry.update({
      where: { id: entryId },
      data: {
        acknowledgedAt,
        acknowledgmentType: type,
        estimatedArrival
      }
    });
    
    logger.info(`Customer ${updatedEntry.customerName} acknowledged notification`, {
      entryId,
      type,
      eta,
      estimatedArrival
    });
    
    // Emit acknowledgment to merchant dashboard
    const io = req.app.get('io');
    if (io) {
      const merchantRoom = `merchant-${queueEntry.queue.merchantId}`;
      io.to(merchantRoom).emit('customer-acknowledged', {
        entryId,
        customerId: updatedEntry.customerId,
        customerName: updatedEntry.customerName,
        acknowledgedAt,
        acknowledgmentType: type,
        estimatedArrival,
        eta
      });
    }
    
    res.json({
      success: true,
      message: 'Acknowledgment received',
      acknowledgedAt,
      estimatedArrival
    });
    
  } catch (error) {
    logger.error('Error processing acknowledgment:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process acknowledgment' 
    });
  }
});

module.exports = router;