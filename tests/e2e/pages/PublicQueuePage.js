class PublicQueuePage {
  constructor(page) {
    this.page = page;
    
    // Form elements with multiple possible selectors
    this.nameInput = page.locator('input[name="name"], input[name="customerName"], #customerName, #name');
    this.phoneInput = page.locator('input[name="phone"], input[name="customerPhone"], #customerPhone, #phone');
    this.partySizeSelect = page.locator('select[name="partySize"], #partySize');
    this.partySizeInput = page.locator('input[name="partySize"]');
    this.serviceTypeSelect = page.locator('select[name="serviceType"], select[name="service"], #serviceType');
    this.notesInput = page.locator('textarea[name="notes"], #customerNotes, #notes');
    
    // Form submission
    this.submitButton = page.locator('button[type="submit"], .submit-btn, .join-btn, button:has-text("Join Queue"), button:has-text("Submit")');
    
    // Success/Error messages
    this.successMessage = page.locator('.alert-success, .success-message, .confirmation');
    this.errorMessage = page.locator('.alert-danger, .error-message, .form-error');
    
    // Queue position display
    this.queuePosition = page.locator('.queue-position, .position-number, .queue-number, .customer-number');
    
    // Queue form container
    this.joinForm = page.locator('form, .join-form, #queueJoinForm, .queue-form, .customer-form');
  }

  async gotoPublicQueue(merchantId) {
    await this.page.goto(`http://localhost:3838/queue/join/${merchantId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async fillCustomerForm(customerData) {
    // Fill name
    if (await this.nameInput.count() > 0) {
      await this.nameInput.first().fill(customerData.name);
    }
    
    // Fill phone
    if (await this.phoneInput.count() > 0) {
      await this.phoneInput.first().fill(customerData.phone);
    }
    
    // Fill party size
    if (await this.partySizeSelect.count() > 0) {
      await this.partySizeSelect.first().selectOption(customerData.partySize.toString());
    } else if (await this.partySizeInput.count() > 0) {
      await this.partySizeInput.first().fill(customerData.partySize.toString());
    }
    
    // Fill service type if available
    if (customerData.serviceType && await this.serviceTypeSelect.count() > 0) {
      const options = await this.serviceTypeSelect.first().locator('option').allTextContents();
      const matchingOption = options.find(option => 
        option.toLowerCase().includes(customerData.serviceType.toLowerCase())
      );
      if (matchingOption) {
        await this.serviceTypeSelect.first().selectOption({ label: matchingOption });
      }
    }
    
    // Fill notes if available
    if (customerData.notes && await this.notesInput.count() > 0) {
      await this.notesInput.first().fill(customerData.notes);
    }
  }

  async submitForm() {
    if (await this.submitButton.count() > 0) {
      await this.submitButton.first().click();
      await this.page.waitForLoadState('networkidle');
      return true;
    }
    return false;
  }

  async joinQueue(customerData) {
    await this.fillCustomerForm(customerData);
    return await this.submitForm();
  }

  async getSuccessMessage() {
    if (await this.successMessage.count() > 0) {
      return await this.successMessage.first().textContent();
    }
    return null;
  }

  async getErrorMessage() {
    if (await this.errorMessage.count() > 0) {
      return await this.errorMessage.first().textContent();
    }
    return null;
  }

  async getQueuePosition() {
    if (await this.queuePosition.count() > 0) {
      return await this.queuePosition.first().textContent();
    }
    return null;
  }

  async isFormVisible() {
    return await this.joinForm.count() > 0 && await this.joinForm.first().isVisible();
  }

  async hasSuccessIndicator() {
    // Check for success message
    if (await this.successMessage.count() > 0) {
      return true;
    }
    
    // Check for success in URL
    const currentUrl = this.page.url();
    return /success|thank|position|confirmation/i.test(currentUrl);
  }

  async validateFormFields() {
    const validation = {
      hasNameField: await this.nameInput.count() > 0,
      hasPhoneField: await this.phoneInput.count() > 0,
      hasPartySizeField: (await this.partySizeSelect.count() > 0) || (await this.partySizeInput.count() > 0),
      hasSubmitButton: await this.submitButton.count() > 0,
      hasForm: await this.joinForm.count() > 0
    };
    
    return validation;
  }

  async takeScreenshot(filename) {
    await this.page.screenshot({ 
      path: `test-results/${filename}`,
      fullPage: true 
    });
  }
}

module.exports = { PublicQueuePage };