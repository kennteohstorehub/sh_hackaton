# Multi-Tenant Authentication System Documentation

## Overview

This document provides comprehensive documentation for the multi-tenant Queue Management System (QMS) authentication architecture. The system supports two distinct user contexts: BackOffice administrators and Tenant users, with complete session isolation and security boundaries.

## Architecture

### Authentication Contexts

The system implements a **dual-context authentication architecture**:

1. **BackOffice Context** (`admin.*`)
   - For system administrators managing the entire platform
   - Accessed via `admin.domain.com` (or `admin.lvh.me:3838` in development)
   - Uses `BackOfficeUser` model
   - Session type: `backoffice`

2. **Tenant Context** (`tenant-slug.*`)
   - For tenant users accessing their organization's QMS
   - Accessed via `tenant-slug.domain.com` (e.g., `demo.lvh.me:3838`)
   - Uses `TenantUser` and `Merchant` models
   - Session type: `tenant`

### Key Components

#### 1. Authentication Context Middleware (`/server/middleware/auth-context.js`)
- Determines authentication context based on subdomain
- Sets `req.authContext` to either `'backoffice'` or `'tenant'`
- Manages `req.isBackOffice` flag for BackOffice routes

#### 2. Tenant Resolver (`/server/middleware/tenantResolver.js`)
- Resolves tenant from subdomain
- Special handling for `admin` subdomain → BackOffice context
- Validates tenant existence and subscription status
- Sets `req.tenant` and `req.tenantId` for tenant contexts

#### 3. BackOffice Authentication (`/server/middleware/backoffice-auth.js`)
- Protects BackOffice routes
- Manages BackOffice sessions with `backOfficeUserId`
- Includes audit logging for all BackOffice actions
- Session timeout: 30 minutes

#### 4. Tenant Authentication (`/server/middleware/auth.js`)
- Protects tenant routes
- Manages tenant sessions with `userId`
- Validates tenant assignment
- Supports both contexts with unified `loadUser` middleware

## Authentication Flow

### BackOffice Login Flow

1. User navigates to `admin.domain.com`
2. `auth-context` middleware sets `authContext: 'backoffice'`
3. `tenantResolver` sets `req.isBackOffice = true`
4. User submits credentials to `/backoffice/auth/login`
5. `BackOfficeUser` validated against database
6. Session created with:
   ```javascript
   {
     backOfficeUserId: user.id,
     sessionType: 'backoffice',
     lastActivity: new Date()
   }
   ```
7. Redirect to `/backoffice/dashboard`

### Tenant Login Flow

1. User navigates to `tenant-slug.domain.com`
2. `auth-context` middleware sets `authContext: 'tenant'`
3. `tenantResolver` resolves tenant from subdomain
4. User submits credentials to `/auth/login`
5. `Merchant` or `TenantUser` validated with tenant context
6. Session created with:
   ```javascript
   {
     userId: user.id,
     tenantId: tenant.id,
     sessionType: 'tenant',
     tenantSlug: tenant.slug
   }
   ```
7. Redirect to `/dashboard`

## Session Management

### Session Isolation

Sessions are completely isolated between contexts:

```javascript
// BackOffice session structure
{
  backOfficeUserId: "uuid",
  sessionType: "backoffice",
  lastActivity: Date,
  // No tenant information
}

// Tenant session structure
{
  userId: "uuid",
  tenantId: "uuid",
  tenantSlug: "demo",
  sessionType: "tenant",
  // No BackOffice information
}
```

### Mixed Session Prevention

The system automatically prevents and cleans up mixed sessions:

```javascript
// In ensureBackOfficeSession middleware
if (req.session.userId && req.session.backOfficeUserId) {
  // Mixed session detected - clear tenant data
  delete req.session.userId;
  delete req.session.user;
}

// In ensureTenantSession middleware
if (req.session.backOfficeUserId && req.session.userId) {
  // Mixed session detected - clear BackOffice data
  delete req.session.backOfficeUserId;
}
```

### Session Configuration

```javascript
{
  name: 'storehub.qms.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  proxy: true,
  cookie: {
    secure: production,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    domain: production ? '.storehubqms.com' : undefined
  },
  store: pgSession // PostgreSQL session store
}
```

## Security Features

### 1. CSRF Protection
- Enabled for all state-changing routes
- Token generation via `csrfTokenManager`
- Validation via `csrfValidation` middleware

### 2. Password Security
- Bcrypt hashing with salt rounds: 10
- Password requirements enforced at application level
- Secure password reset tokens with expiration

### 3. Session Security
- HttpOnly cookies prevent XSS attacks
- Secure flag in production
- Session regeneration on login
- Automatic timeout (30 min for BackOffice, 24h for tenants)

