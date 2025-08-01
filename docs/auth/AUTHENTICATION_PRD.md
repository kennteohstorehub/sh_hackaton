# Product Requirements Document: Authentication System Issues and Fixes
## StoreHub Queue Management System

**Document Version**: 2.0  
**Date**: July 31, 2025  
**Author**: System Architecture Team  
**Status**: In Progress

---

## 1. Executive Summary

This PRD documents critical authentication system issues identified in the StoreHub Queue Management System and outlines the implemented fixes and future requirements. The authentication system, while functional, contains several security vulnerabilities, development conveniences, and **critical UX issues related to multi-tenant identification** that must be addressed before production deployment.

### Key Findings
- Authentication bypass active in development environment
- Session regeneration disabled due to implementation issues
- CSRF protection completely bypassed
- Session management stabilized but security hardening required
- **NEW: Multi-tenant dashboard lacks clear business/tenant identification**

### Impact
- **Security Risk**: High - Multiple vulnerabilities expose the system to attacks
- **Development Impact**: Medium - Auth bypass prevents proper testing
- **User Experience**: **HIGH - Users cannot identify which tenant account they're accessing**
- **Business Risk**: High - Users may access wrong tenant data or make incorrect business decisions

---

## 2. Current State Analysis

### 2.1 Authentication Architecture

**Technology Stack**:
- Framework: Express.js with session-based authentication
- Session Storage: PostgreSQL via connect-pg-simple
- Database ORM: Prisma
- Real-time: Socket.IO with shared session store
- **Multi-tenant Architecture**: Tenant isolation by domain/account

**Authentication Flow**:
```
User Login → Validate Credentials → Create Session → Store in PostgreSQL → Set Cookie → Access Protected Routes
```

**Multi-Tenant Flow**:
```
User Access → Login Form → Tenant Selection/Detection → Session with Tenant Context → Dashboard (PROBLEM: No clear tenant indication)
```

### 2.2 Current Implementation

**Core Components**:
- `/server/routes/auth.js` - Authentication routes (login, register, logout)
- `/server/middleware/auth.js` - Route protection middleware
- `/server/middleware/auth-bypass.js` - Development authentication bypass
- `/server/middleware/security.js` - Security middleware (CSRF, headers)
- `/server/session-fix.js` - Production session configuration
- **Tenant Components**: `/server/middleware/tenant-isolation.js`, `/server/services/tenantService.js`

**Session Configuration**:
```javascript
{
  store: new PgSession({
    pool: pgPool,
    tableName: 'Session',
    createTableIfMissing: false
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: production,
    sameSite: production ? 'none' : 'lax'
  }
}
```

---

## 3. Problem Statement

### 3.1 Primary Issues

#### Issue #1: Authentication Bypass in Development
- **Description**: All requests automatically authenticated as demo merchant
- **Impact**: Cannot test real authentication flows in development
- **Root Cause**: Middleware forces authentication state for all requests

#### Issue #2: Session Regeneration Failure
- **Description**: Session regeneration causes 500 errors during login
- **Impact**: Session fixation vulnerability
- **Root Cause**: Callback handling issue in session regeneration method

#### Issue #3: CSRF Protection Disabled
- **Description**: All CSRF validation bypassed with early return
- **Impact**: Vulnerable to cross-site request forgery attacks
- **Root Cause**: Disabled for testing, never re-enabled

#### Issue #4: Session Store Migration Issues
- **Description**: Multiple attempts to fix PostgreSQL session storage
- **Impact**: Unstable session persistence
- **Root Cause**: Library compatibility and schema mismatches

#### **Issue #5: Multi-Tenant Identity Crisis (NEW - CRITICAL UX ISSUE)**
- **Description**: Dashboard provides no visual indication of which tenant/business account is currently active
- **Impact**: 
  - Users cannot identify which business account they're managing
  - Risk of managing wrong business data
  - Confusion when switching between multiple tenant accounts
  - Potential security and compliance issues
  - Poor user experience and reduced confidence in the system
- **Root Cause**: Dashboard UI lacks tenant identification components
- **User Feedback**: "When I logged into downtown@delicious.com account, the dashboard looked identical to any other tenant dashboard, making it difficult to know which tenant account I'm currently accessing"

### 3.2 Security Vulnerabilities

