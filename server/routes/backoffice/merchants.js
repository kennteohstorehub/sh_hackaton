const express = require('express');
const { body, validationResult } = require('express-validator');
const logger = require('../../utils/logger');
const { requireBackOfficeAuth, loadBackOfficeUser } = require('../../middleware/backoffice-auth');
const prisma = require('../../utils/prisma');

const router = express.Router();

// Apply backoffice authentication and load user data to all routes
router.use(requireBackOfficeAuth);
router.use(loadBackOfficeUser);

// List all merchants across all tenants
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      search = '',
      status = 'all',
      plan = 'all',
      tenant = 'all'
    } = req.query;

    const limit = 20;
    const offset = (parseInt(page) - 1) * limit;

    // Build where clause
    const where = {};

    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { tenant: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    if (status !== 'all') {
      where.isActive = status === 'active';
    }

    if (tenant !== 'all') {
      where.tenantId = tenant;
    }

    // Get merchants with pagination
    const [merchants, totalCount, tenants] = await Promise.all([
      prisma.merchant.findMany({
        where,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          subscription: {
            select: {
              plan: true,
              isActive: true
            }
          },
          _count: {
            select: {
              queues: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.merchant.count({ where }),
      prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          slug: true
        },
        orderBy: { name: 'asc' }
      })
    ]);

    const pagination = {
      page: parseInt(page),
      limit,
      total: totalCount,
      pages: Math.ceil(totalCount / limit),
      hasNext: parseInt(page) < Math.ceil(totalCount / limit),
      hasPrev: parseInt(page) > 1
    };

    res.render('backoffice/merchants/index', {
      title: 'Merchant Management - BackOffice',
      pageTitle: 'QMS BackOffice',
      contentTitle: 'Merchant Management',
      contentSubtitle: 'View and manage all merchants across tenants',
      merchants,
      tenants,
      pagination,
      filters: { search, status, plan, tenant },
      backOfficeUser: req.session.backOfficeUser,
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Error fetching merchants:', error);
    res.render('error', {
      title: 'Merchant Error',
      status: 500,
      message: 'Failed to load merchants',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// View merchant details
router.get('/:id', async (req, res) => {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.params.id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        subscription: true,
        queues: {
          select: {
            id: true,
            name: true,
            isActive: true,
            maxCapacity: true,
            _count: {
              select: {
                entries: true
              }
            }
          }
        },
        _count: {
          select: {
            queues: true
          }
        }
      }
    });

    if (!merchant) {
      req.flash('error', 'Merchant not found');
      return res.redirect('/backoffice/merchants');
    }

    // Get usage statistics
    const [queueEntries, activeQueues] = await Promise.all([
      prisma.queueEntry.count({
        where: {
          queue: {
            merchantId: merchant.id
          },
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      }),
      prisma.queue.count({
        where: {
          merchantId: merchant.id,
          isActive: true
        }
      })
    ]);

    const usage = {
      totalQueues: merchant._count.queues,
      activeQueues,
      queueEntriesLast30Days: queueEntries
    };

    res.render('backoffice/merchants/show', {
      title: `${merchant.businessName} - Merchant Details`,
      pageTitle: 'QMS BackOffice',
      contentTitle: merchant.businessName,
      contentSubtitle: `Merchant details and statistics`,
      merchant,
      usage,
      backOfficeUser: req.session.backOfficeUser,
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Error fetching merchant details:', error);
    req.flash('error', 'Failed to load merchant details');
    res.redirect('/backoffice/merchants');
  }
});

// Toggle merchant status (activate/deactivate)
router.post('/:id/toggle-status', async (req, res) => {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.params.id },
      select: { id: true, businessName: true, isActive: true }
    });

    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    const updatedMerchant = await prisma.merchant.update({
      where: { id: req.params.id },
      data: { isActive: !merchant.isActive }
    });

    const action = updatedMerchant.isActive ? 'activated' : 'deactivated';
    logger.info(`BackOffice ${req.session.backOfficeUser.email} ${action} merchant: ${merchant.businessName}`);
    
    res.json({ 
      success: true, 
      message: `Merchant ${action} successfully`,
      isActive: updatedMerchant.isActive
    });

  } catch (error) {
    logger.error('Error toggling merchant status:', error);
    res.status(500).json({ error: 'Failed to update merchant status' });
  }
});

// Search merchants (AJAX endpoint)
router.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const merchants = await prisma.merchant.findMany({
      where: {
        OR: [
          { businessName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } }
        ]
      },
      include: {
        tenant: {
          select: {
            name: true,
            slug: true
          }
        },
        subscription: {
          select: {
            plan: true
          }
        }
      },
      take: 10,
      orderBy: { businessName: 'asc' }
    });

    res.json(merchants.map(merchant => ({
      id: merchant.id,
      name: merchant.businessName,
      email: merchant.email,
      tenant: merchant.tenant?.name || 'No Tenant',
      plan: merchant.subscription?.plan || 'free',
      isActive: merchant.isActive
    })));

  } catch (error) {
    logger.error('Error searching merchants:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get merchant statistics (AJAX endpoint)
router.get('/api/stats', async (req, res) => {
  try {
    const [totalMerchants, activeMerchants, planStats] = await Promise.all([
      prisma.merchant.count(),
      prisma.merchant.count({ where: { isActive: true } }),
      prisma.merchantSubscription.groupBy({
        by: ['plan'],
        _count: { plan: true },
        where: { isActive: true }
      })
    ]);

    const stats = {
      total: totalMerchants,
      active: activeMerchants,
      inactive: totalMerchants - activeMerchants,
      plans: planStats.reduce((acc, stat) => {
        acc[stat.plan] = stat._count.plan;
        return acc;
      }, {})
    };

    res.json(stats);

  } catch (error) {
    logger.error('Error fetching merchant stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;