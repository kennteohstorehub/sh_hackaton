const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const prisma = require('../../utils/prisma');
const logger = require('../../utils/logger');
const { requireBackOfficeAuth, loadBackOfficeUser } = require('../../middleware/backoffice-auth');
const tenantService = require('../../services/tenantService');

const router = express.Router();

// Apply superadmin authentication and load user data to all routes
router.use(requireBackOfficeAuth);
router.use(loadBackOfficeUser);

// Validation rules for creating/updating users
const validateUser = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('role')
    .isIn(['SUPER_ADMIN', 'ADMIN', 'USER'])
    .withMessage('Invalid role'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
  
  body('phone')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Please provide a valid phone number'),
  
  body('tenantId')
    .optional()
    .isUUID()
    .withMessage('Invalid tenant ID')
];

// Password validation (only for create)
const validatePassword = [
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage('Password must contain at least one letter and one number')
];

// List all users across all tenants
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      search = '',
      tenantId = 'all',
      role = 'all',
      status = 'all'
    } = req.query;

    const limit = 20;
    const offset = (parseInt(page) - 1) * limit;

    // Build where clause
    const where = {
      AND: []
    };

    // Search filter
    if (search) {
      where.AND.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      });
    }

    // Tenant filter
    if (tenantId !== 'all') {
      where.AND.push({ tenantId });
    }

    // Role filter
    if (role !== 'all') {
      where.AND.push({ role });
    }

    // Status filter
    if (status === 'active') {
      where.AND.push({ isActive: true });
    } else if (status === 'inactive') {
      where.AND.push({ isActive: false });
    }

    // Get users with tenant info
    const [users, totalCount] = await Promise.all([
      prisma.tenantUser.findMany({
        where: where.AND.length > 0 ? where : undefined,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.tenantUser.count({
        where: where.AND.length > 0 ? where : undefined
      })
    ]);

    // Get all tenants for filter dropdown
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true
      },
      orderBy: { name: 'asc' }
    });

    const totalPages = Math.ceil(totalCount / limit);

    res.render('backoffice/users/index', {
      title: 'User Management - BackOffice',
      pageTitle: 'QMS BackOffice',
      contentTitle: 'User Management',
      contentSubtitle: 'Manage users across all tenants',
      users,
      tenants,
      pagination: {
        page: parseInt(page),
        totalPages,
        totalCount,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      },
      filters: { search, tenantId, role, status },
      backOfficeUser: req.session.backOfficeUser,
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Error fetching users:', error);
    req.flash('error', 'Failed to load users');
    res.redirect('/backoffice/dashboard');
  }
});

// Show create user form
router.get('/create', async (req, res) => {
  try {
    // Get all tenants for dropdown
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true
      },
      orderBy: { name: 'asc' }
    });

    res.render('backoffice/users/form', {
      title: 'Create User - BackOffice',
      pageTitle: 'QMS BackOffice',
      contentTitle: 'Create New User',
      contentSubtitle: 'Add a new user to a tenant',
      user: null,
      tenants,
      action: 'create',
      backOfficeUser: req.session.backOfficeUser,
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Error loading create user form:', error);
    req.flash('error', 'Failed to load form');
    res.redirect('/backoffice/users');
  }
});

