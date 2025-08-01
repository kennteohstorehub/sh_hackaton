const express = require('express');
const { body, validationResult } = require('express-validator');
const tenantService = require('../../services/tenantService');
const logger = require('../../utils/logger');
const { requireSuperAdminAuth } = require('../../middleware/superadmin-auth');

const router = express.Router();

// Apply superadmin authentication to all routes
router.use(requireSuperAdminAuth);

// Validation rules
const validateTenant = [
  body('name')
    .notEmpty()
    .withMessage('Tenant name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('domain')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Domain must be between 3 and 50 characters')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Domain can only contain lowercase letters, numbers, and hyphens'),
  
  body('plan')
    .isIn(['free', 'basic', 'premium', 'enterprise'])
    .withMessage('Invalid subscription plan'),
  
  body('billingCycle')
    .isIn(['monthly', 'yearly'])
    .withMessage('Invalid billing cycle'),
  
  body('maxMerchants')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Max merchants must be between 1 and 1000'),
  
  body('maxQueuesPerMerchant')
    .isInt({ min: 1, max: 100 })
    .withMessage('Max queues per merchant must be between 1 and 100'),
  
  body('maxCustomersPerQueue')
    .isInt({ min: 10, max: 10000 })
    .withMessage('Max customers per queue must be between 10 and 10000')
];

// List all tenants
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      search = '',
      status = 'all',
      plan = 'all'
    } = req.query;

    const result = await tenantService.findAll({
      page: parseInt(page),
      limit: 20,
      search,
      status,
      plan
    });

    res.render('superadmin/tenants/index', {
      title: 'Tenant Management - SuperAdmin',
      tenants: result.tenants,
      pagination: result.pagination,
      filters: { search, status, plan },
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Error fetching tenants:', error);
    req.flash('error', 'Failed to load tenants');
    res.redirect('/superadmin/dashboard');
  }
});

// Show create tenant form
router.get('/create', (req, res) => {
  res.render('superadmin/tenants/form', {
    title: 'Create Tenant - SuperAdmin',
    tenant: null,
    action: 'create',
    csrfToken: res.locals.csrfToken || ''
  });
});

// Create new tenant
router.post('/', validateTenant, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('superadmin/tenants/form', {
        title: 'Create Tenant - SuperAdmin',
        tenant: req.body,
        action: 'create',
        errors: errors.array(),
        csrfToken: res.locals.csrfToken || ''
      });
    }

    const tenantData = {
      name: req.body.name,
      domain: req.body.domain || null,
      plan: req.body.plan,
      billingCycle: req.body.billingCycle,
      maxMerchants: parseInt(req.body.maxMerchants),
      maxQueuesPerMerchant: parseInt(req.body.maxQueuesPerMerchant),
      maxCustomersPerQueue: parseInt(req.body.maxCustomersPerQueue),
      aiFeatures: req.body.aiFeatures === 'on',
      analytics: req.body.analytics === 'on',
      customBranding: req.body.customBranding === 'on'
    };

    const tenant = await tenantService.create(tenantData);
    
    logger.info(`SuperAdmin ${req.superAdmin.email} created tenant: ${tenant.name}`);
    req.flash('success', `Tenant "${tenant.name}" created successfully`);
    res.redirect('/superadmin/tenants');

  } catch (error) {
    logger.error('Error creating tenant:', error);
    
    let errorMessage = 'Failed to create tenant';
    if (error.message.includes('Domain is already taken')) {
      errorMessage = 'Domain is already taken by another tenant';
    }
    
    return res.render('superadmin/tenants/form', {
      title: 'Create Tenant - SuperAdmin',
      tenant: req.body,
      action: 'create',
      errors: [{ msg: errorMessage }],
      csrfToken: res.locals.csrfToken || ''
    });
  }
});

