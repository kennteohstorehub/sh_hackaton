const express = require('express');
const tenantService = require('../../services/tenantService');
const logger = require('../../utils/logger');
const { requireBackOfficeAuth, loadBackOfficeUser } = require('../../middleware/backoffice-auth');

const router = express.Router();

// Apply backoffice authentication and load user data to all routes
router.use(requireBackOfficeAuth);
router.use(loadBackOfficeUser);

// Main dashboard
router.get('/', async (req, res) => {
  try {
    // Get tenant-focused system statistics
    const systemStats = await tenantService.getSystemStats();
    
    // Get recent tenants (last 10)
    const prisma = require('../../utils/prisma');
    const recentTenants = await prisma.tenant.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: {
          select: {
            status: true,
            priority: true
          }
        },
        _count: {
          select: {
            merchants: true,
            users: true
          }
        }
      }
    });
    
    // Get subscription breakdown
    const subscriptionStats = await getSubscriptionStats();
    
    // Get merchant status breakdown
    const statusStats = {
      active: systemStats.merchants.active,
      inactive: systemStats.merchants.total - systemStats.merchants.active
    };

    res.render('backoffice/dashboard', {
      layout: 'backoffice/layout',
      title: 'BackOffice Dashboard - StoreHub Queue Management',
      pageTitle: 'Dashboard',
      contentTitle: 'Dashboard',
      contentSubtitle: 'Monitor your queue management system and oversee all merchant operations',
      currentPage: 'dashboard',
      systemStats,
      recentTenants,
      recentActivity: [], // Placeholder for recent activity
      subscriptionStats,
      statusStats,
      backOfficeUser: res.locals.backOfficeUser || req.backOfficeUser,
      csrfToken: res.locals.csrfToken || '',
      messages: res.locals.messages || {}
    });

  } catch (error) {
    logger.error('Error loading backoffice dashboard:', error);
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
    
    // Use MerchantSubscription instead of TenantSubscription since that's where plan field exists
    const stats = await prisma.merchantSubscription.groupBy({
      by: ['plan'],
      _count: {
        plan: true
      },
      where: {
        isActive: true
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