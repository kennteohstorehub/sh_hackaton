class LoginPage {
  constructor(page) {
    this.page = page;
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('.alert-danger');
    this.successMessage = page.locator('.alert-success');
    this.registerLink = page.locator('a[href="/auth/register"]');
  }

  async goto() {
    await this.page.goto('/auth/login');
  }

  async login(email, password) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async getErrorMessage() {
    return await this.errorMessage.textContent();
  }

  async getSuccessMessage() {
    return await this.successMessage.textContent();
  }

  async isLoggedIn() {
    // Check if redirected to dashboard
    await this.page.waitForURL('**/dashboard/**', { timeout: 5000 }).catch(() => false);
    return this.page.url().includes('/dashboard');
  }
}

module.exports = { LoginPage };