// Show tenant details
router.get('/:id', async (req, res) => {
  try {
    const tenant = await tenantService.findById(req.params.id);
    if (!tenant) {
      req.flash('error', 'Tenant not found');
      return res.redirect('/superadmin/tenants');
    }

    const [usage, limits] = await Promise.all([
      tenantService.getUsageStats(tenant.id),
      tenantService.checkSubscriptionLimits(tenant.id)
    ]);

    res.render('superadmin/tenants/show', {
      title: `${tenant.name} - Tenant Details`,
      tenant,
      usage,
      limits,
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Error fetching tenant details:', error);
    req.flash('error', 'Failed to load tenant details');
    res.redirect('/superadmin/tenants');
  }
});

// Show edit tenant form
router.get('/:id/edit', async (req, res) => {
  try {
    const tenant = await tenantService.findById(req.params.id);
    if (!tenant) {
      req.flash('error', 'Tenant not found');
      return res.redirect('/superadmin/tenants');
    }

    res.render('superadmin/tenants/form', {
      title: `Edit ${tenant.name} - SuperAdmin`,
      tenant,
      action: 'edit',
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Error fetching tenant for edit:', error);
    req.flash('error', 'Failed to load tenant');
    res.redirect('/superadmin/tenants');
  }
});

// Update tenant
router.put('/:id', validateTenant, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const tenant = await tenantService.findById(req.params.id);
      return res.render('superadmin/tenants/form', {
        title: `Edit ${tenant.name} - SuperAdmin`,
        tenant: { ...tenant, ...req.body },
        action: 'edit',
        errors: errors.array(),
        csrfToken: res.locals.csrfToken || ''
      });
    }

    const updateData = {
      name: req.body.name,
      domain: req.body.domain || null,
      isActive: req.body.isActive === 'on',
      subscription: {
        plan: req.body.plan,
        billingCycle: req.body.billingCycle,
        maxMerchants: parseInt(req.body.maxMerchants),
        maxQueuesPerMerchant: parseInt(req.body.maxQueuesPerMerchant),
        maxCustomersPerQueue: parseInt(req.body.maxCustomersPerQueue),
        aiFeatures: req.body.aiFeatures === 'on',
        analytics: req.body.analytics === 'on',
        customBranding: req.body.customBranding === 'on'
      }
    };

    const tenant = await tenantService.update(req.params.id, updateData);
    
    logger.info(`SuperAdmin ${req.superAdmin.email} updated tenant: ${tenant.name}`);
    req.flash('success', `Tenant "${tenant.name}" updated successfully`);
    res.redirect(`/superadmin/tenants/${tenant.id}`);

  } catch (error) {
    logger.error('Error updating tenant:', error);
    
    let errorMessage = 'Failed to update tenant';
    if (error.message.includes('Domain is already taken')) {
      errorMessage = 'Domain is already taken by another tenant';
    }
    
    const tenant = await tenantService.findById(req.params.id);
    return res.render('superadmin/tenants/form', {
      title: `Edit ${tenant.name} - SuperAdmin`,
      tenant: { ...tenant, ...req.body },
      action: 'edit',
      errors: [{ msg: errorMessage }],
      csrfToken: res.locals.csrfToken || ''
    });
  }
});

// Toggle tenant status (activate/deactivate)
router.post('/:id/toggle-status', async (req, res) => {
  try {
    const tenant = await tenantService.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const updatedTenant = await tenantService.update(req.params.id, {
      isActive: !tenant.isActive
    });

    const action = updatedTenant.isActive ? 'activated' : 'deactivated';
    logger.info(`SuperAdmin ${req.superAdmin.email} ${action} tenant: ${tenant.name}`);
    
    res.json({ 
      success: true, 
      message: `Tenant ${action} successfully`,
      isActive: updatedTenant.isActive
    });

  } catch (error) {
    logger.error('Error toggling tenant status:', error);
    res.status(500).json({ error: 'Failed to update tenant status' });
  }
});

// Delete tenant (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const tenant = await tenantService.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    await tenantService.delete(req.params.id);
    
    logger.info(`SuperAdmin ${req.superAdmin.email} deleted tenant: ${tenant.name}`);
    res.json({ success: true, message: 'Tenant deleted successfully' });

  } catch (error) {
    logger.error('Error deleting tenant:', error);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
});

// Bulk operations
router.post('/bulk', async (req, res) => {
  try {
    const { action, tenantIds } = req.body;
    
    if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
      return res.status(400).json({ error: 'No tenants selected' });
    }

    let updateData = {};
    let message = '';

    switch (action) {
      case 'activate':
        updateData = { isActive: true };
        message = `${tenantIds.length} tenants activated`;
        break;
      case 'deactivate':
        updateData = { isActive: false };
        message = `${tenantIds.length} tenants deactivated`;
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    await tenantService.bulkUpdate(tenantIds, updateData);
    
    logger.info(`SuperAdmin ${req.superAdmin.email} performed bulk ${action} on ${tenantIds.length} tenants`);
    res.json({ success: true, message });

  } catch (error) {
    logger.error('Error performing bulk operation:', error);
    res.status(500).json({ error: 'Failed to perform bulk operation' });
  }
});

// Search tenants (AJAX endpoint)
router.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const tenants = await tenantService.search(q, 10);
    res.json(tenants.map(tenant => ({
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      plan: tenant.subscription?.plan || 'free',
      merchantCount: tenant._count.merchants,
      isActive: tenant.isActive
    })));

  } catch (error) {
    logger.error('Error searching tenants:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;