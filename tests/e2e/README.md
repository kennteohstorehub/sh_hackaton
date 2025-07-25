# E2E Tests for StoreHub Queue Management System

This directory contains comprehensive end-to-end tests for the StoreHub Queue Management System using Playwright.

## Test Structure

The tests are organized into the following files:

1. **01-login.spec.js** - Authentication and login flow tests
2. **02-dashboard.spec.js** - Comprehensive dashboard functionality tests including:
   - Navigation between all sections
   - WhatsApp status banner interactions
   - Queue controls (refresh, stop/start)
   - Customer list and action buttons
   - Tab switching (Active Queue/Seated Customers)
   - Mobile responsive design
   - Real-time connection status
   - Empty queue states
3. **03-queue-management.spec.js** - Enhanced queue management tests including:
   - Queue CRUD operations
   - Customer management
   - Queue capacity limits
   - Stop/start queue functionality
   - Notification actions
   - Queue statistics
   - Real-time updates via WebSocket
4. **04-api-integration.spec.js** - API endpoint integration tests
5. **05-whatsapp-integration.spec.js** - WhatsApp messaging integration tests
6. **06-customer-experience.spec.js** - Comprehensive customer-facing features tests
7. **07-merchant-settings.spec.js** - Merchant settings and configuration tests
8. **08-chatbot-ai-features.spec.js** - AI chatbot functionality tests
9. **09-settings.spec.js** - Comprehensive settings page tests including:
   - Restaurant information management
   - Operating hours configuration
   - Queue configuration
   - Notification preferences
   - Message templates
   - System settings
   - Form validation
   - Responsive design
10. **10-queue-operations.spec.js** - Focused queue operations tests including:
    - Notify button functionality
    - Stop/Start queue toggle
    - Queue status synchronization
    - Customer join validation
    - View Public Queue button
    - Rapid clicking stress tests
11. **comprehensive-system.spec.js** - Complete system integration test including:
    - Full user journey from login to customer join
    - All dashboard cards and buttons
    - Analytics with chart width verification
    - Settings page functionality
    - Error handling and validation
    - Performance benchmarks
    - Concurrent user operations

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure test environment:**
   ```bash
   cp tests/e2e/.env.example tests/e2e/.env
   ```

3. **Update `.env` with your test credentials:**
   ```
   TEST_USER_EMAIL=your-test-email@example.com
   TEST_USER_PASSWORD=your-test-password
   ```

## Running Tests

### Run all tests at high speed:
```bash
npm run test:e2e
```

### Run comprehensive test suite at high speed:
```bash
./run-comprehensive-tests.sh
```

### Run tests in parallel for maximum speed:
```bash
npx playwright test --workers=4
```

### Run focused queue operations tests:
```bash
npx playwright test tests/e2e/10-queue-operations.spec.js --workers=4
```

### Run comprehensive system test:
```bash
npx playwright test tests/e2e/comprehensive-system.spec.js
```

### Run specific test file:
```bash
npx playwright test tests/e2e/01-login.spec.js
```

### Run tests in UI mode for debugging:
```bash
npx playwright test --ui
```

### Run tests with specific browser:
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
npx playwright test --project="Mobile Chrome"
npx playwright test --project="Mobile Safari"
```

## Performance Testing

### Run tests at maximum speed:
```bash
# Headless mode with multiple workers
npx playwright test --workers=auto

# Run specific suite in parallel
npx playwright test tests/e2e/02-dashboard.spec.js --workers=4
```

### Performance tips:
- Tests run faster in headless mode (default)
- Use `--workers=auto` to utilize all CPU cores
- Tests are designed to be independent for parallel execution
- Dynamic data generation prevents test conflicts

## Test Reports

### Generate and view HTML report:
```bash
npx playwright show-report
```

### Generate JSON report for CI:
```bash
npx playwright test --reporter=json > test-results.json
```

### Generate JUnit report:
```bash
npx playwright test --reporter=junit > junit-results.xml
```

## Test Coverage

The test suite covers:
- ✅ Authentication flows (login, logout, session management)
- ✅ Dashboard interactions (all cards, buttons, navigation)
- ✅ Queue management (CRUD, notifications, real-time updates)
- ✅ Customer experience (join queue, status tracking)
- ✅ Settings management (all forms and configurations)
- ✅ Mobile responsive design
- ✅ WebSocket real-time features
- ✅ Form validations
- ✅ Error handling

## Test Data

All test data is generated dynamically to avoid conflicts and ensure test isolation:

- **No hardcoded credentials** - All authentication uses environment variables
- **Dynamic customer data** - Names, phone numbers, emails are generated with timestamps
- **Unique identifiers** - Queue numbers, business names include timestamps
- **Random values** - Party sizes, durations, etc. use random generation

### Available Helpers

```javascript
const testConfig = require('./test-config');

