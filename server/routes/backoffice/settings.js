const express = require('express');
const { body, validationResult } = require('express-validator');
const logger = require('../../utils/logger');
const { requireBackOfficeAuth, loadBackOfficeUser } = require('../../middleware/backoffice-auth');
const prisma = require('../../utils/prisma');
const bcrypt = require('bcryptjs');
const systemSettingsService = require('../../services/systemSettingsService');

const router = express.Router();

// Apply backoffice authentication and load user data to all routes
router.use(requireBackOfficeAuth);
router.use(loadBackOfficeUser);

// BackOffice settings page
router.get('/', async (req, res) => {
  try {
    // Get all settings from database
    const allSettings = await systemSettingsService.getAllSettings();
    
    // Get current backoffice user details
    const backOfficeUser = await prisma.backOfficeUser.findUnique({
      where: { id: req.session.backOfficeUser.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        isActive: true,
        lastLogin: true,
        createdAt: true
      }
    });

    res.render('backoffice/settings/index', {
      title: 'Settings - BackOffice',
      pageTitle: 'QMS BackOffice',
      contentTitle: 'System Settings',
      contentSubtitle: 'Manage system configuration',
      generalSettings: allSettings.general || {},
      securitySettings: allSettings.security || {},
      emailSettings: allSettings.email || {},
      notificationSettings: allSettings.notification || {},
      backOfficeUser,
      csrfToken: res.locals.csrfToken || ''
    });

  } catch (error) {
    logger.error('Error loading settings:', error);
    res.render('error', {
      title: 'Settings Error',
      status: 500,
      message: 'Failed to load settings',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Update general settings
router.post('/general', [
  body('siteName').notEmpty().withMessage('Site name is required'),
  body('supportEmail').isEmail().withMessage('Valid support email is required'),
  body('timezone').notEmpty().withMessage('Timezone is required'),
  body('dateFormat').notEmpty().withMessage('Date format is required'),
  body('timeFormat').isIn(['12h', '24h']).withMessage('Invalid time format'),
  body('language').notEmpty().withMessage('Language is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array().map(e => e.msg).join(', '));
      return res.redirect('/backoffice/settings');
    }

    const settings = {
      siteName: req.body.siteName,
      supportEmail: req.body.supportEmail,
      timezone: req.body.timezone,
      dateFormat: req.body.dateFormat,
      timeFormat: req.body.timeFormat,
      language: req.body.language,
      maintenanceMode: req.body.maintenanceMode === 'on'
    };

    await systemSettingsService.updateSettingsByCategory('general', settings, req.session.backOfficeUser.email);
    
    logger.info(`BackOffice ${req.session.backOfficeUser.email} updated general settings`);
    req.flash('success', 'General settings updated successfully');
    res.redirect('/backoffice/settings');

  } catch (error) {
    logger.error('Error updating general settings:', error);
    req.flash('error', 'Failed to update general settings');
    res.redirect('/backoffice/settings');
  }
});

// Update notification settings
router.post('/notifications', async (req, res) => {
  try {
    const settings = {
      emailEnabled: req.body.emailEnabled === 'on',
      newTenantAlert: req.body.newTenantAlert === 'on',
      systemAlert: req.body.systemAlert === 'on',
      securityAlert: req.body.securityAlert === 'on',
      weeklyReport: req.body.weeklyReport === 'on',
      monthlyReport: req.body.monthlyReport === 'on'
    };

    await systemSettingsService.updateSettingsByCategory('notification', settings, req.session.backOfficeUser.email);
    
    logger.info(`BackOffice ${req.session.backOfficeUser.email} updated notification settings`);
    req.flash('success', 'Notification settings updated successfully');
    res.redirect('/backoffice/settings');

  } catch (error) {
    logger.error('Error updating notification settings:', error);
    req.flash('error', 'Failed to update notification settings');
    res.redirect('/backoffice/settings');
  }
});

// Update security settings
router.post('/security', [
  body('sessionTimeout').isInt({ min: 15, max: 1440 }).withMessage('Session timeout must be between 15 and 1440 minutes'),
  body('passwordMinLength').isInt({ min: 6, max: 50 }).withMessage('Password minimum length must be between 6 and 50'),
  body('maxLoginAttempts').isInt({ min: 3, max: 20 }).withMessage('Max login attempts must be between 3 and 20'),
  body('lockoutDuration').isInt({ min: 5, max: 1440 }).withMessage('Lockout duration must be between 5 and 1440 minutes')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array().map(e => e.msg).join(', '));
      return res.redirect('/backoffice/settings');
    }

    const settings = {
      sessionTimeout: parseInt(req.body.sessionTimeout),
      requireTwoFactor: req.body.requireTwoFactor === 'on',
      passwordMinLength: parseInt(req.body.passwordMinLength),
      passwordRequireNumbers: req.body.passwordRequireNumbers === 'on',
      passwordRequireSymbols: req.body.passwordRequireSymbols === 'on',
      maxLoginAttempts: parseInt(req.body.maxLoginAttempts),
      lockoutDuration: parseInt(req.body.lockoutDuration),
      allowedIpRanges: req.body.allowedIpRanges || ''
    };

    await systemSettingsService.updateSettingsByCategory('security', settings, req.session.backOfficeUser.email);
    
    logger.info(`BackOffice ${req.session.backOfficeUser.email} updated security settings`);
    req.flash('success', 'Security settings updated successfully');
    res.redirect('/backoffice/settings');

  } catch (error) {
    logger.error('Error updating security settings:', error);
    req.flash('error', 'Failed to update security settings');
    res.redirect('/backoffice/settings');
  }
});

// Update email settings
router.post('/email', [
  body('provider').isIn(['smtp', 'sendgrid', 'ses']).withMessage('Invalid email provider'),
  body('fromName').notEmpty().withMessage('Sender name is required'),
  body('fromEmail').isEmail().withMessage('Valid sender email is required'),
  body('smtpHost').if(body('provider').equals('smtp')).notEmpty().withMessage('SMTP host is required for SMTP provider'),
  body('smtpPort').if(body('provider').equals('smtp')).isInt({ min: 1, max: 65535 }).withMessage('Valid SMTP port is required'),
  body('smtpUser').if(body('provider').equals('smtp')).notEmpty().withMessage('SMTP username is required'),
  body('sendgridApiKey').if(body('provider').equals('sendgrid')).notEmpty().withMessage('SendGrid API key is required'),
  body('awsAccessKeyId').if(body('provider').equals('ses')).notEmpty().withMessage('AWS Access Key ID is required'),
  body('awsSecretAccessKey').if(body('provider').equals('ses')).notEmpty().withMessage('AWS Secret Access Key is required'),
  body('awsRegion').if(body('provider').equals('ses')).notEmpty().withMessage('AWS region is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array().map(e => e.msg).join(', '));
      return res.redirect('/backoffice/settings');
    }

    const settings = {
      provider: req.body.provider,
      fromName: req.body.fromName,
      fromEmail: req.body.fromEmail,
      smtpHost: req.body.smtpHost || '',
      smtpPort: parseInt(req.body.smtpPort) || 587,
      smtpSecure: req.body.smtpSecure === 'on',
      smtpUser: req.body.smtpUser || '',
      smtpPassword: req.body.smtpPassword || '',
      sendgridApiKey: req.body.sendgridApiKey || '',
      awsAccessKeyId: req.body.awsAccessKeyId || '',
      awsSecretAccessKey: req.body.awsSecretAccessKey || '',
      awsRegion: req.body.awsRegion || 'us-east-1'
    };

    // Don't update empty passwords (keep existing)
    if (!settings.smtpPassword && req.body.provider === 'smtp') {
      const currentSettings = await systemSettingsService.getSettingsByCategory('email');
      settings.smtpPassword = currentSettings.smtpPassword || '';
    }

    await systemSettingsService.updateSettingsByCategory('email', settings, req.session.backOfficeUser.email);
    
    logger.info(`BackOffice ${req.session.backOfficeUser.email} updated email settings`);
    req.flash('success', 'Email settings updated successfully');
    res.redirect('/backoffice/settings');

  } catch (error) {
    logger.error('Error updating email settings:', error);
    req.flash('error', 'Failed to update email settings');
    res.redirect('/backoffice/settings');
  }
});