### 4. Multi-Tenant Isolation
- Row-level security with `tenantId`
- Tenant validation in all queries
- Cross-tenant access prevention
- BackOffice bypass for system administration

## Database Schema

### User Models

```prisma
model BackOfficeUser {
  id                    String    @id @default(uuid())
  email                 String    @unique
  password              String
  fullName              String
  isActive              Boolean   @default(true)
  lastLogin             DateTime?
  passwordResetToken    String?
  passwordResetExpires  DateTime?
}

model TenantUser {
  id                    String    @id @default(uuid())
  tenantId              String
  email                 String
  password              String
  fullName              String
  role                  TenantUserRole @default(user)
  isActive              Boolean   @default(true)
  tenant                Tenant    @relation(...)
  
  @@unique([tenantId, email])
}

model Merchant {
  id                    String    @id @default(uuid())
  tenantId              String?
  email                 String    @unique
  password              String
  businessName          String
  tenant                Tenant?   @relation(...)
}
```

## Test Accounts

### BackOffice Administrator
- **URL**: http://admin.lvh.me:3838
- **Email**: backoffice@storehubqms.local
- **Password**: BackOffice123!@#
- **Access**: Full system administration

### Tenant Users

#### Demo Restaurant
- **URL**: http://demo.lvh.me:3838
- **Email**: admin@demo.local
- **Password**: Demo123!@#
- **Tenant**: Demo Restaurant

#### Test Cafe
- **URL**: http://test-cafe.lvh.me:3838
- **Email**: cafe@testcafe.local
- **Password**: Test123!@#
- **Tenant**: Test Cafe

## API Authentication

### BackOffice API Routes
```javascript
// Protected by requireBackOfficeAuth
app.use('/backoffice/dashboard', requireBackOfficeAuth, backOfficeDashboardRoutes);
app.use('/backoffice/tenants', requireBackOfficeAuth, backOfficeTenantRoutes);
app.use('/backoffice/audit-logs', requireBackOfficeAuth, backOfficeAuditLogRoutes);
```

### Tenant API Routes
```javascript
// Protected by requireAuth with tenant context
app.use('/api/queues', requireAuth, validateTenantUser, queueRoutes);
app.use('/api/merchants', requireAuth, validateTenantUser, merchantRoutes);
app.use('/api/analytics', requireAuth, validateTenantUser, analyticsRoutes);
```

## Deployment Considerations

### Production Configuration

1. **Domain Setup**
   ```
   admin.storehubqms.com → BackOffice portal
   *.storehubqms.com → Tenant portals
   ```

2. **Environment Variables**
   ```bash
   SESSION_SECRET=<strong-random-secret>
   DATABASE_URL=<postgresql-connection-string>
   NODE_ENV=production
   USE_AUTH_BYPASS=false  # Must be false in production
   ```

3. **SSL/TLS Requirements**
   - All subdomains must use HTTPS
   - Secure cookies enabled in production
   - HSTS headers recommended

### Development Setup

1. **Local Subdomain Resolution**
   ```bash
   # Add to /etc/hosts
   127.0.0.1 admin.lvh.me demo.lvh.me test-cafe.lvh.me
   ```

2. **Environment Variables**
   ```bash
   SESSION_SECRET=development-secret
   DATABASE_URL=postgresql://user:pass@localhost/qms_dev
   NODE_ENV=development
   ```

## Troubleshooting

### Common Issues

1. **"Cannot access tenant" error**
   - Verify subdomain is correctly configured
   - Check tenant exists and is active
   - Ensure user belongs to the tenant

2. **Session not persisting**
   - Check cookie domain configuration
   - Verify session store is connected
   - Clear browser cookies and retry

3. **Mixed authentication contexts**
   - Clear all cookies
   - Use incognito/private browsing
   - Check for session type markers

### Debug Endpoints

```javascript
// Development only
GET /debug/session      // View current session data
GET /api/debug/context  // Check authentication context
```

## Security Best Practices

1. **Regular Security Audits**
   - Review authentication logs monthly
   - Monitor failed login attempts
   - Check for unusual access patterns

2. **Password Policies**
   - Enforce strong passwords
   - Regular password rotation for BackOffice
   - Implement 2FA for BackOffice users

3. **Session Management**
   - Monitor active sessions
   - Implement session invalidation
   - Log session anomalies

4. **Tenant Isolation**
   - Regular tenant boundary testing
   - Audit cross-tenant queries
   - Monitor data access patterns

## Future Enhancements

1. **OAuth2/OIDC Support**
   - Social login for tenants
   - SSO for enterprise tenants

2. **Two-Factor Authentication**
   - TOTP for BackOffice
   - SMS/Email verification

3. **Advanced Session Management**
   - Device fingerprinting
   - Concurrent session limits
   - Geographic restrictions

4. **API Token Authentication**
   - JWT for API access
   - API key management
   - Rate limiting per key