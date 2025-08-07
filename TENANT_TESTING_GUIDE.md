# Multi-Tenant Testing Guide

## Test Environment URLs and Credentials

### 🌐 Local Development URLs (Using lvh.me)

These URLs work without any setup - lvh.me automatically resolves to 127.0.0.1:

#### SuperAdmin Portal
- **URL**: http://admin.lvh.me:3000
- **Purpose**: Manage all tenants, users, and system settings

#### Main Landing Page
- **URL**: http://lvh.me:3000
- **Purpose**: Shows "no subdomain" page directing users to use their organization's subdomain

---

## 📋 Test Tenants and Credentials

### 1. Demo Restaurant (Default Test Tenant)
- **Subdomain**: demo
- **URL**: http://demo.lvh.me:3000
- **Admin Credentials**:
  - Email: `admin@demo.local`
  - Password: `Demo123!@#`
- **Features**: Basic plan with standard queue management

### 2. Test Cafe
- **Subdomain**: test-cafe
- **URL**: http://test-cafe.lvh.me:3000
- **Admin Credentials**:
  - Email: `admin@testcafe.local`
  - Password: `Test123!@#`
- **Features**: Basic plan with analytics enabled

### 3. Test Restaurant 1
- **Subdomain**: test-restaurant-1
- **URL**: http://test-restaurant-1.lvh.me:3000
- **Admin Credentials**:
  - Email: `admin@test1.com`
  - Password: `Test123!@#`
- **Features**: Basic plan for testing data isolation

### 4. Test Restaurant 2
- **Subdomain**: test-restaurant-2
- **URL**: http://test-restaurant-2.lvh.me:3000
- **Admin Credentials**:
  - Email: `admin@test2.com`
  - Password: `Test123!@#`
- **Features**: Basic plan for testing cross-tenant security

---

## 🔐 SuperAdmin Credentials

### Development SuperAdmin
- **Email**: `superadmin@storehubqms.local`
- **Password**: `SuperAdmin123!@#`
- **Access**: Full system access, tenant management, user management

### Alternative SuperAdmin (if exists)
- **Email**: `admin@storehubqms.com`
- **Password**: `Admin123!@#`

---

## 🚀 Quick Setup Instructions

### 1. Create Test Data
```bash
# Run this script to create all test tenants and users
node test-local-subdomains.js
```

### 2. Create SuperAdmin Account
```bash
# Run this to create a SuperAdmin if one doesn't exist
node -e "
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createSuperAdmin() {
  const email = 'superadmin@storehubqms.local';
  const password = 'SuperAdmin123!@#';
  const hashedPassword = await bcrypt.hash(password, 10);
  
  try {
    await prisma.superAdmin.create({
      data: {
        email,
        password: hashedPassword,
        fullName: 'Development SuperAdmin',
        isActive: true
      }
    });
    console.log('✅ SuperAdmin created:', email);
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('ℹ️ SuperAdmin already exists');
    } else {
      console.error('Error:', error);
    }
  }
  await prisma.$disconnect();
}
createSuperAdmin();
"
```

---

## 🧪 Testing Scenarios

### 1. SuperAdmin Functions
1. **Login to SuperAdmin Portal**
   - Go to: http://admin.lvh.me:3000
   - Use SuperAdmin credentials
   - You should see the SuperAdmin dashboard

2. **Create New Tenant**
   - Navigate to Tenants > Create New
   - Fill in:
     - Name: "Test Pizza Place"
     - Subdomain: test-pizza
     - Admin Email: admin@pizza.com
     - Admin Password: Pizza123!@#
   - Submit and verify tenant is created

3. **Access New Tenant**
   - Visit: http://test-pizza.lvh.me:3000
   - Login with the admin credentials you just created

### 2. Tenant Admin Functions
1. **Login as Tenant Admin**
   - Go to: http://demo.lvh.me:3000
   - Login with: admin@demo.local / Demo123!@#

2. **Create Queue**
   - Navigate to Queue Management
   - Create a new queue named "Lunch Queue"

3. **Add Customers**
   - Add test customers to the queue
   - Test calling and completing customers

### 3. Data Isolation Testing
1. **Login to Tenant 1**
   - URL: http://test-restaurant-1.lvh.me:3000
   - Create some queues and customers

2. **Login to Tenant 2**
   - URL: http://test-restaurant-2.lvh.me:3000
   - Verify you cannot see Tenant 1's data

3. **Check Cross-Tenant Security**
   - Try to access Tenant 1's data while logged into Tenant 2
   - All requests should be blocked

### 4. Customer Experience
1. **Join Queue via WebChat**
   - Go to: http://demo.lvh.me:3000/webchat
   - Join the queue as a customer
   - Test receiving notifications

---

## 📊 Test Data Summary

### Subscription Plans
All test tenants are created with the "Basic" plan:
- Max Merchants: 3
- Max Queues per Merchant: 5
- Max Customers per Queue: 100
- Features: Analytics enabled, AI disabled

### User Roles
- **SUPER_ADMIN**: Full system access
- **ADMIN**: Tenant-level admin access
- **USER**: Regular user access

---

## 🔍 Verification Checklist

- [ ] Can access SuperAdmin portal at admin subdomain
- [ ] Can create new tenants from SuperAdmin portal
- [ ] Each tenant has isolated subdomain access
- [ ] Tenant admins can only see their own data
- [ ] Cannot access other tenant's data
- [ ] Subdomain routing works correctly
- [ ] Session management is tenant-specific
- [ ] Email notifications show correct tenant info
- [ ] Queue management is tenant-isolated

---

## 🛠️ Troubleshooting

### Cannot Access Subdomains
1. Ensure you're using `.lvh.me:3000` URLs
2. Check if the server is running on port 3838
3. Verify `.env.local` has `BASE_DOMAIN=lvh.me`

### Login Issues
1. Clear browser cookies for lvh.me domain
2. Check if tenant is active in database
3. Verify password meets requirements (8+ chars)

### Data Not Showing
1. Check if logged into correct tenant
2. Verify tenant isolation is working
3. Check browser console for errors

---

## 📝 Notes

- All test passwords follow the pattern: `[Name]123!@#`
- Email addresses use `.local` domain for development
- Tenants are created with mock Render API (no real provisioning)
- SSL certificates are not required for local testing
- All data is stored in local PostgreSQL database

---

## 🚨 Important Security Notes

**These are TEST credentials only!** 

For production:
- Use strong, unique passwords
- Enable 2FA for SuperAdmin accounts
- Rotate credentials regularly
- Never commit credentials to version control
- Use environment variables for sensitive data