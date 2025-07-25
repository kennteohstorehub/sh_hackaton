const express = require('express');
const Queue = require('../models/Queue');
const Merchant = require('../models/Merchant');
const logger = require('../utils/logger');
const moment = require('moment');

const router = express.Router();

// Use appropriate auth middleware based on environment
let authMiddleware;
if (process.env.NODE_ENV !== 'production') {
  ({ authMiddleware } = require('../middleware/auth-bypass'));
} else {
  ({ authMiddleware } = require('../middleware/auth'));
}

// GET /api/analytics/dashboard - Get dashboard analytics
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
    const { period = '7d' } = req.query;

    // Calculate date range
    let startDate;
    switch (period) {
      case '1d':
        startDate = moment().subtract(1, 'day').startOf('day');
        break;
      case '7d':
        startDate = moment().subtract(7, 'days').startOf('day');
        break;
      case '30d':
        startDate = moment().subtract(30, 'days').startOf('day');
        break;
      case '90d':
        startDate = moment().subtract(90, 'days').startOf('day');
        break;
      default:
        startDate = moment().subtract(7, 'days').startOf('day');
    }

    // Get all queues for the merchant
    const queues = await Queue.find({ merchantId });

    // Calculate analytics
    const analytics = {
      totalCustomersServed: 0,
      averageWaitTime: 0,
      totalQueues: queues.length,
      activeQueues: 0,
      customerSatisfaction: 0,
      peakHours: {},
      dailyStats: [],
      queuePerformance: []
    };

    // Process each queue
    for (const queue of queues) {
      if (queue.isActive) analytics.activeQueues++;

      // Filter entries by date range
      const recentEntries = queue.entries.filter(entry => 
        moment(entry.joinedAt).isAfter(startDate)
      );

      analytics.totalCustomersServed += recentEntries.filter(entry => 
        entry.status === 'completed'
      ).length;

      // Calculate average wait time
      const completedEntries = recentEntries.filter(entry => 
        entry.status === 'completed' && entry.completedAt
      );

      if (completedEntries.length > 0) {
        const totalWaitTime = completedEntries.reduce((sum, entry) => {
          const waitTime = moment(entry.completedAt).diff(moment(entry.joinedAt), 'minutes');
          return sum + waitTime;
        }, 0);
        
        const avgWaitTime = totalWaitTime / completedEntries.length;
        analytics.averageWaitTime = Math.round(avgWaitTime);
      }

      // Analyze peak hours
      recentEntries.forEach(entry => {
        const hour = moment(entry.joinedAt).hour();
        analytics.peakHours[hour] = (analytics.peakHours[hour] || 0) + 1;
      });

      // Queue performance
      analytics.queuePerformance.push({
        queueId: queue._id,
        name: queue.name,
        totalCustomers: recentEntries.length,
        completedCustomers: completedEntries.length,
        averageWaitTime: completedEntries.length > 0 ? 
          Math.round(completedEntries.reduce((sum, entry) => {
            return sum + moment(entry.completedAt).diff(moment(entry.joinedAt), 'minutes');
          }, 0) / completedEntries.length) : 0,
        currentLength: queue.currentLength
      });
    }

    // Generate daily stats
    for (let i = parseInt(period.replace('d', '')); i >= 0; i--) {
      const date = moment().subtract(i, 'days');
      const dayEntries = queues.flatMap(queue => 
        queue.entries.filter(entry => 
          moment(entry.joinedAt).isSame(date, 'day')
        )
      );

      analytics.dailyStats.push({
        date: date.format('YYYY-MM-DD'),
        customers: dayEntries.length,
        completed: dayEntries.filter(entry => entry.status === 'completed').length,
        cancelled: dayEntries.filter(entry => entry.status === 'cancelled').length
      });
    }

    // Calculate customer satisfaction (simplified)
    const allRecentEntries = queues.flatMap(queue => 
      queue.entries.filter(entry => 
        moment(entry.joinedAt).isAfter(startDate) && entry.sentimentScore
      )
    );

    if (allRecentEntries.length > 0) {
      const avgSentiment = allRecentEntries.reduce((sum, entry) => 
        sum + (entry.sentimentScore || 0), 0
      ) / allRecentEntries.length;
      
      // Convert sentiment score (-1 to 1) to satisfaction percentage (0 to 100)
      analytics.customerSatisfaction = Math.round(((avgSentiment + 1) / 2) * 100);
    }

    res.json({
      success: true,
      analytics,
      period
    });

  } catch (error) {
    logger.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/analytics/queue/:id - Get specific queue analytics
router.get('/queue/:id', authMiddleware, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
    const queueId = req.params.id;
    const { period = '7d' } = req.query;

    const queue = await Queue.findOne({ _id: queueId, merchantId });
    
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Calculate date range
    let startDate;
    switch (period) {
      case '1d':
        startDate = moment().subtract(1, 'day').startOf('day');
        break;
      case '7d':
        startDate = moment().subtract(7, 'days').startOf('day');
        break;
      case '30d':
        startDate = moment().subtract(30, 'days').startOf('day');
        break;
      case '90d':
        startDate = moment().subtract(90, 'days').startOf('day');
        break;
      default:
        startDate = moment().subtract(7, 'days').startOf('day');
    }

    // Filter entries by date range
    const recentEntries = queue.entries.filter(entry => 
      moment(entry.joinedAt).isAfter(startDate)
    );

    const analytics = {
      queueName: queue.name,
      totalCustomers: recentEntries.length,
      completedCustomers: recentEntries.filter(entry => entry.status === 'completed').length,
      cancelledCustomers: recentEntries.filter(entry => entry.status === 'cancelled').length,
      waitingCustomers: recentEntries.filter(entry => entry.status === 'waiting').length,
      averageWaitTime: 0,
      peakHours: {},
      hourlyDistribution: Array(24).fill(0),
      dailyStats: []
    };

    // Calculate average wait time
    const completedEntries = recentEntries.filter(entry => 
      entry.status === 'completed' && entry.completedAt
    );

    if (completedEntries.length > 0) {
      const totalWaitTime = completedEntries.reduce((sum, entry) => {
        const waitTime = moment(entry.completedAt).diff(moment(entry.joinedAt), 'minutes');
        return sum + waitTime;
      }, 0);
      
      analytics.averageWaitTime = Math.round(totalWaitTime / completedEntries.length);
    }

    // Analyze hourly distribution
    recentEntries.forEach(entry => {
      const hour = moment(entry.joinedAt).hour();
      analytics.hourlyDistribution[hour]++;
      analytics.peakHours[hour] = (analytics.peakHours[hour] || 0) + 1;
    });

    // Generate daily stats
    const days = parseInt(period.replace('d', ''));
    for (let i = days; i >= 0; i--) {
      const date = moment().subtract(i, 'days');
      const dayEntries = recentEntries.filter(entry => 
        moment(entry.joinedAt).isSame(date, 'day')
      );

      analytics.dailyStats.push({
        date: date.format('YYYY-MM-DD'),
        customers: dayEntries.length,
        completed: dayEntries.filter(entry => entry.status === 'completed').length,
        cancelled: dayEntries.filter(entry => entry.status === 'cancelled').length,
        averageWaitTime: dayEntries.filter(entry => entry.status === 'completed').length > 0 ?
          Math.round(dayEntries.filter(entry => entry.status === 'completed').reduce((sum, entry) => {
            return sum + (entry.completedAt ? 
              moment(entry.completedAt).diff(moment(entry.joinedAt), 'minutes') : 0);
          }, 0) / dayEntries.filter(entry => entry.status === 'completed').length) : 0
      });
    }

    res.json({
      success: true,
      analytics,
      period
    });

  } catch (error) {
    logger.error('Error fetching queue analytics:', error);
    res.status(500).json({ error: 'Failed to fetch queue analytics' });
  }
});

