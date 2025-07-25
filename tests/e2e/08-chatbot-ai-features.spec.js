// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Chatbot and AI Features Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test merchant
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    
    if (!testEmail || !testPassword) {
      test.skip('Test credentials not configured');
      return;
    }
    
    await page.goto('/login');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test.describe('Chatbot Configuration', () => {
    test('should display chatbot settings page', async ({ page }) => {
      await page.goto('/chatbot-settings');
      
      // Check page elements
      await expect(page.locator('h1')).toContainText('Chatbot Settings');
      await expect(page.locator('.chatbot-status')).toBeVisible();
      await expect(page.locator('.ai-features')).toBeVisible();
    });

    test('should toggle chatbot enabled status', async ({ page }) => {
      await page.goto('/chatbot-settings');
      
      // Toggle chatbot
      const toggle = page.locator('input[name="chatbotEnabled"]');
      const initialState = await toggle.isChecked();
      
      await toggle.click();
      
      // Check state changed
      expect(await toggle.isChecked()).toBe(!initialState);
      
      // Save
      await page.click('button:has-text("Save Settings")');
      await expect(page.locator('.success-message')).toBeVisible();
    });

    test('should configure AI response settings', async ({ page }) => {
      await page.goto('/chatbot-settings');
      
      // Check AI settings
      await expect(page.locator(':text("Response Style")')).toBeVisible();
      await expect(page.locator('select[name="responseStyle"]')).toBeVisible();
      
      // Select response style
      await page.selectOption('select[name="responseStyle"]', 'friendly');
      
      // Set response delay
      await page.fill('input[name="responseDelay"]', '1000');
      
      // Save
      await page.click('button:has-text("Save Settings")');
      await expect(page.locator('.success-message')).toBeVisible();
    });

    test('should manage chatbot greetings', async ({ page }) => {
      await page.goto('/chatbot-settings');
      
      // Update greeting message with dynamic content
      const greetingInput = page.locator('textarea[name="greetingMessage"]');
      await greetingInput.clear();
      await greetingInput.fill(`Welcome! How can I help you today? (Test ${Date.now()})`);
      
      // Add business hours greeting
      const afterHoursInput = page.locator('textarea[name="afterHoursMessage"]');
      await afterHoursInput.clear();
      await afterHoursInput.fill('We are currently closed. Our business hours are 9 AM - 9 PM.');
      
      // Save
      await page.click('button:has-text("Save Settings")');
      await expect(page.locator('.success-message')).toBeVisible();
    });
  });

  test.describe('Intent Recognition', () => {
    test('should display intent management', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("Intent Management")');
      
      // Check intent list
      await expect(page.locator('.intent-list')).toBeVisible();
      await expect(page.locator(':text("Queue Status")')).toBeVisible();
      await expect(page.locator(':text("Join Queue")')).toBeVisible();
      await expect(page.locator(':text("Business Hours")')).toBeVisible();
    });

    test('should add custom intent', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("Intent Management")');
      
      // Add new intent
      await page.click('button:has-text("Add Intent")');
      
      // Fill intent form with dynamic data
      await page.fill('input[name="intentName"]', `Test Intent ${Date.now()}`);
      await page.fill('textarea[name="trainingPhrases"]', `Test phrase 1\nTest phrase 2\nTest phrase 3`);
      await page.fill('textarea[name="responseTemplate"]', `Test response template ${Date.now()}: {dynamic_content}`);
      
      // Save
      await page.click('button:has-text("Save Intent")');
      
      // Check added
      await expect(page.locator(':text("Test Intent")')).toBeVisible();
    });

    test('should edit intent responses', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("Intent Management")');
      
      // Edit first intent
      await page.click('.intent-item button:has-text("Edit")').first();
      
      // Update response with dynamic content
      const responseInput = page.locator('textarea[name="responseTemplate"]');
      await responseInput.clear();
      await responseInput.fill(`Updated response ${Date.now()}: {dynamic_content}`);
      
      // Save
      await page.click('button:has-text("Update")');
      
      // Check updated
      await expect(page.locator(':text("Updated response")')).toBeVisible();
    });

    test('should test intent recognition', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("Intent Management")');
      
      // Click test button
      await page.click('button:has-text("Test Intents")');
      
      // Enter test phrase
      await page.fill('input[name="testPhrase"]', 'What time do you close?');
      await page.click('button:has-text("Test")');
      
      // Check results
      await expect(page.locator('.test-results')).toBeVisible();
      await expect(page.locator(':text("Detected Intent")')).toBeVisible();
      await expect(page.locator(':text("Confidence")')).toBeVisible();
    });
  });

  test.describe('AI Analytics', () => {
    test('should display AI performance metrics', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("AI Analytics")');
      
      // Check metrics
      await expect(page.locator(':text("Intent Accuracy")')).toBeVisible();
      await expect(page.locator(':text("Response Time")')).toBeVisible();
      await expect(page.locator(':text("User Satisfaction")')).toBeVisible();
      await expect(page.locator(':text("Fallback Rate")')).toBeVisible();
    });

    test('should show conversation analytics', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("AI Analytics")');
      
      // Check conversation stats
      await expect(page.locator(':text("Total Conversations")')).toBeVisible();
      await expect(page.locator(':text("Average Duration")')).toBeVisible();
      await expect(page.locator(':text("Resolution Rate")')).toBeVisible();
    });

    test('should display top intents', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("AI Analytics")');
      
      // Check top intents chart
      await expect(page.locator('.top-intents-chart')).toBeVisible();
      await expect(page.locator(':text("Most Common Queries")')).toBeVisible();
    });
  });

  test.describe('Sentiment Analysis', () => {
    test('should show sentiment settings', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("Sentiment Analysis")');
      
      // Check settings
      await expect(page.locator(':text("Enable Sentiment Analysis")')).toBeVisible();
      await expect(page.locator(':text("Escalation Threshold")')).toBeVisible();
    });

    test('should configure sentiment thresholds', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("Sentiment Analysis")');
      
      // Enable sentiment analysis
      await page.check('input[name="sentimentEnabled"]');
      
      // Set thresholds
      await page.fill('input[name="negativeThreshold"]', '-0.5');
      await page.fill('input[name="escalationThreshold"]', '-0.7');
      
      // Save
      await page.click('button:has-text("Save Sentiment Settings")');
      await expect(page.locator('.success-message')).toBeVisible();
    });

    test('should set escalation rules', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("Sentiment Analysis")');
      
      // Configure escalation with dynamic email
      await page.check('input[name="autoEscalate"]');
      await page.fill('input[name="escalationEmail"]', `manager_${Date.now()}@example.com`);
      
      // Set escalation message
      await page.fill('textarea[name="escalationMessage"]', 'Customer requires immediate attention - negative sentiment detected');
      
      // Save
      await page.click('button:has-text("Save Sentiment Settings")');
      await expect(page.locator('.success-message')).toBeVisible();
    });
  });

  test.describe('Queue Prediction AI', () => {
    test('should display wait time prediction settings', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("Queue Predictions")');
      
      // Check prediction settings
      await expect(page.locator(':text("Enable Wait Time Predictions")')).toBeVisible();
      await expect(page.locator(':text("Prediction Model")')).toBeVisible();
      await expect(page.locator(':text("Confidence Threshold")')).toBeVisible();
    });

    test('should configure prediction parameters', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("Queue Predictions")');
      
      // Enable predictions
      await page.check('input[name="predictionsEnabled"]');
      
      // Select model
      await page.selectOption('select[name="predictionModel"]', 'advanced');
      
      // Set parameters
      await page.fill('input[name="historicalDataDays"]', '30');
      await page.fill('input[name="confidenceThreshold"]', '0.8');
      
      // Save
      await page.click('button:has-text("Save Prediction Settings")');
      await expect(page.locator('.success-message')).toBeVisible();
    });

    test('should show prediction accuracy metrics', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("Queue Predictions")');
      
      // Check accuracy metrics
      await expect(page.locator(':text("Prediction Accuracy")')).toBeVisible();
      await expect(page.locator(':text("Mean Absolute Error")')).toBeVisible();
      await expect(page.locator('.accuracy-chart')).toBeVisible();
    });
  });

  test.describe('Natural Language Processing', () => {
    test('should display NLP configuration', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("NLP Settings")');
      
      // Check NLP options
      await expect(page.locator(':text("Language Detection")')).toBeVisible();
      await expect(page.locator(':text("Entity Recognition")')).toBeVisible();
      await expect(page.locator(':text("Context Retention")')).toBeVisible();
    });

    test('should configure language support', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("NLP Settings")');
      
      // Enable multiple languages
      await page.check('input[name="multiLanguage"]');
      
      // Select supported languages
      await page.check('input[value="en"]');
      await page.check('input[value="zh"]');
      await page.check('input[value="ms"]');
      
      // Save
      await page.click('button:has-text("Save NLP Settings")');
      await expect(page.locator('.success-message')).toBeVisible();
    });

    test('should manage entity types', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("NLP Settings")');
      
      // Add custom entity
      await page.click('button:has-text("Add Entity Type")');
      
      // Fill entity form with dynamic data
      await page.fill('input[name="entityName"]', `Entity${Date.now()}`);
      await page.fill('textarea[name="entityExamples"]', `example1_${Date.now()}, example2_${Date.now()}, example3_${Date.now()}`);
      
      // Save
      await page.click('button:has-text("Save Entity")');
      
      // Check added
      await expect(page.locator(':text("Entity")')).toBeVisible();
    });
  });

  test.describe('Chatbot Testing Interface', () => {
    test('should provide chat testing interface', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("Test Chatbot")');
      
      // Check test interface
      await expect(page.locator('.chat-test-interface')).toBeVisible();
      await expect(page.locator('.chat-messages')).toBeVisible();
      await expect(page.locator('input[name="testMessage"]')).toBeVisible();
    });

    test('should simulate chat conversation', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("Test Chatbot")');
      
      // Send test message with dynamic content
      await page.fill('input[name="testMessage"]', `Test message ${Date.now()}: What is the current wait time?`);
      await page.click('button:has-text("Send")');
      
      // Check response
      await expect(page.locator('.bot-message')).toBeVisible();
      await expect(page.locator('.message-timestamp')).toBeVisible();
    });

    test('should show debug information', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("Test Chatbot")');
      
      // Enable debug mode
      await page.check('input[name="debugMode"]');
      
      // Send message with dynamic content
      await page.fill('input[name="testMessage"]', `Test ${Date.now()}: Join queue`);
      await page.click('button:has-text("Send")');
      
      // Check debug info
      await expect(page.locator('.debug-panel')).toBeVisible();
      await expect(page.locator(':text("Intent Score")')).toBeVisible();
      await expect(page.locator(':text("Entities Detected")')).toBeVisible();
    });
  });

  test.describe('AI Training Data', () => {
    test('should allow exporting training data', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("Training Data")');
      
      // Check export options
      await expect(page.locator('button:has-text("Export Conversations")')).toBeVisible();
      await expect(page.locator('button:has-text("Export Intents")')).toBeVisible();
    });

    test('should show training recommendations', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("Training Data")');
      
      // Check recommendations
      await expect(page.locator('.training-recommendations')).toBeVisible();
      await expect(page.locator(':text("Low confidence intents")')).toBeVisible();
      await expect(page.locator(':text("Suggested training phrases")')).toBeVisible();
    });

    test('should allow bulk training data import', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("Training Data")');
      
      // Check import section
      await expect(page.locator('input[type="file"]')).toBeVisible();
      await expect(page.locator(':text("Import CSV")')).toBeVisible();
      await expect(page.locator(':text("Import JSON")')).toBeVisible();
    });
  });

  test.describe('AI Mobile Experience', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should have mobile-friendly AI settings', async ({ page }) => {
      await page.goto('/chatbot-settings');
      
      // Check mobile layout
      await expect(page.locator('.chatbot-status')).toBeVisible();
      
      // Settings should be accessible
      const settingsCard = page.locator('.ai-features');
      const box = await settingsCard.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(375);
    });

    test('should have usable mobile chat test interface', async ({ page }) => {
      await page.goto('/chatbot-settings');
      await page.click(':text("Test Chatbot")');
      
      // Check mobile chat interface
      await expect(page.locator('.chat-test-interface')).toBeVisible();
      
      // Input should be accessible
      const input = page.locator('input[name="testMessage"]');
      const box = await input.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(40);
    });
  });
});