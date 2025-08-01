const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

class SuperAdminService {
  /**
   * Find superadmin by ID
   */
  async findById(id, include = {}) {
    return prisma.superAdmin.findUnique({
      where: { id },
      include
    });
  }

  /**
   * Find superadmin by email
   */
  async findByEmail(email) {
    return prisma.superAdmin.findUnique({
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

    return prisma.superAdmin.findMany({
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
    const { password, ...superAdminData } = data;
    
    // Hash password
    const salt = await bcrypt.genSalt(12); // Higher salt rounds for superadmin
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const superAdmin = await prisma.superAdmin.create({
      data: {
        ...superAdminData,
        password: hashedPassword
      }
    });

    // Log audit trail
    await this.logAuditAction(null, {
      action: 'CREATE_SUPERADMIN',
      resourceType: 'SuperAdmin',
      resourceId: superAdmin.id,
      details: {
        email: superAdmin.email,
        fullName: superAdmin.fullName
      }
    });

    // Return without password
    const { password: _, ...result } = superAdmin;
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
    
    const superAdmin = await prisma.superAdmin.update({
      where: { id },
      data: updateData
    });

    // Log audit trail
    await this.logAuditAction(updatedById, {
      action: 'UPDATE_SUPERADMIN',
      resourceType: 'SuperAdmin',
      resourceId: id,
      details: {
        updatedFields: Object.keys(updateData).filter(key => key !== 'password'),
        passwordChanged: !!password
      }
    });

    // Return without password
    const { password: _, ...result } = superAdmin;
    return result;
  }

  /**
   * Soft delete superadmin (deactivate)
   */
  async deactivate(id, deactivatedById = null) {
    const superAdmin = await this.update(id, { isActive: false }, deactivatedById);

    // Log audit trail
    await this.logAuditAction(deactivatedById, {
      action: 'DEACTIVATE_SUPERADMIN',
      resourceType: 'SuperAdmin',
      resourceId: id,
      details: {
        email: superAdmin.email
      }
    });

    return superAdmin;
  }

  /**
   * Reactivate superadmin
   */
  async reactivate(id, reactivatedById = null) {
    const superAdmin = await this.update(id, { isActive: true }, reactivatedById);

    // Log audit trail
    await this.logAuditAction(reactivatedById, {
      action: 'REACTIVATE_SUPERADMIN',
      resourceType: 'SuperAdmin',
      resourceId: id,
      details: {
        email: superAdmin.email
      }
    });

    return superAdmin;
  }

  /**
   * Authenticate superadmin
   */
  async authenticate(email, password) {
    const superAdmin = await this.findByEmail(email);
    
    if (!superAdmin) {
      logger.warn(`SuperAdmin authentication failed: email not found - ${email}`);
      return null;
    }

    if (!superAdmin.isActive) {
      logger.warn(`SuperAdmin authentication failed: account inactive - ${email}`);
      return null;
    }
    
    const isMatch = await bcrypt.compare(password, superAdmin.password);
    
    if (!isMatch) {
      logger.warn(`SuperAdmin authentication failed: invalid password - ${email}`);
      await this.logAuditAction(superAdmin.id, {
        action: 'FAILED_LOGIN',
        resourceType: 'SuperAdmin',
        resourceId: superAdmin.id,
        details: {
          email: email,
          reason: 'invalid_password'
        }
      });
      return null;
    }
    
    // Update last login
    await this.update(superAdmin.id, {
      lastLogin: new Date()
    }, superAdmin.id);

    // Log successful login
    await this.logAuditAction(superAdmin.id, {
      action: 'SUCCESSFUL_LOGIN',
      resourceType: 'SuperAdmin',
      resourceId: superAdmin.id,
      details: {
        email: email
      }
    });

    logger.info(`SuperAdmin authenticated successfully: ${email}`);
    
    // Return without password
    const { password: _, ...result } = superAdmin;
    return result;
  }

  /**
   * Change password with old password verification
   */
  async changePassword(id, oldPassword, newPassword) {
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id }
    });

    if (!superAdmin) {
      throw new Error('SuperAdmin not found');
    }

    // Verify old password
    const isMatch = await bcrypt.compare(oldPassword, superAdmin.password);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    // Update password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.superAdmin.update({
      where: { id },
      data: { 
        password: hashedPassword,
        updatedAt: new Date()
      }
    });

    // Log audit trail
    await this.logAuditAction(id, {
      action: 'CHANGE_PASSWORD',
      resourceType: 'SuperAdmin',
      resourceId: id,
      details: {
        email: superAdmin.email
      }
    });

    logger.info(`SuperAdmin password changed: ${superAdmin.email}`);
    return true;
  }

  /**
   * Generate password reset token
   */
  async generatePasswordResetToken(email) {
    const superAdmin = await this.findByEmail(email);
    
    if (!superAdmin || !superAdmin.isActive) {
      // Don't reveal if email exists or not
      return null;
    }

    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.superAdmin.update({
      where: { id: superAdmin.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires
      }
    });

    // Log audit trail
    await this.logAuditAction(superAdmin.id, {
      action: 'REQUEST_PASSWORD_RESET',
      resourceType: 'SuperAdmin',
      resourceId: superAdmin.id,
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
    const superAdmin = await prisma.superAdmin.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date()
        },
        isActive: true
      }
    });

    if (!superAdmin) {
      throw new Error('Invalid or expired reset token');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and clear reset token
    await prisma.superAdmin.update({
      where: { id: superAdmin.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        updatedAt: new Date()
      }
    });

    // Log audit trail
    await this.logAuditAction(superAdmin.id, {
      action: 'RESET_PASSWORD',
      resourceType: 'SuperAdmin',
      resourceId: superAdmin.id,
      details: {
        email: superAdmin.email
      }
    });

    logger.info(`SuperAdmin password reset: ${superAdmin.email}`);
    return true;
  }

  /**
   * Get superadmin statistics
   */
  async getStatistics() {
    const stats = await prisma.superAdmin.aggregate({
      _count: {
        id: true
      },
      where: {
        isActive: true
      }
    });

    const recentLogins = await prisma.superAdmin.count({
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
  async logAuditAction(superAdminId, actionData, req = null) {
    try {
      await prisma.superAdminAuditLog.create({
        data: {
          superAdminId,
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
  async getAuditLogs(superAdminId, options = {}) {
    const {
      skip = 0,
      take = 100,
      startDate,
      endDate,
      action
    } = options;

    const where = {
      superAdminId
    };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    if (action) {
      where.action = action;
    }

    return prisma.superAdminAuditLog.findMany({
      where,
      skip,
      take,
      orderBy: { timestamp: 'desc' },
      include: {
        superAdmin: {
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
  async isFirstSuperAdmin() {
    const count = await prisma.superAdmin.count({
      where: { isActive: true }
    });
    return count === 0;
  }
}

module.exports = new SuperAdminService();