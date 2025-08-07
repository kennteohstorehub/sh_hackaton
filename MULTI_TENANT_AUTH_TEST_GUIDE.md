# Multi-Tenant Authentication Testing Guide

This document provides comprehensive guidance for testing the multi-tenant authentication system in the StoreHub Queue Management System.

## 🏗️ Architecture Overview

The system implements a sophisticated multi-tenant architecture with:

- **BackOffice Portal**: Admin interface at `admin.lvh.me:3838`
- **Tenant Portals**: Individual tenant interfaces (e.g., `demo.lvh.me:3838`, `test-cafe.lvh.me:3838`)
- **Session Isolation**: Complete separation between BackOffice and tenant sessions
- **Security Boundaries**: Strict access controls preventing cross-tenant data access

## 🧪 Test Suite Components

### 1. Unit Tests (`tests/unit/`)

#### `auth-middleware.test.js`
Tests core authentication middleware functionality:
- BackOffice authentication flow
- Tenant authentication flow  
- Session isolation mechanisms
- User data loading and validation
- Error handling and edge cases

#### `tenant-resolver.test.js`
Tests tenant resolution and isolation:
- Subdomain parsing (local and production)
- Tenant context setting
- Multi-tenant data filtering
- Access validation
- Error scenarios

### 2. End-to-End Tests (`tests/e2e/`)

#### `multi-tenant-auth-comprehensive.spec.js`
Comprehensive authentication flow testing:
- BackOffice login/logout flows
- Multiple tenant authentication flows
- Session persistence across page reloads
- Cross-context access prevention
- CSRF protection validation
- Password reset functionality
- API endpoint security

#### `multi-tenant-security.spec.js`
Security-focused testing:
- Session fixation prevention
- Cross-site session leakage prevention
- SQL injection protection
- XSS prevention
- Rate limiting verification
- Privilege escalation prevention
- Data leakage prevention
- Session timeout handling

### 3. Test Runner (`run-multi-tenant-auth-tests.js`)

Orchestrates the complete test suite:
- Environment validation
- Database setup and seeding
- Sequential test execution
- Comprehensive reporting
- Error aggregation

## 🚀 Running the Tests

### Prerequisites

1. **Local Development Setup**:
   ```bash
   # Ensure local subdomain resolution
   echo "127.0.0.1 admin.lvh.me demo.lvh.me test-cafe.lvh.me" >> /etc/hosts
   ```

2. **Environment Variables**:
   ```bash
   DATABASE_URL="your_database_connection_string"
   SESSION_SECRET="your_session_secret"
   NODE_ENV="test"
   ```

3. **Dependencies**:
   ```bash
   npm install
   npx playwright install
   ```

### Running All Tests

```bash
# Run the complete test suite
node run-multi-tenant-auth-tests.js

# Or run individual test types
npm test -- --testPathPattern="unit.*auth"
npx playwright test multi-tenant-auth-comprehensive.spec.js
npx playwright test multi-tenant-security.spec.js
```

### Test Execution Flow

1. **Environment Validation**
   - Verifies required environment variables
   - Checks server health
   - Validates database connectivity
   - Confirms subdomain resolution

2. **Test Data Setup**
   - Runs database migrations
   - Seeds test data
   - Creates required test users:
     - BackOffice: `backoffice@storehubqms.local` / `BackOffice123!@#`
     - Demo Tenant: `admin@demo.local` / `Demo123!@#`
     - Test Cafe: `cafe@testcafe.local` / `Test123!@#`

3. **Unit Test Execution**
   - Tests middleware functions in isolation
   - Validates business logic
   - Checks error handling

4. **E2E Test Execution**
   - Tests complete user workflows
   - Validates UI interactions
   - Verifies cross-browser compatibility

5. **Security Test Execution**
   - Tests attack vectors
   - Validates security boundaries
   - Checks for vulnerabilities

6. **Report Generation**
   - Aggregates all test results
   - Generates detailed JSON report
   - Provides summary statistics

## 📊 Test Coverage Areas

### ✅ Authentication Flows
- [x] BackOffice login at admin.lvh.me:3838
- [x] Demo tenant login at demo.lvh.me:3838  
- [x] Test Cafe tenant login at test-cafe.lvh.me:3838
- [x] Invalid credential handling
- [x] Session persistence across page reloads
- [x] Logout functionality

### ✅ Session Management
- [x] Session isolation between contexts
- [x] Mixed session cleanup
- [x] Session timeout handling
- [x] Session fixation prevention
- [x] Secure cookie attributes

### ✅ Security Boundaries
- [x] Cross-tenant access prevention
- [x] BackOffice to tenant access blocking
- [x] Tenant to BackOffice access blocking
- [x] API endpoint protection
- [x] Privilege escalation prevention

### ✅ Input Validation & Security
- [x] CSRF protection implementation
- [x] SQL injection prevention
- [x] XSS attack prevention
- [x] Rate limiting verification
- [x] Email format validation
- [x] Password strength requirements

### ✅ Edge Cases & Error Handling
- [x] Invalid subdomain handling  
- [x] Database connection failures
- [x] Malformed session data
- [x] Concurrent login attempts
- [x] Session manipulation attempts
- [x] Server error scenarios

## 🎯 Test Credentials

