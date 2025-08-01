const express = require('express');
const tenantService = require('../../services/tenantService');
const logger = require('../../utils/logger');
const { requireSuperAdminAuth } = require('../../middleware/superadmin-auth');

const router = express.Router();

// Apply superadmin authentication to all routes
router.use(requireSuperAdminAuth);

// Main dashboard
router.get('/', async (req, res) => {
  try {
    // Get system-wide statistics
    const systemStats = await tenantService.getSystemStats();
    
    // Get recent tenants (last 10)
    const recentTenantsResult = await tenantService.findAll({
      page: 1,
      limit: 10
    });
    
    // Get subscription breakdown
    const subscriptionStats = await getSubscriptionStats();
    
    // Get tenant status breakdown
    const statusStats = {
      active: systemStats.tenants.active,
      inactive: systemStats.tenants.total - systemStats.tenants.active
    };

    res.render('superadmin/dashboard', {
      title: 'SuperAdmin Dashboard',
      systemStats,
      recentTenants: recentTenantsResult.tenants,
      subscriptionStats,
      statusStats,
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Error loading superadmin dashboard:', error);
    res.render('error', {
      title: 'Dashboard Error',
      status: 500,
      message: 'Failed to load dashboard data',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// API endpoint for dashboard metrics (for AJAX updates)
router.get('/api/metrics', async (req, res) => {
  try {
    const systemStats = await tenantService.getSystemStats();
    const subscriptionStats = await getSubscriptionStats();
    
    res.json({
      systemStats,
      subscriptionStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Helper function to get subscription statistics
async function getSubscriptionStats() {
  try {
    const prisma = require('../../utils/prisma');
    
    const stats = await prisma.tenantSubscription.groupBy({
      by: ['plan'],
      _count: {
        plan: true
      },
      where: {
        status: 'active'
      }
    });

    // Initialize all plans with 0
    const subscriptionStats = {
      free: 0,
      basic: 0,
      premium: 0,
      enterprise: 0
    };

    // Fill in actual counts
    stats.forEach(stat => {
      subscriptionStats[stat.plan] = stat._count.plan;
    });

    return subscriptionStats;

  } catch (error) {
    logger.error('Error getting subscription stats:', error);
    return { free: 0, basic: 0, premium: 0, enterprise: 0 };
  }
}

module.exports = router;