const express = require('express');
const { body, validationResult } = require('express-validator');
const tenantService = require('../../services/tenantService');
const logger = require('../../utils/logger');
const { requireBackOfficeAuth, loadBackOfficeUser } = require('../../middleware/backoffice-auth');

const router = express.Router();

// Apply superadmin authentication and load user data to all routes
router.use(requireBackOfficeAuth);
router.use(loadBackOfficeUser);

// Validation rules
const validateTenant = [
  body('name')
    .notEmpty()
    .withMessage('Tenant name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('slug')
    .notEmpty()
    .withMessage('Subdomain is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Subdomain must be between 3 and 50 characters')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Subdomain can only contain lowercase letters, numbers, and hyphens'),
  
  body('adminEmail')
    .notEmpty()
    .withMessage('Admin email is required')
    .isEmail()
    .withMessage('Please provide a valid email address'),
  
  body('adminName')
    .notEmpty()
    .withMessage('Admin name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Admin name must be between 2 and 100 characters'),
  
  body('adminPassword')
    .notEmpty()
    .withMessage('Admin password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
];

// Validation rules for update (without password requirement)
const validateTenantUpdate = [
  body('name')
    .notEmpty()
    .withMessage('Tenant name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
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

    res.render('backoffice/tenants/index', {
      title: 'Tenant Management - BackOffice',
      pageTitle: 'QMS BackOffice',
      contentTitle: 'Tenant Management',
      contentSubtitle: 'Manage multi-tenant accounts and subscriptions',
      tenants: result.tenants,
      pagination: result.pagination,
      filters: { search, status, plan },
      backOfficeUser: res.locals.backOfficeUser || req.backOfficeUser,
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Error fetching tenants:', error);
    req.flash('error', 'Failed to load tenants');
    res.redirect('/backoffice/dashboard');
  }
});

// Show create tenant form
router.get('/create', (req, res) => {
  res.render('backoffice/tenants/form', {
    title: 'Create Tenant - BackOffice',
    pageTitle: 'QMS BackOffice',
    contentTitle: 'Create New Tenant',
    contentSubtitle: 'Add a new multi-tenant account to the system',
    tenant: null,
    action: 'create',
    backOfficeUser: res.locals.backOfficeUser || req.backOfficeUser,
    csrfToken: res.locals.csrfToken || ''
  });
});

// Create new tenant
router.post('/', validateTenant, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('backoffice/tenants/form', {
        title: 'Create Tenant - BackOffice',
        pageTitle: 'QMS BackOffice',
        contentTitle: 'Create New Tenant',
        contentSubtitle: 'Add a new multi-tenant account to the system',
        tenant: req.body,
        action: 'create',
        errors: errors.array(),
        backOfficeUser: res.locals.backOfficeUser || req.backOfficeUser,
        csrfToken: res.locals.csrfToken || ''
      });
    }

    const tenantData = {
      name: req.body.name,
      slug: req.body.slug,
      domain: req.body.domain || null,
      adminEmail: req.body.adminEmail,
      adminName: req.body.adminName,
      adminPassword: req.body.adminPassword,
      businessType: req.body.businessType || 'restaurant',
      phone: req.body.phone,
      timezone: req.body.timezone,
      plan: req.body.plan || 'basic',
      maxMerchants: req.body.maxMerchants || 1,
      maxQueuesPerMerchant: req.body.maxQueuesPerMerchant || 3,
      maxCustomersPerQueue: req.body.maxCustomersPerQueue || 200,
      aiFeatures: req.body.aiFeatures === 'true',
      analytics: req.body.analytics === 'true',
      customBranding: req.body.customBranding === 'true'
    };

    const result = await tenantService.create(tenantData);
    const tenant = result.tenant;
    
    logger.info(`BackOffice ${(req.backOfficeUser || res.locals.backOfficeUser).email} created tenant: ${tenant.name}`);
    
    // Redirect to welcome page
    res.redirect(`/backoffice/tenants/${tenant.id}/welcome`);

  } catch (error) {
    logger.error('Error creating tenant:', error);
    
    let errorMessage = 'Failed to create tenant';
    if (error.message.includes('Domain is already taken')) {
      errorMessage = 'Domain is already taken by another tenant';
    }
    
    return res.render('backoffice/tenants/form', {
      title: 'Create Tenant - BackOffice',
      pageTitle: 'QMS BackOffice',
      contentTitle: 'Create New Tenant',
      contentSubtitle: 'Add a new multi-tenant account to the system',
      tenant: req.body,
      action: 'create',
      errors: [{ msg: errorMessage }],
      backOfficeUser: res.locals.backOfficeUser || req.backOfficeUser,
      csrfToken: res.locals.csrfToken || ''
    });
  }
});