// Create new user
router.post('/', validateUser, validatePassword, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const tenants = await prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' }
      });

      return res.render('backoffice/users/form', {
        title: 'Create User - BackOffice',
        pageTitle: 'QMS BackOffice',
        contentTitle: 'Create New User',
        contentSubtitle: 'Add a new user to a tenant',
        user: req.body,
        tenants,
        action: 'create',
        errors: errors.array(),
        backOfficeUser: req.session.backOfficeUser,
        csrfToken: res.locals.csrfToken || ''
      });
    }

    // Check if email already exists
    const existingUser = await prisma.tenantUser.findFirst({
      where: { 
        email: req.body.email,
        tenantId: req.body.tenantId
      }
    });

    if (existingUser) {
      const tenants = await prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' }
      });

      return res.render('backoffice/users/form', {
        title: 'Create User - BackOffice',
        pageTitle: 'QMS BackOffice',
        contentTitle: 'Create New User',
        contentSubtitle: 'Add a new user to a tenant',
        user: req.body,
        tenants,
        action: 'create',
        errors: [{ msg: 'A user with this email already exists in the selected tenant' }],
        backOfficeUser: req.session.backOfficeUser,
        csrfToken: res.locals.csrfToken || ''
      });
    }

    // Check tenant subscription limits
    const limits = await tenantService.checkSubscriptionLimits(req.body.tenantId);
    if (limits.users.current >= limits.users.limit) {
      const tenants = await prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' }
      });

      return res.render('backoffice/users/form', {
        title: 'Create User - BackOffice',
        pageTitle: 'QMS BackOffice',
        contentTitle: 'Create New User',
        contentSubtitle: 'Add a new user to a tenant',
        user: req.body,
        tenants,
        action: 'create',
        errors: [{ msg: 'This tenant has reached its user limit' }],
        backOfficeUser: req.session.backOfficeUser,
        csrfToken: res.locals.csrfToken || ''
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // Create user
    const user = await prisma.tenantUser.create({
      data: {
        email: req.body.email,
        name: req.body.name,
        password: hashedPassword,
        role: req.body.role,
        phone: req.body.phone || null,
        isActive: req.body.isActive === 'on',
        tenantId: req.body.tenantId,
        emailVerified: req.body.emailVerified === 'on'
      },
      include: {
        tenant: {
          select: {
            name: true
          }
        }
      }
    });

    // Log audit event
    await tenantService.logAuditEvent(req.body.tenantId, {
      action: 'USER_CREATED',
      resourceType: 'TenantUser',
      resourceId: user.id,
      details: {
        email: user.email,
        role: user.role,
        createdBy: 'BackOffice',
        createdByEmail: req.backOfficeUser.email
      }
    });

    logger.info(`BackOffice ${req.backOfficeUser.email} created user: ${user.email} for tenant: ${user.tenant.name}`);
    req.flash('success', `User "${user.name}" created successfully`);
    res.redirect('/backoffice/users');

  } catch (error) {
    logger.error('Error creating user:', error);
    
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' }
    });

    return res.render('backoffice/users/form', {
      title: 'Create User - BackOffice',
      user: req.body,
      tenants,
      action: 'create',
      errors: [{ msg: 'Failed to create user' }],
      csrfToken: res.locals.csrfToken || ''
    });
  }
});

