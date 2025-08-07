# Authentication System Bug Report

## Executive Summary
The StoreHub Queue Management System has critical authentication issues preventing proper login functionality when `USE_AUTH_BYPASS=false` is set. Multiple bugs were identified that create redirect loops, CSRF token mismatches, and conflicting authentication middleware configurations.

## Test Environment
- **Date**: July 30, 2025
- **Server Path**: /Users/kennteoh/Development/Hack
- **Node.js Version**: As configured in the environment
- **Database**: PostgreSQL (Neon)
- **Test Credentials**: admin@storehub.com / password123

## Critical Issues Found

### 1. Redirect Loop Between Login and Dashboard (CRITICAL)
**Severity**: Critical  
**Impact**: Complete system unusability  
**Steps to Reproduce**:
1. Set `USE_AUTH_BYPASS=false` in .env
2. Start server with `npm run dev`
3. Access http://localhost:3000
4. Observe infinite redirect loop between /auth/login and /dashboard

**Root Cause**: 
- In development mode, the server uses `auth-redirect.js` instead of `auth.js`
- `auth-redirect.js` redirects ALL auth routes to /dashboard without processing
- Dashboard requires authentication and redirects back to /auth/login
- This creates an infinite loop

**Evidence**:
```javascript
// server/index.js lines 289-293
if (process.env.NODE_ENV !== 'production') {
  app.use('/auth', require('./routes/frontend/auth-redirect'));
} else {
  app.use('/auth', require('./routes/frontend/auth'));
}
```

### 2. Conflicting Authentication Messages (HIGH)
**Severity**: High  
**Impact**: Confusion about system state  
**Details**:
- Server startup shows: "🔓 AUTHENTICATION BYPASSED - All requests use demo merchant"
- Later logs show: "✅ Authentication required - Login system active"
- These messages contradict each other

**Root Cause**: Multiple checks for auth bypass mode with different logic

### 3. CSRF Token Validation Failure (HIGH)
**Severity**: High  
**Impact**: Unable to login even in production mode  
**Steps to Reproduce**:
1. Start server with `NODE_ENV=production npm start`
2. Access login page and obtain CSRF token
3. Submit login form with valid credentials
4. Receive 403 Forbidden error

**Evidence**:
```
CSRF validation failed - invalid token {
  "url": "/auth/login",
  "method": "POST",
  "hasToken": true,
  "tokenMatch": false
}
```

### 4. Auth Bypass Logic Inconsistency (MEDIUM)
**Severity**: Medium  
**Impact**: Unexpected behavior based on environment variables  
**Details**: 
The auth bypass check uses complex logic:
```javascript
const useAuthBypass = process.env.USE_AUTH_BYPASS === 'true' || 
                     (process.env.NODE_ENV !== 'production' && 
                      process.env.USE_AUTH_BYPASS !== 'false');
```
This means auth bypass is enabled by default in development unless explicitly set to 'false'.

### 5. Session Persistence Issues (MEDIUM)
**Severity**: Medium  
**Impact**: Sessions not properly maintained after login  
**Details**:
- After successful login redirect, session userId remains null
- Session regeneration may not be completing properly
- PostgreSQL session store may have synchronization issues

## Additional Findings

### Working Scenarios:
1. **With USE_AUTH_BYPASS=true**: 
   - Dashboard accessible
   - Logout functionality works correctly
   - No CSRF errors on logout

2. **In Production Mode**:
   - Login page renders correctly
   - Real auth routes are used
   - But CSRF validation prevents successful login

### Security Concerns:
1. **Development Auth Bypass**: The `auth-redirect.js` file completely bypasses authentication in development, which could lead to accidental deployment of insecure code
2. **CSRF Token Mismatch**: Indicates potential session management issues
3. **Mixed Authentication States**: System can be in conflicting states where auth is both enabled and bypassed

## Recommendations

### Immediate Fixes Required:
1. **Remove auth-redirect.js routing logic** - Always use real auth routes regardless of environment
2. **Fix CSRF token validation** - Ensure tokens are properly synchronized with sessions
3. **Simplify auth bypass logic** - Use a single, clear boolean check
4. **Fix session regeneration** - Ensure sessions are properly saved after login

### Code Changes Needed:

1. In `server/index.js`, replace:
```javascript
if (process.env.NODE_ENV !== 'production') {
  app.use('/auth', require('./routes/frontend/auth-redirect'));
} else {
  app.use('/auth', require('./routes/frontend/auth'));
}
```
With:
```javascript
app.use('/auth', require('./routes/frontend/auth'));
```

2. Simplify auth bypass check to:
```javascript
const useAuthBypass = process.env.USE_AUTH_BYPASS === 'true';
```

3. Ensure CSRF tokens are properly handled in session configuration

## Test Results Summary

| Test Scenario | Expected Result | Actual Result | Status |
|--------------|-----------------|---------------|---------|
| Access root without auth | Redirect to /auth/login | Redirect loop | ❌ FAIL |
| Access login page | Show login form | Redirect to dashboard | ❌ FAIL |
| Login with valid credentials | Successful login | Never processes (redirected) | ❌ FAIL |
| Logout functionality | Successful logout | Works only with auth bypass | ⚠️ PARTIAL |
| Session persistence | Maintain session | Session not updated properly | ❌ FAIL |
| CSRF protection | Protect against CSRF | Token mismatch errors | ❌ FAIL |

## Conclusion

The authentication system is currently broken when `USE_AUTH_BYPASS=false`. The primary issue is the use of `auth-redirect.js` in development mode, which creates an infinite redirect loop. Additionally, CSRF token validation failures prevent login even when the proper auth routes are used. These issues must be addressed before the authentication system can function properly.

**Recommendation**: Keep `USE_AUTH_BYPASS=true` until these critical issues are resolved.