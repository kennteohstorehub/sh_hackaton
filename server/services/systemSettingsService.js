const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

/**
 * System Settings Service
 * Manages all system-wide configuration settings
 */
class SystemSettingsService {
  constructor() {
    this.defaultSettings = {
      // General Settings
      'general.siteName': {
        value: 'QMS BackOffice',
        category: 'general',
        description: 'System display name'
      },
      'general.supportEmail': {
        value: 'support@storehubqms.com',
        category: 'general',
        description: 'Support contact email'
      },
      'general.timezone': {
        value: 'Asia/Kuala_Lumpur',
        category: 'general',
        description: 'System default timezone'
      },
      'general.dateFormat': {
        value: 'DD/MM/YYYY',
        category: 'general',
        description: 'System date format'
      },
      'general.timeFormat': {
        value: '24h',
        category: 'general',
        description: 'Time format (12h or 24h)'
      },
      'general.language': {
        value: 'en',
        category: 'general',
        description: 'System default language'
      },
      'general.maintenanceMode': {
        value: false,
        category: 'general',
        description: 'Enable maintenance mode'
      },
      
      // Security Settings
      'security.sessionTimeout': {
        value: 480,
        category: 'security',
        description: 'Session timeout in minutes'
      },
      'security.passwordMinLength': {
        value: 8,
        category: 'security',
        description: 'Minimum password length'
      },
      'security.passwordRequireNumbers': {
        value: true,
        category: 'security',
        description: 'Require numbers in passwords'
      },
      'security.passwordRequireSymbols': {
        value: false,
        category: 'security',
        description: 'Require special symbols in passwords'
      },
      'security.maxLoginAttempts': {
        value: 5,
        category: 'security',
        description: 'Maximum failed login attempts'
      },
      'security.lockoutDuration': {
        value: 30,
        category: 'security',
        description: 'Account lockout duration in minutes'
      },
      'security.requireTwoFactor': {
        value: false,
        category: 'security',
        description: 'Require two-factor authentication'
      },
      'security.allowedIpRanges': {
        value: '',
        category: 'security',
        description: 'Allowed IP ranges (comma-separated)'
      },
      
      // Email Settings
      'email.provider': {
        value: 'smtp',
        category: 'email',
        description: 'Email provider (smtp, sendgrid, ses)'
      },
      'email.fromName': {
        value: 'QMS BackOffice',
        category: 'email',
        description: 'Default sender name'
      },
      'email.fromEmail': {
        value: 'noreply@storehubqms.com',
        category: 'email',
        description: 'Default sender email'
      },
      'email.smtpHost': {
        value: '',
        category: 'email',
        description: 'SMTP server host'
      },
      'email.smtpPort': {
        value: 587,
        category: 'email',
        description: 'SMTP server port'
      },
      'email.smtpSecure': {
        value: true,
        category: 'email',
        description: 'Use TLS/SSL for SMTP'
      },
      'email.smtpUser': {
        value: '',
        category: 'email',
        description: 'SMTP username'
      },
      'email.smtpPassword': {
        value: '',
        category: 'email',
        description: 'SMTP password'
      },
      'email.sendgridApiKey': {
        value: '',
        category: 'email',
        description: 'SendGrid API key'
      },
      'email.awsAccessKeyId': {
        value: '',
        category: 'email',
        description: 'AWS Access Key ID for SES'
      },
      'email.awsSecretAccessKey': {
        value: '',
        category: 'email',
        description: 'AWS Secret Access Key for SES'
      },
      'email.awsRegion': {
        value: 'us-east-1',
        category: 'email',
        description: 'AWS region for SES'
      },
      
      // Notification Settings
      'notification.emailEnabled': {
        value: true,
        category: 'notification',
        description: 'Enable email notifications'
      },
      'notification.newTenantAlert': {
        value: true,
        category: 'notification',
        description: 'Alert on new tenant registration'
      },
      'notification.systemAlert': {
        value: true,
        category: 'notification',
        description: 'Alert on system errors'
      },
      'notification.securityAlert': {
        value: true,
        category: 'notification',
        description: 'Alert on security events'
      },
      'notification.weeklyReport': {
        value: false,
        category: 'notification',
        description: 'Send weekly reports'
      },
      'notification.monthlyReport': {
        value: true,
        category: 'notification',
        description: 'Send monthly reports'
      }
    };
  }

  /**
   * Initialize default settings in database
   */
  async initializeSettings() {
    try {
      for (const [key, config] of Object.entries(this.defaultSettings)) {
        await prisma.systemSettings.upsert({
          where: { key },
          create: {
            key,
            value: config.value,
            category: config.category,
            description: config.description
          },
          update: {} // Don't overwrite existing values
        });
      }
      
      logger.info('System settings initialized');
    } catch (error) {
      logger.error('Failed to initialize system settings:', error);
    }
  }

