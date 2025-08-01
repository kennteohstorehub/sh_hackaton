# Queue Management System - E2E Testing Guide

## 🎯 Overview

This comprehensive End-to-End (E2E) testing suite validates the complete queue management system workflow using Playwright. The tests cover the full user journey from authentication to customer queue management.

## 📋 Test Credentials

**Test Account (as specified in requirements):**
- **Email:** `demo@smartqueue.com`
- **Password:** `demo123456`
- **Base URL:** `http://localhost:3838`

## 🧪 Test Coverage

### Complete E2E Flow Test
The main test (`queue-management-complete-flow.spec.js`) covers:

1. **Authentication**
   - Navigate to login page
   - Authenticate with test credentials
   - Verify successful redirect to dashboard

2. **Dashboard Verification**
   - Verify dashboard loads correctly
   - Check essential UI elements
   - Extract merchant ID for public view

3. **Public Queue Access**
   - Navigate to public queue view
   - Verify form accessibility
   - Validate form fields presence

4. **Customer Queue Joining**
   - Fill customer information:
     - Name: Test Customer  
     - Phone: +60191234567
     - Party size: 2
     - Service type: Dine In
   - Submit form and verify success

5. **Real-time Updates**
   - Verify customer appears in merchant dashboard
   - Check waiting count updates
   - Validate WebSocket connections

6. **Customer Seating**
   - Test "seat customer" functionality
   - Verify status changes
   - Check real-time updates

7. **System Validation**
   - Error handling verification
   - Console error monitoring
   - Performance validation

## 🗂️ File Structure

```
tests/e2e/
├── queue-management-complete-flow.spec.js     # Main comprehensive test
├── queue-management-comprehensive-e2e.spec.js # Alternative detailed test
├── pages/
│   ├── LoginPage.js                           # Login page object
│   ├── DashboardPage.js                       # Enhanced dashboard page object
│   ├── PublicQueuePage.js                     # Public queue page object
│   └── QueueManagementPage.js                 # Queue management page object

Supporting files:
├── run-comprehensive-e2e-test.js              # Test runner script
├── validate-test-environment.js               # Environment validation
└── test-results/                              # Screenshots and artifacts
```

## 🚀 Quick Start

### 1. Environment Validation
```bash
# Check if test environment is ready
node validate-test-environment.js
```

### 2. Run Comprehensive E2E Test
```bash
# Run with default settings (headed mode, Chromium)
node run-comprehensive-e2e-test.js

# Run in headless mode
node run-comprehensive-e2e-test.js --headless

# Run with different browser
node run-comprehensive-e2e-test.js --browser=firefox
node run-comprehensive-e2e-test.js --browser=webkit
```

### 3. Direct Playwright Execution
```bash
# Run specific test file
npx playwright test tests/e2e/queue-management-complete-flow.spec.js

# Run with UI mode for debugging
npx playwright test tests/e2e/queue-management-complete-flow.spec.js --ui

# Run with debug mode
npx playwright test tests/e2e/queue-management-complete-flow.spec.js --debug
```

## 📸 Screenshots and Debugging

Screenshots are automatically captured at key points:

- `01-login-page-{timestamp}.png` - Login page
- `02-dashboard-loaded-{timestamp}.png` - Dashboard after login
- `03-public-view-{timestamp}.png` - Public queue view
- `04-form-filled-{timestamp}.png` - Form before submission
- `05-form-submitted-{timestamp}.png` - Form after submission
- `06-dashboard-with-customer-{timestamp}.png` - Dashboard with new customer
- `07-before-seat-{timestamp}.png` - Before seating action
- `08-after-seat-{timestamp}.png` - After seating action
- `09-final-state-{timestamp}.png` - Final test state

All screenshots are saved to `test-results/` directory.

## 🔧 Configuration

### Playwright Configuration
The tests use the existing `playwright.config.js` which includes:
- Multi-browser support (Chromium, Firefox, WebKit, Mobile)
- Screenshot on failure
- Video recording on failure
- Trace collection for debugging

### Test Configuration
Key settings in `tests/e2e/test-config.js`:
- Base URL: `http://localhost:3838`
- Timeouts: 30s default, 10s navigation
- Test data generators for dynamic content

## 🧩 Page Objects

