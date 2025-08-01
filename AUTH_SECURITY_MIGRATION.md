# Authentication Security Migration Guide

## Overview
This document outlines the critical authentication security fixes implemented for the StoreHub Queue Management System and provides a migration plan for safely deploying these changes to production.

## Changes Implemented

### 1. CSRF Protection Enabled
- **Changed**: Switched from `csrf-disabled.js` to `csrf-protection.js`
- **Impact**: All state-changing requests now require valid CSRF tokens
- **Files Modified**:
  - `server/index.js` - Enabled CSRF middleware
  - All EJS templates with forms - Added CSRF tokens
  - Dashboard pages - Added CSRF meta tags and AJAX setup

### 2. Session Regeneration Fixed
- **Changed**: Re-enabled session regeneration on login to prevent session fixation attacks
- **Impact**: Sessions are regenerated after successful authentication
- **Files Modified**:
  - `server/routes/frontend/auth.js` - Uncommented and fixed session regeneration

### 3. Production Safeguards Added
- **Changed**: Added multiple checks to prevent auth bypass in production
- **Impact**: Auth bypass will throw errors if loaded in production
- **Files Modified**:
  - `server/middleware/auth-bypass.js` - Added production checks
  - `server/index.js` - Added USE_AUTH_BYPASS flag support

## Migration Steps

### Phase 1: Pre-deployment Testing (Current Environment)
1. **Test Authentication Flow**:
   ```bash
   # Set environment to development
   NODE_ENV=development npm run dev
   
   # Test login/logout with CSRF enabled
   # Verify all forms work correctly
   # Check AJAX requests include CSRF headers
   ```

2. **Disable Auth Bypass**:
   ```bash
   # Test with auth bypass disabled
   USE_AUTH_BYPASS=false npm run dev
   
   # Ensure real authentication works
   # Verify session persistence
   ```

### Phase 2: Staging Deployment
1. **Deploy to Staging**:
   - Ensure `NODE_ENV=staging` or similar (not production yet)
   - Monitor logs for CSRF validation errors
   - Test all critical user flows

2. **Performance Testing**:
   - Verify session regeneration doesn't cause issues under load
   - Check that CSRF tokens don't expire prematurely

### Phase 3: Production Deployment
1. **Pre-deployment Checklist**:
   - [ ] Ensure `NODE_ENV=production` is set
   - [ ] Verify `USE_AUTH_BYPASS` is not set or set to `false`
   - [ ] Confirm database has all merchant accounts
   - [ ] Back up session store

2. **Deployment**:
   ```bash
   # On production server
   NODE_ENV=production npm start
   ```

3. **Post-deployment Monitoring**:
   - Watch for authentication errors in logs
   - Monitor for CSRF validation failures
   - Check session regeneration success rate

## Rollback Plan

If issues arise, you can temporarily disable specific security features:

### 1. Disable CSRF (Emergency Only)
```javascript
// In server/index.js, temporarily switch back:
// const { csrfTokenManager, csrfValidation, csrfHelpers } = require('./middleware/csrf-disabled');
```

### 2. Disable Session Regeneration
```javascript
// In server/routes/frontend/auth.js, comment out:
// req.session.regenerate((err) => { ... });
// And just set session data directly
```

### 3. Environment Variables
```bash
# Emergency flags (remove after fixing issues)
DISABLE_CSRF=true         # Bypasses CSRF validation
DISABLE_SESSION_REGEN=true # Skips session regeneration
```

## Security Considerations

1. **CSRF Token Expiry**: Tokens expire after 24 hours. Users may need to refresh pages if left open.

2. **Session Regeneration**: May cause brief delays during login. Monitor performance.

3. **Auth Bypass**: The system will refuse to start if auth-bypass is detected in production.

## Monitoring

Add these checks to your monitoring:
- Authentication success/failure rates
- CSRF validation error rates  
- Session regeneration timing
- Unexpected logouts

## Support

If issues arise during migration:
1. Check logs for specific error messages
2. Verify environment variables are set correctly
3. Ensure all template files were updated with CSRF tokens
4. Confirm session store is accessible and working

## Future Improvements

Consider implementing:
1. Rate limiting on authentication endpoints ✓ (Already implemented)
2. Two-factor authentication
3. Session timeout warnings
4. Audit logging for security events