1. **Session Fixation**: No session ID rotation on authentication
2. **CSRF Attacks**: Complete bypass of CSRF protection
3. **Development Mode**: Cannot validate security in development
4. **WebSocket Auth**: Public socket connections without authentication
5. **Tenant Confusion**: Users may inadvertently access or modify wrong tenant data

---

## 4. Root Cause Analysis

### 4.1 Technical Debt Accumulation

**Development Shortcuts**:
- Auth bypass added for rapid development
- CSRF disabled to simplify testing
- Session regeneration commented out instead of fixed
- **Tenant identification postponed during UI development**

**Migration Complexity**:
- Multiple session store libraries attempted
- Schema compatibility issues between libraries
- Production environment differences not initially considered
- **Multi-tenant UI patterns not established from the start**

### 4.2 Testing Gaps

**Missing Test Coverage**:
- No automated security tests
- Authentication flow tests bypass real authentication
- Session security not validated
- **No user experience testing for multi-tenant scenarios**

**Environmental Differences**:
- Development uses auth bypass
- Production requires different cookie settings
- Reverse proxy considerations not initially planned
- **Tenant context differences between environments**

---

## 5. Solution Requirements

### 5.1 Immediate Fixes (P0 - Critical)

#### Fix #1: Conditional Authentication Bypass
**Requirement**: Auth bypass should be controllable via environment variable
```javascript
// Enable only when explicitly set
if (process.env.AUTH_BYPASS_ENABLED === 'true') {
  app.use(authBypassMiddleware);
}
```

#### Fix #2: Proper Session Regeneration
**Requirement**: Implement session regeneration with proper error handling
```javascript
// Wrap regeneration in promise for async/await compatibility
const regenerateSession = (req) => {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};
```

#### Fix #3: Re-enable CSRF Protection
**Requirement**: Remove bypass and implement proper CSRF tokens
- Generate tokens for forms
- Validate on state-changing requests
- Exclude only specific safe endpoints

#### **Fix #4: Multi-Tenant Dashboard Identity (NEW - P0 CRITICAL)**
**Requirement**: Implement clear tenant identification throughout the UI

**Dashboard Header Requirements**:
- Display business/company name prominently in the top navigation bar
- Show current tenant context at all times
- Include visual branding elements if available (logo, colors)
- Position tenant information in a consistent, highly visible location

**Implementation Specifications**:
```html
<!-- Header component with tenant identification -->
<header class="dashboard-header">
  <div class="tenant-identity">
    <div class="business-logo">
      <img src="{{tenantLogo}}" alt="{{businessName}} Logo" />
    </div>
    <div class="business-info">
      <h1 class="business-name">{{businessName}}</h1>
      <span class="tenant-id">ID: {{tenantId}}</span>
    </div>
  </div>
  <div class="user-controls">
    <!-- User menu, notifications, etc. -->
  </div>
</header>
```

**Visual Design Requirements**:
- Business name should be displayed in a large, readable font
- Use consistent typography and color scheme
- Provide visual separation between tenant info and other UI elements
- Ensure accessibility compliance (WCAG 2.1 AA)

### 5.2 Enhanced Multi-Tenant UX (P1 - High Priority)

#### **Enhancement #1: Registration Flow Updates**
**Requirements**:
- Make business name a required field during registration
- Prioritize business name collection early in the registration flow
- Validate business name uniqueness within reasonable constraints
- Provide clear field labels and help text

**Registration Form Updates**:
```html
<form class="registration-form">
  <!-- Step 1: Business Information (PRIORITIZED) -->
  <fieldset class="business-details">
    <legend>Business Information</legend>
    <div class="form-group priority-field">
      <label for="businessName" class="required">Business/Company Name</label>
      <input 
        type="text" 
        id="businessName" 
        name="businessName" 
        required 
        placeholder="Enter your business name"
        maxlength="100"
      />
      <small class="help-text">This will be displayed on your dashboard</small>
    </div>
    <!-- Other business fields -->
  </fieldset>
  
  <!-- Step 2: Account Details -->
  <fieldset class="account-details">
    <!-- Email, password, etc. -->
  </fieldset>
</form>
```

#### **Enhancement #2: Tenant Context Indicators**
**Requirements**:
- Add tenant context to all major UI components
- Include breadcrumb navigation with tenant awareness
- Show tenant-specific data counters and statistics
- Implement tenant-aware page titles

