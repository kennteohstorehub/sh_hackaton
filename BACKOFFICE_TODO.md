# BackOffice Development TODO - Based on Test Results

## Critical Issues (Fix Immediately)

### 1. Fix Server Errors (HTTP 500)
- [ ] **Tenant Management**: Debug `/backoffice/tenants` 500 error
- [ ] **Settings Page**: Debug `/backoffice/settings` 500 error
- [ ] **Database Schema**: Fix audit log table issues
  ```
  Error: Cannot read properties of undefined (reading 'create')
  ```

### 2. Fix Database/ORM Issues
- [ ] Check Prisma schema for `BackOfficeUserAuditLog` table
- [ ] Verify all relations are properly defined
- [ ] Run database migrations if needed

### 3. Add Missing GET Routes
Currently only POST routes exist for settings sub-pages. Add:
- [ ] `GET /backoffice/settings/general`
- [ ] `GET /backoffice/settings/security`
- [ ] `GET /backoffice/settings/email`
- [ ] `GET /backoffice/settings/notifications`
- [ ] `GET /backoffice/settings/profile`

### 4. Fix Missing API Endpoints
- [ ] Implement `GET /backoffice/api/stats` for dashboard statistics

## High Priority Features

### 5. Dashboard Improvements
- [ ] Add proper page navigation/sidebar
- [ ] Add main page title (`<h1>` or `.page-title`)
- [ ] Optimize loading performance (current: 646ms)

### 6. Audit Logs UI
- [ ] Implement audit log display table
- [ ] Add filtering options
- [ ] Add pagination controls
- [ ] Fix Prisma query in `/server/routes/backoffice/audit-logs.js` line 63

## Medium Priority

### 7. UI/UX Polish
- [ ] Add consistent navigation across all pages
- [ ] Improve responsive design
- [ ] Add loading states for slow operations
- [ ] Add proper error messages

### 8. Settings Page Structure
- [ ] Create individual settings page views
- [ ] Implement tabbed interface or separate pages
- [ ] Add form validation feedback
- [ ] Add success/error notifications

## Low Priority

### 9. Security Headers
- [ ] Review X-XSS-Protection header policy
- [ ] Consider additional security headers

### 10. Testing
- [ ] Add automated integration tests
- [ ] Add unit tests for critical functions
- [ ] Add end-to-end test suite

## Quick Fixes (Can be done immediately)

### Fix Audit Logs Prisma Query
File: `/server/routes/backoffice/audit-logs.js:63`

Current broken code:
```javascript
prisma.auditLog.findMany({
  include: {
    user: {  // This field doesn't exist
      select: { id: true, name: true, email: true }
    }
  }
})
```

Should be:
```javascript
prisma.backOfficeUserAuditLog.findMany({
  include: {
    backOfficeUser: {
      select: { id: true, fullName: true, email: true }
    }
  }
})
```

### Add Missing Dashboard API Route
File: `/server/routes/backoffice/settings.js`

The route exists at line 309 but is under settings. Should be moved to dashboard route or main routes.

### Fix Settings Individual Pages
Add these routes to `/server/routes/backoffice/settings.js`:

```javascript
// Individual settings pages
router.get('/general', (req, res) => {
  res.render('backoffice/settings/general', { ... });
});

router.get('/security', (req, res) => {
  res.render('backoffice/settings/security', { ... });
});

router.get('/email', (req, res) => {
  res.render('backoffice/settings/email', { ... });
});

router.get('/notifications', (req, res) => {
  res.render('backoffice/settings/notifications', { ... });
});

router.get('/profile', (req, res) => {
  res.render('backoffice/settings/profile', { ... });
});
```

## Files That Need Attention

1. `/server/routes/backoffice/settings.js` - Add GET routes
2. `/server/routes/backoffice/audit-logs.js` - Fix Prisma query
3. `/server/routes/backoffice/tenants.js` - Debug 500 error
4. `/views/backoffice/dashboard.ejs` - Add navigation and title
5. `/prisma/schema.prisma` - Verify audit log tables

## Testing

After fixes, rerun the comprehensive test:
```bash
node comprehensive-backoffice-test.js
```

Target: Increase pass rate from 51.6% to >80%