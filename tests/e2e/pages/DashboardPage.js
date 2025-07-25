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
}

module.exports = { DashboardPage };