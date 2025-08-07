const logger = require('../utils/logger');

/**
 * Email service for sending emails
 * Can be configured with SendGrid, AWS SES, or other providers
 */
class EmailService {
  constructor() {
    this.provider = process.env.EMAIL_PROVIDER || 'console'; // 'smtp', 'sendgrid', 'ses', 'console'
    this.from = process.env.EMAIL_FROM || 'noreply@storehubqms.com';
    this.isConfigured = this.checkConfiguration();
  }

  /**
   * Check if email service is properly configured
   */
  checkConfiguration() {
    if (this.provider === 'smtp') {
      return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    } else if (this.provider === 'sendgrid') {
      return !!process.env.SENDGRID_API_KEY;
    } else if (this.provider === 'ses') {
      return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    }
    return true; // Console provider is always configured
  }

  /**
   * Send an email
   */
  async sendEmail(options) {
    const { to, subject, html, text } = options;

    if (!this.isConfigured) {
      logger.warn('Email service not configured. Email would have been sent to:', to);
      return this.logEmail(options);
    }

    try {
      switch (this.provider) {
        case 'smtp':
          return await this.sendWithSMTP(options);
        case 'sendgrid':
          return await this.sendWithSendGrid(options);
        case 'ses':
          return await this.sendWithSES(options);
        default:
          return await this.logEmail(options);
      }
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send email using SMTP
   */
  async sendWithSMTP(options) {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const mailOptions = {
      from: this.from,
      to: options.to,
      subject: options.subject,
      text: options.text || this.htmlToText(options.html),
      html: options.html
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info(`Email sent via SMTP to ${options.to}`);
    return result;
  }

  /**
   * Send email using SendGrid
   */
  async sendWithSendGrid(options) {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: options.to,
      from: this.from,
      subject: options.subject,
      text: options.text || this.htmlToText(options.html),
      html: options.html
    };

    const result = await sgMail.send(msg);
    logger.info(`Email sent via SendGrid to ${options.to}`);
    return result;
  }

  /**
   * Send email using AWS SES
   */
  async sendWithSES(options) {
    const AWS = require('aws-sdk');
    const ses = new AWS.SES({
      region: process.env.AWS_REGION || 'us-east-1'
    });

    const params = {
      Destination: {
        ToAddresses: [options.to]
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: options.html
          },
          Text: {
            Charset: 'UTF-8',
            Data: options.text || this.htmlToText(options.html)
          }
        },
        Subject: {
          Charset: 'UTF-8',
          Data: options.subject
        }
      },
      Source: this.from
    };

    const result = await ses.sendEmail(params).promise();
    logger.info(`Email sent via AWS SES to ${options.to}`);
    return result;
  }

  /**
   * Log email to console (for development)
   */
  async logEmail(options) {
    logger.info('=== EMAIL MESSAGE ===');
    logger.info(`From: ${this.from}`);
    logger.info(`To: ${options.to}`);
    logger.info(`Subject: ${options.subject}`);
    logger.info('Body:');
    logger.info(options.text || this.htmlToText(options.html));
    logger.info('===================');
    
    return {
      messageId: `console-${Date.now()}`,
      accepted: [options.to]
    };
  }

