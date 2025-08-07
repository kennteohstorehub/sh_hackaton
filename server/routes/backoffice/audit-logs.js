const express = require('express');
const logger = require('../../utils/logger');
const { requireBackOfficeAuth, loadBackOfficeUser } = require('../../middleware/backoffice-auth');
const prisma = require('../../utils/prisma');

const router = express.Router();

// Apply backoffice authentication and load user data to all routes
router.use(requireBackOfficeAuth);
router.use(loadBackOfficeUser);

// List audit logs
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      search = '',
      action = 'all',
      entity = 'all',
      user = 'all',
      dateFrom = '',
      dateTo = ''
    } = req.query;

    const limit = 50;
    const offset = (parseInt(page) - 1) * limit;

    // Build where clause
    const where = {};

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
        { userId: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (action !== 'all') {
      where.action = action;
    }

    if (entity !== 'all') {
      where.resource = entity;
    }

    if (user !== 'all') {
      where.userId = user;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo + 'T23:59:59.999Z');
      }
    }

    // Get audit logs with pagination
    const [auditLogs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ]);

    // Get unique values for filters
    const [actions, entities, users] = await Promise.all([
      prisma.auditLog.findMany({
        select: { action: true },
        distinct: ['action'],
        orderBy: { action: 'asc' }
      }),
      prisma.auditLog.findMany({
        select: { resource: true },
        distinct: ['resource'],
        orderBy: { resource: 'asc' }
      }),
      // Get unique user IDs from audit logs for filter
      prisma.auditLog.findMany({
        select: { userId: true },
        distinct: ['userId'],
        where: { userId: { not: null } }
      }).then(logs => logs.map(log => ({ id: log.userId, name: log.userId, email: log.userId })))
    ]);

    const pagination = {
      page: parseInt(page),
      limit,
      total: totalCount,
      pages: Math.ceil(totalCount / limit),
      hasNext: parseInt(page) < Math.ceil(totalCount / limit),
      hasPrev: parseInt(page) > 1
    };

    res.render('backoffice/audit-logs/index', {
      title: 'Audit Logs - BackOffice',
      pageTitle: 'QMS BackOffice',
      contentTitle: 'Audit Logs',
      contentSubtitle: 'System activity and security audit trail',
      auditLogs,
      pagination,
      filters: { search, action, entity, user, dateFrom, dateTo },
      filterOptions: {
        actions: actions.map(a => a.action),
        entities: entities.map(e => e.resource),
        users
      },
      backOfficeUser: req.session.backOfficeUser,
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    res.render('error', {
      title: 'Audit Logs Error',
      status: 500,
      message: 'Failed to load audit logs',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// View audit log details
router.get('/:id', async (req, res) => {
  try {
    const auditLog = await prisma.auditLog.findUnique({
      where: { id: req.params.id }
    });

    if (!auditLog) {
      req.flash('error', 'Audit log not found');
      return res.redirect('/backoffice/audit-logs');
    }

    res.render('backoffice/audit-logs/show', {
      title: `Audit Log Details - BackOffice`,
      pageTitle: 'QMS BackOffice',
      contentTitle: 'Audit Log Details',
      contentSubtitle: `${auditLog.action} on ${auditLog.entityType}`,
      auditLog,
      backOfficeUser: req.session.backOfficeUser,
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Error fetching audit log details:', error);
    req.flash('error', 'Failed to load audit log details');
    res.redirect('/backoffice/audit-logs');
  }
});

// Get audit log statistics (AJAX endpoint)
router.get('/api/stats', async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case '24h':
        dateFilter = { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
        break;
      case '7d':
        dateFilter = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case '30d':
        dateFilter = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
        break;
      case '90d':
        dateFilter = { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
        break;
    }

    const [actionStats, entityStats, userStats, totalCount] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ['action'],
        _count: { action: true },
        where: { createdAt: dateFilter },
        orderBy: { _count: { action: 'desc' } }
      }),
      prisma.auditLog.groupBy({
        by: ['resource'],
        _count: { resource: true },
        where: { createdAt: dateFilter },
        orderBy: { _count: { resource: 'desc' } }
      }),
      prisma.auditLog.groupBy({
        by: ['userId'],
        _count: { userId: true },
        where: { 
          createdAt: dateFilter,
          userId: { not: null }
        },
        orderBy: { _count: { userId: 'desc' } },
        take: 10
      }),
      prisma.auditLog.count({
        where: { createdAt: dateFilter }
      })
    ]);

    const stats = {
      total: totalCount,
      actions: actionStats,
      entities: entityStats,
      topUsers: userStats,
      period
    };

    res.json(stats);

  } catch (error) {
    logger.error('Error fetching audit log stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Export audit logs (CSV)
router.get('/export/csv', async (req, res) => {
  try {
    const {
      search = '',
      action = 'all',
      entity = 'all',
      user = 'all',
      dateFrom = '',
      dateTo = ''
    } = req.query;

    // Build where clause (same as index route)
    const where = {};

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
        { userId: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (action !== 'all') {
      where.action = action;
    }

    if (entity !== 'all') {
      where.resource = entity;
    }

    if (user !== 'all') {
      where.userId = user;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo + 'T23:59:59.999Z');
      }
    }

    const auditLogs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000 // Limit to prevent memory issues
    });

    // Generate CSV
    const csvHeaders = [
      'Timestamp',
      'Action',
      'Entity Type',
      'Entity ID',
      'User Name',
      'User Email',
      'IP Address',
      'User Agent'
    ];

    const csvRows = auditLogs.map(log => [
      log.createdAt.toISOString(),
      log.action,
      log.resource,
      log.resourceId || '',
      log.userId || '',
      log.userId || '',
      log.ipAddress || '',
      log.userAgent || ''
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

    logger.info(`BackOffice ${req.session.backOfficeUser.email} exported ${auditLogs.length} audit logs`);

  } catch (error) {
    logger.error('Error exporting audit logs:', error);
    req.flash('error', 'Failed to export audit logs');
    res.redirect('/backoffice/audit-logs');
  }
});

module.exports = router;