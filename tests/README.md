# Queue Management System - E2E Tests

This directory contains comprehensive end-to-end tests for the Queue Management System using Playwright.

## Test Structure

```
tests/
├── e2e/
│   ├── fixtures/         # Test data and utilities
│   ├── pages/           # Page Object Models
│   ├── 01-login.spec.js # Login functionality tests
│   ├── 02-dashboard.spec.js # Dashboard tests
│   ├── 03-queue-management.spec.js # Queue management tests
│   └── 04-api-integration.spec.js # API and security tests
└── README.md
```

## Running Tests

### Prerequisites
```bash
# Install Playwright browsers (first time only)
npx playwright install
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
npm run test:login      # Login tests only
npm run test:dashboard  # Dashboard tests only
npm run test:queue     # Queue management tests only
npm run test:api       # API integration tests only
```

### Interactive Mode
```bash
npm run test:ui        # Run with Playwright UI
npm run test:debug     # Debug mode
npm run test:headed    # Run in headed browser
```

### Test Production
```bash
# Quick production test
node test-production.js

# Full test suite against production
BASE_URL=https://queuemanagement-vtc2.onrender.com npm test
```

## Test Coverage

### 1. Login Tests (`01-login.spec.js`)
- ✅ Login page display and elements
- ✅ Form validation
- ✅ Invalid credentials handling
- ✅ Successful login with demo account
- ✅ Password security (masked input)
- ✅ XSS prevention
- ✅ Session persistence
- ✅ Protected route redirects
- ✅ Accessibility (ARIA labels, keyboard navigation)

### 2. Dashboard Tests (`02-dashboard.spec.js`)
- ✅ Dashboard display after login
- ✅ Business statistics display
- ✅ Navigation to all sections
- ✅ Logout functionality
- ✅ Session persistence across refresh
- ✅ Merchant information display
- ✅ Responsive design
- ✅ Real-time WebSocket connection

### 3. Queue Management Tests (`03-queue-management.spec.js`)
- ✅ Create new queue
- ✅ Add customers to queue
- ✅ Call next customer
- ✅ Delete queue
- ✅ Form validation
- ✅ Capacity limits
- ✅ Real-time updates

### 4. API Integration Tests (`04-api-integration.spec.js`)
- ✅ Health endpoint
- ✅ Authentication via API
- ✅ Queue CRUD operations
- ✅ Analytics API
- ✅ Rate limiting
- ✅ CSRF protection
- ✅ WebSocket connection
- ✅ SQL injection prevention
- ✅ XSS sanitization
- ✅ Route authentication

## Page Objects

The tests use Page Object Model pattern for better maintainability:

- `LoginPage.js` - Login page interactions
- `DashboardPage.js` - Dashboard navigation and stats
- `QueueManagementPage.js` - Queue CRUD operations

## Test Data

Test data is centralized in `fixtures/test-data.js` including:
- User credentials
- Queue configurations
- Customer information

## CI/CD Integration

To run in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Install dependencies
  run: npm ci
  
- name: Install Playwright
  run: npx playwright install --with-deps
  
- name: Run tests
  run: npm test
  env:
    BASE_URL: ${{ secrets.PRODUCTION_URL }}
```

## Debugging Failed Tests

1. **Screenshots**: Automatically captured on failure in `test-results/`
2. **Videos**: Enable with `video: 'on'` in playwright.config.js
3. **Traces**: Run with `--trace on` for detailed debugging
4. **Reports**: View HTML report with `npm run test:report`

## Best Practices

1. Always run tests locally before committing
2. Keep tests independent - each test should work in isolation
3. Use meaningful test descriptions
4. Clean up test data after tests
5. Use Page Objects for reusable interactions
6. Keep selectors maintainable (prefer data-testid attributes)

## Troubleshooting

### Tests timing out
- Increase timeout in playwright.config.js
- Check if application is running on correct port
- Verify network connectivity

### Login failures
- Ensure demo user is seeded in database
- Check password hashing consistency
- Verify CSRF token handling

### WebSocket tests failing
- Ensure Socket.IO is properly initialized
- Check authentication middleware
- Verify real-time features are enabled