// GET /api/analytics/export - Export analytics data
router.get('/export', authMiddleware, async (req, res) => {
  try {
    const merchantId = req.session.user.id;
    const { format = 'json', period = '30d' } = req.query;

    // Calculate date range
    let startDate;
    switch (period) {
      case '7d':
        startDate = moment().subtract(7, 'days').startOf('day');
        break;
      case '30d':
        startDate = moment().subtract(30, 'days').startOf('day');
        break;
      case '90d':
        startDate = moment().subtract(90, 'days').startOf('day');
        break;
      default:
        startDate = moment().subtract(30, 'days').startOf('day');
    }

    const queues = await Queue.find({ merchantId });
    
    const exportData = {
      merchant: req.session.user.businessName,
      exportDate: moment().format('YYYY-MM-DD HH:mm:ss'),
      period,
      queues: []
    };

    // Process each queue
    for (const queue of queues) {
      const recentEntries = queue.entries.filter(entry => 
        moment(entry.joinedAt).isAfter(startDate)
      );

      exportData.queues.push({
        queueId: queue._id,
        name: queue.name,
        description: queue.description,
        maxCapacity: queue.maxCapacity,
        averageServiceTime: queue.averageServiceTime,
        totalCustomers: recentEntries.length,
        completedCustomers: recentEntries.filter(entry => entry.status === 'completed').length,
        cancelledCustomers: recentEntries.filter(entry => entry.status === 'cancelled').length,
        entries: recentEntries.map(entry => ({
          customerId: entry.customerId,
          customerName: entry.customerName,
          customerPhone: entry.customerPhone,
          platform: entry.platform,
          status: entry.status,
          joinedAt: entry.joinedAt,
          calledAt: entry.calledAt,
          completedAt: entry.completedAt,
          waitTime: entry.completedAt ? 
            moment(entry.completedAt).diff(moment(entry.joinedAt), 'minutes') : null,
          sentimentScore: entry.sentimentScore
        }))
      });
    }

    if (format === 'csv') {
      // Convert to CSV format
      let csv = 'Queue Name,Customer Name,Phone,Platform,Status,Joined At,Wait Time (min),Sentiment\n';
      
      exportData.queues.forEach(queue => {
        queue.entries.forEach(entry => {
          csv += `"${queue.name}","${entry.customerName}","${entry.customerPhone}","${entry.platform}","${entry.status}","${entry.joinedAt}","${entry.waitTime || ''}","${entry.sentimentScore || ''}"\n`;
        });
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="queue-analytics-${period}.csv"`);
      res.send(csv);
    } else {
      res.json({
        success: true,
        data: exportData
      });
    }

  } catch (error) {
    logger.error('Error exporting analytics:', error);
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

module.exports = router; 