// Show user details
router.get('/:id', async (req, res) => {
  try {
    const user = await prisma.tenantUser.findUnique({
      where: { id: req.params.id },
      include: {
        tenant: true,
        merchants: {
          include: {
            _count: {
              select: {
                queues: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/backoffice/users');
    }

    // Get recent activity
    const recentActivity = await prisma.auditLog.findMany({
      where: {
        userId: user.id,
        tenantId: user.tenantId
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    res.render('backoffice/users/show', {
      title: `${user.name} - User Details`,
      user,
      recentActivity,
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Error fetching user details:', error);
    req.flash('error', 'Failed to load user details');
    res.redirect('/backoffice/users');
  }
});

// Show edit user form
router.get('/:id/edit', async (req, res) => {
  try {
    const [user, tenants] = await Promise.all([
      prisma.tenantUser.findUnique({
        where: { id: req.params.id },
        include: { tenant: true }
      }),
      prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' }
      })
    ]);

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/backoffice/users');
    }

    res.render('backoffice/users/form', {
      title: `Edit ${user.name} - BackOffice`,
      user,
      tenants,
      action: 'edit',
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Error fetching user for edit:', error);
    req.flash('error', 'Failed to load user');
    res.redirect('/backoffice/users');
  }
});

// Update user
router.put('/:id', validateUser, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const [user, tenants] = await Promise.all([
        prisma.tenantUser.findUnique({
          where: { id: req.params.id },
          include: { tenant: true }
        }),
        prisma.tenant.findMany({
          where: { isActive: true },
          select: { id: true, name: true, slug: true },
          orderBy: { name: 'asc' }
        })
      ]);

      return res.render('backoffice/users/form', {
        title: `Edit ${user.name} - BackOffice`,
        user: { ...user, ...req.body },
        tenants,
        action: 'edit',
        errors: errors.array(),
        csrfToken: res.locals.csrfToken || ''
      });
    }

    // Check if email is being changed and already exists
    const existingUser = await prisma.tenantUser.findFirst({
      where: {
        email: req.body.email,
        tenantId: req.body.tenantId,
        NOT: { id: req.params.id }
      }
    });

    if (existingUser) {
      const [user, tenants] = await Promise.all([
        prisma.tenantUser.findUnique({
          where: { id: req.params.id },
          include: { tenant: true }
        }),
        prisma.tenant.findMany({
          where: { isActive: true },
          select: { id: true, name: true, slug: true },
          orderBy: { name: 'asc' }
        })
      ]);

      return res.render('backoffice/users/form', {
        title: `Edit ${user.name} - BackOffice`,
        user: { ...user, ...req.body },
        tenants,
        action: 'edit',
        errors: [{ msg: 'A user with this email already exists in the selected tenant' }],
        csrfToken: res.locals.csrfToken || ''
      });
    }

    // Update user
    const updateData = {
      email: req.body.email,
      name: req.body.name,
      role: req.body.role,
      phone: req.body.phone || null,
      isActive: req.body.isActive === 'on',
      emailVerified: req.body.emailVerified === 'on'
    };

    // Only update password if provided
    if (req.body.password) {
      updateData.password = await bcrypt.hash(req.body.password, 10);
    }

    const user = await prisma.tenantUser.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        tenant: {
          select: {
            name: true
          }
        }
      }
    });

    // Log audit event
    await tenantService.logAuditEvent(user.tenantId, {
      action: 'USER_UPDATED',
      resourceType: 'TenantUser',
      resourceId: user.id,
      details: {
        email: user.email,
        role: user.role,
        updatedBy: 'BackOffice',
        updatedByEmail: req.backOfficeUser.email
      }
    });

    logger.info(`BackOffice ${req.backOfficeUser.email} updated user: ${user.email}`);
    req.flash('success', `User "${user.name}" updated successfully`);
    res.redirect(`/backoffice/users/${user.id}`);

  } catch (error) {
    logger.error('Error updating user:', error);
    
    const [user, tenants] = await Promise.all([
      prisma.tenantUser.findUnique({
        where: { id: req.params.id },
        include: { tenant: true }
      }),
      prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' }
      })
    ]);

    return res.render('backoffice/users/form', {
      title: `Edit ${user.name} - BackOffice`,
      user: { ...user, ...req.body },
      tenants,
      action: 'edit',
      errors: [{ msg: 'Failed to update user' }],
      csrfToken: res.locals.csrfToken || ''
    });
  }
});

// Toggle user status (activate/deactivate)
router.post('/:id/toggle-status', async (req, res) => {
  try {
    const user = await prisma.tenantUser.findUnique({
      where: { id: req.params.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await prisma.tenantUser.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive }
    });

    const action = updatedUser.isActive ? 'activated' : 'deactivated';
    
    // Log audit event
    await tenantService.logAuditEvent(user.tenantId, {
      action: `USER_${action.toUpperCase()}`,
      resourceType: 'TenantUser',
      resourceId: user.id,
      details: {
        email: user.email,
        actionBy: 'BackOffice',
        actionByEmail: req.backOfficeUser.email
      }
    });

    logger.info(`BackOffice ${req.backOfficeUser.email} ${action} user: ${user.email}`);
    
    res.json({ 
      success: true, 
      message: `User ${action} successfully`,
      isActive: updatedUser.isActive
    });

  } catch (error) {
    logger.error('Error toggling user status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    const user = await prisma.tenantUser.findUnique({
      where: { id: req.params.id },
      include: {
        merchants: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has merchants
    if (user.merchants.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete user with associated merchants. Please reassign or delete merchants first.' 
      });
    }

    // Delete user
    await prisma.tenantUser.delete({
      where: { id: req.params.id }
    });

    // Log audit event
    await tenantService.logAuditEvent(user.tenantId, {
      action: 'USER_DELETED',
      resourceType: 'TenantUser',
      resourceId: user.id,
      details: {
        email: user.email,
        deletedBy: 'BackOffice',
        deletedByEmail: req.backOfficeUser.email
      }
    });

    logger.info(`BackOffice ${req.backOfficeUser.email} deleted user: ${user.email}`);
    res.json({ success: true, message: 'User deleted successfully' });

  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Reset user password
router.post('/:id/reset-password', async (req, res) => {
  try {
    const user = await prisma.tenantUser.findUnique({
      where: { id: req.params.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate random password
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Update user password
    await prisma.tenantUser.update({
      where: { id: req.params.id },
      data: {
        password: hashedPassword,
        passwordResetRequired: true
      }
    });

    // Send password reset email (if email service is configured)
    const emailService = require('../../services/emailService');
    await emailService.sendPasswordReset({
      to: user.email,
      name: user.name,
      tempPassword,
      loginUrl: `https://${user.tenant?.slug}.storehubqms.com/auth/login`
    });

    // Log audit event
    await tenantService.logAuditEvent(user.tenantId, {
      action: 'USER_PASSWORD_RESET',
      resourceType: 'TenantUser',
      resourceId: user.id,
      details: {
        email: user.email,
        resetBy: 'BackOffice',
        resetByEmail: req.backOfficeUser.email
      }
    });

    logger.info(`BackOffice ${req.backOfficeUser.email} reset password for user: ${user.email}`);
    res.json({ 
      success: true, 
      message: 'Password reset successfully. Temporary password sent to user email.' 
    });

  } catch (error) {
    logger.error('Error resetting user password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Bulk operations
router.post('/bulk', async (req, res) => {
  try {
    const { action, userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'No users selected' });
    }

    let updateData = {};
    let message = '';
    let auditAction = '';

    switch (action) {
      case 'activate':
        updateData = { isActive: true };
        message = `${userIds.length} users activated`;
        auditAction = 'USER_BULK_ACTIVATED';
        break;
      case 'deactivate':
        updateData = { isActive: false };
        message = `${userIds.length} users deactivated`;
        auditAction = 'USER_BULK_DEACTIVATED';
        break;
      case 'delete':
        // Check if any users have merchants
        const usersWithMerchants = await prisma.tenantUser.findMany({
          where: {
            id: { in: userIds },
            merchants: {
              some: {}
            }
          }
        });

        if (usersWithMerchants.length > 0) {
          return res.status(400).json({ 
            error: `${usersWithMerchants.length} users have associated merchants and cannot be deleted.` 
          });
        }

        // Delete users
        await prisma.tenantUser.deleteMany({
          where: { id: { in: userIds } }
        });

        message = `${userIds.length} users deleted`;
        auditAction = 'USER_BULK_DELETED';
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    if (action !== 'delete') {
      await prisma.tenantUser.updateMany({
        where: { id: { in: userIds } },
        data: updateData
      });
    }

    // Log audit event (simplified for bulk operations)
    logger.info(`BackOffice ${req.backOfficeUser.email} performed bulk ${action} on ${userIds.length} users`);
    
    res.json({ success: true, message });

  } catch (error) {
    logger.error('Error performing bulk operation:', error);
    res.status(500).json({ error: 'Failed to perform bulk operation' });
  }
});

// Search users (AJAX endpoint)
router.get('/api/search', async (req, res) => {
  try {
    const { q, tenantId } = req.query;
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const where = {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } }
      ]
    };

    if (tenantId && tenantId !== 'all') {
      where.tenantId = tenantId;
    }

    const users = await prisma.tenantUser.findMany({
      where,
      include: {
        tenant: {
          select: {
            name: true,
            slug: true
          }
        }
      },
      take: 10
    });

    res.json(users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant: user.tenant?.name,
      isActive: user.isActive
    })));

  } catch (error) {
    logger.error('Error searching users:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// User activity report
router.get('/:id/activity', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where = {
      userId: req.params.id
    };

    if (startDate) {
      where.createdAt = {
        gte: new Date(startDate)
      };
    }

    if (endDate) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(endDate)
      };
    }

    const activities = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json(activities);

  } catch (error) {
    logger.error('Error fetching user activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

module.exports = router;