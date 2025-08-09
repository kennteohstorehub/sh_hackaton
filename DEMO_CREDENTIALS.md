# Demo Account Credentials

This file contains all test account credentials for the StoreHub Queue Management System.

## 🚀 Production URLs (Render Deployment)

| **Access Type** | **URL** | **Username** | **Password** |
|-----------------|---------|--------------|--------------|
| **Landing Page** | https://storehub-qms-production.onrender.com | - | - |
| **Registration** | https://storehub-qms-production.onrender.com/register | - | - |
| **Demo 1 Login** | https://storehub-qms-production.onrender.com/t/demo1/auth/login | demo1@demo.com | password123 |
| **Demo 2 Login** | https://storehub-qms-production.onrender.com/t/demo2/auth/login | demo2@demo.com | password123 |
| **BackOffice Admin** | https://storehub-qms-production.onrender.com/backoffice/login | admin@storehub.com | password123 |

## 🏠 Local Development URLs

| **Access Type** | **URL** | **Username** | **Password** |
|-----------------|---------|--------------|--------------|
| **Demo 1 (Path-based)** | http://localhost:3000/t/demo1/auth/login | demo1@demo.com | password123 |
| **Demo 2 (Path-based)** | http://localhost:3000/t/demo2/auth/login | demo2@demo.com | password123 |
| **Demo 1 (Subdomain)** | http://demo1.lvh.me:3000/auth/login | demo1@demo.com | password123 |
| **Demo 2 (Subdomain)** | http://demo2.lvh.me:3000/auth/login | demo2@demo.com | password123 |
| **BackOffice Admin** | http://localhost:3000/backoffice/login | admin@storehub.com | password123 |

## 📝 Account Details

### BackOffice Administrator
- **Email**: `admin@storehub.com`
- **Password**: `password123`
- **Role**: SuperAdmin
- **Access**: Full system administration

### Demo Merchant 1
- **Business Name**: Demo1 Restaurant
- **Email**: `demo1@demo.com`
- **Password**: `password123`
- **Tenant Slug**: `demo1`
- **Subscription**: 30-day trial
- **Display Name**: Shows "Demo1 Restaurant" on login page

### Demo Merchant 2
- **Business Name**: Demo2 Cafe
- **Email**: `demo2@demo.com`
- **Password**: `password123`
- **Tenant Slug**: `demo2`
- **Subscription**: 30-day trial
- **Display Name**: Shows "Demo2 Cafe" on login page

## 🚀 Quick Start

### For Production (Render):
1. Visit https://storehub-qms-production.onrender.com
2. Use path-based routing: `/t/demo1/` or `/t/demo2/`
3. Login with credentials above
4. Each login page displays the merchant name at the top

### For Local Development:
1. Start the server:
   ```bash
   npm start
   ```
2. Access via:
   - Path-based: `http://localhost:3000/t/demo1/`
   - Subdomain: `http://demo1.lvh.me:3000/`

## 🔧 Reset Accounts

To reset accounts to this clean state:
```bash
node setup-production-accounts.js
```

This will:
- Remove all existing accounts
- Create 2 demo merchant accounts
- Create 1 BackOffice admin account
- All with password: `password123`

## ⚠️ Important Notes

- **Path-Based Routing**: Currently using `/t/tenant-slug/` format
- **Merchant Display**: Each login page shows the merchant name in a subtle badge
- **Trial Period**: Each demo account has 30-day trial
- **CSRF Protection**: All forms include CSRF tokens
- **Production Service**: Running on `storehub-qms-production` service on Render

## 🛠️ Troubleshooting

### Cannot Login?
1. Ensure server is running
2. Check you're using correct path: `/t/demo1/` or `/t/demo2/`
3. Clear browser cookies
4. Verify password: `password123`

### After Deployment:
- Allow 1-2 minutes for Render to spin up
- First request may be slow (cold start)
- Check https://storehub-qms-production.onrender.com/api/health

---

*Last Updated: 2025-08-09*
*StoreHub Queue Management System v1.0.0*