  /**
   * Get all settings by category
   */
  async getSettingsByCategory(category) {
    try {
      const settings = await prisma.systemSettings.findMany({
        where: { category },
        orderBy: { key: 'asc' }
      });
      
      // Convert to key-value object
      const result = {};
      settings.forEach(setting => {
        const shortKey = setting.key.replace(`${category}.`, '');
        result[shortKey] = setting.value;
      });
      
      return result;
    } catch (error) {
      logger.error(`Failed to get ${category} settings:`, error);
      throw error;
    }
  }

  /**
   * Get a single setting value
   */
  async getSetting(key) {
    try {
      const setting = await prisma.systemSettings.findUnique({
        where: { key }
      });
      
      return setting?.value ?? this.defaultSettings[key]?.value;
    } catch (error) {
      logger.error(`Failed to get setting ${key}:`, error);
      return this.defaultSettings[key]?.value;
    }
  }

  /**
   * Update settings by category
   */
  async updateSettingsByCategory(category, settings, updatedBy) {
    try {
      const updates = [];
      
      for (const [shortKey, value] of Object.entries(settings)) {
        const key = `${category}.${shortKey}`;
        
        updates.push(
          prisma.systemSettings.upsert({
            where: { key },
            create: {
              key,
              value,
              category,
              description: this.defaultSettings[key]?.description || '',
              updatedBy
            },
            update: {
              value,
              updatedBy
            }
          })
        );
      }
      
      await prisma.$transaction(updates);
      
      logger.info(`Updated ${category} settings by ${updatedBy}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update ${category} settings:`, error);
      throw error;
    }
  }

  /**
   * Update a single setting
   */
  async updateSetting(key, value, updatedBy) {
    try {
      await prisma.systemSettings.upsert({
        where: { key },
        create: {
          key,
          value,
          category: key.split('.')[0],
          description: this.defaultSettings[key]?.description || '',
          updatedBy
        },
        update: {
          value,
          updatedBy
        }
      });
      
      logger.info(`Updated setting ${key} by ${updatedBy}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get all settings
   */
  async getAllSettings() {
    try {
      const settings = await prisma.systemSettings.findMany({
        orderBy: [
          { category: 'asc' },
          { key: 'asc' }
        ]
      });
      
      // Group by category
      const grouped = {};
      settings.forEach(setting => {
        if (!grouped[setting.category]) {
          grouped[setting.category] = {};
        }
        const shortKey = setting.key.replace(`${setting.category}.`, '');
        grouped[setting.category][shortKey] = setting.value;
      });
      
      return grouped;
    } catch (error) {
      logger.error('Failed to get all settings:', error);
      throw error;
    }
  }

  /**
   * Test email configuration
   */
  async testEmailConfiguration(testEmail) {
    try {
      const emailService = require('./emailService');
      
      // Update email service configuration
      const emailSettings = await this.getSettingsByCategory('email');
      
      if (emailSettings.provider === 'smtp') {
        process.env.EMAIL_PROVIDER = 'smtp';
        process.env.SMTP_HOST = emailSettings.smtpHost;
        process.env.SMTP_PORT = emailSettings.smtpPort;
        process.env.SMTP_SECURE = emailSettings.smtpSecure;
        process.env.SMTP_USER = emailSettings.smtpUser;
        process.env.SMTP_PASS = emailSettings.smtpPassword;
      } else if (emailSettings.provider === 'sendgrid') {
        process.env.EMAIL_PROVIDER = 'sendgrid';
        process.env.SENDGRID_API_KEY = emailSettings.sendgridApiKey;
      } else if (emailSettings.provider === 'ses') {
        process.env.EMAIL_PROVIDER = 'ses';
        process.env.AWS_ACCESS_KEY_ID = emailSettings.awsAccessKeyId;
        process.env.AWS_SECRET_ACCESS_KEY = emailSettings.awsSecretAccessKey;
        process.env.AWS_REGION = emailSettings.awsRegion;
      }
      
      process.env.EMAIL_FROM = `${emailSettings.fromName} <${emailSettings.fromEmail}>`;
      
      // Send test email
      await emailService.sendEmail({
        to: testEmail,
        subject: 'QMS BackOffice - Test Email',
        html: `
          <h2>Test Email</h2>
          <p>This is a test email from QMS BackOffice.</p>
          <p>If you're receiving this, your email configuration is working correctly!</p>
          <hr>
          <p>Configuration details:</p>
          <ul>
            <li>Provider: ${emailSettings.provider}</li>
            <li>From: ${emailSettings.fromName} &lt;${emailSettings.fromEmail}&gt;</li>
          </ul>
        `
      });
      
      return { success: true, message: 'Test email sent successfully' };
    } catch (error) {
      logger.error('Failed to send test email:', error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = new SystemSettingsService();