const { test, expect } = require('@playwright/test');
const { LoginPage } = require('./pages/LoginPage');

test.describe('API Integration Tests', () => {
  let apiContext;
  let authToken;

  test.beforeAll(async ({ playwright }) => {
    // Create API context
    apiContext = await playwright.request.newContext({
      baseURL: process.env.BASE_URL || 'http://localhost:3838',
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      },
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('should test API health endpoint', async () => {
    const response = await apiContext.get('/api/health');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('OK');
    expect(data.timestamp).toBeDefined();
    expect(data.uptime).toBeGreaterThan(0);
  });

  test('should authenticate via API and get token', async ({ page }) => {
    // First login via UI to get session
    const loginPage = new LoginPage(page);
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    
    if (!testEmail || !testPassword) {
      test.skip('Test credentials not configured');
      return;
    }
    
    await loginPage.goto();
    await loginPage.login(testEmail, testPassword);
    await page.waitForURL('**/dashboard');
    
    // Get cookies
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'connect.sid');
    expect(sessionCookie).toBeDefined();
    
    // Use session cookie for API requests
    const response = await apiContext.get('/api/merchant/profile', {
      headers: {
        'Cookie': `${sessionCookie.name}=${sessionCookie.value}`
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const merchant = await response.json();
    expect(merchant.email).toBe(testEmail);
  });

  test('should test queue API endpoints', async ({ page }) => {
    // Login first
    const loginPage = new LoginPage(page);
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    
    if (!testEmail || !testPassword) {
      test.skip('Test credentials not configured');
      return;
    }
    
    await loginPage.goto();
    await loginPage.login(testEmail, testPassword);
    
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'connect.sid');
    
    // Create queue via API
    const createResponse = await apiContext.post('/api/queue', {
      headers: {
        'Cookie': `${sessionCookie.name}=${sessionCookie.value}`
      },
      data: {
        name: `API Test Queue ${Date.now()}`,
        description: 'Created via API test',
        maxCapacity: 25,
        averageServiceTime: 20
      }
    });
    
    expect(createResponse.ok()).toBeTruthy();
    const newQueue = await createResponse.json();
    expect(newQueue.queue.name).toContain('API Test Queue');
    
    // Get queue list
    const listResponse = await apiContext.get('/api/queue', {
      headers: {
        'Cookie': `${sessionCookie.name}=${sessionCookie.value}`
      }
    });
    
    expect(listResponse.ok()).toBeTruthy();
    const queues = await listResponse.json();
    expect(Array.isArray(queues)).toBeTruthy();
    
    // Add customer to queue
    const addCustomerResponse = await apiContext.post(`/api/queue/${newQueue.queue.id}/join`, {
      headers: {
        'Cookie': `${sessionCookie.name}=${sessionCookie.value}`
      },
      data: {
        customerName: `API Test Customer ${Date.now()}`,
        customerPhone: `+601${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
        partySize: 2
      }
    });
    
    expect(addCustomerResponse.ok()).toBeTruthy();
  });

  test('should test analytics API', async ({ page }) => {
    // Login
    const loginPage = new LoginPage(page);
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    
    if (!testEmail || !testPassword) {
      test.skip('Test credentials not configured');
      return;
    }
    
    await loginPage.goto();
    await loginPage.login(testEmail, testPassword);
    
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'connect.sid');
    
    // Get analytics data
    const response = await apiContext.get('/api/analytics/dashboard', {
      headers: {
        'Cookie': `${sessionCookie.name}=${sessionCookie.value}`
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const analytics = await response.json();
    
    // Verify analytics structure
    expect(analytics).toHaveProperty('totalCustomersToday');
    expect(analytics).toHaveProperty('avgWaitTime');
    expect(analytics).toHaveProperty('totalQueues');
    expect(analytics).toHaveProperty('activeQueues');
  });

  test('should handle API rate limiting', async () => {
    // Make multiple rapid requests
    const requests = [];
    for (let i = 0; i < 150; i++) {
      requests.push(apiContext.get('/api/health'));
    }
    
    const responses = await Promise.all(requests);
    
    // Some requests should be rate limited
    const rateLimited = responses.filter(r => r.status() === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
    
    // Check rate limit headers
    const limitedResponse = rateLimited[0];
    const retryAfter = limitedResponse.headers()['retry-after'];
    expect(retryAfter).toBeDefined();
  });

  test('should validate CSRF protection on API', async ({ page }) => {
    // Login
    const loginPage = new LoginPage(page);
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    
    if (!testEmail || !testPassword) {
      test.skip('Test credentials not configured');
      return;
    }
    
    await loginPage.goto();
    await loginPage.login(testEmail, testPassword);
    
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'connect.sid');
    
    // Try to create queue without CSRF token
    const response = await apiContext.post('/api/queue', {
      headers: {
        'Cookie': `${sessionCookie.name}=${sessionCookie.value}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: 'CSRF Test Queue'
      }
    });
    
    // Should be rejected due to missing CSRF token
    expect(response.status()).toBe(403);
  });

  test('should test WebSocket connection', async ({ page }) => {
    // Login
    const loginPage = new LoginPage(page);
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    
    if (!testEmail || !testPassword) {
      test.skip('Test credentials not configured');
      return;
    }
    
    await loginPage.goto();
    await loginPage.login(testEmail, testPassword);
    await page.waitForURL('**/dashboard');
    
    // Listen for WebSocket
    const wsPromise = page.waitForEvent('websocket', { timeout: 5000 });
    const ws = await wsPromise;
    
    // Verify WebSocket URL
    expect(ws.url()).toContain('socket.io');
    
    // Listen for frames
    const framePromise = ws.waitForEvent('framereceived', { timeout: 5000 });
    const frame = await framePromise;
    
    // Socket.io sends connection frames
    expect(frame).toBeDefined();
  });
});

test.describe('Security Tests', () => {
  test('should prevent SQL injection attempts', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // Try SQL injection in login
    await loginPage.login("admin' OR '1'='1", "password' OR '1'='1");
    
    // Should not bypass login
    await expect(loginPage.errorMessage).toBeVisible();
    await expect(page).not.toHaveURL(/.*\/dashboard/);
  });

  test('should sanitize XSS attempts in forms', async ({ page }) => {
    // Login first
    const loginPage = new LoginPage(page);
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    
    if (!testEmail || !testPassword) {
      test.skip('Test credentials not configured');
      return;
    }
    
    await loginPage.goto();
    await loginPage.login(testEmail, testPassword);
    
    // Navigate to queue creation
    await page.goto('/dashboard/queues');
    await page.click('button:has-text("Create Queue")');
    
    // Try XSS in queue name
    const xssPayload = '<img src=x onerror=alert("XSS")>';
    await page.fill('input[name="name"]', xssPayload);
    await page.fill('textarea[name="description"]', xssPayload);
    await page.click('button[type="submit"]');
    
    // Check that XSS is sanitized
    const pageContent = await page.content();
    expect(pageContent).not.toContain('onerror=alert');
  });

  test('should enforce authentication on protected routes', async ({ page }) => {
    const protectedRoutes = [
      '/dashboard',
      '/dashboard/queues',
      '/dashboard/customers',
      '/dashboard/analytics',
      '/dashboard/settings'
    ];
    
    for (const route of protectedRoutes) {
      await page.goto(route);
      // Should redirect to login
      await expect(page).toHaveURL(/.*\/auth\/login/);
    }
  });
});