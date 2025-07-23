class DashboardPage {
  constructor(page) {
    this.page = page;
    this.welcomeMessage = page.locator('h1');
    this.queueCards = page.locator('.queue-card');
    this.createQueueButton = page.locator('a:has-text("Create New Queue")');
    this.statsCards = page.locator('.stat-card');
    this.logoutButton = page.locator('a[href="/auth/logout"]');
    
    // Navigation
    this.navDashboard = page.locator('a[href="/dashboard"]');
    this.navQueues = page.locator('a[href="/dashboard/queues"]');
    this.navCustomers = page.locator('a[href="/dashboard/customers"]');
    this.navAnalytics = page.locator('a[href="/dashboard/analytics"]');
    this.navSettings = page.locator('a[href="/dashboard/settings"]');
    
    // Stats
    this.activeQueuesCount = page.locator('[data-stat="active-queues"]');
    this.totalCustomersCount = page.locator('[data-stat="total-customers"]');
    this.avgWaitTime = page.locator('[data-stat="avg-wait-time"]');
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
}

module.exports = { DashboardPage };