// Test email configuration
router.post('/email/test', [
  body('testEmail').isEmail().withMessage('Valid test email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array().map(e => e.msg).join(', ') });
    }

    const result = await systemSettingsService.testEmailConfiguration(req.body.testEmail);
    
    if (result.success) {
      logger.info(`BackOffice ${req.session.backOfficeUser.email} tested email configuration`);
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }

  } catch (error) {
    logger.error('Error testing email configuration:', error);
    res.status(500).json({ error: 'Failed to test email configuration' });
  }
});

// Update user profile
router.post('/profile', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('currentPassword').optional().isLength({ min: 8 }).withMessage('Current password must be at least 8 characters'),
  body('newPassword').optional().isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  body('confirmPassword').optional().custom((value, { req }) => {
    if (req.body.newPassword && value !== req.body.newPassword) {
      throw new Error('Password confirmation does not match');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array().map(e => e.msg).join(', '));
      return res.redirect('/backoffice/settings');
    }

    const updateData = {
      fullName: req.body.name,
      email: req.body.email
    };

    // Handle password change
    if (req.body.newPassword) {
      if (!req.body.currentPassword) {
        req.flash('error', 'Current password is required to change password');
        return res.redirect('/backoffice/settings');
      }

      const user = await prisma.backOfficeUser.findUnique({
        where: { id: req.session.backOfficeUser.id }
      });

      const validPassword = await bcrypt.compare(req.body.currentPassword, user.password);
      if (!validPassword) {
        req.flash('error', 'Current password is incorrect');
        return res.redirect('/backoffice/settings');
      }

      updateData.password = await bcrypt.hash(req.body.newPassword, 12);
    }

    const updatedUser = await prisma.backOfficeUser.update({
      where: { id: req.session.backOfficeUser.id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        isActive: true
      }
    });

    // Update session
    req.session.backOfficeUser = updatedUser;
    
    logger.info(`BackOffice ${req.session.backOfficeUser.email} updated their profile`);
    req.flash('success', 'Profile updated successfully');
    res.redirect('/backoffice/settings');

  } catch (error) {
    logger.error('Error updating profile:', error);
    req.flash('error', 'Failed to update profile');
    res.redirect('/backoffice/settings');
  }
});