  /**
   * Convert HTML to plain text (basic implementation)
   */
  htmlToText(html) {
    if (!html) return '';
    
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(recipients, template) {
    const results = [];
    
    for (const recipient of recipients) {
      try {
        const email = {
          to: recipient.email,
          subject: this.personalizeTemplate(template.subject, recipient),
          html: this.personalizeTemplate(template.html, recipient)
        };
        
        const result = await this.sendEmail(email);
        results.push({ success: true, email: recipient.email, result });
      } catch (error) {
        results.push({ success: false, email: recipient.email, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Send welcome email to new merchant
   */
  async sendWelcomeEmail(data) {
    const { to, name, businessName, loginUrl, trialDays = 14 } = data;
    
    const subject = `Welcome to StoreHub QMS - Your ${trialDays}-Day Trial Has Started!`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Open Sans', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #FA8C16, #FF6B35); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 30px; background: #FA8C16; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .button:hover { background: #FF6B35; }
          .features { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .features li { margin: 10px 0; }
          .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to StoreHub QMS!</h1>
            <p style="font-size: 18px; margin: 0;">Your ${trialDays}-Day Free Trial Has Started</p>
          </div>
          
          <div class="content">
            <p>Hi ${name},</p>
            
            <p>Congratulations! Your queue management system for <strong>${businessName}</strong> is now ready to use.</p>
            
            <p>Your free trial includes:</p>
            <div class="features">
              <ul>
                <li>✓ Full queue management features</li>
                <li>✓ Real-time customer notifications</li>
                <li>✓ Analytics and reporting</li>
                <li>✓ Unlimited customers during trial</li>
                <li>✓ Email support</li>
              </ul>
            </div>
            
            <p><strong>Your Login Details:</strong></p>
            <p>
              Email: ${to}<br>
              Login URL: <a href="${loginUrl}">${loginUrl}</a>
            </p>
            
            <div style="text-align: center;">
              <a href="${loginUrl}" class="button">Go to Dashboard</a>
            </div>
            
            <h3>Quick Start Guide:</h3>
            <ol>
              <li>Log in to your dashboard</li>
              <li>Configure your business hours and queue settings</li>
              <li>Download your QR code for customers</li>
              <li>Start managing your queue!</li>
            </ol>
            
            <p>Your trial will expire on <strong>${new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>. 
            We'll send you a reminder before it expires.</p>
            
            <p>If you have any questions, feel free to reply to this email or contact our support team.</p>
            
            <p>Best regards,<br>The StoreHub QMS Team</p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} StoreHub QMS. All rights reserved.</p>
            <p>This email was sent to ${to}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
Welcome to StoreHub QMS!

Hi ${name},

Congratulations! Your queue management system for ${businessName} is now ready to use.

Your ${trialDays}-day free trial includes:
- Full queue management features
- Real-time customer notifications
- Analytics and reporting
- Unlimited customers during trial
- Email support

Your Login Details:
Email: ${to}
Login URL: ${loginUrl}

Quick Start Guide:
1. Log in to your dashboard
2. Configure your business hours and queue settings
3. Download your QR code for customers
4. Start managing your queue!

Your trial will expire on ${new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.
We'll send you a reminder before it expires.

If you have any questions, feel free to reply to this email.

Best regards,
The StoreHub QMS Team
    `;
    
    return await this.sendEmail({
      to,
      subject,
      html,
      text
    });
  }

  /**
   * Personalize email template
   */
  personalizeTemplate(template, data) {
    let result = template;
    
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, data[key]);
    });
    
    return result;
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(user, verificationUrl) {
    return this.sendEmail({
      to: user.email,
      subject: 'Verify your email address',
      html: `
        <h2>Email Verification</h2>
        <p>Hi ${user.fullName || 'there'},</p>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verificationUrl}" style="background-color: #FF8C00; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a></p>
        <p>Or copy and paste this link: ${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <br>
        <p>Best regards,<br>StoreHub QMS Team</p>
      `
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(user, resetUrl) {
    return this.sendEmail({
      to: user.email,
      subject: 'Reset your password',
      html: `
        <h2>Password Reset Request</h2>
        <p>Hi ${user.fullName || 'there'},</p>
        <p>We received a request to reset your password. Click the link below to create a new password:</p>
        <p><a href="${resetUrl}" style="background-color: #FF8C00; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
        <p>Or copy and paste this link: ${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <br>
        <p>Best regards,<br>StoreHub QMS Team</p>
      `
    });
  }

  /**
   * Send invitation email
   */
  async sendInvitationEmail(invitation, inviteUrl) {
    return this.sendEmail({
      to: invitation.email,
      subject: `You're invited to join ${invitation.tenantName}`,
      html: `
        <h2>Team Invitation</h2>
        <p>Hi there,</p>
        <p>You've been invited to join <strong>${invitation.tenantName}</strong> on StoreHub Queue Management System.</p>
        <p>Click the link below to accept the invitation and create your account:</p>
        <p><a href="${inviteUrl}" style="background-color: #FF8C00; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Invitation</a></p>
        <p>Or copy and paste this link: ${inviteUrl}</p>
        <p>This invitation will expire in 7 days.</p>
        <br>
        <p>Best regards,<br>StoreHub QMS Team</p>
      `
    });
  }
}

module.exports = new EmailService();