**Context Components**:
```html
<!-- Page title with tenant context -->
<title>Queue Management - {{businessName}} | StoreHub</title>

<!-- Breadcrumb with tenant context -->
<nav class="breadcrumb">
  <span class="tenant-context">{{businessName}}</span>
  <span class="separator">></span>
  <span class="current-page">Dashboard</span>
</nav>

<!-- Tenant-specific statistics -->
<div class="dashboard-stats tenant-branded">
  <h2>{{businessName}} Overview</h2>
  <div class="stats-grid">
    <!-- Statistics with tenant context -->
  </div>
</div>
```

#### **Enhancement #3: Multi-Account Management**
**Requirements**:
- Account switching interface for users with multiple tenant access
- Clear indication of which account is currently active
- Recent tenant access history
- Secure tenant switching with re-authentication if needed

**Account Switcher Component**:
```html
<div class="account-switcher">
  <button class="current-account">
    <div class="account-info">
      <strong>{{currentBusinessName}}</strong>
      <small>{{currentTenantEmail}}</small>
    </div>
    <icon name="chevron-down" />
  </button>
  
  <div class="account-dropdown">
    <div class="recent-accounts">
      <h3>Recent Accounts</h3>
      <!-- List of recent tenant accounts -->
    </div>
    <div class="account-actions">
      <button class="add-account">Add Account</button>
      <button class="manage-accounts">Manage Access</button>
    </div>
  </div>
</div>
```

### 5.3 Security Hardening (P1 - High)

#### Enhancement #1: Session Security
**Requirements**:
- Session fingerprinting (user agent + IP hash)
- Automatic session rotation every 6 hours
- Concurrent session limiting
- Session activity tracking
- **Tenant-specific session isolation**

#### Enhancement #2: WebSocket Authentication
**Requirements**:
- Require authentication for socket connections
- Implement socket-specific auth tokens
- Room-based authorization with tenant context
- Connection rate limiting per tenant

#### Enhancement #3: Authentication Logging
**Requirements**:
- Log all authentication events with tenant context
- Track failed login attempts per tenant
- Alert on suspicious patterns
- Audit trail for compliance per tenant

### 5.4 Development Experience (P2 - Medium)

#### Enhancement #1: Test Authentication Mode
**Requirements**:
- Separate test mode from auth bypass
- Provide test credentials for different tenants
- Enable/disable via environment variable
- Clear console warnings when active

#### Enhancement #2: Session Debugging
**Requirements**:
- Session inspection endpoints (dev only)
- Clear session state commands
- Session migration utilities
- Debug logging for session issues
- **Tenant context debugging tools**

---

## 6. Technical Specifications

### 6.1 Implementation Plan

#### Phase 1: Critical Security Fixes (Week 1)
1. Implement conditional auth bypass
2. Fix session regeneration with proper error handling
3. Re-enable CSRF protection with exclusion list
4. Add security headers for production
5. **Implement basic tenant identification in dashboard header**

#### Phase 2: Multi-Tenant UX Enhancement (Week 2)
1. **Update registration flow to prioritize business name**
2. **Implement comprehensive tenant context indicators**
3. **Add tenant-aware page titles and breadcrumbs**
4. **Create tenant context debugging tools**

#### Phase 3: Session Hardening (Week 3)
1. Implement session fingerprinting with tenant context
2. Add session rotation mechanism
3. Build concurrent session management per tenant
4. Create session activity tracking with tenant isolation

#### Phase 4: Enhanced Security (Week 4)
1. Implement WebSocket authentication with tenant context
2. Add authentication event logging per tenant
3. Build suspicious activity detection per tenant
4. Create security dashboard with tenant-specific views

### 6.2 Code Changes Required

**Files to Modify**:
```
/server/middleware/auth-bypass.js          - Add conditional logic
/server/routes/auth.js                     - Fix session regeneration, add tenant context
/server/middleware/security.js             - Re-enable CSRF
/server/middleware/auth.js                 - Add session security + tenant context
/server/services/sessionService.js         - New session management service
/server/socket-handlers/auth.js            - New WebSocket auth with tenant context
/views/partials/header.ejs                 - Add tenant identification UI
/views/auth/register.ejs                   - Update registration form
/views/dashboard/index.ejs                 - Add tenant context indicators
/public/css/tenant-identity.css            - New styles for tenant UI components
/public/js/tenant-context.js               - Client-side tenant context management
```

