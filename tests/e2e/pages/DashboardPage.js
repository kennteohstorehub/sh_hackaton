class DashboardPage {
  constructor(page) {
    this.page = page;
    this.welcomeMessage = page.locator('h1');
    this.queueCards = page.locator('.queue-card');
    this.createQueueButton = page.locator('a:has-text("Create New Queue")');
    this.statsCards = page.locator('.stat-card');
    this.logoutButton = page.locator('button[type="submit"]:has-text("Logout")');
    
    // Navigation
    this.navDashboard = page.locator('nav a[href="/dashboard"]');
    this.navQueues = page.locator('a[href="/dashboard/queues"]');
    this.navCustomers = page.locator('a[href="/dashboard/customers"]');
    this.navAnalytics = page.locator('nav a[href="/dashboard/analytics"]');
    this.navSettings = page.locator('nav a[href="/dashboard/settings"]');
    this.navWhatsApp = page.locator('nav a[href="/dashboard/whatsapp-setup"]');
    this.navHelp = page.locator('nav a[href="/dashboard/help"]');
    
    // Stats
    this.activeQueuesCount = page.locator('#totalWaitingCount');
    this.totalCustomersCount = page.locator('.stat-card:nth-child(3) .stat-number');
    this.avgWaitTime = page.locator('#averageWaitTime');
    
    // Queue Management Elements
    this.waitingCount = page.locator('.waiting-count, .queue-stats .number, [data-waiting-count], .stat-waiting, .customers-waiting');
    this.currentServing = page.locator('.current-serving, .serving-number, .now-serving');
    this.customerEntries = page.locator('.queue-entry, .customer-card, .waiting-customer, .customer-item');
    this.publicViewButton = page.locator('a:has-text("View Public"), button:has-text("View Public"), a:has-text("Public View"), button:has-text("Public View"), a:has-text("Customer View"), .btn-public-view, [href*="queue/join"], [data-action="public-view"]');
    
    // Customer Action Buttons
    this.seatButtons = page.locator('button:has-text("Seat"), button:has-text("Call Next"), button:has-text("Serve"), button:has-text("Ready"), .seat-btn, .call-btn, .serve-btn, [data-action="seat"], [data-action="call"], [data-action="serve"]');
    this.notifyButtons = page.locator('button.btn-notify, .notify-btn, button:has-text("Notify"), [data-action="notify"]');
    
    // Status Indicators
    this.connectionStatus = page.locator('#connection-status, .connection-status, .ws-status, [data-connection-status]');
    this.seatedCustomers = page.locator('.seated-customer, .customer-seated, .status-seated');
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async getWelcomeText() {
    return await this.welcomeMessage.textContent();
  }

  async getQueueCount() {
    return await this.queueCards.count();
  }

  async navigateToQueues() {
    await this.navQueues.click();
    await this.page.waitForURL('**/dashboard/queues');
  }

  async navigateToCustomers() {
    await this.navCustomers.click();
    await this.page.waitForURL('**/dashboard/customers');
  }

  async navigateToAnalytics() {
    await this.navAnalytics.click();
    await this.page.waitForURL('**/dashboard/analytics');
  }

  async navigateToSettings() {
    await this.navSettings.click();
    await this.page.waitForURL('**/dashboard/settings');
  }

  async logout() {
    await this.logoutButton.click();
  }

  async getStats() {
    return {
      activeQueues: await this.activeQueuesCount.textContent(),
      totalCustomers: await this.totalCustomersCount.textContent(),
      avgWaitTime: await this.avgWaitTime.textContent()
    };
  }

  async navigateToWhatsApp() {
    await this.navWhatsApp.click();
    await this.page.waitForURL('**/dashboard/whatsapp-setup');
  }

  async navigateToHelp() {
    await this.navHelp.click();
    await this.page.waitForURL('**/dashboard/help');
  }

  // Queue Management Methods
  async getWaitingCount() {
    if (await this.waitingCount.count() > 0) {
      const countText = await this.waitingCount.first().textContent();
      return parseInt(countText.replace(/\D/g, '')) || 0;
    }
    return 0;
  }

  async getCurrentServing() {
    if (await this.currentServing.count() > 0) {
      return await this.currentServing.first().textContent();
    }
    return null;
  }

  async findCustomerByName(customerName) {
    const customerEntries = await this.customerEntries.all();
    for (const entry of customerEntries) {
      const text = await entry.textContent();
      if (text.includes(customerName)) {
        return entry;
      }
    }
    return null;
  }

  async findCustomerByPhone(customerPhone) {
    const customerEntries = await this.customerEntries.all();
    for (const entry of customerEntries) {
      const text = await entry.textContent();
      if (text.includes(customerPhone)) {
        return entry;
      }
    }
    return null;
  }

  async clickPublicView() {
    if (await this.publicViewButton.count() > 0) {
      await this.publicViewButton.first().click();
      return true;
    }
    return false;
  }

  async getPublicViewUrl() {
    if (await this.publicViewButton.count() > 0) {
      const href = await this.publicViewButton.first().getAttribute('href');
      return href;
    }
    return null;
  }

  async seatCustomer(customerElement = null) {
    let seatButton;
    
    if (customerElement) {
      // Look for seat button within specific customer entry
      seatButton = customerElement.locator('button:has-text("Seat"), button:has-text("Call Next"), button:has-text("Serve"), .seat-btn, .call-btn, .serve-btn');
    } else {
      // Use the first available seat button
      seatButton = this.seatButtons.first();
    }
    
    if (await seatButton.count() > 0) {
      await seatButton.first().click();
      return true;
    }
    return false;
  }

  async notifyCustomer(customerElement = null) {
    let notifyButton;
    
    if (customerElement) {
      // Look for notify button within specific customer entry
      notifyButton = customerElement.locator('button:has-text("Notify"), .notify-btn, [data-action="notify"]');
    } else {
      // Use the first available notify button
      notifyButton = this.notifyButtons.first();
    }
    
    if (await notifyButton.count() > 0) {
      await notifyButton.first().click();
      return true;
    }
    return false;
  }

  async getConnectionStatus() {
    if (await this.connectionStatus.count() > 0) {
      const statusText = await this.connectionStatus.first().textContent();
      const element = this.connectionStatus.first();
      
      const isConnected = await element.evaluate(el => {
        return el.classList.contains('connected') || 
               el.classList.contains('online') ||
               el.textContent.toLowerCase().includes('connected');
      });
      
      return {
        text: statusText,
        isConnected: isConnected
      };
    }
    return { text: 'Unknown', isConnected: false };
  }

  async getSeatedCustomersCount() {
    return await this.seatedCustomers.count();
  }

  async waitForCustomerUpdate(timeoutMs = 5000) {
    // Wait for potential real-time updates
    await this.page.waitForTimeout(Math.min(timeoutMs, 5000));
  }

  async extractMerchantId() {
    // Try to extract merchant ID from page context
    const merchantId = await this.page.evaluate(() => {
      return window.merchantId || 
             document.querySelector('[data-merchant-id]')?.dataset.merchantId ||
             localStorage.getItem('merchantId') ||
             sessionStorage.getItem('merchantId');
    });
    
    if (merchantId) {
      return merchantId;
    }
    
    // Try to extract from URL
    const currentUrl = this.page.url();
    const urlMatch = currentUrl.match(/merchant[\/=]([a-f0-9-]+)/i);
    if (urlMatch) {
      return urlMatch[1];
    }
    
    return null;
  }

  async takeScreenshot(filename) {
    await this.page.screenshot({ 
      path: `test-results/${filename}`,
      fullPage: true 
    });
  }
}

module.exports = { DashboardPage };