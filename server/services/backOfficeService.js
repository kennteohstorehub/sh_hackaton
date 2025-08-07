const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

class BackOfficeUserService {
  /**
   * Find superadmin by ID
   */
  async findById(id, include = {}) {
    return prisma.backOfficeUser.findUnique({
      where: { id },
      include
    });
  }

  /**
   * Find superadmin by email
   */
  async findByEmail(email) {
    return prisma.backOfficeUser.findUnique({
      where: { email }
    });
  }

  /**
   * Get all superadmins (for management)
   */
  async findAll(options = {}) {
    const { 
      skip = 0, 
      take = 50, 
      where = {}, 
      orderBy = { createdAt: 'desc' } 
    } = options;

    return prisma.backOfficeUser.findMany({
      where: {
        ...where,
        isActive: true // Only return active superadmins by default
      },
      skip,
      take,
      orderBy,
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true
        // Exclude password from results
      }
    });
  }

  /**
   * Create new superadmin
   */
  async create(data) {
    const { password, ...backOfficeUserData } = data;
    
    // Hash password
    const salt = await bcrypt.genSalt(12); // Higher salt rounds for superadmin
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const backOfficeUser = await prisma.backOfficeUser.create({
      data: {
        ...backOfficeUserData,
        password: hashedPassword
      }
    });

    // Log audit trail
    await this.logAuditAction(null, {
      action: 'CREATE_SUPERADMIN',
      resourceType: 'BackOfficeUser',
      resourceId: backOfficeUser.id,
      details: {
        email: backOfficeUser.email,
        fullName: backOfficeUser.fullName
      }
    });

    // Return without password
    const { password: _, ...result } = backOfficeUser;
    return result;
  }

  /**
   * Update superadmin
   */
  async update(id, data, updatedById = null) {
    const { password, ...updateData } = data;
    
    // If password is being updated, hash it
    if (password) {
      const salt = await bcrypt.genSalt(12);
      updateData.password = await bcrypt.hash(password, salt);
    }
    
    const backOfficeUser = await prisma.backOfficeUser.update({
      where: { id },
      data: updateData
    });

    // Log audit trail
    await this.logAuditAction(updatedById, {
      action: 'UPDATE_SUPERADMIN',
      resourceType: 'BackOfficeUser',
      resourceId: id,
      details: {
        updatedFields: Object.keys(updateData).filter(key => key !== 'password'),
        passwordChanged: !!password
      }
    });

    // Return without password
    const { password: _, ...result } = backOfficeUser;
    return result;
  }

  /**
   * Soft delete superadmin (deactivate)
   */
  async deactivate(id, deactivatedById = null) {
    const backOfficeUser = await this.update(id, { isActive: false }, deactivatedById);

    // Log audit trail
    await this.logAuditAction(deactivatedById, {
      action: 'DEACTIVATE_SUPERADMIN',
      resourceType: 'BackOfficeUser',
      resourceId: id,
      details: {
        email: backOfficeUser.email
      }
    });

    return backOfficeUser;
  }

  /**
   * Reactivate superadmin
   */
  async reactivate(id, reactivatedById = null) {
    const backOfficeUser = await this.update(id, { isActive: true }, reactivatedById);

    // Log audit trail
    await this.logAuditAction(reactivatedById, {
      action: 'REACTIVATE_SUPERADMIN',
      resourceType: 'BackOfficeUser',
      resourceId: id,
      details: {
        email: backOfficeUser.email
      }
    });

    return backOfficeUser;
  }

  /**
   * Authenticate superadmin
   */
  async authenticate(email, password) {
    const backOfficeUser = await this.findByEmail(email);
    
    if (!backOfficeUser) {
      logger.warn(`BackOfficeUser authentication failed: email not found - ${email}`);
      return null;
    }

    if (!backOfficeUser.isActive) {
      logger.warn(`BackOfficeUser authentication failed: account inactive - ${email}`);
      return null;
    }
    
    const isMatch = await bcrypt.compare(password, backOfficeUser.password);
    
    if (!isMatch) {
      logger.warn(`BackOfficeUser authentication failed: invalid password - ${email}`);
      await this.logAuditAction(backOfficeUser.id, {
        action: 'FAILED_LOGIN',
        resourceType: 'BackOfficeUser',
        resourceId: backOfficeUser.id,
        details: {
          email: email,
          reason: 'invalid_password'
        }
      });
      return null;
    }
    
    // Update last login
    await this.update(backOfficeUser.id, {
      lastLogin: new Date()
    }, backOfficeUser.id);

    // Log successful login
    await this.logAuditAction(backOfficeUser.id, {
      action: 'SUCCESSFUL_LOGIN',
      resourceType: 'BackOfficeUser',
      resourceId: backOfficeUser.id,
      details: {
        email: email
      }
    });

    logger.info(`BackOfficeUser authenticated successfully: ${email}`);
    
    // Return without password
    const { password: _, ...result } = backOfficeUser;
    return result;
  }

  /**
   * Change password with old password verification
   */
  async changePassword(id, oldPassword, newPassword) {
    const backOfficeUser = await prisma.backOfficeUser.findUnique({
      where: { id }
    });

    if (!backOfficeUser) {
      throw new Error('BackOfficeUser not found');
    }

    // Verify old password
    const isMatch = await bcrypt.compare(oldPassword, backOfficeUser.password);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    // Update password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.backOfficeUser.update({
      where: { id },
      data: { 
        password: hashedPassword,
        updatedAt: new Date()
      }
    });

    // Log audit trail
    await this.logAuditAction(id, {
      action: 'CHANGE_PASSWORD',
      resourceType: 'BackOfficeUser',
      resourceId: id,
      details: {
        email: backOfficeUser.email
      }
    });

    logger.info(`BackOfficeUser password changed: ${backOfficeUser.email}`);
    return true;
  }

  /**
   * Generate password reset token
   */
  async generatePasswordResetToken(email) {
    const backOfficeUser = await this.findByEmail(email);
    
    if (!backOfficeUser || !backOfficeUser.isActive) {
      // Don't reveal if email exists or not
      return null;
    }

    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.backOfficeUser.update({
      where: { id: backOfficeUser.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires
      }
    });

    // Log audit trail
    await this.logAuditAction(backOfficeUser.id, {
      action: 'REQUEST_PASSWORD_RESET',
      resourceType: 'BackOfficeUser',
      resourceId: backOfficeUser.id,
      details: {
        email: email
      }
    });

    return resetToken;
  }

  /**
   * Reset password using token
   */
  async resetPassword(token, newPassword) {
    const backOfficeUser = await prisma.backOfficeUser.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date()
        },
        isActive: true
      }
    });

    if (!backOfficeUser) {
      throw new Error('Invalid or expired reset token');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and clear reset token
    await prisma.backOfficeUser.update({
      where: { id: backOfficeUser.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        updatedAt: new Date()
      }
    });

    // Log audit trail
    await this.logAuditAction(backOfficeUser.id, {
      action: 'RESET_PASSWORD',
      resourceType: 'BackOfficeUser',
      resourceId: backOfficeUser.id,
      details: {
        email: backOfficeUser.email
      }
    });

    logger.info(`BackOfficeUser password reset: ${backOfficeUser.email}`);
    return true;
  }

  /**
   * Get superadmin statistics
   */
  async getStatistics() {
    const stats = await prisma.backOfficeUser.aggregate({
      _count: {
        id: true
      },
      where: {
        isActive: true
      }
    });

    const recentLogins = await prisma.backOfficeUser.count({
      where: {
        isActive: true,
        lastLogin: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    });

    return {
      totalActive: stats._count.id,
      recentLogins
    };
  }

  /**
   * Log audit action
   */
  async logAuditAction(backOfficeUserId, actionData, req = null) {
    try {
      await prisma.backOfficeAuditLog.create({
        data: {
          backOfficeUserId,
          action: actionData.action,
          resourceType: actionData.resourceType,
          resourceId: actionData.resourceId,
          details: actionData.details || {},
          ipAddress: req?.ip || req?.headers['x-forwarded-for'] || req?.connection?.remoteAddress,
          userAgent: req?.headers['user-agent'],
          tenantId: actionData.tenantId || null
        }
      });
    } catch (error) {
      logger.error('Failed to log audit action:', error);
      // Don't throw error - audit logging failure shouldn't break the main operation
    }
  }

  /**
   * Get audit logs for a superadmin
   */
  async getAuditLogs(backOfficeUserId, options = {}) {
    const {
      skip = 0,
      take = 100,
      startDate,
      endDate,
      action
    } = options;

    const where = {
      backOfficeUserId
    };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    if (action) {
      where.action = action;
    }

    return prisma.backOfficeUserAuditLog.findMany({
      where,
      skip,
      take,
      orderBy: { timestamp: 'desc' },
      include: {
        backOfficeUser: {
          select: {
            email: true,
            fullName: true
          }
        },
        tenant: {
          select: {
            name: true,
            slug: true
          }
        }
      }
    });
  }

  /**
   * Check if this is the first superadmin registration
   */
  async isFirstBackOfficeUser() {
    const count = await prisma.backOfficeUser.count({
      where: { isActive: true }
    });
    return count === 0;
  }
}

module.exports = new BackOfficeUserService();