**New Files Required**:
```
/server/services/authLogger.js             - Authentication event logging
/server/utils/sessionSecurity.js           - Session fingerprinting utilities
/server/middleware/socketAuth.js           - Socket.IO authentication
/config/security.js                        - Security configuration
/server/services/tenantContextService.js   - Tenant context management
/views/components/tenant-identity.ejs      - Reusable tenant identification component
/views/components/account-switcher.ejs     - Multi-account management component
```

### 6.3 Database Schema Changes

**Session Table Enhancement**:
```prisma
model Session {
  sid         String   @id
  sess        Json
  expire      DateTime
  // New fields
  fingerprint String?
  lastActive  DateTime @default(now())
  ipAddress   String?
  userAgent   String?
  tenantId    String?  // NEW: Associate sessions with tenants
  
  @@index([expire])
  @@index([fingerprint])
  @@index([tenantId])
}
```

**Authentication Log Table**:
```prisma
model AuthLog {
  id          String   @id @default(uuid())
  merchantId  String?
  tenantId    String?  // NEW: Track tenant context
  event       String   // login, logout, failed_login, session_expired, tenant_switch
  ipAddress   String
  userAgent   String
  success     Boolean
  errorReason String?
  businessName String? // NEW: Log business name for context
  createdAt   DateTime @default(now())
  
  merchant    Merchant? @relation(fields: [merchantId], references: [id])
  
  @@index([merchantId])
  @@index([tenantId])
  @@index([event])
  @@index([createdAt])
}
```

**Merchant Table Enhancement**:
```prisma
model Merchant {
  id              String   @id @default(uuid())
  email           String   @unique
  password        String
  businessName    String   // Make this required and prominent
  displayName     String?  // Optional display name override
  logoUrl         String?  // Business logo for branding
  brandColor      String?  // Primary brand color
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  isActive        Boolean  @default(true)
  
  // Relations
  authLogs        AuthLog[]
  queues          Queue[]
  
  @@index([businessName])
  @@index([email])
}
```

### 6.4 UI/UX Implementation Details

#### **Header Component Specifications**:
```css
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: var(--primary-bg);
  border-bottom: 1px solid var(--border-color);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.tenant-identity {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.business-logo img {
  height: 40px;
  width: auto;
  border-radius: 4px;
}

.business-name {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--primary-text);
  margin: 0;
}

.tenant-id {
  font-size: 0.875rem;
  color: var(--secondary-text);
  opacity: 0.8;
}
```

#### **Registration Form Priority**:
```javascript
// Form validation priorities
const registrationValidation = {
  businessName: {
    required: true,
    priority: 1,
    validation: 'Business name is required for your dashboard identification'
  },
  email: {
    required: true,
    priority: 2
  },
  password: {
    required: true,
    priority: 3
  }
};
```

---

## 7. Testing Requirements

### 7.1 Security Testing

**Test Cases**:
1. Session fixation prevention
2. CSRF token validation
3. Concurrent session limits
4. Session timeout behavior
5. Authentication bypass prevention in production
6. **Tenant isolation in sessions**

**Automated Tests**:
```javascript
describe('Authentication Security', () => {
  it('should regenerate session on login');
  it('should validate CSRF tokens');
  it('should prevent session fixation');
  it('should limit concurrent sessions');
  it('should track authentication events');
  it('should isolate tenant contexts in sessions');
});
```

### 7.2 Multi-Tenant UX Testing

**Test Scenarios**:
1. **Tenant identification visibility in dashboard**
2. **Business name display consistency across pages**
3. **Registration flow business name validation**
4. **Multi-account switching functionality**
5. **Tenant-specific branding application**

**User Acceptance Tests**:
```javascript
describe('Multi-Tenant User Experience', () => {
  it('should display business name prominently in header');
  it('should require business name during registration');
  it('should show tenant context on all pages');
  it('should allow users to identify current tenant account');
  it('should maintain tenant context across sessions');
});
```

### 7.3 Integration Testing

**Test Scenarios**:
1. Complete authentication flow with tenant context
2. Session persistence across requests with tenant data
3. WebSocket authentication with tenant isolation
4. Multi-device session management per tenant
5. Production environment simulation with multiple tenants

