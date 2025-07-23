class QueueManagementPage {
  constructor(page) {
    this.page = page;
    
    // Queue List
    this.queueTable = page.locator('table.queue-table');
    this.queueRows = page.locator('table.queue-table tbody tr');
    this.createQueueButton = page.locator('button:has-text("Create Queue")');
    
    // Queue Form
    this.queueNameInput = page.locator('input[name="name"]');
    this.queueDescriptionInput = page.locator('textarea[name="description"]');
    this.maxCapacityInput = page.locator('input[name="maxCapacity"]');
    this.avgServiceTimeInput = page.locator('input[name="averageServiceTime"]');
    this.saveQueueButton = page.locator('button[type="submit"]:has-text("Save")');
    
    // Queue Actions
    this.editButtons = page.locator('button:has-text("Edit")');
    this.deleteButtons = page.locator('button:has-text("Delete")');
    this.viewButtons = page.locator('a:has-text("View")');
    
    // Queue Details
    this.queueStatus = page.locator('.queue-status');
    this.currentServingNumber = page.locator('.current-serving');
    this.waitingCount = page.locator('.waiting-count');
    this.addCustomerButton = page.locator('button:has-text("Add Customer")');
    
    // Customer Form
    this.customerNameInput = page.locator('input[name="customerName"]');
    this.customerPhoneInput = page.locator('input[name="customerPhone"]');
    this.partySizeInput = page.locator('input[name="partySize"]');
    this.notesInput = page.locator('textarea[name="notes"]');
    this.addToQueueButton = page.locator('button:has-text("Add to Queue")');
    
    // Customer Actions
    this.callNextButton = page.locator('button:has-text("Call Next")');
    this.markNoShowButton = page.locator('button:has-text("Mark No Show")');
    this.completeServiceButton = page.locator('button:has-text("Complete Service")');
  }

  async goto() {
    await this.page.goto('/dashboard/queues');
  }

  async createQueue(queueData) {
    await this.createQueueButton.click();
    await this.queueNameInput.fill(queueData.name);
    await this.queueDescriptionInput.fill(queueData.description || '');
    await this.maxCapacityInput.fill(queueData.maxCapacity?.toString() || '50');
    await this.avgServiceTimeInput.fill(queueData.avgServiceTime?.toString() || '30');
    await this.saveQueueButton.click();
  }

  async getQueueCount() {
    return await this.queueRows.count();
  }

  async viewQueue(queueName) {
    const row = this.queueRows.filter({ hasText: queueName });
    await row.locator('a:has-text("View")').click();
  }

  async addCustomerToQueue(customerData) {
    await this.addCustomerButton.click();
    await this.customerNameInput.fill(customerData.name);
    await this.customerPhoneInput.fill(customerData.phone);
    await this.partySizeInput.fill(customerData.partySize?.toString() || '1');
    if (customerData.notes) {
      await this.notesInput.fill(customerData.notes);
    }
    await this.addToQueueButton.click();
  }

  async callNext() {
    await this.callNextButton.click();
  }

  async getCurrentServing() {
    return await this.currentServingNumber.textContent();
  }

  async getWaitingCount() {
    return await this.waitingCount.textContent();
  }

  async deleteQueue(queueName) {
    const row = this.queueRows.filter({ hasText: queueName });
    await row.locator('button:has-text("Delete")').click();
    // Confirm deletion
    await this.page.locator('button:has-text("Confirm")').click();
  }
}

module.exports = { QueueManagementPage };