### BackOffice Portal
- **URL**: http://admin.lvh.me:3838/backoffice/auth/login
- **Email**: backoffice@storehubqms.local
- **Password**: BackOffice123!@#

### Demo Tenant
- **URL**: http://demo.lvh.me:3838/auth/login
- **Email**: admin@demo.local
- **Password**: Demo123!@#

### Test Cafe Tenant
- **URL**: http://test-cafe.lvh.me:3838/auth/login
- **Email**: cafe@testcafe.local
- **Password**: Test123!@#

## 📋 Test Report Structure

The test runner generates a comprehensive report (`multi-tenant-auth-test-report.json`) containing:

```json
{
  "unit": { "passed": 25, "failed": 0, "total": 25 },
  "e2e": { "passed": 18, "failed": 0, "total": 18 },
  "security": { "passed": 15, "failed": 0, "total": 15 },
  "startTime": "2025-01-24T10:00:00.000Z",
  "endTime": "2025-01-24T10:15:30.000Z",
  "errors": [],
  "metadata": {
    "version": "1.0.0",
    "environment": "test",
    "nodeVersion": "v18.17.0",
    "platform": "darwin",
    "testRunner": "custom-multi-tenant-auth-runner"
  },
  "testConfiguration": {
    "backofficeUrl": "http://admin.lvh.me:3838",
    "tenantUrls": [
      "http://demo.lvh.me:3838",
      "http://test-cafe.lvh.me:3838"
    ],
    "databaseUrl": "configured",
    "sessionSecret": "configured"
  }
}
```

## 🔧 Troubleshooting

### Common Issues

1. **Subdomain Resolution Fails**
   ```bash
   # Add to /etc/hosts
   127.0.0.1 admin.lvh.me demo.lvh.me test-cafe.lvh.me
   ```

2. **Database Connection Issues**
   ```bash
   # Verify DATABASE_URL
   echo $DATABASE_URL
   
   # Test connection
   npx prisma db push
   ```

3. **Server Not Running**
   ```bash
   # Start server manually
   npm start
   
   # Or check port usage
   lsof -i :3838
   ```

4. **Missing Test Data**
   ```bash
   # Reset and seed database
   npx prisma migrate reset
   npx prisma db seed
   ```

5. **Session Issues**
   ```bash
   # Clear browser data
   # Or test in incognito mode
   ```

### Test Debugging

1. **Run Tests in Headed Mode**:
   ```bash
   npx playwright test --headed multi-tenant-auth-comprehensive.spec.js
   ```

2. **Debug Specific Test**:
   ```bash
   npx playwright test --debug multi-tenant-security.spec.js -g "should prevent session fixation"
   ```

3. **Generate Test Reports**:
   ```bash
   npx playwright test --reporter=html
   ```

4. **View Test Traces**:
   ```bash
   npx playwright show-trace trace.zip
   ```

## 🚨 Security Considerations

### Critical Security Tests

1. **Session Isolation**: Ensures complete separation between BackOffice and tenant sessions
2. **Cross-Tenant Prevention**: Blocks access to other tenant's data
3. **CSRF Protection**: Validates all forms have proper CSRF tokens
4. **Session Fixation**: Ensures session IDs change after authentication
5. **Input Validation**: Protects against SQL injection and XSS
6. **Rate Limiting**: Prevents brute force attacks
7. **Privilege Escalation**: Blocks unauthorized access elevation

### Security Test Failures

If security tests fail, consider these critical:
- **Session isolation failures**: Could lead to data breaches
- **CSRF protection failures**: Could enable cross-site attacks  
- **Input validation failures**: Could allow code injection
- **Rate limiting failures**: Could enable brute force attacks

## 📈 Performance Considerations

### Load Testing
The test suite includes basic concurrent access testing. For production load testing:

```bash
# Install k6 for load testing
npm install -g k6

# Run load tests
k6 run load-test-script.js
```

### Performance Benchmarks
- Login response time: < 500ms
- Dashboard load time: < 1000ms
- Session validation: < 100ms
- Database queries: < 200ms

## 🔄 Continuous Integration

### GitHub Actions Integration

```yaml
name: Multi-Tenant Auth Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npx playwright install
      - run: node run-multi-tenant-auth-tests.js
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          SESSION_SECRET: ${{ secrets.TEST_SESSION_SECRET }}
```

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Jest Testing Framework](https://jestjs.io/)
- [Express Session Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [OWASP Authentication Guide](https://owasp.org/www-project-authentication/)
- [Multi-Tenant Architecture Patterns](https://docs.microsoft.com/en-us/azure/architecture/patterns/multitenancy)

## 🎯 Next Steps

1. **Integration with CI/CD**: Add tests to deployment pipeline
2. **Performance Testing**: Implement load testing scenarios  
3. **Security Scanning**: Add automated vulnerability scanning
4. **Monitoring**: Set up test execution monitoring
5. **Documentation**: Keep test documentation updated with new features

## 📞 Support

For issues with the test suite:

1. Check the troubleshooting section above
2. Review test logs in `multi-tenant-auth-test-report.json`
3. Examine Playwright test results in `test-results/`
4. Verify environment configuration
5. Check database connectivity and test data

Remember: A failing test is better than an undiscovered security vulnerability in production!