// Generate test data
const phoneNumber = testConfig.generateTestData.phoneNumber();
const email = testConfig.generateTestData.email();
const name = testConfig.generateTestData.name();
const queueNumber = testConfig.generateTestData.queueNumber();
```

## Writing Tests

Tests follow the Page Object Model pattern. Page objects are located in `tests/e2e/pages/` directory.

Example test structure:
```javascript
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('./pages/LoginPage');

test.describe('Feature Tests', () => {
  test('should perform action', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    // ... test steps
  });
});
```

## Best Practices

1. **Use page objects** for reusable components
2. **Keep tests independent** - each test should be atomic
3. **Use meaningful descriptions** for test clarity
4. **Dynamic data generation** - use timestamps and random data
5. **Proper waits** - use Playwright's auto-waiting, avoid hard delays
6. **Test both paths** - success and failure scenarios
7. **Parallel execution** - tests are designed to run concurrently
8. **Mobile testing** - include viewport tests for responsive design
9. **Clean up after tests** - delete any test data created

## Debugging

### Debug a specific test:
```bash
npx playwright test --debug tests/e2e/01-login.spec.js
```

### View browser during test execution:
```bash
npx playwright test --headed
```

### Slow down test execution:
```bash
npx playwright test --headed --slow-mo=1000
```

### Generate trace for debugging:
```bash
npx playwright test --trace on
```

### View trace:
```bash
npx playwright show-trace trace.zip
```

### Debug with environment variable:
```bash
PWDEBUG=1 npm test
```

## CI/CD Integration

### GitHub Actions example:
```yaml
- name: Run Playwright tests
  run: npx playwright test
  env:
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
    TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
```

### Docker support:
```bash
docker run --rm -v $(pwd):/work -w /work mcr.microsoft.com/playwright:v1.40.0 npm run test:e2e
```

The tests are configured for CI environments with:
- Automatic retries on failure
- Headless execution
- Configurable workers based on environment
- Screenshots and videos on failure

## Troubleshooting

### Tests fail with "Test credentials not configured"
- Ensure `.env` file exists with valid credentials
- Check that environment variables are loaded correctly
- Verify the test user exists in the system

### Random test failures
- Check for race conditions in async operations
- Ensure proper waits for elements and navigation
- Review test isolation - tests shouldn't depend on each other
- Use `page.waitForLoadState('networkidle')` for dynamic content

### Port conflicts
- The test server runs on port 3838 by default
- Change in `playwright.config.js` if needed
- Use the server manager script to clean up processes

### WebSocket connection issues
- Allow time for WebSocket connections to establish
- Use proper event waiting: `page.waitForEvent('websocket')`
- Check for connection status indicators

### Mobile test issues
- Verify touch target sizes (minimum 44px)
- Test viewport settings match actual devices
- Check responsive breakpoints

## Configuration

The test suite uses centralized configuration:

- `playwright.config.js` - Main Playwright configuration
- `test-config.js` - Test data generation and helpers
- `.env` - Environment-specific settings

Timeout configurations:
- Default action timeout: 10 seconds
- Navigation timeout: 30 seconds
- Test timeout: 60 seconds (configurable)

## Test Execution Statistics

Typical execution times (on modern hardware):
- Full suite: ~2-3 minutes (parallel)
- Individual test file: ~15-30 seconds
- Single test: ~2-10 seconds

With `--workers=auto`:
- 4 cores: ~1-2 minutes
- 8 cores: ~45-60 seconds
- 16 cores: ~30-45 seconds