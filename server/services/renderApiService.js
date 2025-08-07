const logger = require('../utils/logger');

/**
 * Service to interact with Render.com API
 * Handles subdomain provisioning and management
 */
class RenderApiService {
  constructor() {
    this.apiKey = process.env.RENDER_API_KEY;
    this.serviceId = process.env.RENDER_SERVICE_ID;
    this.apiUrl = 'https://api.render.com/v1';
    this.baseDomain = process.env.BASE_DOMAIN || 'storehubqms.com';
    this.mockMode = process.env.MOCK_RENDER_API === 'true';
    
    if (this.mockMode) {
      logger.info('Render API running in mock mode for local development');
    }
  }

  /**
   * Check if API is configured
   */
  isConfigured() {
    if (this.mockMode) {
      return true; // Always return true in mock mode
    }
    return !!(this.apiKey && this.serviceId);
  }

  /**
   * Make API request to Render
   */
  async makeRequest(endpoint, options = {}) {
    if (!this.isConfigured()) {
      logger.warn('Render API not configured. Skipping subdomain provisioning.');
      return null;
    }

    // Mock mode for local development
    if (this.mockMode) {
      logger.info(`[MOCK] Render API request: ${options.method || 'GET'} ${endpoint}`);
      
      // Simulate successful responses
      if (endpoint.includes('/custom-domains') && options.method === 'POST') {
        return {
          id: 'mock-domain-id',
          name: JSON.parse(options.body).name,
          verified: true,
          createdAt: new Date().toISOString()
        };
      }
      
      if (endpoint.includes('/custom-domains') && options.method === 'GET') {
        return {
          id: 'mock-domain-id',
          name: 'mock.domain',
          verified: true,
          status: 'verified',
          sslStatus: 'issued'
        };
      }
      
      return { success: true, mock: true };
    }

    try {
      const response = await fetch(`${this.apiUrl}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Render API error: ${response.status}`);
      }

      return data;
    } catch (error) {
      logger.error('Render API request failed:', error);
      throw error;
    }
  }

  /**
   * Provision a new subdomain for a tenant
   */
  async provisionSubdomain(tenant) {
    const subdomain = `${tenant.slug}.${this.baseDomain}`;
    
    logger.info(`Provisioning subdomain: ${subdomain}`);

    try {
      // Add custom domain to Render service
      const result = await this.makeRequest(`/services/${this.serviceId}/custom-domains`, {
        method: 'POST',
        body: JSON.stringify({
          name: subdomain
        })
      });

      logger.info(`Subdomain provisioned successfully: ${subdomain}`, result);
      
      // Wait for SSL certificate provisioning
      await this.waitForSSL(subdomain);
      
      return result;
    } catch (error) {
      logger.error(`Failed to provision subdomain ${subdomain}:`, error);
      throw error;
    }
  }

  /**
   * Remove a subdomain
   */
  async removeSubdomain(subdomain) {
    if (!subdomain.endsWith(this.baseDomain)) {
      subdomain = `${subdomain}.${this.baseDomain}`;
    }

    logger.info(`Removing subdomain: ${subdomain}`);

    try {
      await this.makeRequest(`/services/${this.serviceId}/custom-domains/${subdomain}`, {
        method: 'DELETE'
      });

      logger.info(`Subdomain removed successfully: ${subdomain}`);
    } catch (error) {
      logger.error(`Failed to remove subdomain ${subdomain}:`, error);
      throw error;
    }
  }

  /**
   * List all custom domains
   */
  async listDomains() {
    try {
      const service = await this.makeRequest(`/services/${this.serviceId}`);
      return service.customDomains || [];
    } catch (error) {
      logger.error('Failed to list domains:', error);
      return [];
    }
  }

  /**
   * Check domain status
   */
  async checkDomainStatus(subdomain) {
    if (!subdomain.endsWith(this.baseDomain)) {
      subdomain = `${subdomain}.${this.baseDomain}`;
    }

    try {
      const domains = await this.listDomains();
      const domain = domains.find(d => d.name === subdomain);
      
      return {
        exists: !!domain,
        status: domain?.verificationStatus || 'not_found',
        sslStatus: domain?.sslStatus || 'not_found',
        createdAt: domain?.createdAt,
        verifiedAt: domain?.verifiedAt
      };
    } catch (error) {
      logger.error(`Failed to check domain status for ${subdomain}:`, error);
      return {
        exists: false,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Wait for SSL certificate to be provisioned
   */
  async waitForSSL(subdomain, maxAttempts = 30, interval = 10000) {
    // Skip SSL wait in mock mode
    if (this.mockMode) {
      logger.info(`[MOCK] SSL certificate immediately ready for ${subdomain}`);
      return true;
    }
    
    logger.info(`Waiting for SSL certificate for ${subdomain}...`);
    
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.checkDomainStatus(subdomain);
      
      if (status.sslStatus === 'issued') {
        logger.info(`SSL certificate issued for ${subdomain}`);
        return true;
      }
      
      if (status.sslStatus === 'failed') {
        throw new Error(`SSL certificate provisioning failed for ${subdomain}`);
      }
      
      logger.info(`SSL status for ${subdomain}: ${status.sslStatus}. Attempt ${i + 1}/${maxAttempts}`);
      
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    
    logger.warn(`SSL certificate not ready for ${subdomain} after ${maxAttempts} attempts`);
    return false;
  }

  /**
   * Verify subdomain DNS configuration
   */
  async verifyDNS(subdomain) {
    if (!subdomain.endsWith(this.baseDomain)) {
      subdomain = `${subdomain}.${this.baseDomain}`;
    }

    try {
      const dns = require('dns').promises;
      const records = await dns.resolveCname(subdomain);
      
      logger.info(`DNS records for ${subdomain}:`, records);
      
      // Check if CNAME points to Render
      const isValid = records.some(record => 
        record.includes('onrender.com') || 
        record.includes('render.com')
      );
      
      return {
        configured: isValid,
        records
      };
    } catch (error) {
      if (error.code === 'ENOTFOUND') {
        return {
          configured: false,
          error: 'DNS record not found'
        };
      }
      
      logger.error(`DNS verification failed for ${subdomain}:`, error);
      return {
        configured: false,
        error: error.message
      };
    }
  }

  /**
   * Get service information
   */
  async getServiceInfo() {
    try {
      const service = await this.makeRequest(`/services/${this.serviceId}`);
      return {
        id: service.id,
        name: service.name,
        type: service.type,
        region: service.region,
        status: service.suspended ? 'suspended' : 'active',
        url: service.serviceDetails?.url,
        customDomains: service.customDomains || []
      };
    } catch (error) {
      logger.error('Failed to get service info:', error);
      throw error;
    }
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      await this.makeRequest('/services');
      return { success: true, message: 'Render API connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = new RenderApiService();