### LoginPage
```javascript
// Usage example
const loginPage = new LoginPage(page);
await loginPage.goto();
await loginPage.login('demo@smartqueue.com', 'demo123456');
```

### DashboardPage (Enhanced)
```javascript
// Usage example
const dashboardPage = new DashboardPage(page);
await dashboardPage.goto();
const waitingCount = await dashboardPage.getWaitingCount();
const customerEntry = await dashboardPage.findCustomerByName('Test Customer');
await dashboardPage.seatCustomer(customerEntry);
```

### PublicQueuePage
```javascript
// Usage example
const publicPage = new PublicQueuePage(page);
await publicPage.gotoPublicQueue(merchantId);
await publicPage.joinQueue({
  name: 'Test Customer',
  phone: '+60191234567',
  partySize: 2
});
```

## ⚠️ Prerequisites

### Server Requirements
1. **Server Running:** Application must be running on `http://localhost:3838`
2. **Database Connected:** Database must be accessible and seeded with test data
3. **Test Account:** `demo@smartqueue.com` account must exist with password `demo123456`

### Dependencies
```bash
# Install Playwright
npm install @playwright/test

# Install browsers
npx playwright install
```

## 🔍 Troubleshooting

### Common Issues

#### Server Not Running
```bash
# Error: Server is not accessible
# Solution: Start the server
npm start
# or
node server/index.js
```

#### Test Credentials Invalid
```bash
# Error: Authentication failed
# Solution: Verify test account exists in database
# Check: demo@smartqueue.com with password demo123456
```

#### Screenshots Not Generated
```bash
# Ensure test-results directory exists
mkdir -p test-results

# Check file permissions
chmod 755 test-results
```

#### WebSocket Connection Issues
```bash
# Check server logs for WebSocket errors
# Verify socket.io is properly initialized
# Check for CORS issues
```

### Debug Mode
```bash
# Run in debug mode with pause on failure
npx playwright test --debug tests/e2e/queue-management-complete-flow.spec.js

# Run with trace viewer
npx playwright test --trace on tests/e2e/queue-management-complete-flow.spec.js
npx playwright show-trace test-results/*/trace.zip
```

## 📊 Test Reporting

### Console Output
The test provides detailed console logging:
- Step-by-step progress indicators
- Assertion results
- Performance metrics
- Error details

### Artifacts
Generated artifacts include:
- Screenshots at each major step
- Video recordings (on failure)
- Trace files (for debugging)
- Test reports (HTML format)

## 🎯 Test Data

### Customer Test Data
```javascript
const testCustomerData = {
  name: 'Test Customer',
  phone: '+60191234567',
  partySize: 2,
  serviceType: 'Dine In'
};
```

### Dynamic Data Generation
The test generates unique data for each run:
- Timestamps for uniqueness
- Random phone numbers
- Unique customer names

## 🔒 Security Considerations

- Test credentials are hardcoded for consistency
- No production data is used
- Tests run in isolated environment
- Sensitive data is not logged

## 📈 Performance Monitoring

The tests include performance checks:
- Page load times (< 10 seconds threshold)
- WebSocket connection speed
- Form submission response time
- Real-time update latency

## 🚨 Error Handling

Comprehensive error handling includes:
- Network timeout handling
- Element not found graceful failures
- Dialog dismissal
- Console error monitoring
- Screenshot capture on failure

## 🔄 Continuous Integration

For CI/CD integration:
```bash
# Run in CI mode
CI=true npx playwright test tests/e2e/queue-management-complete-flow.spec.js

# Generate junit report
npx playwright test --reporter=junit tests/e2e/queue-management-complete-flow.spec.js
```

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Page Object Model Pattern](https://playwright.dev/docs/pom)
- [Test Organization Best Practices](https://playwright.dev/docs/test-organization)
- [Debugging Tests](https://playwright.dev/docs/debug)

## 🎉 Success Criteria

A successful test run should show:
- ✅ All authentication steps pass
- ✅ Dashboard loads and displays correctly
- ✅ Public queue form is accessible and functional
- ✅ Customer successfully joins queue
- ✅ Real-time updates work correctly
- ✅ Customer seating functionality works
- ✅ No critical JavaScript errors
- ✅ Screenshots capture all key states

---

**Last Updated:** $(date)
**Test Framework:** Playwright
**Coverage:** End-to-End User Journey
**Automation Level:** Fully Automated