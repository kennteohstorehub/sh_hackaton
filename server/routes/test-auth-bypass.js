
// Quick authentication test bypass
// This allows testing the dashboard without login redirect loops

const express = require('express');
const router = express.Router();

// Test route to set session manually
router.get('/test-auth/:type', async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    if (req.params.type === 'merchant') {
      // Find first merchant
      const merchant = await prisma.merchant.findFirst({
        where: { email: 'admin@demo.local' }
      });
      
      if (merchant) {
        req.session.userId = merchant.id;
        req.session.userType = 'merchant';
        req.session.merchantId = merchant.id;
        if (merchant.tenantId) {
          req.session.tenantId = merchant.tenantId;
        }
        return res.redirect('/dashboard');
      }
    } else if (req.params.type === 'superadmin') {
      // Find SuperAdmin
      const superAdmin = await prisma.superAdmin.findFirst({
        where: { email: 'superadmin@storehubqms.local' }
      });
      
      if (superAdmin) {
        req.session.superAdminId = superAdmin.id;
        req.session.isSuperAdmin = true;
        return res.redirect('/superadmin/dashboard');
      }
    }
    
    res.status(404).send('User not found');
  } catch (error) {
    console.error('Test auth error:', error);
    res.status(500).send('Error setting test session');
  } finally {
    await prisma.$disconnect();
  }
});

module.exports = router;