// Get system statistics (AJAX endpoint)
router.get('/api/stats', async (req, res) => {
  try {
    const [tenantStats, userStats, queueStats, systemInfo] = await Promise.all([
      prisma.tenant.groupBy({
        by: ['isActive'],
        _count: { isActive: true }
      }),
      prisma.user.groupBy({
        by: ['isActive'],
        _count: { isActive: true }
      }),
      prisma.queue.groupBy({
        by: ['isActive'],
        _count: { isActive: true }
      }),
      getSystemInfo()
    ]);

    const stats = {
      tenants: {
        total: tenantStats.reduce((sum, stat) => sum + stat._count.isActive, 0),
        active: tenantStats.find(s => s.isActive)?._count.isActive || 0
      },
      users: {
        total: userStats.reduce((sum, stat) => sum + stat._count.isActive, 0),
        active: userStats.find(s => s.isActive)?._count.isActive || 0
      },
      queues: {
        total: queueStats.reduce((sum, stat) => sum + stat._count.isActive, 0),
        active: queueStats.find(s => s.isActive)?._count.isActive || 0
      },
      system: systemInfo
    };

    res.json(stats);

  } catch (error) {
    logger.error('Error fetching system stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Helper functions
async function getSystemSettings() {
  // In a real implementation, these would be stored in a settings table
  // For now, return default values
  return {
    siteName: process.env.SITE_NAME || 'QMS BackOffice',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@storehubqms.com',
    allowRegistration: process.env.ALLOW_REGISTRATION !== 'false',
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
    maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
    maxTenantsPerPlan: {
      free: parseInt(process.env.MAX_FREE_TENANTS) || 1000,
      basic: parseInt(process.env.MAX_BASIC_TENANTS) || 5000,
      premium: parseInt(process.env.MAX_PREMIUM_TENANTS) || 10000,
      enterprise: parseInt(process.env.MAX_ENTERPRISE_TENANTS) || 50000
    }
  };
}

async function getNotificationSettings() {
  return {
    emailNotifications: true,
    newTenantAlerts: true,
    systemAlerts: true,
    securityAlerts: true,
    weeklyReports: false,
    monthlyReports: true
  };
}

async function getSecuritySettings() {
  return {
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 480, // 8 hours
    requireTwoFactor: process.env.REQUIRE_2FA === 'true',
    passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH) || 8,
    requirePasswordNumbers: true,
    requirePasswordSymbols: false,
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 30, // minutes
    allowedIpRanges: process.env.ALLOWED_IP_RANGES || ''
  };
}

async function updateSystemSettings(settings) {
  // In a real implementation, store these in a settings table
  logger.info('System settings updated:', settings);
}

async function updateNotificationSettings(settings) {
  // In a real implementation, store these in a settings table
  logger.info('Notification settings updated:', settings);
}

async function updateSecuritySettings(settings) {
  // In a real implementation, store these in a settings table
  logger.info('Security settings updated:', settings);
}

async function getSystemInfo() {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    uptime: Math.floor(process.uptime()),
    memoryUsage: process.memoryUsage(),
    env: process.env.NODE_ENV || 'development'
  };
}

module.exports = router;