// Show welcome page after tenant creation
router.get('/:id/welcome', async (req, res) => {
  try {
    const tenant = await tenantService.findById(req.params.id);
    if (!tenant) {
      req.flash('error', 'Tenant not found');
      return res.redirect('/backoffice/tenants');
    }

    // Get admin email from the most recent tenant user
    const adminUser = tenant.users?.[0];
    const adminEmail = adminUser?.email || tenant.adminEmail || 'admin@' + tenant.slug + '.com';
    
    // Determine plan name
    const planNames = {
      'standard': 'Basic',
      'high': 'Premium',
      'enterprise': 'Enterprise'
    };
    const plan = planNames[tenant.subscription?.priority] || 'Free';

    res.render('backoffice/tenants/welcome', {
      title: 'Welcome to StoreHub QMS',
      pageTitle: 'QMS BackOffice',
      contentTitle: 'Welcome!',
      contentSubtitle: 'Your tenant has been created successfully',
      tenant,
      adminEmail,
      plan,
      backOfficeUser: res.locals.backOfficeUser || req.backOfficeUser,
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Error loading welcome page:', error);
    req.flash('error', 'Failed to load welcome page');
    res.redirect('/backoffice/tenants');
  }
});

// Show tenant details
router.get('/:id', async (req, res) => {
  try {
    const tenant = await tenantService.findById(req.params.id);
    if (!tenant) {
      req.flash('error', 'Tenant not found');
      return res.redirect('/backoffice/tenants');
    }

    const [usage, limits] = await Promise.all([
      tenantService.getUsageStats(tenant.id),
      tenantService.checkSubscriptionLimits(tenant.id)
    ]);

    res.render('backoffice/tenants/show', {
      title: `${tenant.name} - Tenant Details`,
      pageTitle: 'QMS BackOffice',
      contentTitle: `${tenant.name}`,
      contentSubtitle: 'Tenant details and subscription information',
      tenant,
      usage,
      limits,
      backOfficeUser: res.locals.backOfficeUser || req.backOfficeUser,
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Error fetching tenant details:', error);
    req.flash('error', 'Failed to load tenant details');
    res.redirect('/backoffice/tenants');
  }
});

// Show edit tenant form
router.get('/:id/edit', async (req, res) => {
  try {
    const tenant = await tenantService.findById(req.params.id);
    if (!tenant) {
      req.flash('error', 'Tenant not found');
      return res.redirect('/backoffice/tenants');
    }

    res.render('backoffice/tenants/form', {
      title: `Edit ${tenant.name} - BackOffice`,
      pageTitle: 'QMS BackOffice',
      contentTitle: `Edit ${tenant.name}`,
      contentSubtitle: 'Update tenant information and settings',
      tenant,
      action: 'edit',
      backOfficeUser: res.locals.backOfficeUser || req.backOfficeUser,
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Error fetching tenant for edit:', error);
    req.flash('error', 'Failed to load tenant');
    res.redirect('/backoffice/tenants');
  }
});

// Update tenant
router.put('/:id', validateTenantUpdate, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const tenant = await tenantService.findById(req.params.id);
      return res.render('backoffice/tenants/form', {
        title: `Edit ${tenant.name} - BackOffice`,
        pageTitle: 'QMS BackOffice',
        contentTitle: `Edit ${tenant.name}`,
        contentSubtitle: 'Update tenant information and settings',
        tenant: { ...tenant, ...req.body },
        action: 'edit',
        errors: errors.array(),
        backOfficeUser: res.locals.backOfficeUser || req.backOfficeUser,
        csrfToken: res.locals.csrfToken || ''
      });
    }

    const updateData = {
      name: req.body.name,
      domain: req.body.domain || null,
      isActive: req.body.isActive === 'on',
      businessType: req.body.businessType,
      phone: req.body.phone,
      timezone: req.body.timezone
    };

    const tenant = await tenantService.update(req.params.id, updateData);
    
    logger.info(`BackOffice ${(req.backOfficeUser || res.locals.backOfficeUser).email} updated tenant: ${tenant.name}`);
    req.flash('success', `Tenant "${tenant.name}" updated successfully`);
    res.redirect(`/backoffice/tenants/${tenant.id}`);

  } catch (error) {
    logger.error('Error updating tenant:', error);
    
    let errorMessage = 'Failed to update tenant';
    if (error.message.includes('Domain is already taken')) {
      errorMessage = 'Domain is already taken by another tenant';
    }
    
    const tenant = await tenantService.findById(req.params.id);
    return res.render('backoffice/tenants/form', {
      title: `Edit ${tenant.name} - BackOffice`,
      tenant: { ...tenant, ...req.body },
      action: 'edit',
      errors: [{ msg: errorMessage }],
      backOfficeUser: res.locals.backOfficeUser || req.backOfficeUser,
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
    logger.info(`BackOffice ${(req.backOfficeUser || res.locals.backOfficeUser).email} ${action} tenant: ${tenant.name}`);
    
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
    
    logger.info(`BackOffice ${(req.backOfficeUser || res.locals.backOfficeUser).email} deleted tenant: ${tenant.name}`);
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
    
    logger.info(`BackOffice ${(req.backOfficeUser || res.locals.backOfficeUser).email} performed bulk ${action} on ${tenantIds.length} tenants`);
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
      slug: tenant.slug,
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

// Check subdomain availability
router.post('/api/check-subdomain', async (req, res) => {
  try {
    const { slug } = req.body;
    
    if (!slug || slug.length < 3) {
      return res.json({ 
        available: false, 
        message: 'Subdomain must be at least 3 characters' 
      });
    }
    
    const existing = await tenantService.search(slug, 1);
    const isAvailable = !existing.some(t => t.slug === slug);
    
    res.json({
      available: isAvailable,
      message: isAvailable ? 'Subdomain is available' : 'Subdomain is already taken'
    });
    
  } catch (error) {
    logger.error('Error checking subdomain:', error);
    res.status(500).json({ error: 'Failed to check subdomain' });
  }
});

// Provision subdomain for existing tenant
router.post('/:id/provision-subdomain', async (req, res) => {
  try {
    const tenant = await tenantService.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    if (!tenant.slug) {
      return res.status(400).json({ error: 'Tenant does not have a subdomain slug' });
    }
    
    const renderApiService = require('../../services/renderApiService');
    await renderApiService.provisionSubdomain(tenant);
    
    logger.info(`BackOffice ${(req.backOfficeUser || res.locals.backOfficeUser).email} provisioned subdomain for tenant: ${tenant.name}`);
    res.json({ 
      success: true, 
      message: 'Subdomain provisioning initiated',
      subdomain: `${tenant.slug}.storehubqms.com`
    });
    
  } catch (error) {
    logger.error('Error provisioning subdomain:', error);
    res.status(500).json({ error: 'Failed to provision subdomain' });
  }
});

// Check subdomain status
router.get('/:id/subdomain-status', async (req, res) => {
  try {
    const tenant = await tenantService.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    if (!tenant.slug) {
      return res.json({ 
        status: 'not_configured',
        message: 'No subdomain configured'
      });
    }
    
    const renderApiService = require('../../services/renderApiService');
    const status = await renderApiService.checkDomainStatus(tenant.slug);
    
    res.json({
      subdomain: `${tenant.slug}.storehubqms.com`,
      ...status
    });
    
  } catch (error) {
    logger.error('Error checking subdomain status:', error);
    res.status(500).json({ error: 'Failed to check subdomain status' });
  }
});

module.exports = router;