### 7.4 Performance Testing

**Metrics to Validate**:
- Session creation time < 100ms
- Authentication check overhead < 10ms
- Session store query performance
- Concurrent user capacity per tenant
- **Tenant context loading time < 50ms**

---

## 8. Success Criteria

### 8.1 Security Metrics

**Must Achieve**:
- Zero authentication bypasses in production
- 100% CSRF protection coverage
- Session regeneration on all logins
- All authentication events logged with tenant context

**Should Achieve**:
- < 0.1% false positive rate on suspicious activity
- < 50ms authentication overhead
- 99.9% session availability
- Zero session hijacking incidents
- **Zero tenant data cross-contamination incidents**

### 8.2 Multi-Tenant User Experience

**Must Achieve**:
- **100% of users can identify their current tenant account**
- **Business name visible on all dashboard pages**
- **Registration requires business name as mandatory field**
- **Zero user confusion about tenant context**

**Should Achieve**:
- **< 3 seconds to identify current tenant account**
- **> 95% user satisfaction with tenant identification**
- **Zero wrong-tenant data modification incidents**
- **100% tenant context consistency across sessions**

### 8.3 Developer Experience

**Requirements Met**:
- Development authentication configurable
- Clear documentation for auth testing
- Debug tools for session inspection
- No impact on development workflow
- **Tenant context debugging tools available**

### 8.4 Deployment Readiness

**Checklist**:
- [ ] All P0 security fixes implemented
- [ ] **Multi-tenant UI identity components implemented**
- [ ] **Registration flow updated with business name priority**
- [ ] Security test suite passing
- [ ] **Multi-tenant UX test suite passing**
- [ ] Performance benchmarks met
- [ ] Production configuration validated
- [ ] Security audit completed
- [ ] Monitoring and alerting configured
- [ ] Incident response plan documented
- [ ] **Tenant isolation validation completed**

---

## Appendix A: Current Issues Log

| Issue ID | Description | Severity | Status | Fix Version |
|----------|-------------|----------|---------|-------------|
| AUTH-001 | Auth bypass in development | High | Open | 1.1.0 |
| AUTH-002 | Session regeneration disabled | Critical | Open | 1.1.0 |
| AUTH-003 | CSRF protection bypassed | Critical | Open | 1.1.0 |
| AUTH-004 | Session store instability | Medium | Fixed | 1.0.5 |
| AUTH-005 | No WebSocket authentication | High | Open | 1.2.0 |
| **AUTH-006** | **Multi-tenant identity crisis** | **Critical** | **Open** | **2.0.0** |
| **AUTH-007** | **Registration lacks business name priority** | **High** | **Open** | **2.0.0** |
| **AUTH-008** | **No tenant context in dashboard** | **Critical** | **Open** | **2.0.0** |

## Appendix B: Multi-Tenant UX Requirements Summary

### **Critical UX Improvements**:

1. **Dashboard Header Identity**:
   - Large, prominent business name display
   - Consistent placement across all pages
   - Visual branding integration (logo, colors)
   - Accessible design compliance

2. **Registration Flow Priority**:
   - Business name as first required field
   - Clear labeling and help text
   - Validation and error messaging
   - Progressive disclosure for other fields

3. **Tenant Context Consistency**:
   - Page titles include business name
   - Breadcrumb navigation shows tenant context
   - Statistics and data clearly attributed to tenant
   - Session isolation prevents cross-tenant data access

4. **Multi-Account Management**:
   - Account switcher for users with multiple access
   - Recent account history
   - Secure switching with proper authentication
   - Clear current account indication

### **Success Validation Methods**:
- User testing with multiple tenant scenarios
- Analytics tracking tenant identification time
- Support ticket analysis for tenant confusion issues
- Security audit for tenant isolation
- Performance testing with concurrent tenants

## Appendix C: References

- OWASP Session Management Cheat Sheet
- Express.js Security Best Practices
- PostgreSQL Session Store Documentation
- Socket.IO Authentication Guide
- **Multi-Tenant SaaS Design Patterns**
- **WCAG 2.1 Accessibility Guidelines**
- **User Experience Design for Enterprise Applications**

---

**Document Approval**:
- Technical Lead: _________________
- Security Officer: _________________
- Product Manager: _________________
- **UX Designer**: _________________
- Date: _________________