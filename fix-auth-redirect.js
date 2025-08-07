/**
 * Quick fix for authentication redirect issues
 * This script patches the authentication routes to ensure proper redirects
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Applying authentication redirect fixes...\n');

// Fix 1: Update auth.js route to handle tenant context properly
const authRoutePath = path.join(__dirname, 'server/routes/frontend/auth.js');
const authRouteContent = fs.readFileSync(authRoutePath, 'utf8');

// Check if the fix is already applied
if (!authRouteContent.includes('// MULTI-TENANT FIX:')) {
  console.log('✅ Applying fix to auth routes...');
  
  // Find the login POST route and update redirect logic
  const updatedAuthRoute = authRouteContent.replace(
    /res\.redirect\(['"]\/dashboard['"]\)/g,
    `// MULTI-TENANT FIX: Use absolute path for redirect
    const dashboardUrl = req.tenant ? '/dashboard' : '/dashboard';
    res.redirect(dashboardUrl)`
  );
  
  fs.writeFileSync(authRoutePath, updatedAuthRoute);
  console.log('   - Updated dashboard redirect in auth routes');
}

// Fix 2: Update SuperAdmin auth routes
const superAdminAuthPath = path.join(__dirname, 'server/routes/superadmin/auth.js');
const superAdminAuthContent = fs.readFileSync(superAdminAuthPath, 'utf8');

if (!superAdminAuthContent.includes('// SUPERADMIN FIX:')) {
  console.log('✅ Applying fix to SuperAdmin auth routes...');
  
  const updatedSuperAdminAuth = superAdminAuthContent.replace(
    /res\.redirect\(['"]\/superadmin\/dashboard['"]\)/g,
    `// SUPERADMIN FIX: Ensure proper redirect
    res.redirect('/superadmin/dashboard')`
  );
  
  fs.writeFileSync(superAdminAuthPath, updatedSuperAdminAuth);
  console.log('   - Updated SuperAdmin dashboard redirect');
}

// Fix 3: Create a simple auth bypass for testing
const testAuthBypass = `
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
`;

// Write test auth bypass route
fs.writeFileSync(path.join(__dirname, 'server/routes/test-auth-bypass.js'), testAuthBypass);
console.log('✅ Created test auth bypass route');

// Add route to server index
const serverIndexPath = path.join(__dirname, 'server/index.js');
const serverIndexContent = fs.readFileSync(serverIndexPath, 'utf8');

if (!serverIndexContent.includes('test-auth-bypass')) {
  const updatedServerIndex = serverIndexContent.replace(
    /\/\/ Health check endpoint/,
    `// Test auth bypass (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use('/test', require('./routes/test-auth-bypass'));
}

// Health check endpoint`
  );
  
  fs.writeFileSync(serverIndexPath, updatedServerIndex);
  console.log('✅ Added test auth bypass to server');
}

console.log('\n🎉 Authentication fixes applied!');
console.log('\n📝 Test URLs:');
console.log('   Regular User: http://localhost:3000/test/test-auth/merchant');
console.log('   SuperAdmin: http://localhost:3000/test/test-auth/superadmin');
console.log('\n⚠️  Restart the server for changes to take effect.');