class WhatsAppPage {
  constructor(page) {
    this.page = page;
    
    // Connection elements
    this.qrCodeContainer = page.locator('.qr-code-container');
    this.qrCodeImage = page.locator('.qr-code-container img');
    this.connectionStatus = page.locator('.connection-status');
    this.reconnectButton = page.locator('button:has-text("Reconnect")');
    
    // Whitelist elements
    this.whitelistSection = page.locator('.whitelist-section');
    this.whitelistNumbers = page.locator('.whitelist-numbers');
    this.phoneNumberInput = page.locator('input[placeholder*="phone number"]');
    this.addNumberButton = page.locator('button:has-text("Add Number")');
    
    // Commands section
    this.commandsSection = page.locator('.commands-section');
    this.commandsList = page.locator('.commands-list');
    
    // Analytics section
    this.analyticsSection = page.locator('.analytics-section');
    this.totalMessages = page.locator('.stat-total-messages');
    this.activeConversations = page.locator('.stat-active-conversations');
    this.queueJoins = page.locator('.stat-queue-joins');
    
    // Notification settings
    this.notificationSettings = page.locator('.notification-settings');
    this.welcomeMessageInput = page.locator('textarea[name="welcomeMessage"]');
    this.positionUpdateInput = page.locator('textarea[name="positionUpdateMessage"]');
    
    // Error handling
    this.errorContainer = page.locator('.error-container');
    this.errorMessage = page.locator('.error-message');
  }

  async navigateToSettings() {
    await this.page.goto('/whatsapp-settings');
    await this.page.waitForLoadState('networkidle');
  }

  async getConnectionStatus() {
    return await this.connectionStatus.textContent();
  }

  async isConnected() {
    const status = await this.getConnectionStatus();
    return status?.toLowerCase().includes('connected');
  }

  async reconnect() {
    await this.reconnectButton.click();
    await this.page.waitForTimeout(2000); // Wait for reconnection attempt
  }

  async addPhoneNumber(phoneNumber) {
    await this.phoneNumberInput.fill(phoneNumber);
    await this.addNumberButton.click();
  }

  async getWhitelistedNumbers() {
    const numbers = await this.whitelistNumbers.locator('.phone-number').allTextContents();
    return numbers;
  }

  async updateWelcomeMessage(message) {
    await this.welcomeMessageInput.clear();
    await this.welcomeMessageInput.fill(message);
    await this.page.click('button:has-text("Save Settings")');
  }

  async getAnalytics() {
    return {
      totalMessages: await this.totalMessages.textContent(),
      activeConversations: await this.activeConversations.textContent(),
      queueJoins: await this.queueJoins.textContent()
    };
  }

  async waitForQRCode() {
    await this.qrCodeImage.waitFor({ state: 'visible', timeout: 10000 });
  }

  async getAvailableCommands() {
    return await this.commandsList.locator('.command-item').allTextContents();
  }

  async hasError() {
    return await this.errorContainer.isVisible();
  }

  async getErrorMessage() {
    if (await this.hasError()) {
      return await this.errorMessage.textContent();
    }
    return null;
  }

  async enableNotification(notificationType) {
    const checkbox = this.page.locator(`input[name="${notificationType}Notification"]`);
    if (!(await checkbox.isChecked())) {
      await checkbox.check();
    }
  }

  async disableNotification(notificationType) {
    const checkbox = this.page.locator(`input[name="${notificationType}Notification"]`);
    if (await checkbox.isChecked()) {
      await checkbox.uncheck();
    }
  }

  async saveSettings() {
    await this.page.click('button:has-text("Save Settings")');
    await this.page.waitForTimeout(1000); // Wait for save
  }
}

module.exports = WhatsAppPage;