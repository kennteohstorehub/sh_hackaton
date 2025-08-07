# Demo Account Credentials

This file contains all test account credentials for the StoreHub Queue Management System.

## 🔐 Merchant Accounts

All merchant accounts use the same password: **`password123`**

| Business Name | Email | Password | Subdomain URL | Direct Login |
|--------------|-------|----------|---------------|-------------|
| ChickenRice Restaurant | chickenrice@demo.com | password123 | http://chickenrice.localhost:3000 | http://localhost:3000/auth/login |
| KFC | kfc@demo.com | password123 | http://kfc.localhost:3000 | http://localhost:3000/auth/login |
| Hotpot Palace | hotpot@demo.com | password123 | http://hotpot.localhost:3000 | http://localhost:3000/auth/login |

## 🔑 BackOffice Admin Account

| Role | Email | Password | URL |
|------|-------|----------|-----|
| BackOffice Admin | admin@demo.com | password123 | http://localhost:3000/backoffice/login |

## 📝 Quick Start

### Login Options:
1. **Direct Login (Recommended)**: http://localhost:3000/auth/login
   - Works for all merchant accounts without subdomain setup
   
2. **Subdomain Login**: Use the subdomain URLs if you have hosts file configured
   - Example: http://chickenrice.localhost:3000

3. **BackOffice Login**: http://localhost:3000/backoffice/login
   - For admin access only

## 🌐 Subdomain Setup (Optional)

If you want to use subdomain URLs, add these entries to your hosts file (`/etc/hosts` on Mac/Linux):
```
127.0.0.1 chickenrice.localhost
127.0.0.1 kfc.localhost
127.0.0.1 hotpot.localhost
```

## 🚀 Getting Started

1. **Start the server**:
   ```bash
   npm start
   ```

2. **Login** using any of the accounts above with password: `password123`

3. **Start a queue** from the merchant dashboard

4. **Access customer view** at: `http://localhost:3000/queue/[queueId]`

## 🔧 Reset/Recreate Accounts

If you need to reset the accounts to this clean state:
```bash
node setup-clean-accounts.js
```

This will:
- Delete all existing accounts
- Create the 3 merchant accounts
- Create the 1 BackOffice admin account
- All with password: `password123`

## ⚠️ Important Notes

- **Same Password**: All accounts use `password123` for easy testing
- **CSRF Token**: The login forms now include CSRF tokens (fixes the 403 error)
- **Each merchant** has:
  - Its own tenant with domain configuration
  - Default queue settings
  - Business information pre-configured

## 🛠️ Troubleshooting

### Cannot Login?
1. Make sure the server is running: `npm start`
2. Try the direct login URL: http://localhost:3000/auth/login
3. Clear browser cookies and cache
4. Check that you're using password: `password123`

### Need More Test Data?
Run the setup script to recreate clean accounts:
```bash
node setup-clean-accounts.js
```

---

*Last Updated: 2025-01-08*
*StoreHub Queue Management System v1.0.0*